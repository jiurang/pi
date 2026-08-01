import { describe, expect, it } from "vitest";
import { convertMessages } from "../src/api/google-shared.ts";
import type { AssistantMessage, Context, Model } from "../src/types.ts";

// Gemini can attach `thoughtSignature` to a response part whose visible text is empty (e.g. a
// Gemini 可能会给可见文本为空的响应片段(part)附加 `thoughtSignature`(例如
// thought burst preceding a function call) and requires the signature echoed back on the next
// 函数调用之前的一段思考爆发),并要求在下一次请求中原样回传该签名。
// request. Dropping such blocks while rebuilding history silently breaks the reasoning chain:
// 在重建历史记录时丢弃这类块会悄无声息地破坏推理链:
// the model then intermittently ends a mid-task turn with a thought-only STOP and no tool call.
// 随后模型会间歇性地在任务中途以仅含思考的 STOP 结束回合,且不发起任何工具调用。
// These tests pin the rule: an empty text/thinking block is skipped only when it is UNSIGNED.
// 这些测试固化了如下规则:只有在未签名(UNSIGNED)的情况下,空的 text/thinking 块才会被跳过。

function makeModel(id = "gemini-3-pro-preview"): Model<"google-generative-ai"> {
	return {
		id,
		name: id,
		api: "google-generative-ai",
		provider: "google",
		baseUrl: "https://example.com",
		reasoning: true,
		input: ["text"],
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: 128000,
		maxTokens: 8192,
	};
}

const VALID_SIG = "AAAAAAAAAAAAAAAAAAAAAA==";

function makeContext(
	model: { api: string; provider: string; id: string },
	content: AssistantMessage["content"],
): Context {
	const now = Date.now();
	return {
		messages: [
			{ role: "user", content: "Hi", timestamp: now },
			{
				role: "assistant",
				content,
				api: model.api as AssistantMessage["api"],
				provider: model.provider,
				model: model.id,
				usage: {
					input: 0,
					output: 0,
					cacheRead: 0,
					cacheWrite: 0,
					totalTokens: 0,
					cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
				},
				stopReason: "toolUse",
				timestamp: now,
			},
		],
	};
}

describe("google-shared convertMessages — signed empty blocks", () => {
	it("keeps a signed empty thinking block so its signature is echoed back", () => {
		const model = makeModel();
		const contents = convertMessages(
			model,
			makeContext(model, [
				{ type: "thinking", thinking: "", thinkingSignature: VALID_SIG },
				{ type: "toolCall", id: "call_1", name: "bash", arguments: { command: "ls" } },
			]),
		);
		const modelTurn = contents.find((c) => c.role === "model");
		const signed = modelTurn?.parts?.filter((p) => p.thoughtSignature === VALID_SIG) ?? [];
		expect(signed).toHaveLength(1);
		expect(signed[0]?.thought).toBe(true);
	});

	it("keeps a signed empty text block the same way", () => {
		const model = makeModel();
		const contents = convertMessages(
			model,
			makeContext(model, [
				{ type: "text", text: "", textSignature: VALID_SIG },
				{ type: "toolCall", id: "call_1", name: "bash", arguments: { command: "ls" } },
			]),
		);
		const modelTurn = contents.find((c) => c.role === "model");
		const signed = modelTurn?.parts?.filter((p) => p.thoughtSignature === VALID_SIG) ?? [];
		expect(signed).toHaveLength(1);
	});

	it("still drops unsigned empty blocks", () => {
		const model = makeModel();
		const contents = convertMessages(
			model,
			makeContext(model, [
				{ type: "thinking", thinking: "" },
				{ type: "text", text: "   " },
				{ type: "toolCall", id: "call_1", name: "bash", arguments: { command: "ls" } },
			]),
		);
		const modelTurn = contents.find((c) => c.role === "model");
		expect(modelTurn?.parts).toHaveLength(1);
		expect(modelTurn?.parts?.[0]?.functionCall).toBeTruthy();
	});

	it("still drops signed empty blocks from a different provider/model (signature unusable)", () => {
		const model = makeModel();
		const contents = convertMessages(
			model,
			makeContext({ ...model, id: "other-model" }, [
				{ type: "thinking", thinking: "", thinkingSignature: VALID_SIG },
				{ type: "text", text: "", textSignature: VALID_SIG },
				{ type: "toolCall", id: "call_1", name: "bash", arguments: { command: "ls" } },
			]),
		);
		const modelTurn = contents.find((c) => c.role === "model");
		expect(modelTurn?.parts).toHaveLength(1);
		expect(modelTurn?.parts?.[0]?.functionCall).toBeTruthy();
		expect(JSON.stringify(modelTurn)).not.toContain(VALID_SIG);
	});
});
