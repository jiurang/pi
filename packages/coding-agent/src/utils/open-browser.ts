import { spawn } from "node:child_process";

/**
 * Open a URL or file in the platform browser/default handler.
 * 使用平台浏览器/默认处理程序打开一个 URL 或文件。
 *
 * This intentionally never invokes a shell.
 * 此实现刻意不调用任何 shell。
 * On Windows, do not use `cmd /c start`: cmd.exe re-parses metacharacters
 * (&, |, ^, ...) before `start` runs, which would make attacker-controlled
 * URLs injectable.
 * 在 Windows 上不要使用 `cmd /c start`:cmd.exe 会在 `start` 执行前重新解析
 * 元字符(&、|、^ 等),这会使攻击者可控的 URL 具备注入风险。
 */
export function openBrowser(target: string): void {
	const [cmd, args]: [string, string[]] =
		process.platform === "darwin"
			? ["open", [target]]
			: process.platform === "win32"
				? ["rundll32", ["url.dll,FileProtocolHandler", target]]
				: ["xdg-open", [target]];

	// spawn reports launcher failures (for example, missing xdg-open) via an
	// error event. Browser launch is best-effort: callers still present the target
	// to the user, so keep the launcher failure from becoming a process crash.
	// spawn 会通过 error 事件报告启动器失败(例如缺少 xdg-open)。浏览器启动属于
	// 尽力而为(best-effort)的操作:调用方仍会把目标地址展示给用户,因此要避免
	// 启动器失败演变成进程崩溃。
	spawn(cmd, args, { stdio: "ignore", detached: true })
		.on("error", () => {})
		.unref();
}
