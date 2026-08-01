/**
 * Test totalTokens field across all providers.
 * 在所有 provider 上测试 totalTokens 字段。
 *
 * totalTokens represents the total number of tokens processed by the LLM,
 * including input (with cache) and output (with thinking).
 * totalTokens 表示 LLM 处理的 token 总数,包含输入(含缓存)和输出(含思考内容)。
 * This is the
 * base for calculating context size for the next request.
 * 它是计算下一次请求上下文大小的基础。
 *
 * - OpenAI Completions: Uses native total_tokens field
 * - OpenAI Completions:使用原生的 total_tokens 字段
 * - OpenAI Responses: Uses native total_tokens field
 * - OpenAI Responses:使用原生的 total_tokens 字段
 * - Google: Uses native totalTokenCount field
 * - Google:使用原生的 totalTokenCount 字段
 * - Anthropic: Computed as input + output + cacheRead + cacheWrite
 * - Anthropic:按 input + output + cacheRead + cacheWrite 计算得出
 * - Other OpenAI-compatible providers: Uses native total_tokens field
 * - 其他 OpenAI 兼容 provider:使用原生的 total_tokens 字段
 */

import { describe, expect, it } from "vitest";
import { complete, getModel } from "../src/compat.ts";
import type { Api, Context, Model, StreamOptions, Usage } from "../src/types.ts";

type StreamOptionsWithExtras = StreamOptions & Record<string, unknown>;

import { hasAzureOpenAICredentials, resolveAzureDeploymentName } from "./azure-utils.ts";
import { hasBedrockCredentials } from "./bedrock-utils.ts";
import { hasCloudflareAiGatewayCredentials, hasCloudflareWorkersAICredentials } from "./cloudflare-utils.ts";
import { resolveApiKey } from "./oauth.ts";

// Resolve OAuth tokens at module level (async, runs before tests)
// 在模块层级解析 OAuth 令牌(异步执行,在测试之前运行)
const oauthTokens = await Promise.all([
	resolveApiKey("anthropic"),
	resolveApiKey("github-copilot"),
	resolveApiKey("openai-codex"),
]);
const [anthropicOAuthToken, githubCopilotToken, openaiCodexToken] = oauthTokens;

// Generate a long system prompt to trigger caching (>2k bytes for most providers)
// 生成一段较长的系统提示词以触发缓存(对大多数 provider 而言需大于 2k 字节)
const LONG_SYSTEM_PROMPT = `You are a helpful assistant. Be concise in your responses.

Here is some additional context that makes this system prompt long enough to trigger caching:

${Array(50)
	.fill(
		"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
	)
	.join("\n\n")}

Remember: Always be helpful and concise.`;

async function testTotalTokensWithCache<TApi extends Api>(
	llm: Model<TApi>,
	options: StreamOptionsWithExtras = {},
): Promise<{ first: Usage; second: Usage }> {
	// First request - no cache
	// 第一次请求 —— 无缓存
	const context1: Context = {
		systemPrompt: LONG_SYSTEM_PROMPT,
		messages: [
			{
				role: "user",
				content: "What is 2 + 2? Reply with just the number.",
				timestamp: Date.now(),
			},
		],
	};

	const response1 = await complete(llm, context1, options);
	expect(response1.stopReason).toBe("stop");

	// Second request - should trigger cache read (same system prompt, add conversation)
	// 第二次请求 —— 应当触发缓存读取(系统提示词相同,追加对话内容)
	const context2: Context = {
		systemPrompt: LONG_SYSTEM_PROMPT,
		messages: [
			...context1.messages,
			response1, // Include previous assistant response
			// 包含上一条 assistant 响应
			{
				role: "user",
				content: "What is 3 + 3? Reply with just the number.",
				timestamp: Date.now(),
			},
		],
	};

	const response2 = await complete(llm, context2, options);
	expect(response2.stopReason).toBe("stop");

	return { first: response1.usage, second: response2.usage };
}

function logUsage(label: string, usage: Usage) {
	const computed = usage.input + usage.output + usage.cacheRead + usage.cacheWrite;
	console.log(`  ${label}:`);
	console.log(
		`    input: ${usage.input}, output: ${usage.output}, cacheRead: ${usage.cacheRead}, cacheWrite: ${usage.cacheWrite}`,
	);
	console.log(`    totalTokens: ${usage.totalTokens}, computed: ${computed}`);
}

function assertTotalTokensEqualsComponents(usage: Usage) {
	const computed = usage.input + usage.output + usage.cacheRead + usage.cacheWrite;
	expect(usage.totalTokens).toBe(computed);
}

describe("totalTokens field", () => {
	// =========================================================================
	// Anthropic
	// Anthropic(Anthropic)
	// =========================================================================

	describe.skipIf(!process.env.ANTHROPIC_API_KEY)("Anthropic (API Key)", () => {
		it(
			"claude-sonnet-4-5 - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				const llm = getModel("anthropic", "claude-sonnet-4-5");

				console.log(`\nAnthropic / ${llm.id}:`);
				const { first, second } = await testTotalTokensWithCache(llm, { apiKey: process.env.ANTHROPIC_API_KEY });

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);

				// Anthropic should have cache activity
				// Anthropic 应当有缓存活动
				const hasCache = second.cacheRead > 0 || second.cacheWrite > 0 || first.cacheWrite > 0;
				expect(hasCache).toBe(true);
			},
		);
	});

	describe("Anthropic (OAuth)", () => {
		it.skipIf(!anthropicOAuthToken)(
			"claude-sonnet-4 - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				const llm = getModel("anthropic", "claude-sonnet-4-6");

				console.log(`\nAnthropic OAuth / ${llm.id}:`);
				const { first, second } = await testTotalTokensWithCache(llm, { apiKey: anthropicOAuthToken });

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);

				// Anthropic should have cache activity
				// Anthropic 应当有缓存活动
				const hasCache = second.cacheRead > 0 || second.cacheWrite > 0 || first.cacheWrite > 0;
				expect(hasCache).toBe(true);
			},
		);
	});

	// =========================================================================
	// OpenAI
	// OpenAI(OpenAI)
	// =========================================================================

	describe.skipIf(!process.env.OPENAI_API_KEY)("OpenAI Completions", () => {
		it(
			"gpt-4o-mini - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				const { compat: _compat, ...baseModel } = getModel("openai", "gpt-4o-mini")!;
				void _compat;
				const llm: Model<"openai-completions"> = {
					...baseModel,
					api: "openai-completions",
				};

				console.log(`\nOpenAI Completions / ${llm.id}:`);
				const { first, second } = await testTotalTokensWithCache(llm);

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	describe.skipIf(!process.env.OPENAI_API_KEY)("OpenAI Responses", () => {
		it(
			"claude-haiku-4.5 - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				const llm = getModel("openai", "gpt-4o");

				console.log(`\nOpenAI Responses / ${llm.id}:`);
				const { first, second } = await testTotalTokensWithCache(llm);

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	describe.skipIf(!hasAzureOpenAICredentials())("Azure OpenAI Responses", () => {
		it(
			"gpt-4o-mini - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				const llm = getModel("azure-openai-responses", "gpt-4o-mini");
				const azureDeploymentName = resolveAzureDeploymentName(llm.id);
				const azureOptions = azureDeploymentName ? { azureDeploymentName } : {};

				console.log(`\nAzure OpenAI Responses / ${llm.id}:`);
				const { first, second } = await testTotalTokensWithCache(llm, azureOptions);

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	// =========================================================================
	// Google
	// Google(谷歌)
	// =========================================================================

	describe.skipIf(!process.env.GEMINI_API_KEY)("Google", () => {
		it(
			"gemini-2.0-flash - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				const llm = getModel("google", "gemini-2.0-flash");

				console.log(`\nGoogle / ${llm.id}:`);
				const { first, second } = await testTotalTokensWithCache(llm);

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	// =========================================================================
	// xAI
	// xAI(xAI)
	// =========================================================================

	describe.skipIf(!process.env.XAI_API_KEY)("xAI", () => {
		it("grok-4.3 - should return totalTokens equal to sum of components", { retry: 3, timeout: 60000 }, async () => {
			const llm = getModel("xai", "grok-4.3");

			console.log(`\nxAI / ${llm.id}:`);
			const { first, second } = await testTotalTokensWithCache(llm, { apiKey: process.env.XAI_API_KEY });

			logUsage("First request", first);
			logUsage("Second request", second);

			assertTotalTokensEqualsComponents(first);
			assertTotalTokensEqualsComponents(second);
		});
	});

	// =========================================================================
	// Groq
	// Groq(Groq)
	// =========================================================================

	describe.skipIf(!process.env.GROQ_API_KEY)("Groq", () => {
		it(
			"openai/gpt-oss-120b - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				const llm = getModel("groq", "openai/gpt-oss-120b");

				console.log(`\nGroq / ${llm.id}:`);
				const { first, second } = await testTotalTokensWithCache(llm, { apiKey: process.env.GROQ_API_KEY });

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	// =========================================================================
	// Cerebras
	// Cerebras(Cerebras)
	// =========================================================================

	describe.skipIf(!process.env.CEREBRAS_API_KEY)("Cerebras", () => {
		it(
			"gpt-oss-120b - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				const llm = getModel("cerebras", "gpt-oss-120b");

				console.log(`\nCerebras / ${llm.id}:`);
				const { first, second } = await testTotalTokensWithCache(llm, { apiKey: process.env.CEREBRAS_API_KEY });

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	// =========================================================================
	// Cloudflare Workers AI
	// Cloudflare Workers AI(Cloudflare Workers AI)
	// =========================================================================

	describe.skipIf(!hasCloudflareWorkersAICredentials())("Cloudflare Workers AI", () => {
		it(
			"@cf/moonshotai/kimi-k2.6 - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				const llm = getModel("cloudflare-workers-ai", "@cf/moonshotai/kimi-k2.6");

				console.log(`\nCloudflare Workers AI / ${llm.id}:`);
				const { first, second } = await testTotalTokensWithCache(llm, {
					apiKey: process.env.CLOUDFLARE_API_KEY,
				});

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	// =========================================================================
	// Cloudflare AI Gateway
	// Cloudflare AI 网关(Cloudflare AI Gateway)
	// =========================================================================

	describe.skipIf(!hasCloudflareAiGatewayCredentials())("Cloudflare AI Gateway", () => {
		it(
			"workers-ai/@cf/moonshotai/kimi-k2.6 - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				const llm = getModel("cloudflare-ai-gateway", "workers-ai/@cf/moonshotai/kimi-k2.6");

				console.log(`\nCloudflare AI Gateway / ${llm.id}:`);
				const { first, second } = await testTotalTokensWithCache(llm, {
					apiKey: process.env.CLOUDFLARE_API_KEY,
				});

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	// =========================================================================
	// Hugging Face
	// Hugging Face(Hugging Face)
	// =========================================================================

	describe.skipIf(!process.env.HF_TOKEN)("Hugging Face", () => {
		it("Kimi-K2.5 - should return totalTokens equal to sum of components", { retry: 3, timeout: 60000 }, async () => {
			const llm = getModel("huggingface", "moonshotai/Kimi-K2.5");

			console.log(`\nHugging Face / ${llm.id}:`);
			const { first, second } = await testTotalTokensWithCache(llm, { apiKey: process.env.HF_TOKEN });

			logUsage("First request", first);
			logUsage("Second request", second);

			assertTotalTokensEqualsComponents(first);
			assertTotalTokensEqualsComponents(second);
		});
	});

	// =========================================================================
	// Together AI
	// Together AI(Together AI)
	// =========================================================================

	describe.skipIf(!process.env.TOGETHER_API_KEY)("Together AI", () => {
		it("Kimi-K2.6 - should return totalTokens equal to sum of components", { retry: 3, timeout: 60000 }, async () => {
			const llm = getModel("together", "moonshotai/Kimi-K2.6");

			console.log(`\nTogether AI / ${llm.id}:`);
			const { first, second } = await testTotalTokensWithCache(llm, {
				apiKey: process.env.TOGETHER_API_KEY,
				reasoningEffort: "high",
			});

			logUsage("First request", first);
			logUsage("Second request", second);

			assertTotalTokensEqualsComponents(first);
			assertTotalTokensEqualsComponents(second);
		});
	});

	// =========================================================================
	// z.ai
	// z.ai(z.ai)
	// =========================================================================

	describe.skipIf(!process.env.ZAI_API_KEY)("z.ai", () => {
		it(
			"glm-4.5-air - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				const llm = getModel("zai", "glm-4.5-air");

				console.log(`\nz.ai / ${llm.id}:`);
				const { first, second } = await testTotalTokensWithCache(llm, { apiKey: process.env.ZAI_API_KEY });

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	// =========================================================================
	// Mistral
	// Mistral(Mistral)
	// =========================================================================

	describe.skipIf(!process.env.MISTRAL_API_KEY)("Mistral", () => {
		it(
			"devstral-medium-latest - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				const llm = getModel("mistral", "devstral-medium-latest");

				console.log(`\nMistral / ${llm.id}:`);
				const { first, second } = await testTotalTokensWithCache(llm, { apiKey: process.env.MISTRAL_API_KEY });

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	// =========================================================================
	// MiniMax
	// MiniMax(MiniMax)
	// =========================================================================

	describe.skipIf(!process.env.MINIMAX_API_KEY)("MiniMax", () => {
		it(
			"MiniMax-M2.7 - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				const llm = getModel("minimax", "MiniMax-M2.7");

				console.log(`\nMiniMax / ${llm.id}:`);
				const { first, second } = await testTotalTokensWithCache(llm, { apiKey: process.env.MINIMAX_API_KEY });

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	// =========================================================================
	// Xiaomi MiMo
	// 小米 MiMo(Xiaomi MiMo)
	// =========================================================================

	describe.skipIf(!process.env.XIAOMI_API_KEY)("Xiaomi MiMo (API billing)", () => {
		it(
			"mimo-v2.5-pro - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				const llm = getModel("xiaomi", "mimo-v2.5-pro");

				console.log(`\nXiaomi MiMo / ${llm.id}:`);
				const { first, second } = await testTotalTokensWithCache(llm, { apiKey: process.env.XIAOMI_API_KEY });

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	// =========================================================================
	// Xiaomi MiMo Token Plan CN
	// 小米 MiMo Token 套餐 CN(Xiaomi MiMo Token Plan CN)
	// =========================================================================

	describe.skipIf(!process.env.XIAOMI_TOKEN_PLAN_CN_API_KEY)("Xiaomi MiMo Token Plan (CN)", () => {
		it(
			"mimo-v2.5-pro - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				const llm = getModel("xiaomi-token-plan-cn", "mimo-v2.5-pro");

				console.log(`\nXiaomi MiMo Token Plan CN / ${llm.id}:`);
				const { first, second } = await testTotalTokensWithCache(llm, {
					apiKey: process.env.XIAOMI_TOKEN_PLAN_CN_API_KEY,
				});

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	// =========================================================================
	// Xiaomi MiMo Token Plan AMS
	// 小米 MiMo Token 套餐 AMS(Xiaomi MiMo Token Plan AMS)
	// =========================================================================

	describe.skipIf(!process.env.XIAOMI_TOKEN_PLAN_AMS_API_KEY)("Xiaomi MiMo Token Plan (AMS)", () => {
		it(
			"mimo-v2.5-pro - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				const llm = getModel("xiaomi-token-plan-ams", "mimo-v2.5-pro");

				console.log(`\nXiaomi MiMo Token Plan AMS / ${llm.id}:`);
				const { first, second } = await testTotalTokensWithCache(llm, {
					apiKey: process.env.XIAOMI_TOKEN_PLAN_AMS_API_KEY,
				});

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	// =========================================================================
	// Xiaomi MiMo Token Plan SGP
	// 小米 MiMo Token 套餐 SGP(Xiaomi MiMo Token Plan SGP)
	// =========================================================================

	describe.skipIf(!process.env.XIAOMI_TOKEN_PLAN_SGP_API_KEY)("Xiaomi MiMo Token Plan (SGP)", () => {
		it(
			"mimo-v2.5-pro - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				const llm = getModel("xiaomi-token-plan-sgp", "mimo-v2.5-pro");

				console.log(`\nXiaomi MiMo Token Plan SGP / ${llm.id}:`);
				const { first, second } = await testTotalTokensWithCache(llm, {
					apiKey: process.env.XIAOMI_TOKEN_PLAN_SGP_API_KEY,
				});

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	// =========================================================================
	// Qwen Token Plan
	// 通义千问 Token 套餐(Qwen Token Plan)
	// =========================================================================

	describe.skipIf(!process.env.QWEN_TOKEN_PLAN_API_KEY)("Qwen Token Plan", () => {
		it(
			"qwen3.7-max - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				const llm = getModel("qwen-token-plan", "qwen3.7-max");

				console.log(`\nQwen Token Plan / ${llm.id}:`);
				const { first, second } = await testTotalTokensWithCache(llm, {
					apiKey: process.env.QWEN_TOKEN_PLAN_API_KEY,
				});

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	// =========================================================================
	// Qwen Token Plan CN
	// 通义千问 Token 套餐 CN(Qwen Token Plan CN)
	// =========================================================================

	describe.skipIf(!process.env.QWEN_TOKEN_PLAN_CN_API_KEY)("Qwen Token Plan (CN)", () => {
		it(
			"qwen3.7-max - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				const llm = getModel("qwen-token-plan-cn", "qwen3.7-max");

				console.log(`\nQwen Token Plan CN / ${llm.id}:`);
				const { first, second } = await testTotalTokensWithCache(llm, {
					apiKey: process.env.QWEN_TOKEN_PLAN_CN_API_KEY,
				});

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	// =========================================================================
	// Kimi For Coding
	// Kimi For Coding(Kimi 编程版)
	// =========================================================================

	describe.skipIf(!process.env.KIMI_API_KEY)("Kimi For Coding", () => {
		it(
			"kimi-for-coding - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				const llm = getModel("kimi-coding", "kimi-for-coding");

				console.log(`\nKimi For Coding / ${llm.id}:`);
				const { first, second } = await testTotalTokensWithCache(llm, { apiKey: process.env.KIMI_API_KEY });

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	// =========================================================================
	// Vercel AI Gateway
	// Vercel AI 网关(Vercel AI Gateway)
	// =========================================================================

	describe.skipIf(!process.env.AI_GATEWAY_API_KEY)("Vercel AI Gateway", () => {
		it(
			"google/gemini-2.5-flash - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				const llm = getModel("vercel-ai-gateway", "google/gemini-2.5-flash");

				console.log(`\nVercel AI Gateway / ${llm.id}:`);
				const { first, second } = await testTotalTokensWithCache(llm, { apiKey: process.env.AI_GATEWAY_API_KEY });

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	// =========================================================================
	// OpenRouter - Multiple backend providers
	// OpenRouter —— 多个后端 provider
	// =========================================================================

	describe.skipIf(!process.env.OPENROUTER_API_KEY)("OpenRouter", () => {
		it(
			"anthropic/claude-sonnet-4 - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				const llm = getModel("openrouter", "anthropic/claude-sonnet-4");

				console.log(`\nOpenRouter / ${llm.id}:`);
				const { first, second } = await testTotalTokensWithCache(llm, { apiKey: process.env.OPENROUTER_API_KEY });

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);

		it(
			"deepseek/deepseek-chat - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				const llm = getModel("openrouter", "deepseek/deepseek-chat");

				console.log(`\nOpenRouter / ${llm.id}:`);
				const { first, second } = await testTotalTokensWithCache(llm, { apiKey: process.env.OPENROUTER_API_KEY });

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);

		it(
			"mistralai/mistral-small-3.2-24b-instruct - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				const llm = getModel("openrouter", "mistralai/mistral-small-3.2-24b-instruct");

				console.log(`\nOpenRouter / ${llm.id}:`);
				const { first, second } = await testTotalTokensWithCache(llm, { apiKey: process.env.OPENROUTER_API_KEY });

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);

		it(
			"google/gemini-2.5-flash - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				const llm = getModel("openrouter", "google/gemini-2.5-flash");

				console.log(`\nOpenRouter / ${llm.id}:`);
				const { first, second } = await testTotalTokensWithCache(llm, { apiKey: process.env.OPENROUTER_API_KEY });

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);

		it(
			"deepseek/deepseek-chat - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				const llm = getModel("openrouter", "deepseek/deepseek-chat");

				console.log(`\nOpenRouter / ${llm.id}:`);
				const { first, second } = await testTotalTokensWithCache(llm, { apiKey: process.env.OPENROUTER_API_KEY });

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	// =========================================================================
	// GitHub Copilot (OAuth)
	// GitHub Copilot(OAuth 方式)
	// =========================================================================

	describe("GitHub Copilot (OAuth)", () => {
		it.skipIf(!githubCopilotToken)(
			"claude-haiku-4.5 - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				const llm = getModel("github-copilot", "claude-haiku-4.5");

				console.log(`\nGitHub Copilot / ${llm.id}:`);
				const { first, second } = await testTotalTokensWithCache(llm, { apiKey: githubCopilotToken });

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);

		it.skipIf(!githubCopilotToken)(
			"claude-sonnet-4 - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				const llm = getModel("github-copilot", "claude-sonnet-4.6");

				console.log(`\nGitHub Copilot / ${llm.id}:`);
				const { first, second } = await testTotalTokensWithCache(llm, { apiKey: githubCopilotToken });

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	// =========================================================================
	// =========================================================================

	// =========================================================================
	// =========================================================================

	describe.skipIf(!hasBedrockCredentials())("Amazon Bedrock", () => {
		it(
			"claude-sonnet-4-5 - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				const llm = getModel("amazon-bedrock", "global.anthropic.claude-sonnet-4-5-20250929-v1:0");

				console.log(`\nAmazon Bedrock / ${llm.id}:`);
				const { first, second } = await testTotalTokensWithCache(llm);

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});

	// =========================================================================
	// OpenAI Codex (OAuth)
	// OpenAI Codex(OAuth 方式)
	// =========================================================================

	describe("OpenAI Codex (OAuth)", () => {
		it.skipIf(!openaiCodexToken)(
			"gpt-5.5 - should return totalTokens equal to sum of components",
			{ retry: 3, timeout: 60000 },
			async () => {
				const llm = getModel("openai-codex", "gpt-5.5");

				console.log(`\nOpenAI Codex / ${llm.id}:`);
				const { first, second } = await testTotalTokensWithCache(llm, { apiKey: openaiCodexToken });

				logUsage("First request", first);
				logUsage("Second request", second);

				assertTotalTokensEqualsComponents(first);
				assertTotalTokensEqualsComponents(second);
			},
		);
	});
});
