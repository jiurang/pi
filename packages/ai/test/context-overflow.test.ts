/**
 * Test context overflow error handling across providers.
 * 测试各提供商（provider）对上下文溢出（context overflow）错误的处理。
 *
 * Context overflow occurs when the input (prompt + history) exceeds
 * the model's context window. This is different from output token limits.
 * 当输入（提示词 + 历史记录）超出模型的上下文窗口（context window）时，就会发生上下文溢出。
 * 这与输出 token 数量上限是不同的概念。
 *
 * Expected behavior: All providers should return stopReason: "error"
 * with an errorMessage that indicates the context was too large,
 * OR (for z.ai) return successfully with usage.input > contextWindow.
 * 预期行为：所有提供商都应返回 stopReason: "error"，并带有表明上下文过大的 errorMessage，
 * 或者（对于 z.ai）成功返回但满足 usage.input > contextWindow。
 *
 * The isContextOverflow() function must return true for all providers.
 * isContextOverflow() 函数对所有提供商都必须返回 true。
 */

import type { ChildProcess } from "child_process";
import { execSync, spawn } from "child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { complete, getModel, getModels } from "../src/compat.ts";
import type { AssistantMessage, Context, Model, Usage } from "../src/types.ts";
import { isContextOverflow } from "../src/utils/overflow.ts";
import { hasAzureOpenAICredentials } from "./azure-utils.ts";
import { hasBedrockCredentials } from "./bedrock-utils.ts";
import { resolveApiKey } from "./oauth.ts";

// Resolve OAuth tokens at module level (async, runs before tests)
// 在模块层级解析 OAuth 令牌（异步执行，在测试运行前完成）
const oauthTokens = await Promise.all([resolveApiKey("github-copilot"), resolveApiKey("openai-codex")]);
const [githubCopilotToken, openaiCodexToken] = oauthTokens;

// Lorem ipsum paragraph for realistic token estimation
// 用于更贴近真实场景的 token 数量估算的 Lorem ipsum 段落
const LOREM_IPSUM = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. `;

// Generate a string that will exceed the context window
// 生成一个会超出上下文窗口（context window）的字符串
// Using chars/4 as token estimate (works better with varied text than repeated chars)
// 使用「字符数 / 4」作为 token 数量的估算方式（对于内容多样的文本，比重复字符更准确）
function generateOverflowContent(contextWindow: number): string {
	const targetTokens = contextWindow + 10000; // Exceed by 10k tokens 超出 1 万个 token
	const targetChars = targetTokens * 4 * 1.5;
	const repetitions = Math.ceil(targetChars / LOREM_IPSUM.length);
	return LOREM_IPSUM.repeat(repetitions);
}

interface OverflowResult {
	provider: string;
	model: string;
	contextWindow: number;
	stopReason: string;
	errorMessage: string | undefined;
	usage: Usage;
	hasUsageData: boolean;
	response: AssistantMessage;
}

async function testContextOverflow(model: Model<any>, apiKey: string): Promise<OverflowResult> {
	const overflowContent = generateOverflowContent(model.contextWindow);

	const context: Context = {
		systemPrompt: "You are a helpful assistant.",
		messages: [
			{
				role: "user",
				content: overflowContent,
				timestamp: Date.now(),
			},
		],
	};

	const response = await complete(model, context, { apiKey });

	const hasUsageData = response.usage.input > 0 || response.usage.cacheRead > 0;

	return {
		provider: model.provider,
		model: model.id,
		contextWindow: model.contextWindow,
		stopReason: response.stopReason,
		errorMessage: response.errorMessage,
		usage: response.usage,
		hasUsageData,
		response,
	};
}

function logResult(result: OverflowResult) {
	console.log(`\n${result.provider} / ${result.model}:`);
	console.log(`  contextWindow: ${result.contextWindow}`);
	console.log(`  stopReason: ${result.stopReason}`);
	console.log(`  errorMessage: ${result.errorMessage}`);
	console.log(`  usage: ${JSON.stringify(result.usage)}`);
	console.log(`  hasUsageData: ${result.hasUsageData}`);
}

// =============================================================================
// Anthropic
// Expected pattern: "prompt is too long: X tokens > Y maximum"
// 预期匹配模式："prompt is too long: X tokens > Y maximum"
// =============================================================================

describe("Context overflow error handling", () => {
	describe.skipIf(!process.env.ANTHROPIC_API_KEY)("Anthropic (API Key)", () => {
		it("claude-haiku-4-5 - should detect overflow via isContextOverflow", async () => {
			const model = getModel("anthropic", "claude-haiku-4-5");
			const result = await testContextOverflow(model, process.env.ANTHROPIC_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(result.errorMessage).toMatch(/prompt is too long/i);
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	describe.skipIf(!process.env.ANTHROPIC_OAUTH_TOKEN)("Anthropic (OAuth)", () => {
		it("claude-sonnet-4 - should detect overflow via isContextOverflow", async () => {
			const model = getModel("anthropic", "claude-sonnet-4-6");
			const result = await testContextOverflow(model, process.env.ANTHROPIC_OAUTH_TOKEN!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(result.errorMessage).toMatch(/prompt is too long/i);
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	// =============================================================================
	// GitHub Copilot (OAuth)
	// Tests both Google and Anthropic models via Copilot
	// 通过 Copilot 同时测试 Google 和 Anthropic 的模型
	// =============================================================================

	describe("GitHub Copilot (OAuth)", () => {
		// Google model via Copilot
		// 通过 Copilot 使用的 Google 模型
		it.skipIf(!githubCopilotToken)(
			"gemini-2.5-pro - should detect overflow via isContextOverflow",
			async () => {
				const model = getModel("github-copilot", "gemini-2.5-pro");
				const result = await testContextOverflow(model, githubCopilotToken!);
				logResult(result);

				expect(result.stopReason).toBe("error");
				expect(result.errorMessage).toMatch(/exceeds the limit of \d+/i);
				expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
			},
			120000,
		);

		// Anthropic model via Copilot
		// 通过 Copilot 使用的 Anthropic 模型
		it.skipIf(!githubCopilotToken)(
			"claude-sonnet-4 - should detect overflow via isContextOverflow",
			async () => {
				const model = getModel("github-copilot", "claude-sonnet-4.6");
				const result = await testContextOverflow(model, githubCopilotToken!);
				logResult(result);

				expect(result.stopReason).toBe("error");
				expect(result.errorMessage).toMatch(/exceeds the limit of \d+|input is too long/i);
				expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
			},
			120000,
		);
	});

	// =============================================================================
	// OpenAI
	// Expected pattern: "exceeds the context window"
	// 预期匹配模式："exceeds the context window"
	// =============================================================================

	describe.skipIf(!process.env.OPENAI_API_KEY)("OpenAI Completions", () => {
		it("gpt-4o-mini - should detect overflow via isContextOverflow", async () => {
			const model = { ...getModel("openai", "gpt-4o-mini") };
			model.api = "openai-completions" as any;
			const result = await testContextOverflow(model, process.env.OPENAI_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(result.errorMessage).toMatch(/maximum context length/i);
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	describe.skipIf(!process.env.OPENAI_API_KEY)("OpenAI Responses", () => {
		it("gpt-4o - should detect overflow via isContextOverflow", async () => {
			const model = getModel("openai", "gpt-4o");
			const result = await testContextOverflow(model, process.env.OPENAI_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(result.errorMessage).toMatch(/exceeds the context window/i);
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	describe.skipIf(!hasAzureOpenAICredentials())("Azure OpenAI Responses", () => {
		it("gpt-4o-mini - should detect overflow via isContextOverflow", async () => {
			const model = getModel("azure-openai-responses", "gpt-4o-mini");
			const result = await testContextOverflow(model, process.env.AZURE_OPENAI_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(result.errorMessage).toMatch(/context|maximum/i);
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	// =============================================================================
	// Google
	// Expected pattern: "input token count (X) exceeds the maximum"
	// 预期匹配模式："input token count (X) exceeds the maximum"
	// =============================================================================

	describe.skipIf(!process.env.GEMINI_API_KEY)("Google", () => {
		it("gemini-2.0-flash - should detect overflow via isContextOverflow", async () => {
			const model = getModel("google", "gemini-2.0-flash");
			const result = await testContextOverflow(model, process.env.GEMINI_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(result.errorMessage).toMatch(/input token count.*exceeds the maximum/i);
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	// =============================================================================
	// Uses same API as Google, expects same error pattern
	// 使用与 Google 相同的 API，预期错误匹配模式也相同
	// =============================================================================

	// =============================================================================
	// =============================================================================

	// =============================================================================
	// OpenAI Codex (OAuth)
	// Uses ChatGPT Plus/Pro subscription via OAuth
	// 通过 OAuth 使用 ChatGPT Plus/Pro 订阅
	// =============================================================================

	describe("OpenAI Codex (OAuth)", () => {
		it.skipIf(!openaiCodexToken)(
			"gpt-5.5 - should detect overflow via isContextOverflow",
			async () => {
				const model = getModel("openai-codex", "gpt-5.5");
				const result = await testContextOverflow(model, openaiCodexToken!);
				logResult(result);

				expect(result.stopReason).toBe("error");
				expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
			},
			120000,
		);
	});

	// =============================================================================
	// Amazon Bedrock
	// Expected pattern: "Input is too long for requested model"
	// 预期匹配模式："Input is too long for requested model"
	// =============================================================================

	describe.skipIf(!hasBedrockCredentials())("Amazon Bedrock", () => {
		it("claude-sonnet-4-5 - should detect overflow via isContextOverflow", async () => {
			const model = getModel("amazon-bedrock", "global.anthropic.claude-sonnet-4-5-20250929-v1:0");
			const result = await testContextOverflow(model, "");
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	// =============================================================================
	// xAI
	// Expected pattern: "maximum prompt length is X but the request contains Y"
	// 预期匹配模式："maximum prompt length is X but the request contains Y"
	// =============================================================================

	describe.skipIf(!process.env.XAI_API_KEY)("xAI", () => {
		it("grok-4.3 - should detect overflow via isContextOverflow", async () => {
			const model = getModel("xai", "grok-4.3");
			const result = await testContextOverflow(model, process.env.XAI_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(result.errorMessage).toMatch(/maximum prompt length is \d+/i);
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	// =============================================================================
	// Groq
	// Expected pattern: "reduce the length of the messages"
	// 预期匹配模式："reduce the length of the messages"
	// =============================================================================

	describe.skipIf(!process.env.GROQ_API_KEY)("Groq", () => {
		it("llama-3.3-70b-versatile - should detect overflow via isContextOverflow", async () => {
			const model = getModel("groq", "llama-3.3-70b-versatile");
			const result = await testContextOverflow(model, process.env.GROQ_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(result.errorMessage).toMatch(/reduce the length of the messages/i);
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	// =============================================================================
	// Cerebras
	// Expected: 400/413 status code with no body
	// 预期：返回 400/413 状态码且响应体为空
	// =============================================================================

	describe.skipIf(!process.env.CEREBRAS_API_KEY)("Cerebras", () => {
		it("available model - should detect overflow via isContextOverflow", async () => {
			const preferredCerebrasModelIds: string[] = ["gpt-oss-120b", "zai-glm-4.7", "llama3.1-8b"];
			const cerebrasModels = getModels("cerebras");
			const model =
				cerebrasModels.find((candidate) => preferredCerebrasModelIds.includes(candidate.id)) ?? cerebrasModels[0];
			if (!model) {
				throw new Error("No Cerebras models available");
			}

			const result = await testContextOverflow(model, process.env.CEREBRAS_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			// Cerebras returns status code with no body (400, 413, or 429 for token rate limit)
			// Cerebras 返回的响应只有状态码而没有响应体（400、413，或触发 token 速率限制时的 429）
			expect(result.errorMessage).toMatch(/4(00|13|29).*\(no body\)/i);
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	// =============================================================================
	// Hugging Face
	// Uses OpenAI-compatible Inference Router
	// 使用兼容 OpenAI 的 Inference Router（推理路由）
	// =============================================================================

	describe.skipIf(!process.env.HF_TOKEN)("Hugging Face", () => {
		it("Kimi-K2.5 - should detect overflow via isContextOverflow", async () => {
			const model = getModel("huggingface", "moonshotai/Kimi-K2.5");
			const result = await testContextOverflow(model, process.env.HF_TOKEN!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	// =============================================================================
	// Together AI
	// Uses OpenAI-compatible Chat Completions API
	// 使用兼容 OpenAI 的 Chat Completions API
	// =============================================================================

	describe.skipIf(!process.env.TOGETHER_API_KEY)("Together AI", () => {
		it("Kimi-K2.6 - should detect overflow via isContextOverflow", async () => {
			const model = getModel("together", "moonshotai/Kimi-K2.6");
			const result = await testContextOverflow(model, process.env.TOGETHER_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	// =============================================================================
	// z.ai
	// Special case: may return explicit overflow error text, may accept overflow silently,
	// or may rate limit instead
	// 特殊情况：可能返回明确的溢出错误文本，也可能静默接受溢出的输入，
	// 或者转而返回速率限制（rate limit）错误
	// =============================================================================

	describe.skipIf(!process.env.ZAI_API_KEY)("z.ai", () => {
		it("glm-4.5-air - should detect overflow via isContextOverflow when z.ai reports it", async () => {
			const model = getModel("zai", "glm-4.5-air");
			const result = await testContextOverflow(model, process.env.ZAI_API_KEY!);
			logResult(result);

			// z.ai behavior is inconsistent:
			// z.ai 的行为并不一致：
			// - Sometimes returns explicit overflow error text via non-standard finish_reason handling
			// - 有时通过非标准的 finish_reason 处理方式返回明确的溢出错误文本
			// - Sometimes accepts overflow and returns successfully with usage.input > contextWindow
			// - 有时接受溢出的输入并成功返回，此时 usage.input > contextWindow
			// - Sometimes returns rate limit error
			// - 有时返回速率限制（rate limit）错误
			if (result.stopReason === "error") {
				if (result.errorMessage?.match(/model_context_window_exceeded/i)) {
					expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
				} else {
					console.log("  z.ai returned non-overflow error (possibly rate limited), skipping overflow detection");
				}
			} else if (result.stopReason === "stop") {
				if (result.hasUsageData && result.usage.input > model.contextWindow) {
					expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
				} else {
					console.log("  z.ai returned stop without overflow usage data, skipping overflow detection");
				}
			}
		}, 120000);
	});

	// =============================================================================
	// Mistral
	// =============================================================================

	describe.skipIf(!process.env.MISTRAL_API_KEY)("Mistral", () => {
		it("devstral-medium-latest - should detect overflow via isContextOverflow", async () => {
			const model = getModel("mistral", "devstral-medium-latest");
			const result = await testContextOverflow(model, process.env.MISTRAL_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(result.errorMessage).toMatch(/too large for model with \d+ maximum context length/i);
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	// =============================================================================
	// MiniMax
	// Expected pattern: TBD - need to test actual error message
	// 预期匹配模式：待定（TBD）——需要实测真实的错误消息
	// =============================================================================

	describe.skipIf(!process.env.MINIMAX_API_KEY)("MiniMax", () => {
		it("MiniMax-M2.7 - should detect overflow via isContextOverflow", async () => {
			const model = getModel("minimax", "MiniMax-M2.7");
			const result = await testContextOverflow(model, process.env.MINIMAX_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	// =============================================================================
	// Xiaomi MiMo
	// =============================================================================

	describe.skipIf(!process.env.XIAOMI_API_KEY)("Xiaomi MiMo (API billing)", () => {
		// Xiaomi silently truncates oversized input to fill the context window exactly,
		// then returns finish_reason "length" with output=0 (no room left to generate).
		// 小米（Xiaomi）会静默地截断超长输入，使其恰好填满上下文窗口，
		// 随后返回 finish_reason 为 "length" 且 output=0（已无剩余空间用于生成内容）。
		// This is a detectable overflow signal but uses stopReason "length" rather than "error".
		// 这是一个可检测到的溢出信号，但其 stopReason 为 "length" 而非 "error"。
		it("mimo-v2.5-pro - should detect overflow via isContextOverflow", async () => {
			const model = getModel("xiaomi", "mimo-v2.5-pro");
			const result = await testContextOverflow(model, process.env.XIAOMI_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("length");
			expect(result.usage.output).toBe(0);
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	describe.skipIf(!process.env.XIAOMI_TOKEN_PLAN_CN_API_KEY)("Xiaomi MiMo Token Plan (CN)", () => {
		it("mimo-v2.5-pro - should detect overflow via isContextOverflow", async () => {
			const model = getModel("xiaomi-token-plan-cn", "mimo-v2.5-pro");
			const result = await testContextOverflow(model, process.env.XIAOMI_TOKEN_PLAN_CN_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("length");
			expect(result.usage.output).toBe(0);
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	describe.skipIf(!process.env.XIAOMI_TOKEN_PLAN_AMS_API_KEY)("Xiaomi MiMo Token Plan (AMS)", () => {
		it("mimo-v2.5-pro - should detect overflow via isContextOverflow", async () => {
			const model = getModel("xiaomi-token-plan-ams", "mimo-v2.5-pro");
			const result = await testContextOverflow(model, process.env.XIAOMI_TOKEN_PLAN_AMS_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("length");
			expect(result.usage.output).toBe(0);
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	describe.skipIf(!process.env.XIAOMI_TOKEN_PLAN_SGP_API_KEY)("Xiaomi MiMo Token Plan (SGP)", () => {
		it("mimo-v2.5-pro - should detect overflow via isContextOverflow", async () => {
			const model = getModel("xiaomi-token-plan-sgp", "mimo-v2.5-pro");
			const result = await testContextOverflow(model, process.env.XIAOMI_TOKEN_PLAN_SGP_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("length");
			expect(result.usage.output).toBe(0);
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	describe.skipIf(!process.env.QWEN_TOKEN_PLAN_API_KEY)("Qwen Token Plan", () => {
		it("qwen3.7-max - should detect overflow via isContextOverflow", async () => {
			const model = getModel("qwen-token-plan", "qwen3.7-max");
			const result = await testContextOverflow(model, process.env.QWEN_TOKEN_PLAN_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(result.errorMessage).toMatch(/input length/i);
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	describe.skipIf(!process.env.QWEN_TOKEN_PLAN_CN_API_KEY)("Qwen Token Plan (CN)", () => {
		it("qwen3.7-max - should detect overflow via isContextOverflow", async () => {
			const model = getModel("qwen-token-plan-cn", "qwen3.7-max");
			const result = await testContextOverflow(model, process.env.QWEN_TOKEN_PLAN_CN_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(result.errorMessage).toMatch(/input length/i);
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	// =============================================================================
	// Kimi For Coding
	// =============================================================================

	describe.skipIf(!process.env.KIMI_API_KEY)("Kimi For Coding", () => {
		it("kimi-for-coding - should detect overflow via isContextOverflow", async () => {
			const model = getModel("kimi-coding", "kimi-for-coding");
			const result = await testContextOverflow(model, process.env.KIMI_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	// =============================================================================
	// Vercel AI Gateway - Unified API for multiple providers
	// Vercel AI Gateway —— 面向多个提供商的统一 API
	// =============================================================================

	describe.skipIf(!process.env.AI_GATEWAY_API_KEY)("Vercel AI Gateway", () => {
		it("google/gemini-2.5-flash via AI Gateway - should detect overflow via isContextOverflow", async () => {
			const model = getModel("vercel-ai-gateway", "google/gemini-2.5-flash");
			const result = await testContextOverflow(model, process.env.AI_GATEWAY_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	// =============================================================================
	// OpenRouter - Multiple backend providers
	// OpenRouter —— 多个后端提供商
	// Expected pattern: "maximum context length is X tokens"
	// 预期匹配模式："maximum context length is X tokens"
	// =============================================================================

	describe.skipIf(!process.env.OPENROUTER_API_KEY)("OpenRouter", () => {
		// Anthropic backend
		// Anthropic 后端
		it("anthropic/claude-sonnet-4 via OpenRouter - should detect overflow via isContextOverflow", async () => {
			const model = getModel("openrouter", "anthropic/claude-sonnet-4");
			const result = await testContextOverflow(model, process.env.OPENROUTER_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(result.errorMessage).toMatch(/maximum context length is \d+ tokens/i);
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);

		// DeepSeek backend
		// DeepSeek 后端
		it("deepseek/deepseek-v3.2 via OpenRouter - should detect overflow via isContextOverflow", async () => {
			const model = getModel("openrouter", "deepseek/deepseek-v3.2");
			const result = await testContextOverflow(model, process.env.OPENROUTER_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(result.errorMessage).toMatch(/maximum context length is \d+ tokens/i);
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);

		// Mistral backend
		// Mistral 后端
		it("mistralai/mistral-large-2512 via OpenRouter - should detect overflow via isContextOverflow", async () => {
			const model = getModel("openrouter", "mistralai/mistral-large-2512");
			const result = await testContextOverflow(model, process.env.OPENROUTER_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(result.errorMessage).toMatch(/maximum context length is \d+ tokens/i);
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);

		// Google backend
		// Google 后端
		it("google/gemini-2.5-flash via OpenRouter - should detect overflow via isContextOverflow", async () => {
			const model = getModel("openrouter", "google/gemini-2.5-flash");
			const result = await testContextOverflow(model, process.env.OPENROUTER_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(result.errorMessage).toMatch(/maximum context length is \d+ tokens/i);
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);

		// Meta/Llama backend
		// Meta/Llama 后端
		it("meta-llama/llama-4-scout via OpenRouter - should detect overflow via isContextOverflow", async () => {
			const model = getModel("openrouter", "meta-llama/llama-4-scout");
			const result = await testContextOverflow(model, process.env.OPENROUTER_API_KEY!);
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(result.errorMessage).toMatch(/maximum context length is \d+ tokens/i);
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	// =============================================================================
	// Ollama (local)
	// Ollama（本地）
	// =============================================================================

	// Check if ollama is installed and local LLM tests are enabled
	// 检查是否已安装 ollama，以及是否启用了本地 LLM 测试
	let ollamaInstalled = false;
	if (!process.env.PI_NO_LOCAL_LLM) {
		try {
			execSync("which ollama", { stdio: "ignore" });
			ollamaInstalled = true;
		} catch {
			ollamaInstalled = false;
		}
	}

	describe.skipIf(!ollamaInstalled)("Ollama (local)", () => {
		let ollamaProcess: ChildProcess | null = null;
		let model: Model<"openai-completions">;

		beforeAll(async () => {
			// Check if model is available, if not pull it
			// 检查该模型是否可用，若不可用则拉取（pull）它
			try {
				execSync("ollama list | grep -q 'gpt-oss:20b'", { stdio: "ignore" });
			} catch {
				console.log("Pulling gpt-oss:20b model for Ollama overflow tests...");
				try {
					execSync("ollama pull gpt-oss:20b", { stdio: "inherit" });
				} catch (_e) {
					console.warn("Failed to pull gpt-oss:20b model, tests will be skipped");
					return;
				}
			}

			// Start ollama server
			// 启动 ollama 服务端
			ollamaProcess = spawn("ollama", ["serve"], {
				detached: false,
				stdio: "ignore",
			});

			// Wait for server to be ready
			// 等待服务端就绪
			await new Promise<void>((resolve) => {
				const checkServer = async () => {
					try {
						const response = await fetch("http://localhost:11434/api/tags");
						if (response.ok) {
							resolve();
						} else {
							setTimeout(checkServer, 500);
						}
					} catch {
						setTimeout(checkServer, 500);
					}
				};
				setTimeout(checkServer, 1000);
			});

			model = {
				id: "gpt-oss:20b",
				api: "openai-completions",
				provider: "ollama",
				baseUrl: "http://localhost:11434/v1",
				reasoning: true,
				input: ["text"],
				contextWindow: 128000,
				maxTokens: 16000,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
				name: "Ollama GPT-OSS 20B",
			};
		}, 60000);

		afterAll(() => {
			if (ollamaProcess) {
				ollamaProcess.kill("SIGTERM");
				ollamaProcess = null;
			}
		});

		it("gpt-oss:20b - should detect overflow via isContextOverflow (ollama silently truncates)", async () => {
			const result = await testContextOverflow(model, "ollama");
			logResult(result);

			// Ollama silently truncates input instead of erroring
			// Ollama 会静默地截断输入，而不是报错
			// It returns stopReason "stop" with truncated usage
			// 它返回的 stopReason 为 "stop"，且用量（usage）数据也是截断后的
			// We cannot detect overflow via error message, only via usage comparison
			// 我们无法通过错误消息检测溢出，只能通过对比用量数据来判断
			if (result.stopReason === "stop" && result.hasUsageData) {
				// Ollama truncated - check if reported usage is less than what we sent
				// Ollama 进行了截断——检查其上报的用量是否少于我们实际发送的量
				// This is a "silent overflow" - we can detect it if we know expected input size
				// 这属于"静默溢出"——只要我们知道预期的输入大小，就可以检测出来
				console.log("  Ollama silently truncated input to", result.usage.input, "tokens");
				// For now, we accept this behavior - Ollama doesn't give us a way to detect overflow
				// 目前我们接受这一行为——Ollama 没有提供任何检测溢出的手段
			} else if (result.stopReason === "error") {
				expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
			}
		}, 300000); // 5 min timeout for local model 本地模型使用 5 分钟超时
	});

	// =============================================================================
	// LM Studio (local) - Skip if not running or local LLM tests disabled
	// LM Studio（本地）—— 若未运行或本地 LLM 测试已禁用，则跳过
	// =============================================================================

	let lmStudioRunning = false;
	if (!process.env.PI_NO_LOCAL_LLM) {
		try {
			execSync("curl -s --max-time 1 http://localhost:1234/v1/models > /dev/null", { stdio: "ignore" });
			lmStudioRunning = true;
		} catch {
			lmStudioRunning = false;
		}
	}

	describe.skipIf(!lmStudioRunning)("LM Studio (local)", () => {
		it("should detect overflow via isContextOverflow", async () => {
			const model: Model<"openai-completions"> = {
				id: "local-model",
				api: "openai-completions",
				provider: "lm-studio",
				baseUrl: "http://localhost:1234/v1",
				reasoning: false,
				input: ["text"],
				contextWindow: 8192,
				maxTokens: 2048,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
				name: "LM Studio Local Model",
			};

			const result = await testContextOverflow(model, "lm-studio");
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});

	// =============================================================================
	// llama.cpp server (local) - Skip if not running or not exposing /v1/completions
	// llama.cpp 服务端（本地）—— 若未运行或未暴露 /v1/completions 接口，则跳过
	// =============================================================================

	let llamaCppRunning = false;
	if (!process.env.PI_NO_LOCAL_LLM) {
		try {
			execSync("curl -s --max-time 1 http://localhost:8081/health > /dev/null", { stdio: "ignore" });
			const probeStatus = execSync(
				'curl -s --max-time 1 -o /dev/null -w \'%{http_code}\' -X POST http://localhost:8081/v1/completions -H \'content-type: application/json\' -d \'{"model":"local-model","prompt":"ping","max_tokens":1}\'',
				{ encoding: "utf8" },
			).trim();
			llamaCppRunning = probeStatus !== "404" && probeStatus !== "405" && probeStatus !== "000";
		} catch {
			llamaCppRunning = false;
		}
	}

	describe.skipIf(!llamaCppRunning)("llama.cpp (local)", () => {
		it("should detect overflow via isContextOverflow", async () => {
			// Using small context (4096) to match server --ctx-size setting
			// 使用较小的上下文长度（4096）以匹配服务端的 --ctx-size 设置
			const model: Model<"openai-completions"> = {
				id: "local-model",
				api: "openai-completions",
				provider: "llama.cpp",
				baseUrl: "http://localhost:8081/v1",
				reasoning: false,
				input: ["text"],
				contextWindow: 4096,
				maxTokens: 2048,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
				name: "llama.cpp Local Model",
			};

			const result = await testContextOverflow(model, "llama.cpp");
			logResult(result);

			expect(result.stopReason).toBe("error");
			expect(isContextOverflow(result.response, model.contextWindow)).toBe(true);
		}, 120000);
	});
});
