import { afterEach, describe, expect, test, vi } from "vitest";
import { InteractiveMode } from "../../../src/modes/interactive/interactive-mode.ts";

// Regression for https://github.com/earendil-works/pi/issues/5724
// 针对 https://github.com/earendil-works/pi/issues/5724 的回归测试
//
// `proper-lockfile` installs `signal-exit`, whose signal listener re-sends
// SIGTERM/SIGHUP when it observes no other process listeners during the same
// signal dispatch.
// `proper-lockfile` 会引入 `signal-exit`，其信号监听器在同一次信号派发过程中若发现
// 没有其他进程监听器，就会重新发送一次 SIGTERM/SIGHUP。
// InteractiveMode must therefore keep its signal handlers
// registered until async terminal cleanup has completed.
// 因此 InteractiveMode 必须保持其信号处理器处于注册状态，直到异步的终端清理工作完成为止。

type ShutdownThis = {
	isShuttingDown: boolean;
	unregisterSignalHandlers: () => void;
	runtimeHost: { dispose: () => Promise<void> };
	ui: { terminal: { drainInput: (ms: number) => Promise<void> } };
	themeController: { disableAutoSync: () => void };
	stop: () => void;
};

type InteractiveModePrototypeWithShutdown = {
	shutdown(this: ShutdownThis, options?: { fromSignal?: boolean }): Promise<void>;
};

const interactiveModePrototype = InteractiveMode.prototype as unknown;

class ProcessExitError extends Error {}

function deferred(): { promise: Promise<void>; resolve: () => void } {
	let resolve: (() => void) | undefined;
	const promise = new Promise<void>((res) => {
		resolve = res;
	});
	return {
		promise,
		resolve: () => resolve?.(),
	};
}

async function callShutdown(context: ShutdownThis, options?: { fromSignal?: boolean }): Promise<void> {
	try {
		await (interactiveModePrototype as InteractiveModePrototypeWithShutdown).shutdown.call(context, options);
	} catch (error) {
		if (!(error instanceof ProcessExitError)) throw error;
	}
}

describe("InteractiveMode SIGTERM shutdown with signal-exit (#5724)", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	test("keeps signal handlers registered while signal-triggered cleanup is pending", async () => {
		vi.spyOn(process, "exit").mockImplementation((() => {
			throw new ProcessExitError();
		}) as typeof process.exit);

		const order: string[] = [];
		const dispose = deferred();
		const context: ShutdownThis = {
			isShuttingDown: false,
			unregisterSignalHandlers: vi.fn(() => {
				order.push("unregister");
			}),
			runtimeHost: {
				dispose: vi.fn(() => {
					order.push("dispose");
					return dispose.promise;
				}),
			},
			ui: {
				terminal: {
					drainInput: vi.fn(async () => {
						order.push("drainInput");
					}),
				},
			},
			themeController: { disableAutoSync: vi.fn() },
			stop: vi.fn(() => {
				order.push("stop");
			}),
		};

		const shutdownPromise = callShutdown(context, { fromSignal: true });
		await Promise.resolve();

		expect(order).toEqual(["dispose"]);
		expect(context.unregisterSignalHandlers).not.toHaveBeenCalled();

		dispose.resolve();
		await shutdownPromise;

		expect(order).toEqual(["dispose", "drainInput", "stop"]);
	});
});
