/**
 * Custom Compaction Extension
 * 自定义上下文压缩（Compaction）扩展
 *
 * Replaces the default compaction behavior with a full summary of the entire context.
 * 将默认的上下文压缩行为替换为对整个上下文生成一份完整摘要。
 * Instead of keeping the last 20k tokens of conversation turns, this extension:
 * 本扩展不再保留最近 20k token 的对话轮次，而是：
 * 1. Summarizes ALL messages (messagesToSummarize + turnPrefixMessages)
 *    对全部消息进行摘要（messagesToSummarize + turnPrefixMessages）
 * 2. Discards all old turns completely, keeping only the summary
 *    完全丢弃所有旧的对话轮次，只保留摘要
 *
 * This example also demonstrates using a different model (Gemini Flash) for summarization,
 * which can be cheaper/faster than the main conversation model.
 * 本示例还演示了使用另一个模型（Gemini Flash）来生成摘要，它可能比主对话模型更廉价/更快。
 *
 * Usage:
 * 用法：
 *   pi --extension examples/extensions/custom-compaction.ts
 */

import { uuidv7 } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { convertToLlm, serializeConversation } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	pi.on("session_before_compact", async (event, ctx) => {
		ctx.ui.notify("Custom compaction extension triggered", "info");

		const { preparation, branchEntries: _, signal } = event;
		const { messagesToSummarize, turnPrefixMessages, tokensBefore, firstKeptEntryId, previousSummary } = preparation;

		// Use Gemini Flash for summarization (cheaper/faster than most conversation models)
		// 使用 Gemini Flash 生成摘要（相比大多数对话模型更廉价/更快）
		const model = ctx.modelRegistry.find("google", "gemini-2.5-flash");
		if (!model) {
			ctx.ui.notify(`Could not find Gemini Flash model, using default compaction`, "warning");
			return;
		}

		// Resolve request auth for the summarization model
		// 为摘要模型解析请求所需的鉴权信息
		const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
		if (!auth.ok) {
			ctx.ui.notify(`Compaction auth failed: ${auth.error}`, "warning");
			return;
		}
		if (!auth.apiKey) {
			ctx.ui.notify(`No API key for ${model.provider}, using default compaction`, "warning");
			return;
		}

		// Combine all messages for full summary
		// 合并全部消息以生成完整摘要
		const allMessages = [...messagesToSummarize, ...turnPrefixMessages];

		ctx.ui.notify(
			`Custom compaction: summarizing ${allMessages.length} messages (${tokensBefore.toLocaleString()} tokens) with ${model.id}...`,
			"info",
		);

		// Convert messages to readable text format
		// 将消息转换为可读的文本格式
		const conversationText = serializeConversation(convertToLlm(allMessages));

		// Include previous summary context if available
		// 若存在此前的摘要上下文，则一并纳入
		const previousContext = previousSummary ? `\n\nPrevious session summary for context:\n${previousSummary}` : "";

		// Build messages that ask for a comprehensive summary
		// 构建用于请求生成全面摘要的消息
		const summaryMessages = [
			{
				role: "user" as const,
				content: [
					{
						type: "text" as const,
						text: `You are a conversation summarizer. Create a comprehensive summary of this conversation that captures:${previousContext}

1. The main goals and objectives discussed
2. Key decisions made and their rationale
3. Important code changes, file modifications, or technical details
4. Current state of any ongoing work
5. Any blockers, issues, or open questions
6. Next steps that were planned or suggested

Be thorough but concise. The summary will replace the ENTIRE conversation history, so include all information needed to continue the work effectively.

Format the summary as structured markdown with clear sections.

<conversation>
${conversationText}
</conversation>`,
					},
				],
				timestamp: Date.now(),
			},
		];

		try {
			// Pass signal to honor abort requests (e.g., user cancels compaction)
			// 传入 signal 以响应中止请求（例如用户取消了上下文压缩）
			const response = await ctx.modelRegistry.complete(
				model,
				{ messages: summaryMessages },
				{
					apiKey: auth.apiKey,
					headers: auth.headers,
					env: auth.env,
					maxTokens: 8192,
					signal,
					cacheRetention: "none",
					sessionId: uuidv7(),
				},
			);

			const summary = response.content
				.filter((c): c is { type: "text"; text: string } => c.type === "text")
				.map((c) => c.text)
				.join("\n");

			if (!summary.trim()) {
				if (!signal.aborted) ctx.ui.notify("Compaction summary was empty, using default compaction", "warning");
				return;
			}

			// Return compaction content - SessionManager adds id/parentId
			// 返回压缩内容 —— id/parentId 由 SessionManager 补充
			// Use firstKeptEntryId from preparation to keep recent messages
			// 使用 preparation 中的 firstKeptEntryId 来保留最近的消息
			return {
				compaction: {
					summary,
					firstKeptEntryId,
					tokensBefore,
					usage: response.usage,
				},
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			ctx.ui.notify(`Compaction failed: ${message}`, "error");
			// Fall back to default compaction on error
			// 出错时回退到默认的上下文压缩逻辑
			return;
		}
	});
}
