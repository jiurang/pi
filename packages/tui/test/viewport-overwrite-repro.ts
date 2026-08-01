/**
 * TUI viewport overwrite repro
 * TUI 视口（viewport）内容被覆盖问题的复现脚本
 *
 * Place this file at: packages/tui/test/viewport-overwrite-repro.ts
 * 请将该文件放置于：packages/tui/test/viewport-overwrite-repro.ts
 * Run from repo root: npx tsx packages/tui/test/viewport-overwrite-repro.ts
 * 在仓库根目录运行：npx tsx packages/tui/test/viewport-overwrite-repro.ts
 *
 * For reliable repro, run in a small terminal (8-12 rows) or a tmux session:
 * 为稳定复现该问题，请在较小的终端（8-12 行）或 tmux 会话中运行：
 *   tmux new-session -d -s tui-bug -x 80 -y 12
 *   tmux send-keys -t tui-bug "npx tsx packages/tui/test/viewport-overwrite-repro.ts" Enter
 *   tmux attach -t tui-bug
 *
 * Expected behavior:
 * 预期行为：
 * - PRE-TOOL lines remain visible above tool output.
 * - PRE-TOOL 行应保持可见，位于工具输出的上方。
 * - POST-TOOL lines append after tool output without overwriting earlier content.
 * - POST-TOOL 行应追加在工具输出之后，且不覆盖此前的内容。
 *
 * Actual behavior (bug):
 * 实际行为（缺陷 bug）：
 * - When content exceeds the viewport and new lines arrive after a tool-call pause,
 * - 当内容超出视口，且在工具调用暂停之后有新行到达时，
 *   some earlier PRE-TOOL lines near the bottom are overwritten by POST-TOOL lines.
 *   靠近底部的部分早先 PRE-TOOL 行会被 POST-TOOL 行覆盖。
 */

import { TuiMainScreen } from "../src/TuiMainScreen.ts";
import { ProcessTerminal } from "../src/terminal.ts";
import type { Component, TUI } from "../src/tui.ts";

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

class Lines implements Component {
	private lines: string[] = [];

	set(lines: string[]): void {
		this.lines = lines;
	}

	append(lines: string[]): void {
		this.lines.push(...lines);
	}

	render(width: number): string[] {
		return this.lines.map((line) => {
			if (line.length > width) return line.slice(0, width);
			return line.padEnd(width, " ");
		});
	}

	invalidate(): void {}
}

async function streamLines(buffer: Lines, label: string, count: number, delayMs: number, ui: TUI): Promise<void> {
	for (let i = 1; i <= count; i += 1) {
		buffer.append([`${label} ${String(i).padStart(2, "0")}`]);
		ui.requestRender();
		await sleep(delayMs);
	}
}

async function main(): Promise<void> {
	const ui: TUI = new TuiMainScreen(new ProcessTerminal());
	const buffer = new Lines();
	ui.addChild(buffer);
	ui.start();

	const height = ui.terminal.rows;
	const preCount = height + 8; // Ensure content exceeds viewport | 确保内容超出视口范围
	const toolCount = height + 12; // Tool output pushes further into scrollback | 工具输出将内容进一步推入回滚缓冲区（scrollback）
	const postCount = 6;

	buffer.set([
		"TUI viewport overwrite repro",
		`Viewport rows detected: ${height}`,
		"(Resize to ~8-12 rows for best repro)",
		"",
		"=== PRE-TOOL STREAM ===",
	]);
	ui.requestRender();
	await sleep(300);

	// Phase 1: Stream pre-tool text until viewport is exceeded.
	// 阶段 1：流式输出工具调用前的文本，直到超出视口范围。
	await streamLines(buffer, "PRE-TOOL LINE", preCount, 30, ui);

	// Phase 2: Simulate tool call pause and tool output.
	// 阶段 2：模拟工具调用的暂停以及工具输出。
	buffer.append(["", "--- TOOL CALL START ---", "(pause...)", ""]);
	ui.requestRender();
	await sleep(700);

	await streamLines(buffer, "TOOL OUT", toolCount, 20, ui);

	// Phase 3: Post-tool streaming. This is where overwrite often appears.
	// 阶段 3：工具调用后的流式输出。内容覆盖问题通常就出现在此处。
	buffer.append(["", "=== POST-TOOL STREAM ==="]);
	ui.requestRender();
	await sleep(300);
	await streamLines(buffer, "POST-TOOL LINE", postCount, 40, ui);

	// Leave the output visible briefly, then restore terminal state.
	// 让输出短暂保持可见，随后恢复终端状态。
	await sleep(1500);
	ui.stop();
}

main().catch((error) => {
	// Ensure terminal is restored if something goes wrong.
	// 确保出现异常时终端状态能够被恢复。
	try {
		const ui: TUI = new TuiMainScreen(new ProcessTerminal());
		ui.stop();
	} catch {
		// Ignore restore errors.
		// 忽略恢复过程中的错误。
	}
	process.stderr.write(`${String(error)}\n`);
	process.exitCode = 1;
});
