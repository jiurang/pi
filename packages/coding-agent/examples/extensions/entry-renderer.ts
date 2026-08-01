/**
 * Custom entry rendering example.
 * 自定义条目渲染示例。
 *
 * Shows how to render durable extension data inside the chat without sending it
 * to the LLM.
 * 演示如何在对话中渲染可持久化的扩展数据,同时不将其发送给 LLM。
 * Custom entries are stored in the session via pi.appendEntry() and rendered in
 * interactive mode via pi.registerEntryRenderer().
 * 自定义条目通过 pi.appendEntry() 存入会话,并通过 pi.registerEntryRenderer()
 * 在交互模式下渲染。
 *
 * Usage: /status-card [message]
 * 用法: /status-card [message]
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Box, Text } from "@earendil-works/pi-tui";

interface StatusCardData {
	message: string;
	timestamp: number;
}

export default function (pi: ExtensionAPI) {
	pi.registerEntryRenderer<StatusCardData>("status-card", (entry, { expanded }, theme) => {
		const data = entry.data ?? { message: "No data", timestamp: Date.now() };
		const box = new Box(1, 1, (text) => theme.bg("customMessageBg", text));
		box.addChild(new Text(`${theme.fg("accent", "[status]")} ${data.message}`, 0, 0));

		if (expanded) {
			box.addChild(new Text(theme.fg("dim", new Date(data.timestamp).toLocaleString()), 0, 0));
		}

		return box;
	});

	pi.registerCommand("status-card", {
		description: "Render a durable status card that is not sent to the LLM",
		handler: async (args) => {
			pi.appendEntry<StatusCardData>("status-card", {
				message: args.trim() || "Status card",
				timestamp: Date.now(),
			});
		},
	});
}
