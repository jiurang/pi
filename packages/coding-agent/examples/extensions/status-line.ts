/**
 * Status Line Extension
 * 状态行(Status Line)扩展
 *
 * Demonstrates ctx.ui.setStatus() for displaying persistent status text in the footer.
 * 演示如何使用 ctx.ui.setStatus() 在底部栏(footer)中持续显示状态文本。
 * Shows turn progress with themed colors.
 * 并以符合主题(theme)的配色展示每一轮(turn)的进度。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	let turnCount = 0;

	pi.on("session_start", async (_event, ctx) => {
		const theme = ctx.ui.theme;
		ctx.ui.setStatus("status-demo", theme.fg("dim", "Ready"));
	});

	pi.on("turn_start", async (_event, ctx) => {
		turnCount++;
		const theme = ctx.ui.theme;
		const spinner = theme.fg("accent", "●");
		const text = theme.fg("dim", ` Turn ${turnCount}...`);
		ctx.ui.setStatus("status-demo", spinner + text);
	});

	pi.on("turn_end", async (_event, ctx) => {
		const theme = ctx.ui.theme;
		const check = theme.fg("success", "✓");
		const text = theme.fg("dim", ` Turn ${turnCount} complete`);
		ctx.ui.setStatus("status-demo", check + text);
	});
}
