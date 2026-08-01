/**
 * Input Transform Example - demonstrates the `input` event for intercepting user input.
 * 输入转换示例 —— 演示如何使用 `input` 事件拦截用户输入。
 *
 * Start pi with this extension:
 * 使用该扩展启动 pi：
 *   pi -e ./examples/extensions/input-transform.ts
 *
 * Then type these inside pi:
 * 然后在 pi 中输入以下内容：
 *   ?quick What is TypeScript?  → "Respond briefly: What is TypeScript?"
 *   ?quick What is TypeScript?  → 转换为 "Respond briefly: What is TypeScript?"
 *   ping                        → "pong" (instant, no LLM)
 *   ping                        → "pong"（即时响应，不调用 LLM）
 *   time                        → current time (instant, no LLM)
 *   time                        → 当前时间（即时响应，不调用 LLM）
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	pi.on("input", async (event, ctx) => {
		// Source-based logic: skip processing for extension-injected messages
		// 基于来源的逻辑：对扩展注入的消息跳过处理
		if (event.source === "extension") {
			return { action: "continue" };
		}

		// Transform: ?quick prefix for brief responses
		// 转换：使用 ?quick 前缀以获得简短回复
		if (event.text.startsWith("?quick ")) {
			const query = event.text.slice(7).trim();
			if (!query) {
				ctx.ui.notify("Usage: ?quick <question>", "warning");
				return { action: "handled" };
			}
			return { action: "transform", text: `Respond briefly in 1-2 sentences: ${query}` };
		}

		// Handle: instant responses without LLM (extension shows its own feedback)
		// 处理：不调用 LLM 的即时响应（由扩展自行展示反馈）
		if (event.text.toLowerCase() === "ping") {
			ctx.ui.notify("pong", "info");
			return { action: "handled" };
		}
		if (event.text.toLowerCase() === "time") {
			ctx.ui.notify(new Date().toLocaleString(), "info");
			return { action: "handled" };
		}

		return { action: "continue" };
	});
}
