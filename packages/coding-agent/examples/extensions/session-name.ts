/**
 * Session naming example.
 * 会话命名示例。
 *
 * Shows setSessionName/getSessionName to give sessions friendly names
 * that appear in the session selector instead of the first message.
 * 演示如何使用 setSessionName/getSessionName 为会话设置易读的名称,
 * 使会话选择器中显示该名称而非首条消息。
 *
 * Usage: /session-name [name] - set or show session name
 * 用法: /session-name [name] —— 设置或查看会话名称
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	pi.registerCommand("session-name", {
		description: "Set or show session name (usage: /session-name [new name])",
		handler: async (args, ctx) => {
			const name = args.trim();

			if (name) {
				pi.setSessionName(name);
				ctx.ui.notify(`Session named: ${name}`, "info");
			} else {
				const current = pi.getSessionName();
				ctx.ui.notify(current ? `Session: ${current}` : "No session name set", "info");
			}
		},
	});
}
