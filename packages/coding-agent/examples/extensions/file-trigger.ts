/**
 * File Trigger Extension
 * 文件触发器扩展
 *
 * Watches a trigger file and injects its contents into the conversation.
 * 监听一个触发文件,并将其内容注入到对话中。
 * Useful for external systems to send messages to the agent.
 * 适用于外部系统向 agent 发送消息的场景。
 *
 * Usage:
 * 用法:
 *   echo "Run the tests" > /tmp/agent-trigger.txt
 */

import * as fs from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		const triggerFile = "/tmp/agent-trigger.txt";

		fs.watch(triggerFile, () => {
			try {
				const content = fs.readFileSync(triggerFile, "utf-8").trim();
				if (content) {
					pi.sendMessage(
						{
							customType: "file-trigger",
							content: `External trigger: ${content}`,
							display: true,
						},
						// triggerTurn - get LLM to respond
						// triggerTurn —— 让 LLM 作出响应
						{ triggerTurn: true },
					);
					// Clear after reading
					// 读取后清空文件
					fs.writeFileSync(triggerFile, "");
				}
			} catch {
				// File might not exist yet
				// 文件可能尚不存在
			}
		});

		if (ctx.hasUI) {
			ctx.ui.notify(`Watching ${triggerFile}`, "info");
		}
	});
}
