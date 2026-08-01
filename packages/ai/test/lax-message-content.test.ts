/**
 * The Message types require `content` to always be present, but untyped
 * callers (custom tools, hand-built histories, old session files) can violate
 * that contract.
 * Message 类型要求 `content` 始终存在,但无类型约束的调用方
 * (自定义工具、手工拼装的历史记录、旧的会话文件)可能违反该约定。
 * `transformMessages` is the choke point before every provider
 * request and is intentionally lax: it normalizes null/missing content to an
 * empty array (issues #6259, #6276).
 * `transformMessages` 是每次 provider 请求前的必经关卡,并且有意做得宽松:
 * 它会把 null 或缺失的 content 归一化为空数组(见 issue #6259、#6276)。
 */

import { describe, expect, it } from "vitest";
import { transformMessages } from "../src/api/transform-messages.ts";
import type { Message, Model } from "../src/types.ts";

// Text-only model so the image downgrade path (replaceImagesWithPlaceholder) runs,
// 使用纯文本模型,以便触发图片降级路径(replaceImagesWithPlaceholder),
// which was the primary crash site for null tool result content.
// 该路径正是 null 工具结果内容导致崩溃的主要位置。
function makeTextOnlyModel(): Model<"openai-completions"> {
	return {
		id: "test-model",
		name: "Test Model",
		api: "openai-completions",
		provider: "openai",
		baseUrl: "https://example.invalid/v1",
		reasoning: false,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 128000,
		maxTokens: 16000,
	};
}

describe("lax message content handling", () => {
	it("normalizes null/missing content to an empty array instead of crashing", () => {
		const messages = [
			{ role: "user", content: null, timestamp: Date.now() },
			{
				role: "assistant",
				content: null,
				api: "openai-completions",
				provider: "openai",
				model: "test-model",
				usage: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					totalTokens: 0,
					cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
				},
				stopReason: "stop",
				timestamp: Date.now(),
			},
			{
				role: "toolResult",
				toolCallId: "call_1",
				toolName: "web_search",
				isError: false,
				timestamp: Date.now(),
			},
		] as unknown as Message[];

		const result = transformMessages(messages, makeTextOnlyModel());

		expect(result).toHaveLength(3);
		for (const msg of result) {
			expect(msg.content).toEqual([]);
		}
	});
});
