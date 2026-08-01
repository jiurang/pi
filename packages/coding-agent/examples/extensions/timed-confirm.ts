/**
 * Example extension demonstrating timed dialogs with live countdown.
 * 演示带实时倒计时的定时对话框的示例扩展。
 *
 * Commands:
 * 命令:
 * - /timed - Shows confirm dialog that auto-cancels after 5 seconds with countdown
 *   /timed —— 显示一个带倒计时、5 秒后自动取消的确认对话框
 * - /timed-select - Shows select dialog that auto-cancels after 10 seconds with countdown
 *   /timed-select —— 显示一个带倒计时、10 秒后自动取消的选择对话框
 * - /timed-signal - Shows confirm using AbortSignal (manual approach)
 *   /timed-signal —— 使用 AbortSignal 显示确认对话框(手动方式)
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	// Simple approach: use timeout option (recommended)
	// 简单方式:使用 timeout 选项(推荐)
	pi.registerCommand("timed", {
		description: "Show a timed confirmation dialog (auto-cancels in 5s with countdown)",
		handler: async (_args, ctx) => {
			const confirmed = await ctx.ui.confirm(
				"Timed Confirmation",
				"This dialog will auto-cancel in 5 seconds. Confirm?",
				{ timeout: 5000 },
			);

			if (confirmed) {
				ctx.ui.notify("Confirmed by user!", "info");
			} else {
				ctx.ui.notify("Cancelled or timed out", "info");
			}
		},
	});

	pi.registerCommand("timed-select", {
		description: "Show a timed select dialog (auto-cancels in 10s with countdown)",
		handler: async (_args, ctx) => {
			const choice = await ctx.ui.select("Pick an option", ["Option A", "Option B", "Option C"], { timeout: 10000 });

			if (choice) {
				ctx.ui.notify(`Selected: ${choice}`, "info");
			} else {
				ctx.ui.notify("Selection cancelled or timed out", "info");
			}
		},
	});

	// Manual approach: use AbortSignal for more control
	// 手动方式:使用 AbortSignal 以获得更精细的控制
	pi.registerCommand("timed-signal", {
		description: "Show a timed confirm using AbortSignal (manual approach)",
		handler: async (_args, ctx) => {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 5000);

			ctx.ui.notify("Dialog will auto-cancel in 5 seconds...", "info");

			const confirmed = await ctx.ui.confirm(
				"Timed Confirmation",
				"This dialog will auto-cancel in 5 seconds. Confirm?",
				{ signal: controller.signal },
			);

			clearTimeout(timeoutId);

			if (confirmed) {
				ctx.ui.notify("Confirmed by user!", "info");
			} else if (controller.signal.aborted) {
				ctx.ui.notify("Dialog timed out (auto-cancelled)", "warning");
			} else {
				ctx.ui.notify("Cancelled by user", "info");
			}
		},
	});
}
