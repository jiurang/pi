/**
 * Send User Message Example
 * 发送用户消息示例
 *
 * Demonstrates pi.sendUserMessage() for sending user messages from extensions.
 * 演示如何使用 pi.sendUserMessage() 从扩展中发送用户消息。
 * Unlike pi.sendMessage() which sends custom messages, sendUserMessage() sends
 * actual user messages that appear in the conversation as if typed by the user.
 * 与发送自定义消息的 pi.sendMessage() 不同，sendUserMessage() 发送的是真正的用户消息，
 * 它们会像用户亲自输入的一样出现在对话中。
 *
 * Usage:
 * 用法：
 *   /ask What is 2+2?     - Sends a user message (always triggers a turn)
 *                           发送一条用户消息（总是会触发一轮对话）
 *   /steer Focus on X     - Sends while streaming with steer delivery
 *                           在流式输出过程中以 steer（引导）方式投递发送
 *   /followup And then?   - Sends while streaming with followUp delivery
 *                           在流式输出过程中以 followUp（追问）方式投递发送
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	// Simple command that sends a user message
	// 用于发送用户消息的简单命令
	pi.registerCommand("ask", {
		description: "Send a user message to the agent",
		handler: async (args, ctx) => {
			if (!args.trim()) {
				ctx.ui.notify("Usage: /ask <message>", "warning");
				return;
			}

			// sendUserMessage always triggers a turn when not streaming
			// 在非流式输出状态下，sendUserMessage 总会触发一轮对话
			// If streaming, it will throw (no deliverAs specified)
			// 若处于流式输出中，则会抛出异常（因为未指定 deliverAs）
			if (!ctx.isIdle()) {
				ctx.ui.notify("Agent is busy. Use /steer or /followup instead.", "warning");
				return;
			}

			pi.sendUserMessage(args);
		},
	});

	// Command that steers the agent mid-conversation
	// 用于在对话进行中引导（steer）agent 的命令
	pi.registerCommand("steer", {
		description: "Send a steering message (interrupts current processing)",
		handler: async (args, ctx) => {
			if (!args.trim()) {
				ctx.ui.notify("Usage: /steer <message>", "warning");
				return;
			}

			if (ctx.isIdle()) {
				// Not streaming, just send normally
				// 非流式输出状态，直接正常发送即可
				pi.sendUserMessage(args);
			} else {
				// Streaming - use steer to interrupt
				// 流式输出中——使用 steer（引导）方式打断
				pi.sendUserMessage(args, { deliverAs: "steer" });
			}
		},
	});

	// Command that queues a follow-up message
	// 用于将追问（follow-up）消息加入队列的命令
	pi.registerCommand("followup", {
		description: "Queue a follow-up message (waits for current processing)",
		handler: async (args, ctx) => {
			if (!args.trim()) {
				ctx.ui.notify("Usage: /followup <message>", "warning");
				return;
			}

			if (ctx.isIdle()) {
				// Not streaming, just send normally
				// 非流式输出状态，直接正常发送即可
				pi.sendUserMessage(args);
			} else {
				// Streaming - queue as follow-up
				// 流式输出中——作为追问（follow-up）加入队列
				pi.sendUserMessage(args, { deliverAs: "followUp" });
				ctx.ui.notify("Follow-up queued", "info");
			}
		},
	});

	// Example with content array (text + images would go here)
	// 使用内容数组的示例（文本 + 图片可放在此处）
	pi.registerCommand("askwith", {
		description: "Send a user message with structured content",
		handler: async (args, ctx) => {
			if (!args.trim()) {
				ctx.ui.notify("Usage: /askwith <message>", "warning");
				return;
			}

			if (!ctx.isIdle()) {
				ctx.ui.notify("Agent is busy", "warning");
				return;
			}

			// sendUserMessage accepts string or (TextContent | ImageContent)[]
			// sendUserMessage 接受字符串或 (TextContent | ImageContent)[] 数组
			pi.sendUserMessage([
				{ type: "text", text: `User request: ${args}` },
				{ type: "text", text: "Please respond concisely." },
			]);
		},
	});
}
