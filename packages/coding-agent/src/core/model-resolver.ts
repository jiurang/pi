/**
 * Model resolution, scoping, and initial selection
 * 模型解析、作用域（scoping）限定与初始模型选择
 */

import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import { type Api, type KnownProvider, type Model, modelsAreEqual } from "@earendil-works/pi-ai";
import chalk from "chalk";
import { minimatch } from "minimatch";
import { isValidThinkingLevel } from "../cli/args.ts";
import { DEFAULT_THINKING_LEVEL } from "./defaults.ts";
import type { ModelRuntime } from "./model-runtime.ts";

/** Default model IDs for each known provider
 *  每个已知提供商（provider）的默认模型 ID */
export const defaultModelPerProvider: Record<KnownProvider, string> = {
	"amazon-bedrock": "us.anthropic.claude-opus-4-6-v1",
	"ant-ling": "Ring-2.6-1T",
	anthropic: "claude-opus-4-8",
	openai: "gpt-5.5",
	"azure-openai-responses": "gpt-5.4",
	"openai-codex": "gpt-5.5",
	radius: "auto",
	nvidia: "nvidia/nemotron-3-super-120b-a12b",
	deepseek: "deepseek-v4-pro",
	google: "gemini-3.1-pro-preview",
	"google-vertex": "gemini-3.1-pro-preview",
	"github-copilot": "gpt-5.4",
	openrouter: "moonshotai/kimi-k2.6",
	"vercel-ai-gateway": "zai/glm-5.1",
	xai: "grok-4.5",
	groq: "openai/gpt-oss-120b",
	cerebras: "zai-glm-4.7",
	zai: "glm-5.1",
	"zai-coding-cn": "glm-5.1",
	mistral: "devstral-medium-latest",
	minimax: "MiniMax-M2.7",
	"minimax-cn": "MiniMax-M2.7",
	moonshotai: "kimi-k2.6",
	"moonshotai-cn": "kimi-k2.6",
	huggingface: "moonshotai/Kimi-K2.6",
	fireworks: "accounts/fireworks/models/kimi-k2p6",
	together: "moonshotai/Kimi-K2.6",
	opencode: "kimi-k2.6",
	"opencode-go": "kimi-k2.6",
	"kimi-coding": "kimi-for-coding",
	"cloudflare-workers-ai": "@cf/moonshotai/kimi-k2.6",
	"cloudflare-ai-gateway": "workers-ai/@cf/moonshotai/kimi-k2.6",
	"qwen-token-plan": "qwen3.7-max",
	"qwen-token-plan-cn": "qwen3.7-max",
	xiaomi: "mimo-v2.5-pro",
	"xiaomi-token-plan-cn": "mimo-v2.5-pro",
	"xiaomi-token-plan-ams": "mimo-v2.5-pro",
	"xiaomi-token-plan-sgp": "mimo-v2.5-pro",
};

export interface ScopedModel {
	model: Model<Api>;
	/** Thinking level if explicitly specified in pattern (e.g., "model:high"), undefined otherwise
	 *  若模式中显式指定了思考级别（thinking level，例如 "model:high"）则为该值，否则为 undefined */
	thinkingLevel?: ThinkingLevel;
}

/**
 * Helper to check if a model ID looks like an alias (no date suffix)
 * 用于判断某个模型 ID 是否形如别名（alias，即不带日期后缀）的辅助函数
 * Dates are typically in format: -20241022 or -20250929
 * 日期通常采用如下格式：-20241022 或 -20250929
 */
function isAlias(id: string): boolean {
	// Check if ID ends with -latest
	// 检查 ID 是否以 -latest 结尾
	if (id.endsWith("-latest")) return true;

	// Check if ID ends with a date pattern (-YYYYMMDD)
	// 检查 ID 是否以日期模式（-YYYYMMDD）结尾
	const datePattern = /-\d{8}$/;
	return !datePattern.test(id);
}

/**
 * Find an exact model reference match.
 * 查找精确匹配的模型引用。
 * Supports either a bare model id or a canonical provider/modelId reference.
 * 既支持裸模型 id，也支持规范形式的 provider/modelId 引用。
 * When matching by bare id, ambiguous matches across providers are rejected.
 * 按裸 id 匹配时，若在多个提供商之间产生歧义匹配，则拒绝该结果。
 */
export function findExactModelReferenceMatch(
	modelReference: string,
	availableModels: Model<Api>[],
): Model<Api> | undefined {
	const trimmedReference = modelReference.trim();
	if (!trimmedReference) {
		return undefined;
	}

	const normalizedReference = trimmedReference.toLowerCase();

	const canonicalMatches = availableModels.filter(
		(model) => `${model.provider}/${model.id}`.toLowerCase() === normalizedReference,
	);
	if (canonicalMatches.length === 1) {
		return canonicalMatches[0];
	}
	if (canonicalMatches.length > 1) {
		return undefined;
	}

	const slashIndex = trimmedReference.indexOf("/");
	if (slashIndex !== -1) {
		const provider = trimmedReference.substring(0, slashIndex).trim();
		const modelId = trimmedReference.substring(slashIndex + 1).trim();
		if (provider && modelId) {
			const providerMatches = availableModels.filter(
				(model) =>
					model.provider.toLowerCase() === provider.toLowerCase() &&
					model.id.toLowerCase() === modelId.toLowerCase(),
			);
			if (providerMatches.length === 1) {
				return providerMatches[0];
			}
			if (providerMatches.length > 1) {
				return undefined;
			}
		}
	}

	const idMatches = availableModels.filter((model) => model.id.toLowerCase() === normalizedReference);
	return idMatches.length === 1 ? idMatches[0] : undefined;
}

/**
 * Try to match a pattern to a model from the available models list.
 * 尝试将某个模式（pattern）匹配到可用模型列表中的某个模型。
 * Returns the matched model or undefined if no match found.
 * 返回匹配到的模型；若未找到匹配项则返回 undefined。
 */
function tryMatchModel(modelPattern: string, availableModels: Model<Api>[]): Model<Api> | undefined {
	const exactMatch = findExactModelReferenceMatch(modelPattern, availableModels);
	if (exactMatch) {
		return exactMatch;
	}

	// No exact match - fall back to partial matching
	// 没有精确匹配时，回退到部分匹配
	const matches = availableModels.filter(
		(m) =>
			m.id.toLowerCase().includes(modelPattern.toLowerCase()) ||
			m.name?.toLowerCase().includes(modelPattern.toLowerCase()),
	);

	if (matches.length === 0) {
		return undefined;
	}

	// Separate into aliases and dated versions
	// 将结果拆分为别名（alias）与带日期的版本两类
	const aliases = matches.filter((m) => isAlias(m.id));
	const datedVersions = matches.filter((m) => !isAlias(m.id));

	if (aliases.length > 0) {
		// Prefer alias - if multiple aliases, pick the one that sorts highest
		// 优先选用别名；若存在多个别名，则选取排序最靠前（最大）的那个
		aliases.sort((a, b) => b.id.localeCompare(a.id));
		return aliases[0];
	} else {
		// No alias found, pick latest dated version
		// 未找到别名时，选取日期最新的版本
		datedVersions.sort((a, b) => b.id.localeCompare(a.id));
		return datedVersions[0];
	}
}

export interface ParsedModelResult {
	model: Model<Api> | undefined;
	/** Thinking level if explicitly specified in pattern, undefined otherwise
	 *  若模式中显式指定了思考级别（thinking level）则为该值，否则为 undefined */
	thinkingLevel?: ThinkingLevel;
	warning: string | undefined;
}

function buildFallbackModel(provider: string, modelId: string, availableModels: Model<Api>[]): Model<Api> | undefined {
	const providerModels = availableModels.filter((m) => m.provider === provider);
	if (providerModels.length === 0) return undefined;

	const defaultId = defaultModelPerProvider[provider as KnownProvider];
	const baseModel = defaultId
		? (providerModels.find((m) => m.id === defaultId) ?? providerModels[0])
		: providerModels[0];

	return {
		...baseModel,
		id: modelId,
		name: modelId,
	};
}

/**
 * Parse a pattern to extract model and thinking level.
 * 解析模式字符串，从中提取模型与思考级别（thinking level）。
 * Handles models with colons in their IDs (e.g., OpenRouter's :exacto suffix).
 * 能够处理 ID 中含冒号的模型（例如 OpenRouter 的 :exacto 后缀）。
 *
 * Algorithm:
 * 算法：
 * 1. Try to match full pattern as a model
 *    先尝试将完整模式作为模型进行匹配
 * 2. If found, return it with "off" thinking level
 *    若匹配成功，则以 "off" 思考级别返回该模型
 * 3. If not found and has colons, split on last colon:
 *    若未匹配到且模式中含冒号，则在最后一个冒号处切分：
 *    - If suffix is valid thinking level, use it and recurse on prefix
 *      若后缀是合法的思考级别，则采用该级别并对前缀递归处理
 *    - If suffix is invalid, warn and recurse on prefix with "off"
 *      若后缀非法，则发出警告并以 "off" 对前缀递归处理
 *
 * @internal Exported for testing
 *           导出仅用于测试
 */
export function parseModelPattern(
	pattern: string,
	availableModels: Model<Api>[],
	options?: { allowInvalidThinkingLevelFallback?: boolean },
): ParsedModelResult {
	// Try exact match first
	// 先尝试精确匹配
	const exactMatch = tryMatchModel(pattern, availableModels);
	if (exactMatch) {
		return { model: exactMatch, thinkingLevel: undefined, warning: undefined };
	}

	// No match - try splitting on last colon if present
	// 未匹配到：若存在冒号，则尝试在最后一个冒号处切分
	const lastColonIndex = pattern.lastIndexOf(":");
	if (lastColonIndex === -1) {
		// No colons, pattern simply doesn't match any model
		// 不含冒号，说明该模式确实匹配不到任何模型
		return { model: undefined, thinkingLevel: undefined, warning: undefined };
	}

	const prefix = pattern.substring(0, lastColonIndex);
	const suffix = pattern.substring(lastColonIndex + 1);

	if (isValidThinkingLevel(suffix)) {
		// Valid thinking level - recurse on prefix and use this level
		// 合法的思考级别：对前缀递归处理，并采用该级别
		const result = parseModelPattern(prefix, availableModels, options);
		if (result.model) {
			// Only use this thinking level if no warning from inner recursion
			// 仅当内层递归未产生警告时，才采用该思考级别
			return {
				model: result.model,
				thinkingLevel: result.warning ? undefined : suffix,
				warning: result.warning,
			};
		}
		return result;
	} else {
		// Invalid suffix
		// 非法后缀
		const allowFallback = options?.allowInvalidThinkingLevelFallback ?? true;
		if (!allowFallback) {
			// In strict mode (CLI --model parsing), treat it as part of the model id and fail.
			// 在严格模式（CLI --model 解析）下，将其视为模型 id 的一部分并判定失败。
			// This avoids accidentally resolving to a different model.
			// 这样可避免意外解析到另一个模型。
			return { model: undefined, thinkingLevel: undefined, warning: undefined };
		}

		// Scope mode: recurse on prefix and warn
		// 作用域（scope）模式：对前缀递归处理并发出警告
		const result = parseModelPattern(prefix, availableModels, options);
		if (result.model) {
			return {
				model: result.model,
				thinkingLevel: undefined,
				warning: `Invalid thinking level "${suffix}" in pattern "${pattern}". Using default instead.`,
			};
		}
		return result;
	}
}

/**
 * Resolve model patterns to actual Model objects with optional thinking levels
 * 将模型模式解析为实际的 Model 对象，并可附带思考级别（thinking level）
 * Format: "pattern:level" where :level is optional
 * 格式："pattern:level"，其中 :level 为可选部分
 * For each pattern, finds all matching models and picks the best version:
 * 对每个模式，找出所有匹配的模型并挑选最佳版本：
 * 1. Prefer alias (e.g., claude-sonnet-4-5) over dated versions (claude-sonnet-4-5-20250929)
 *    优先选用别名（如 claude-sonnet-4-5）而非带日期的版本（如 claude-sonnet-4-5-20250929）
 * 2. If no alias, pick the latest dated version
 *    若无别名，则选取日期最新的版本
 *
 * Supports models with colons in their IDs (e.g., OpenRouter's model:exacto).
 * 支持 ID 中含冒号的模型（例如 OpenRouter 的 model:exacto）。
 * The algorithm tries to match the full pattern first, then progressively
 * strips colon-suffixes to find a match.
 * 该算法先尝试匹配完整模式，随后逐步剥离冒号后缀以寻找匹配项。
 */
export interface ModelScopeDiagnostic {
	type: "warning";
	code: "no-match" | "invalid-thinking-level";
	message: string;
	pattern: string;
}

export interface ResolveModelScopeResult {
	scopedModels: ScopedModel[];
	diagnostics: ModelScopeDiagnostic[];
}

export async function resolveModelScopeWithDiagnostics(
	patterns: string[],
	modelRuntime: ModelRuntime,
): Promise<ResolveModelScopeResult> {
	const availableModels = [...(await modelRuntime.getAvailable())];
	const scopedModels: ScopedModel[] = [];
	const diagnostics: ModelScopeDiagnostic[] = [];

	for (const pattern of patterns) {
		// Check if pattern contains glob characters
		// 检查模式中是否包含通配符（glob）字符
		if (pattern.includes("*") || pattern.includes("?") || pattern.includes("[")) {
			// Extract optional thinking level suffix (e.g., "provider/*:high")
			// 提取可选的思考级别后缀（例如 "provider/*:high"）
			const colonIdx = pattern.lastIndexOf(":");
			let globPattern = pattern;
			let thinkingLevel: ThinkingLevel | undefined;

			if (colonIdx !== -1) {
				const suffix = pattern.substring(colonIdx + 1);
				if (isValidThinkingLevel(suffix)) {
					thinkingLevel = suffix;
					globPattern = pattern.substring(0, colonIdx);
				}
			}

			const exactMatch = findExactModelReferenceMatch(globPattern, availableModels);
			if (exactMatch) {
				if (!scopedModels.find((sm) => modelsAreEqual(sm.model, exactMatch))) {
					scopedModels.push({ model: exactMatch, thinkingLevel });
				}
				continue;
			}

			// Match against "provider/modelId" format OR just model ID
			// 既可按 "provider/modelId" 形式匹配，也可仅按模型 ID 匹配
			// This allows "*sonnet*" to match without requiring "anthropic/*sonnet*"
			// 这样 "*sonnet*" 无需写成 "anthropic/*sonnet*" 即可匹配
			const matchingModels = availableModels.filter((m) => {
				const fullId = `${m.provider}/${m.id}`;
				return minimatch(fullId, globPattern, { nocase: true }) || minimatch(m.id, globPattern, { nocase: true });
			});

			if (matchingModels.length === 0) {
				diagnostics.push({
					type: "warning",
					code: "no-match",
					message: `No models match pattern "${pattern}"`,
					pattern,
				});
				continue;
			}

			for (const model of matchingModels) {
				if (!scopedModels.find((sm) => modelsAreEqual(sm.model, model))) {
					scopedModels.push({ model, thinkingLevel });
				}
			}
			continue;
		}

		const { model, thinkingLevel, warning } = parseModelPattern(pattern, availableModels);

		if (warning) {
			diagnostics.push({ type: "warning", code: "invalid-thinking-level", message: warning, pattern });
		}

		if (!model) {
			diagnostics.push({
				type: "warning",
				code: "no-match",
				message: `No models match pattern "${pattern}"`,
				pattern,
			});
			continue;
		}

		// Avoid duplicates
		// 避免重复项
		if (!scopedModels.find((sm) => modelsAreEqual(sm.model, model))) {
			scopedModels.push({ model, thinkingLevel });
		}
	}

	return { scopedModels, diagnostics };
}

export async function resolveModelScope(patterns: string[], modelRuntime: ModelRuntime): Promise<ScopedModel[]> {
	const { scopedModels, diagnostics } = await resolveModelScopeWithDiagnostics(patterns, modelRuntime);
	for (const diagnostic of diagnostics) {
		console.warn(chalk.yellow(`Warning: ${diagnostic.message}`));
	}
	return scopedModels;
}

export interface ResolveCliModelResult {
	model: Model<Api> | undefined;
	thinkingLevel?: ThinkingLevel;
	warning: string | undefined;
	/**
	 * Error message suitable for CLI display.
	 * 适合在 CLI 中展示的错误信息。
	 * When set, model will be undefined.
	 * 当该字段有值时，model 将为 undefined。
	 */
	error: string | undefined;
}

/**
 * Resolve a single model from CLI flags.
 * 根据 CLI 参数解析出单个模型。
 *
 * Supports:
 * 支持：
 * - --provider <provider> --model <pattern>
 * - --model <provider>/<pattern>
 * - Fuzzy matching (same rules as model scoping: exact id, then partial id/name)
 *   模糊匹配（规则与模型作用域限定一致：先精确 id，再按 id/name 部分匹配）
 *
 * Note: This does not apply the thinking level by itself, but it may *parse* and
 * return a thinking level from "<pattern>:<thinking>" so the caller can apply it.
 * 注意：本函数自身不会应用思考级别（thinking level），但可能会从 "<pattern>:<thinking>"
 * 中*解析*出思考级别并返回，交由调用方去应用。
 */
export function resolveCliModel(options: {
	cliProvider?: string;
	cliModel?: string;
	cliThinking?: ThinkingLevel;
	modelRuntime: ModelRuntime;
}): ResolveCliModelResult {
	const { cliProvider, cliModel, cliThinking, modelRuntime } = options;

	if (!cliModel) {
		return { model: undefined, warning: undefined, error: undefined };
	}

	// Important: use *all* models here, not just models with pre-configured auth.
	// 重要：此处要使用*全部*模型，而不仅是已预先配置鉴权（auth）的模型。
	// This allows "--api-key" to be used for first-time setup.
	// 这样才能用 "--api-key" 来完成首次配置。
	const availableModels = [...modelRuntime.getModels()];
	if (availableModels.length === 0) {
		return {
			model: undefined,
			warning: undefined,
			error: "No models available. Check your installation or add models to models.json.",
		};
	}

	// Build canonical provider lookup (case-insensitive)
	// 构建规范提供商名称的查找表（大小写不敏感）
	const providerMap = new Map<string, string>();
	for (const m of availableModels) {
		providerMap.set(m.provider.toLowerCase(), m.provider);
	}

	let provider = cliProvider ? providerMap.get(cliProvider.toLowerCase()) : undefined;
	if (cliProvider && !provider) {
		return {
			model: undefined,
			warning: undefined,
			error: `Unknown provider "${cliProvider}". Use --list-models to see available providers/models.`,
		};
	}

	// If no explicit --provider, try to interpret "provider/model" format first.
	// 若未显式指定 --provider，则先尝试按 "provider/model" 格式解释。
	// When the prefix before the first slash matches a known provider, prefer that
	// interpretation over matching models whose IDs literally contain slashes
	// 当第一个斜杠之前的前缀匹配某个已知提供商时，优先采用该解释，
	// 而不是去匹配 ID 中字面包含斜杠的模型
	// (e.g. "zai/glm-5" should resolve to provider=zai, model=glm-5, not to a
	// vercel-ai-gateway model with id "zai/glm-5").
	// （例如 "zai/glm-5" 应解析为 provider=zai、model=glm-5，而不是解析为
	// id 为 "zai/glm-5" 的 vercel-ai-gateway 模型）。
	let pattern = cliModel;
	let inferredProvider = false;

	if (!provider) {
		const slashIndex = cliModel.indexOf("/");
		if (slashIndex !== -1) {
			const maybeProvider = cliModel.substring(0, slashIndex);
			const canonical = providerMap.get(maybeProvider.toLowerCase());
			if (canonical) {
				provider = canonical;
				pattern = cliModel.substring(slashIndex + 1);
				inferredProvider = true;
			}
		}
	}

	// If no provider was inferred from the slash, try exact matches without provider inference.
	// 若未能从斜杠推断出提供商，则在不做提供商推断的前提下尝试精确匹配。
	// This handles models whose IDs naturally contain slashes (e.g. OpenRouter-style IDs).
	// 这样可处理那些 ID 本身就含斜杠的模型（例如 OpenRouter 风格的 ID）。
	if (!provider) {
		const lower = cliModel.toLowerCase();
		const exact = availableModels.find(
			(m) => m.id.toLowerCase() === lower || `${m.provider}/${m.id}`.toLowerCase() === lower,
		);
		if (exact) {
			return { model: exact, warning: undefined, thinkingLevel: undefined, error: undefined };
		}
	}

	if (cliProvider && provider) {
		// If both were provided, tolerate --model <provider>/<pattern> by stripping the provider prefix
		// 若两者都提供了，则通过剥离提供商前缀来兼容 --model <provider>/<pattern> 的写法
		const prefix = `${provider}/`;
		if (cliModel.toLowerCase().startsWith(prefix.toLowerCase())) {
			pattern = cliModel.substring(prefix.length);
		}
	}

	const candidates = provider ? availableModels.filter((m) => m.provider === provider) : availableModels;
	const { model, thinkingLevel, warning } = parseModelPattern(pattern, candidates, {
		allowInvalidThinkingLevelFallback: false,
	});

	if (model) {
		// If provider inference matched an unauthenticated provider/model pair, prefer
		// one exact raw model-id match that is authenticated. This keeps
		// 若提供商推断得到的是一个未通过鉴权的 provider/model 组合，则优先选用
		// 某个已通过鉴权、且原始模型 id 精确匹配的模型。这样在可用时
		// "provider/model" syntax preferred when usable, but handles models whose
		// literal id starts with a known provider name (for example
		// 仍优先保留 "provider/model" 语法，同时也能处理那些字面 id 以
		// 已知提供商名称开头的模型（例如
		// commandcode model id "xiaomi/mimo-v2.5-pro").
		// commandcode 的模型 id "xiaomi/mimo-v2.5-pro"）。
		if (inferredProvider) {
			const rawExactMatches = availableModels.filter(
				(m) => m.id.toLowerCase() === cliModel.toLowerCase() && !modelsAreEqual(m, model),
			);
			if (rawExactMatches.length > 0 && !modelRuntime.hasConfiguredAuth(model.provider)) {
				const authenticatedRawMatches = rawExactMatches.filter((m) => modelRuntime.hasConfiguredAuth(m.provider));
				if (authenticatedRawMatches.length === 1) {
					return {
						model: authenticatedRawMatches[0],
						thinkingLevel: undefined,
						warning: undefined,
						error: undefined,
					};
				}
			}
		}
		return { model, thinkingLevel, warning, error: undefined };
	}

	// If we inferred a provider from the slash but found no match within that provider,
	// fall back to matching the full input as a raw model id across all models.
	// 若已从斜杠推断出提供商，但在该提供商范围内没有匹配项，
	// 则回退为把完整输入当作原始模型 id，在全部模型中进行匹配。
	// This handles OpenRouter-style IDs like "openai/gpt-4o:extended" where "openai"
	// looks like a provider but the full string is actually a model id on openrouter.
	// 这样可处理形如 "openai/gpt-4o:extended" 的 OpenRouter 风格 ID：其中 "openai"
	// 看起来像提供商，但整个字符串实际上是 openrouter 上的一个模型 id。
	if (inferredProvider) {
		const lower = cliModel.toLowerCase();
		const exact = availableModels.find(
			(m) => m.id.toLowerCase() === lower || `${m.provider}/${m.id}`.toLowerCase() === lower,
		);
		if (exact) {
			return { model: exact, warning: undefined, thinkingLevel: undefined, error: undefined };
		}
		// Also try parseModelPattern on the full input against all models
		// 同时也对完整输入在全部模型上尝试 parseModelPattern
		const fallback = parseModelPattern(cliModel, availableModels, {
			allowInvalidThinkingLevelFallback: false,
		});
		if (fallback.model) {
			return {
				model: fallback.model,
				thinkingLevel: fallback.thinkingLevel,
				warning: fallback.warning,
				error: undefined,
			};
		}
	}

	if (provider) {
		// Parse thinking level suffix from the pattern before building the fallback model,
		// but only when --thinking is not explicitly provided.
		// 在构建回退模型之前，先从模式中解析出思考级别后缀，
		// 但仅在未显式提供 --thinking 时才这样做。
		// e.g. "zai-org/GLM-5.1-FP8:high" → modelId="zai-org/GLM-5.1-FP8", fallbackThinking="high"
		// 例如 "zai-org/GLM-5.1-FP8:high" → modelId="zai-org/GLM-5.1-FP8"，fallbackThinking="high"
		let fallbackPattern = pattern;
		let fallbackThinking: ThinkingLevel | undefined;
		if (!cliThinking) {
			const lastColon = pattern.lastIndexOf(":");
			if (lastColon !== -1) {
				const suffix = pattern.substring(lastColon + 1);
				if (isValidThinkingLevel(suffix)) {
					fallbackPattern = pattern.substring(0, lastColon);
					fallbackThinking = suffix;
				}
			}
		}

		const fallbackModel = buildFallbackModel(provider, fallbackPattern, availableModels);
		if (fallbackModel) {
			const requestedThinking = cliThinking ?? fallbackThinking;
			const model =
				requestedThinking && requestedThinking !== "off" ? { ...fallbackModel, reasoning: true } : fallbackModel;
			const fallbackWarning = warning
				? `${warning} Model "${fallbackPattern}" not found for provider "${provider}". Using custom model id.`
				: `Model "${fallbackPattern}" not found for provider "${provider}". Using custom model id.`;
			return { model, thinkingLevel: fallbackThinking, warning: fallbackWarning, error: undefined };
		}
	}

	const display = provider ? `${provider}/${pattern}` : cliModel;
	return {
		model: undefined,
		thinkingLevel: undefined,
		warning,
		error: `Model "${display}" not found. Use --list-models to see available models.`,
	};
}

export interface InitialModelResult {
	model: Model<Api> | undefined;
	thinkingLevel: ThinkingLevel;
	fallbackMessage: string | undefined;
}

/**
 * Find the initial model to use based on priority:
 * 按以下优先级确定要使用的初始模型：
 * 1. CLI args (provider + model)
 *    CLI 参数（provider + model）
 * 2. First model from scoped models (if not continuing/resuming)
 *    作用域模型列表中的第一个模型（在非继续/恢复会话的情况下）
 * 3. Restored from session (if continuing/resuming)
 *    从会话中恢复的模型（在继续/恢复会话的情况下）
 * 4. Saved default from settings
 *    设置中保存的默认模型
 * 5. First available model with valid API key
 *    第一个具备有效 API key 的可用模型
 */
export async function findInitialModel(options: {
	cliProvider?: string;
	cliModel?: string;
	scopedModels: ScopedModel[];
	isContinuing: boolean;
	defaultProvider?: string;
	defaultModelId?: string;
	defaultThinkingLevel?: ThinkingLevel;
	modelRuntime: ModelRuntime;
}): Promise<InitialModelResult> {
	const {
		cliProvider,
		cliModel,
		scopedModels,
		isContinuing,
		defaultProvider,
		defaultModelId,
		defaultThinkingLevel,
		modelRuntime,
	} = options;

	let model: Model<Api> | undefined;
	let thinkingLevel: ThinkingLevel = DEFAULT_THINKING_LEVEL;

	// 1. CLI args take priority
	// 1. CLI 参数具有最高优先级
	if (cliProvider && cliModel) {
		const resolved = resolveCliModel({
			cliProvider,
			cliModel,
			modelRuntime,
		});
		if (resolved.error) {
			console.error(chalk.red(resolved.error));
			process.exit(1);
		}
		if (resolved.model) {
			return { model: resolved.model, thinkingLevel: DEFAULT_THINKING_LEVEL, fallbackMessage: undefined };
		}
	}

	// 2. Use first model from scoped models (skip if continuing/resuming)
	// 2. 使用作用域模型列表中的第一个模型（若为继续/恢复会话则跳过）
	if (scopedModels.length > 0 && !isContinuing) {
		return {
			model: scopedModels[0].model,
			thinkingLevel: scopedModels[0].thinkingLevel ?? defaultThinkingLevel ?? DEFAULT_THINKING_LEVEL,
			fallbackMessage: undefined,
		};
	}

	// 3. Try saved default from settings if auth is configured.
	// 3. 若已配置鉴权（auth），则尝试使用设置中保存的默认模型。
	if (defaultProvider && defaultModelId) {
		const found = modelRuntime.getModel(defaultProvider, defaultModelId);
		if (found && modelRuntime.hasConfiguredAuth(found.provider)) {
			model = found;
			if (defaultThinkingLevel) {
				thinkingLevel = defaultThinkingLevel;
			}
			return { model, thinkingLevel, fallbackMessage: undefined };
		}
	}

	// 4. Try first available model with valid API key
	// 4. 尝试使用第一个具备有效 API key 的可用模型
	const availableModels = [...(await modelRuntime.getAvailable())];

	if (availableModels.length > 0) {
		// Try to find a default model from known providers
		// 尝试从已知提供商中找出一个默认模型
		for (const provider of Object.keys(defaultModelPerProvider) as KnownProvider[]) {
			const defaultId = defaultModelPerProvider[provider];
			const match = availableModels.find((m) => m.provider === provider && m.id === defaultId);
			if (match) {
				return { model: match, thinkingLevel: DEFAULT_THINKING_LEVEL, fallbackMessage: undefined };
			}
		}

		// If no default found, use first available
		// 若未找到默认模型，则使用第一个可用模型
		return { model: availableModels[0], thinkingLevel: DEFAULT_THINKING_LEVEL, fallbackMessage: undefined };
	}

	// 5. No model found
	// 5. 未找到任何模型
	return { model: undefined, thinkingLevel: DEFAULT_THINKING_LEVEL, fallbackMessage: undefined };
}

/**
 * Restore model from session, with fallback to available models
 * 从会话中恢复模型，并在失败时回退到可用模型
 */
export async function restoreModelFromSession(
	savedProvider: string,
	savedModelId: string,
	currentModel: Model<Api> | undefined,
	shouldPrintMessages: boolean,
	modelRuntime: ModelRuntime,
): Promise<{ model: Model<Api> | undefined; fallbackMessage: string | undefined }> {
	const restoredModel = modelRuntime.getModel(savedProvider, savedModelId);

	// Check if restored model exists and still has auth configured
	// 检查恢复出的模型是否存在，且是否仍配置了鉴权（auth）
	const hasConfiguredAuth = restoredModel ? modelRuntime.hasConfiguredAuth(restoredModel.provider) : false;

	if (restoredModel && hasConfiguredAuth) {
		if (shouldPrintMessages) {
			console.log(chalk.dim(`Restored model: ${savedProvider}/${savedModelId}`));
		}
		return { model: restoredModel, fallbackMessage: undefined };
	}

	// Model not found or no API key - fall back
	// 模型未找到或缺少 API key —— 执行回退
	const reason = !restoredModel ? "model no longer exists" : "no auth configured";

	if (shouldPrintMessages) {
		console.error(chalk.yellow(`Warning: Could not restore model ${savedProvider}/${savedModelId} (${reason}).`));
	}

	// If we already have a model, use it as fallback
	// 若当前已有模型，则将其用作回退项
	if (currentModel) {
		if (shouldPrintMessages) {
			console.log(chalk.dim(`Falling back to: ${currentModel.provider}/${currentModel.id}`));
		}
		return {
			model: currentModel,
			fallbackMessage: `Could not restore model ${savedProvider}/${savedModelId} (${reason}). Using ${currentModel.provider}/${currentModel.id}.`,
		};
	}

	// Try to find any available model
	// 尝试寻找任意一个可用模型
	const availableModels = [...(await modelRuntime.getAvailable())];

	if (availableModels.length > 0) {
		// Try to find a default model from known providers
		// 尝试从已知提供商中找出一个默认模型
		let fallbackModel: Model<Api> | undefined;
		for (const provider of Object.keys(defaultModelPerProvider) as KnownProvider[]) {
			const defaultId = defaultModelPerProvider[provider];
			const match = availableModels.find((m) => m.provider === provider && m.id === defaultId);
			if (match) {
				fallbackModel = match;
				break;
			}
		}

		// If no default found, use first available
		// 若未找到默认模型，则使用第一个可用模型
		if (!fallbackModel) {
			fallbackModel = availableModels[0];
		}

		if (shouldPrintMessages) {
			console.log(chalk.dim(`Falling back to: ${fallbackModel.provider}/${fallbackModel.id}`));
		}

		return {
			model: fallbackModel,
			fallbackMessage: `Could not restore model ${savedProvider}/${savedModelId} (${reason}). Using ${fallbackModel.provider}/${fallbackModel.id}.`,
		};
	}

	// No models available
	// 没有任何可用模型
	return { model: undefined, fallbackMessage: undefined };
}
