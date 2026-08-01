#!/usr/bin/env node
import { matchesKey } from "../src/keys.ts";
import { TuiMainScreen } from "../src/TuiMainScreen.ts";
import { ProcessTerminal } from "../src/terminal.ts";
import type { Component, TUI } from "../src/tui.ts";
import { truncateToWidth } from "../src/utils.ts";

/**
 * Simple key code logger component
 * 简易的按键码日志组件
 */
class KeyLogger implements Component {
	private log: string[] = [];
	private maxLines = 20;
	private tui: TUI;
	private terminal: ProcessTerminal;

	constructor(tui: TUI, terminal: ProcessTerminal) {
		this.tui = tui;
		this.terminal = terminal;
	}

	handleInput(data: string): void {
		// Handle Ctrl+C (raw or Kitty protocol) for exit
		// 处理 Ctrl+C（原始序列或 Kitty 协议）以退出程序
		if (matchesKey(data, "ctrl+c")) {
			this.tui.stop();
			console.log("\nExiting...");
			process.exit(0);
		}

		// Convert to various representations
		// 转换为多种表示形式
		const hex = Buffer.from(data).toString("hex");
		const charCodes = Array.from(data)
			.map((c) => c.charCodeAt(0))
			.join(", ");
		const repr = data
			.replace(/\x1b/g, "\\x1b")
			.replace(/\r/g, "\\r")
			.replace(/\n/g, "\\n")
			.replace(/\t/g, "\\t")
			.replace(/\x7f/g, "\\x7f");

		const logLine = `Hex: ${hex.padEnd(20)} | Chars: [${charCodes.padEnd(15)}] | Repr: "${repr}"`;

		this.log.push(logLine);

		// Keep only last N lines
		// 仅保留最后 N 行
		if (this.log.length > this.maxLines) {
			this.log.shift();
		}

		// Request re-render to show the new log entry
		// 请求重新渲染以显示新的日志条目
		this.tui.requestRender();
	}

	invalidate(): void {
		// No cached state to invalidate currently
		// 目前没有需要失效（invalidate）的缓存状态
	}

	private protocolName(): string {
		if (this.terminal.kittyProtocolActive) return "kitty";
		if (this.terminal.modifyOtherKeysActive) return "modifyOtherKeys";
		return "legacy";
	}

	private fit(line: string, width: number): string {
		return truncateToWidth(line, width).padEnd(width);
	}

	render(width: number): string[] {
		const lines: string[] = [];

		// Title
		// 标题
		lines.push("=".repeat(width));
		lines.push(this.fit("Key Code Tester - Press keys to see their codes (Ctrl+C to exit)", width));
		lines.push(this.fit(`Protocol: ${this.protocolName()}`, width));
		lines.push("=".repeat(width));
		lines.push("");

		// Log entries
		// 日志条目
		for (const entry of this.log) {
			lines.push(this.fit(entry, width));
		}

		// Fill remaining space
		// 填充剩余空间
		const remaining = Math.max(0, 25 - lines.length);
		for (let i = 0; i < remaining; i++) {
			lines.push("".padEnd(width));
		}

		// Footer
		// 页脚
		lines.push("=".repeat(width));
		lines.push(this.fit("Test these:", width));
		lines.push(this.fit("  - Shift + Enter (should show: \\x1b[13;2u with Kitty protocol)", width));
		lines.push(this.fit("  - Alt/Option + Enter", width));
		lines.push(this.fit("  - Option/Alt + Backspace", width));
		lines.push(this.fit("  - Cmd/Ctrl + Backspace", width));
		lines.push(this.fit("  - Regular Backspace", width));
		lines.push("=".repeat(width));

		return lines;
	}
}

// Set up TUI
// 初始化 TUI
const terminal = new ProcessTerminal();
const tui: TUI = new TuiMainScreen(terminal);
const logger = new KeyLogger(tui, terminal);

tui.addChild(logger);
tui.setFocus(logger);

// Handle Ctrl+C for clean exit (SIGINT still works for raw mode)
// 处理 Ctrl+C 以实现干净退出（在原始模式 raw mode 下 SIGINT 依然有效）
process.on("SIGINT", () => {
	tui.stop();
	console.log("\nExiting...");
	process.exit(0);
});

// Start the TUI
// 启动 TUI
tui.start();

// Protocol negotiation completes asynchronously after the first render.
// 协议协商会在首次渲染之后异步完成。
// Refresh briefly/continuously so the displayed protocol state is not stale.
// 短周期持续刷新，以确保显示的协议状态不会过期。
setInterval(() => tui.requestRender(), 100);
