/**
 * Tool Call ID Normalization Tests
 * 工具调用 ID（Tool Call ID）归一化测试
 *
 * Tests that tool call IDs from OpenAI Responses API (github-copilot, openai-codex, opencode)
 * 测试来自 OpenAI Responses API（github-copilot、openai-codex、opencode）的工具调用 ID
 * are properly normalized when sent to other providers.
 * 在发送给其他 provider 时能被正确归一化。
 *
 * OpenAI Responses API generates IDs in format: {call_id}|{id}
 * OpenAI Responses API 生成的 ID 格式为：{call_id}|{id}
 * where {id} can be 400+ chars with special characters (+, /, =).
 * 其中 {id} 可能长达 400 多个字符，并包含特殊字符（+、/、=）。
 *
 * Regression test for: https://github.com/earendil-works/pi-mono/issues/1022
 * 针对以下问题的回归测试：https://github.com/earendil-works/pi-mono/issues/1022
 */

import { Type } from "typebox";
import { describe, expect, it } from "vitest";
import { completeSimple, getEnvApiKey, getModel } from "../src/compat.ts";
import type { AssistantMessage, Message, Tool, ToolResultMessage } from "../src/types.ts";
import { resolveApiKey } from "./oauth.ts";

// Resolve API keys
// 解析各 provider 的 API 密钥
const copilotToken = await resolveApiKey("github-copilot");
const openrouterKey = getEnvApiKey("openrouter");
const codexToken = await resolveApiKey("openai-codex");

// Simple echo tool for testing
// 用于测试的简单回显（echo）工具
const echoToolSchema = Type.Object({
	message: Type.String({ description: "Message to echo back" }),
});

const echoTool: Tool<typeof echoToolSchema> = {
	name: "echo",
	description: "Echoes the message back",
	parameters: echoToolSchema,
};

/**
 * Test 1: Live cross-provider handoff
 * 测试 1：真实（live）的跨 provider 交接
 *
 * 1. Use github-copilot gpt-5.2-codex to generate a tool call
 * 1. 使用 github-copilot 的 gpt-5.2-codex 生成一次工具调用
 * 2. Switch to openrouter openai/gpt-5.2-codex and complete
 * 2. 切换到 openrouter 的 openai/gpt-5.2-codex 并完成补全
 * 3. Switch to openai-codex gpt-5.5 and complete
 * 3. 切换到 openai-codex 的 gpt-5.5 并完成补全
 *
 * Both should succeed without "call_id too long" errors.
 * 两者都应当成功，且不出现 "call_id too long"（call_id 过长）错误。
 */
describe("Tool Call ID Normalization - Live Handoff", () => {
	it.skipIf(!copilotToken || !openrouterKey)(
		"github-copilot -> openrouter should normalize pipe-separated IDs",
		async () => {
			const copilotModel = getModel("github-copilot", "gpt-5.2-codex");
			const openrouterModel = getModel("openrouter", "openai/gpt-5.2-codex");

			// Step 1: Generate tool call with github-copilot
			// 第 1 步：使用 github-copilot 生成工具调用
			const userMessage: Message = {
				role: "user",
				content: "Use the echo tool to echo 'hello world'",
				timestamp: Date.now(),
			};

			const assistantResponse = await completeSimple(
				copilotModel,
				{
					systemPrompt: "You are a helpful assistant. Use the echo tool when asked.",
					messages: [userMessage],
					tools: [echoTool],
				},
				{ apiKey: copilotToken },
			);

			expect(assistantResponse.stopReason, `Copilot error: ${assistantResponse.errorMessage}`).toBe("toolUse");

			const toolCall = assistantResponse.content.find((c) => c.type === "toolCall");
			expect(toolCall).toBeDefined();
			expect(toolCall!.type).toBe("toolCall");

			// Verify it's a pipe-separated ID (OpenAI Responses format)
			// 验证它是以竖线（|）分隔的 ID（OpenAI Responses 格式）
			if (toolCall?.type === "toolCall") {
				expect(toolCall.id).toContain("|");
				console.log(`Tool call ID from github-copilot: ${toolCall.id.slice(0, 80)}...`);
			}

			// Create tool result
			// 构造工具结果（tool result）
			const toolResult: ToolResultMessage = {
				role: "toolResult",
				toolCallId: (toolCall as any).id,
				toolName: "echo",
				content: [{ type: "text", text: "hello world" }],
				isError: false,
				timestamp: Date.now(),
			};

			// Step 2: Complete with openrouter (uses openai-completions API)
			// 第 2 步：使用 openrouter 完成补全（走 openai-completions API）
			const openrouterResponse = await completeSimple(
				openrouterModel,
				{
					systemPrompt: "You are a helpful assistant.",
					messages: [
						userMessage,
						assistantResponse,
						toolResult,
						{ role: "user", content: "Say hi", timestamp: Date.now() },
					],
					tools: [echoTool],
				},
				{ apiKey: openrouterKey },
			);

			// Should NOT fail with "call_id too long" error
			// 不应当因 "call_id too long"（call_id 过长）错误而失败
			expect(openrouterResponse.stopReason, `OpenRouter error: ${openrouterResponse.errorMessage}`).not.toBe(
				"error",
			);
			expect(openrouterResponse.errorMessage).toBeUndefined();
		},
		60000,
	);

	it.skipIf(!copilotToken || !codexToken)(
		"github-copilot -> openai-codex should normalize pipe-separated IDs",
		async () => {
			const copilotModel = getModel("github-copilot", "gpt-5.2-codex");
			const codexModel = getModel("openai-codex", "gpt-5.5");

			// Step 1: Generate tool call with github-copilot
			// 第 1 步：使用 github-copilot 生成工具调用
			const userMessage: Message = {
				role: "user",
				content: "Use the echo tool to echo 'test message'",
				timestamp: Date.now(),
			};

			const assistantResponse = await completeSimple(
				copilotModel,
				{
					systemPrompt: "You are a helpful assistant. Use the echo tool when asked.",
					messages: [userMessage],
					tools: [echoTool],
				},
				{ apiKey: copilotToken },
			);

			expect(assistantResponse.stopReason, `Copilot error: ${assistantResponse.errorMessage}`).toBe("toolUse");

			const toolCall = assistantResponse.content.find((c) => c.type === "toolCall");
			expect(toolCall).toBeDefined();

			// Create tool result
			// 构造工具结果（tool result）
			const toolResult: ToolResultMessage = {
				role: "toolResult",
				toolCallId: (toolCall as any).id,
				toolName: "echo",
				content: [{ type: "text", text: "test message" }],
				isError: false,
				timestamp: Date.now(),
			};

			// Step 2: Complete with openai-codex (uses openai-codex-responses API)
			// 第 2 步：使用 openai-codex 完成补全（走 openai-codex-responses API）
			const codexResponse = await completeSimple(
				codexModel,
				{
					systemPrompt: "You are a helpful assistant.",
					messages: [
						userMessage,
						assistantResponse,
						toolResult,
						{ role: "user", content: "Say hi", timestamp: Date.now() },
					],
					tools: [echoTool],
				},
				{ apiKey: codexToken },
			);

			// Should NOT fail with ID validation error
			// 不应当因 ID 校验错误而失败
			expect(codexResponse.stopReason, `Codex error: ${codexResponse.errorMessage}`).not.toBe("error");
			expect(codexResponse.errorMessage).toBeUndefined();
		},
		60000,
	);
});

/**
 * Test 2: Prefilled context with exact failing IDs from issue #1022
 * 测试 2：使用 issue #1022 中导致失败的原始 ID 预填充上下文
 *
 * Uses the exact tool call ID format that caused the error:
 * 使用了触发该错误的确切工具调用 ID 格式：
 * "call_xxx|very_long_base64_with_special_chars+/="
 */
describe("Tool Call ID Normalization - Prefilled Context", () => {
	// Exact tool call ID from issue #1022 JSONL
	// 取自 issue #1022 的 JSONL 中的原始工具调用 ID
	const FAILING_TOOL_CALL_ID =
		"call_pAYbIr76hXIjncD9UE4eGfnS|t5nnb2qYMFWGSsr13fhCd1CaCu3t3qONEPuOudu4HSVEtA8YJSL6FAZUxvoOoD792VIJWl91g87EdqsCWp9krVsdBysQoDaf9lMCLb8BS4EYi4gQd5kBQBYLlgD71PYwvf+TbMD9J9/5OMD42oxSRj8H+vRf78/l2Xla33LWz4nOgsddBlbvabICRs8GHt5C9PK5keFtzyi3lsyVKNlfduK3iphsZqs4MLv4zyGJnvZo/+QzShyk5xnMSQX/f98+aEoNflEApCdEOXipipgeiNWnpFSHbcwmMkZoJhURNu+JEz3xCh1mrXeYoN5o+trLL3IXJacSsLYXDrYTipZZbJFRPAucgbnjYBC+/ZzJOfkwCs+Gkw7EoZR7ZQgJ8ma+9586n4tT4cI8DEhBSZsWMjrCt8dxKg==";

	// Build prefilled context with the failing ID
	// 使用该会导致失败的 ID 构建预填充上下文
	function buildPrefilledMessages(): Message[] {
		const userMessage: Message = {
			role: "user",
			content: "Use the echo tool to echo 'hello'",
			timestamp: Date.now() - 2000,
		};

		const assistantMessage: AssistantMessage = {
			role: "assistant",
			content: [
				{
					type: "toolCall",
					id: FAILING_TOOL_CALL_ID,
					name: "echo",
					arguments: { message: "hello" },
				},
			],
			api: "openai-responses",
			provider: "github-copilot",
			model: "gpt-5.2-codex",
			usage: {
				input: 100,
				output: 50,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 150,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "toolUse",
			timestamp: Date.now() - 1500,
		};

		const toolResult: ToolResultMessage = {
			role: "toolResult",
			toolCallId: FAILING_TOOL_CALL_ID,
			toolName: "echo",
			content: [{ type: "text", text: "hello" }],
			isError: false,
			timestamp: Date.now() - 1000,
		};

		const followUpUser: Message = {
			role: "user",
			content: "Say hi",
			timestamp: Date.now(),
		};

		return [userMessage, assistantMessage, toolResult, followUpUser];
	}

	it.skipIf(!openrouterKey)(
		"openrouter should handle prefilled context with long pipe-separated IDs",
		async () => {
			const model = getModel("openrouter", "openai/gpt-5.2-codex");
			const messages = buildPrefilledMessages();

			const response = await completeSimple(
				model,
				{
					systemPrompt: "You are a helpful assistant.",
					messages,
					tools: [echoTool],
				},
				{ apiKey: openrouterKey },
			);

			// Should NOT fail with "call_id too long" error
			// 不应当因 "call_id too long"（call_id 过长）错误而失败
			expect(response.stopReason, `OpenRouter error: ${response.errorMessage}`).not.toBe("error");
			if (response.errorMessage) {
				expect(response.errorMessage).not.toContain("call_id");
				expect(response.errorMessage).not.toContain("too long");
			}
		},
		30000,
	);

	it.skipIf(!codexToken)(
		"openai-codex should handle prefilled context with long pipe-separated IDs",
		async () => {
			const model = getModel("openai-codex", "gpt-5.5");
			const messages = buildPrefilledMessages();

			const response = await completeSimple(
				model,
				{
					systemPrompt: "You are a helpful assistant.",
					messages,
					tools: [echoTool],
				},
				{ apiKey: codexToken },
			);

			// Should NOT fail with ID validation error
			// 不应当因 ID 校验错误而失败
			expect(response.stopReason, `Codex error: ${response.errorMessage}`).not.toBe("error");
			if (response.errorMessage) {
				expect(response.errorMessage).not.toContain("id");
				expect(response.errorMessage).not.toContain("additional characters");
			}
		},
		30000,
	);
});
