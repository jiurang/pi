/**
 * Interactive Shell Commands Extension
 * 交互式 Shell 命令扩展
 *
 * Enables running interactive commands (vim, git rebase -i, htop, etc.)
 * with full terminal access.
 * 支持在拥有完整终端控制权的情况下运行交互式命令(vim、git rebase -i、htop 等)。
 * The TUI suspends while they run.
 * 这些命令运行期间 TUI 会被挂起。
 *
 * Usage:
 * 用法：
 *   pi -e examples/extensions/interactive-shell.ts
 *
 *   !vim file.txt        # Auto-detected as interactive
 *                        # 自动识别为交互式命令
 *   !i any-command       # Force interactive mode with !i prefix
 *                        # 使用 !i 前缀强制以交互模式运行
 *   !git rebase -i HEAD~3
 *   !htop
 *
 * Configuration via environment variables:
 * 通过环境变量进行配置：
 *   INTERACTIVE_COMMANDS - Additional commands (comma-separated)
 *                          追加的命令列表(以逗号分隔)
 *   INTERACTIVE_EXCLUDE  - Commands to exclude (comma-separated)
 *                          需要排除的命令列表(以逗号分隔)
 *
 * Note: This only intercepts user `!` commands, not agent bash tool calls.
 * 注意：本扩展只拦截用户输入的 `!` 命令，不会拦截 agent 发起的 bash 工具调用。
 * If the agent runs an interactive command, it will fail (which is fine).
 * 如果 agent 运行了交互式命令，该命令会执行失败(这是预期行为)。
 */

import { spawnSync } from "node:child_process";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Default interactive commands - editors, pagers, git ops, TUIs
// 默认的交互式命令 —— 编辑器、分页器、git 操作、终端界面(TUI)程序
const DEFAULT_INTERACTIVE_COMMANDS = [
	// Editors
	// 编辑器
	"vim",
	"nvim",
	"vi",
	"nano",
	"emacs",
	"pico",
	"micro",
	"helix",
	"hx",
	"kak",
	// Pagers
	// 分页器
	"less",
	"more",
	"most",
	// Git interactive
	// Git 交互式操作
	"git commit",
	"git rebase",
	"git merge",
	"git cherry-pick",
	"git revert",
	"git add -p",
	"git add --patch",
	"git add -i",
	"git add --interactive",
	"git stash -p",
	"git stash --patch",
	"git reset -p",
	"git reset --patch",
	"git checkout -p",
	"git checkout --patch",
	"git difftool",
	"git mergetool",
	// System monitors
	// 系统监控工具
	"htop",
	"top",
	"btop",
	"glances",
	// File managers
	// 文件管理器
	"ranger",
	"nnn",
	"lf",
	"mc",
	"vifm",
	// Git TUIs
	// Git 终端界面(TUI)工具
	"tig",
	"lazygit",
	"gitui",
	// Fuzzy finders
	// 模糊查找工具
	"fzf",
	"sk",
	// Remote sessions
	// 远程会话
	"ssh",
	"telnet",
	"mosh",
	// Database clients
	// 数据库客户端
	"psql",
	"mysql",
	"sqlite3",
	"mongosh",
	"redis-cli",
	// Kubernetes/Docker
	// Kubernetes / Docker 相关
	"kubectl edit",
	"kubectl exec -it",
	"docker exec -it",
	"docker run -it",
	// Other
	// 其他
	"tmux",
	"screen",
	"ncdu",
];

function getInteractiveCommands(): string[] {
	const additional =
		process.env.INTERACTIVE_COMMANDS?.split(",")
			.map((s) => s.trim())
			.filter(Boolean) ?? [];
	const excluded = new Set(process.env.INTERACTIVE_EXCLUDE?.split(",").map((s) => s.trim().toLowerCase()) ?? []);
	return [...DEFAULT_INTERACTIVE_COMMANDS, ...additional].filter((cmd) => !excluded.has(cmd.toLowerCase()));
}

function isInteractiveCommand(command: string): boolean {
	const trimmed = command.trim().toLowerCase();
	const commands = getInteractiveCommands();

	for (const cmd of commands) {
		const cmdLower = cmd.toLowerCase();
		// Match at start
		// 在命令开头处匹配
		if (trimmed === cmdLower || trimmed.startsWith(`${cmdLower} `) || trimmed.startsWith(`${cmdLower}\t`)) {
			return true;
		}
		// Match after pipe: "cat file | less"
		// 在管道符之后匹配，例如："cat file | less"
		const pipeIdx = trimmed.lastIndexOf("|");
		if (pipeIdx !== -1) {
			const afterPipe = trimmed.slice(pipeIdx + 1).trim();
			if (afterPipe === cmdLower || afterPipe.startsWith(`${cmdLower} `)) {
				return true;
			}
		}
	}
	return false;
}

export default function (pi: ExtensionAPI) {
	pi.on("user_bash", async (event, ctx) => {
		let command = event.command;
		let forceInteractive = false;

		// Check for !i prefix (command comes without the leading !)
		// 检查是否带有 !i 前缀(传入的命令已不含开头的 !)
		// The prefix parsing happens before this event, so we check if command starts with "i "
		// 前缀解析发生在本事件之前，因此这里只需判断命令是否以 "i " 开头
		if (command.startsWith("i ") || command.startsWith("i\t")) {
			forceInteractive = true;
			command = command.slice(2).trim();
		}

		const shouldBeInteractive = forceInteractive || isInteractiveCommand(command);
		if (!shouldBeInteractive) {
			return; // Let normal handling proceed 交由常规流程继续处理
		}

		// No UI available (print mode, RPC, etc.)
		// 当前没有可用的 UI(print 模式、RPC 模式等)
		if (ctx.mode !== "tui") {
			return {
				result: { output: "(interactive commands require TUI)", exitCode: 1, cancelled: false, truncated: false },
			};
		}

		// Use ctx.ui.custom() to get TUI access, then run the command
		// 通过 ctx.ui.custom() 获取对 TUI 的控制权，然后执行该命令
		const exitCode = await ctx.ui.custom<number | null>((tui, _theme, _kb, done) => {
			// Stop TUI to release terminal
			// 停止 TUI 以释放终端
			tui.stop();

			// Clear screen
			// 清屏
			process.stdout.write("\x1b[2J\x1b[H");

			// Run command with full terminal access
			// 在拥有完整终端控制权的情况下运行命令
			const shell = process.env.SHELL || "/bin/sh";
			const result = spawnSync(shell, ["-c", command], {
				stdio: "inherit",
				env: process.env,
			});

			// Restart TUI
			// 重新启动 TUI
			tui.start();
			tui.requestRender(true);

			// Signal completion
			// 发出完成信号
			done(result.status);

			// Return empty component (immediately disposed since done() was called)
			// 返回一个空组件(由于已调用 done()，它会被立即销毁)
			return { render: () => [], invalidate: () => {} };
		});

		// Return result to prevent default bash handling
		// 返回执行结果，以阻止默认的 bash 处理流程
		const output =
			exitCode === 0
				? "(interactive command completed successfully)"
				: `(interactive command exited with code ${exitCode})`;

		return {
			result: {
				output,
				exitCode: exitCode ?? 1,
				cancelled: false,
				truncated: false,
			},
		};
	});
}
