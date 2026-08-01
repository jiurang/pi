/**
 * Custom message rendering example.
 * 自定义消息渲染示例。
 *
 * Shows how to use registerMessageRenderer to control how custom messages
 * appear in the TUI, with colors, formatting, and expandable details.
 * 展示如何使用 registerMessageRenderer 来控制自定义消息在 TUI 中的呈现方式，
 * 包括颜色、格式以及可展开的详情。
 *
 * Usage: /status [message] - sends a status message with custom rendering
 * 用法：/status [message] —— 发送一条采用自定义渲染的状态消息
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Box, Text } from "@earendil-works/pi-tui";

export default function (pi: ExtensionAPI) {
	// Register custom renderer for "status-update" messages
	// 为 "status-update" 类型的消息注册自定义渲染器
	pi.registerMessageRenderer("status-update", (message, { expanded, outputPad }, theme) => {
		const details = message.details as { level: string; timestamp: number } | undefined;
		const level = details?.level ?? "info";

		// Color based on level
		// 根据级别（level）决定颜色
		const color = level === "error" ? "error" : level === "warn" ? "warning" : "success";
		const prefix = theme.fg(color, `[${level.toUpperCase()}]`);

		let text = `${prefix} ${message.content}`;

		// Show timestamp when expanded
		// 展开时显示时间戳
		if (expanded && details?.timestamp) {
			const time = new Date(details.timestamp).toLocaleTimeString();
			text += `\n${theme.fg("dim", `  at ${time}`)}`;
		}

		// Use Box with customMessageBg for consistent styling
		// 使用带有 customMessageBg 的 Box，以保持样式一致
		const box = new Box(outputPad, 1, (t) => theme.bg("customMessageBg", t));
		box.addChild(new Text(text, 0, 0));
		return box;
	});

	// Command to send status messages
	// 用于发送状态消息的命令
	pi.registerCommand("status", {
		description: "Send a status message (usage: /status [warn|error] message)",
		handler: async (args, _ctx) => {
			const parts = args.trim().split(/\s+/);
			let level = "info";
			let content = args.trim();

			// Check for level prefix
			// 检查是否存在级别前缀
			if (parts[0] === "warn" || parts[0] === "error") {
				level = parts[0];
				content = parts.slice(1).join(" ") || "Status update";
			}

			pi.sendMessage({
				customType: "status-update",
				content,
				display: true,
				details: { level, timestamp: Date.now() },
			});
		},
	});
}
