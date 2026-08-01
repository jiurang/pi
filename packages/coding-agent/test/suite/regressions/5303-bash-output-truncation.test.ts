import type { ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { spawnProcess, waitForChildProcess } from "../../../src/utils/child-process.ts";

/**
 * Regression test for https://github.com/earendil-works/pi/issues/5303
 * 针对 https://github.com/earendil-works/pi/issues/5303 的回归测试。
 *
 * waitForChildProcess armed a fixed 100ms timer on `exit` and destroyed the
 * stdio streams when it fired. When a short-lived detached descendant kept the
 * stdout pipe open, `close` never fired, so that timer was the only thing that
 * resolved the wait, and any output written more than 100ms after exit was
 * binned. In practice every git commit whose pre-commit hook runs lint-staged
 * came back truncated mid-listr2 output, read by the model as a hang.
 * waitForChildProcess 在 `exit` 时启动了一个固定 100ms 的定时器，并在触发时销毁
 * stdio 流。当一个短生命周期的分离(detached)子孙进程持续持有 stdout 管道时，
 * `close` 永远不会触发，于是该定时器成了唯一能结束等待的机制，任何在退出 100ms
 * 之后写出的输出都会被丢弃。实际表现是：每一次 pre-commit 钩子运行 lint-staged 的
 * git commit，返回的输出都会在 listr2 输出中途被截断，被模型误读为卡死。
 *
 * The fix re-arms the grace on each chunk, so an actively writing pipe keeps us
 * reading while a genuinely idle held-open handle still releases after the
 * grace elapses. Both behaviours are covered below.
 * 修复方案是在每个数据块(chunk)到达时重新启动宽限计时，这样持续写入的管道会让我们
 * 继续读取，而真正处于空闲的、被持有打开的句柄仍会在宽限期结束后释放。
 * 下面的测试覆盖了这两种行为。
 */
describe.skipIf(process.platform === "win32")("issue #5303 bash output truncation past exit", () => {
	let child: ChildProcessByStdio<null, Readable, Readable> | undefined;

	afterEach(() => {
		if (child?.pid) {
			try {
				process.kill(-child.pid, "SIGKILL");
			} catch {
				// Already gone.
				// 进程已经消失。
			}
		}
		child = undefined;
	});

	it("captures output emitted after exit while a detached child holds stdout open", async () => {
		// The shell exits immediately, but a backgrounded subshell keeps the stdout
		// pipe open and emits ticks every 50ms, the last well past the 100ms grace.
		// shell 会立即退出，但后台子 shell 会保持 stdout 管道打开，并每 50ms 输出一次
		// tick，最后一次远远超出 100ms 的宽限期。
		const command = 'printf "HEAD\\n"; ( for i in 1 2 3 4 5 6; do sleep 0.05; printf "TICK$i\\n"; done ) &';
		child = spawnProcess("/bin/sh", ["-c", command], {
			stdio: ["ignore", "pipe", "pipe"],
			detached: true,
		}) as ChildProcessByStdio<null, Readable, Readable>;

		let output = "";
		child.stdout.on("data", (chunk: Buffer) => {
			output += chunk.toString();
		});

		const exitCode = await waitForChildProcess(child);

		expect(exitCode).toBe(0);
		expect(output).toContain("HEAD");
		expect(output).toContain("TICK6");
	});

	it("resolves promptly when a detached child holds stdout open but stays quiet", async () => {
		// The shell exits, but a backgrounded sleeper inherits the stdout pipe and
		// keeps it open for a long time without writing. `close` never fires, so we
		// must still release via the idle grace rather than hang on the open handle.
		// shell 会退出，但后台的休眠进程继承了 stdout 管道，并在不写入任何内容的情况下
		// 长时间保持其打开。`close` 永远不会触发，因此我们必须依靠空闲宽限期来释放，
		// 而不是在这个打开的句柄上一直挂起。
		const command = 'printf "DONE\\n"; ( sleep 30 ) &';
		child = spawnProcess("/bin/sh", ["-c", command], {
			stdio: ["ignore", "pipe", "pipe"],
			detached: true,
		}) as ChildProcessByStdio<null, Readable, Readable>;

		let output = "";
		child.stdout.on("data", (chunk: Buffer) => {
			output += chunk.toString();
		});

		const start = Date.now();
		const exitCode = await waitForChildProcess(child);
		const elapsed = Date.now() - start;

		expect(exitCode).toBe(0);
		expect(output).toContain("DONE");
		// Must not wait for the 30s sleeper; the idle grace releases us in well under a second.
		// 不能等待那个 30 秒的休眠进程；空闲宽限期应当在远小于 1 秒的时间内让我们返回。
		expect(elapsed).toBeLessThan(2000);
	});
});
