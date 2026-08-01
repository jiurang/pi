import type { AssistantMessage } from "../types.ts";

/**
 * Regex patterns to detect context overflow errors from different providers.
 * 用于检测来自不同提供方（provider）的上下文溢出（context overflow）错误的正则模式。
 *
 * These patterns match error messages returned when the input exceeds
 * the model's context window.
 * 这些模式匹配当输入超出模型上下文窗口（context window）时返回的错误消息。
 *
 * Provider-specific patterns (with example error messages):
 * 各提供方专有的模式（附带示例错误消息）：
 *
 * - Anthropic: "prompt is too long: 213462 tokens > 200000 maximum"
 * - Anthropic: "413 {\"error\":{\"type\":\"request_too_large\",\"message\":\"Request exceeds the maximum size\"}}"
 * - OpenAI: "Your input exceeds the context window of this model"
 * - OpenAI/LiteLLM: "Requested token count exceeds the model's maximum context length of 131072 tokens"
 * - OpenAI-compatible: "Input length (265330) exceeds model's maximum context length (262144)."
 * - Google: "The input token count (1196265) exceeds the maximum number of tokens allowed (1048575)"
 * - xAI: "This model's maximum prompt length is 131072 but the request contains 537812 tokens"
 * - Groq: "Please reduce the length of the messages or completion"
 * - OpenRouter: "This endpoint's maximum context length is X tokens. However, you requested about Y tokens"
 * - OpenRouter/Poolside: "Input length X exceeds the maximum allowed input length of Y tokens."
 * - Together AI: "The input (X tokens) is longer than the model's context length (Y tokens)."
 * - llama.cpp: "the request exceeds the available context size, try increasing it"
 * - LM Studio: "tokens to keep from the initial prompt is greater than the context length"
 * - GitHub Copilot: "prompt token count of X exceeds the limit of Y"
 * - MiniMax: "invalid params, context window exceeds limit"
 * - Kimi For Coding: "Your request exceeded model token limit: X (requested: Y)"
 * - DS4: "Prompt has X tokens, but the configured context size is Y tokens"
 * - Cerebras: "400/413 status code (no body)"
 * - Mistral: "Prompt contains X tokens ... too large for model with Y maximum context length"
 * - z.ai: Does NOT error, accepts overflow silently - handled via usage.input > contextWindow
 *   z.ai：不会报错，会静默接受溢出请求 —— 通过 usage.input > contextWindow 来处理。
 * - Xiaomi MiMo: Truncates input to fill contextWindow exactly, then returns finish_reason "length"
 *   with output=0 (no room left to generate). Detected via stopReason "length" + zero output +
 *   input filling the context window.
 *   小米 MiMo：会截断输入以恰好填满 contextWindow，然后返回 finish_reason "length" 且 output=0
 *   （已无剩余空间可供生成）。通过 stopReason "length" + 零输出 + 输入填满上下文窗口来检测。
 * - DashScope/Qwen: "Range of input length should be [1, X]" (HTTP 400 invalid_parameter_error)
 * - Ollama: Some deployments truncate silently, others return errors like "prompt too long; exceeded max context length by X tokens"
 *   Ollama：部分部署会静默截断，另一些则返回诸如 "prompt too long; exceeded max context length by X tokens" 的错误。
 */
const OVERFLOW_PATTERNS = [
	/prompt is too long/i, // Anthropic token overflow
	// Anthropic token 溢出
	/request_too_large/i, // Anthropic request byte-size overflow (HTTP 413)
	// Anthropic 请求字节大小溢出（HTTP 413）
	/input is too long for requested model/i, // Amazon Bedrock
	// 亚马逊 Bedrock
	/exceeds the context window/i, // OpenAI (Completions & Responses API)
	// OpenAI（Completions 与 Responses API）
	/exceeds (?:the )?(?:model'?s )?maximum context length(?: of [\d,]+ tokens?|\s*\([\d,]+\))/i, // OpenAI-compatible proxies (LiteLLM)
	// 兼容 OpenAI 的代理（LiteLLM）
	/input token count.*exceeds the maximum/i, // Google (Gemini)
	// 谷歌（Gemini）
	/maximum prompt length is \d+/i, // xAI (Grok)
	// xAI（Grok）
	/reduce the length of the messages/i, // Groq
	// Groq
	/maximum context length is \d+ tokens/i, // OpenRouter (most backends)
	// OpenRouter（大多数后端）
	/exceeds (?:the )?maximum allowed input length of [\d,]+ tokens?/i, // OpenRouter/Poolside
	// OpenRouter/Poolside
	/input \(\d+ tokens\) is longer than the model'?s context length \(\d+ tokens\)/i, // Together AI
	// Together AI
	/exceeds the limit of \d+/i, // GitHub Copilot
	// GitHub Copilot
	/exceeds the available context size/i, // llama.cpp server
	// llama.cpp 服务端
	/greater than the context length/i, // LM Studio
	// LM Studio
	/context window exceeds limit/i, // MiniMax
	// MiniMax
	/exceeded model token limit/i, // Kimi For Coding
	// Kimi For Coding
	/too large for model with \d+ maximum context length/i, // Mistral
	// Mistral
	/prompt has [\d,]+ tokens?, but the configured context size is [\d,]+ tokens?/i, // DS4 server
	// DS4 服务端
	/model_context_window_exceeded/i, // z.ai non-standard finish_reason surfaced as error text
	// z.ai 以错误文本形式暴露的非标准 finish_reason
	/prompt too long; exceeded (?:max )?context length/i, // Ollama explicit overflow error
	// Ollama 显式溢出错误
	/range of input length should be/i, // DashScope / Qwen Token Plan
	// DashScope / 通义千问 Token Plan
	/context[_ ]length[_ ]exceeded/i, // Generic fallback
	// 通用兜底模式
	/too many tokens/i, // Generic fallback
	// 通用兜底模式
	/token limit exceeded/i, // Generic fallback
	// 通用兜底模式
	/^4(?:00|13)\s*(?:status code)?\s*\(no body\)/i, // Cerebras: 400/413 with no body
	// Cerebras：400/413 且无响应体
];

/**
 * Patterns that indicate non-overflow errors (e.g. rate limiting, server errors).
 * 用于标识非溢出类错误（例如限流、服务端错误）的模式。
 * Error messages matching any of these are excluded from overflow detection
 * even if they also match an OVERFLOW_PATTERN.
 * 匹配其中任意一项的错误消息都会被排除在溢出检测之外，即使它们同时也匹配某个 OVERFLOW_PATTERN。
 *
 * Example: Bedrock formats throttling errors as "ThrottlingException: Too many tokens,
 * please wait before trying again." which would match the /too many tokens/i overflow
 * pattern without this exclusion.
 * 示例：Bedrock 会把限流错误格式化为 "ThrottlingException: Too many tokens, please wait before
 * trying again."，若没有这项排除规则，它就会命中 /too many tokens/i 这个溢出模式。
 */
const NON_OVERFLOW_PATTERNS = [
	/^(Throttling error|Service unavailable):/i, // AWS Bedrock non-overflow errors (human-readable prefixes from formatBedrockError)
	// AWS Bedrock 的非溢出错误（来自 formatBedrockError 的可读前缀）
	/rate limit/i, // Generic rate limiting
	// 通用限流
	/too many requests/i, // Generic HTTP 429 style
	// 通用 HTTP 429 风格
];

/**
 * Check if an assistant message represents a context overflow error.
 * 检查一条助手（assistant）消息是否代表上下文溢出错误。
 *
 * This handles two cases:
 * 该函数处理两种情况：
 * 1. Error-based overflow: Most providers return stopReason "error" with a
 *    specific error message pattern.
 *    基于错误的溢出：大多数提供方会返回 stopReason "error"，并带有特定的错误消息模式。
 * 2. Silent overflow: Some providers accept overflow requests and return
 *    successfully. For these, we check if usage.input exceeds the context window.
 *    静默溢出：部分提供方会接受溢出请求并成功返回。对于这类情况，我们检查 usage.input 是否超出上下文窗口。
 *
 * ## Reliability by Provider
 * ## 各提供方的检测可靠性
 *
 * **Reliable detection (returns error with detectable message):**
 * **可靠检测（返回带有可识别消息的错误）：**
 * - Anthropic: "prompt is too long: X tokens > Y maximum" or "request_too_large"
 * - OpenAI (Completions & Responses): "exceeds the context window", "exceeds the model's maximum context length of X tokens", or "exceeds model's maximum context length (X)"
 * - Google Gemini: "input token count exceeds the maximum"
 * - xAI (Grok): "maximum prompt length is X but request contains Y"
 * - Groq: "reduce the length of the messages"
 * - Cerebras: 400/413 status code (no body)
 * - Mistral: "Prompt contains X tokens ... too large for model with Y maximum context length"
 * - OpenRouter (most backends): "maximum context length is X tokens"
 * - OpenRouter/Poolside: "Input length X exceeds the maximum allowed input length of Y tokens."
 * - Together AI: "The input (X tokens) is longer than the model's context length (Y tokens)."
 * - llama.cpp: "exceeds the available context size"
 * - LM Studio: "greater than the context length"
 * - Kimi For Coding: "exceeded model token limit: X (requested: Y)"
 * - DS4: "Prompt has X tokens, but the configured context size is Y tokens"
 * - DashScope/Qwen: "Range of input length should be [1, X]"
 *
 * **Unreliable detection:**
 * **不可靠检测：**
 * - z.ai: Sometimes accepts overflow silently (detectable via usage.input > contextWindow),
 *   sometimes returns rate limit errors. Pass contextWindow param to detect silent overflow.
 *   z.ai：有时会静默接受溢出（可通过 usage.input > contextWindow 检测到），有时则返回限流错误。
 *   传入 contextWindow 参数即可检测静默溢出。
 * - Xiaomi MiMo: Truncates input to fit contextWindow then returns stopReason "length" with
 *   output=0. Pass contextWindow param to detect via the "filled context + zero output" signal.
 *   小米 MiMo：会截断输入以适配 contextWindow，然后返回 stopReason "length" 且 output=0。
 *   传入 contextWindow 参数即可通过“上下文被填满 + 零输出”这一信号进行检测。
 * - Ollama: May truncate input silently for some setups, but may also return explicit
 *   overflow errors that match the patterns above. Silent truncation still cannot be
 *   detected here because we do not know the expected token count.
 *   Ollama：某些配置下可能静默截断输入，但也可能返回匹配上述模式的显式溢出错误。
 *   此处仍无法检测静默截断，因为我们并不知道预期的 token 数量。
 *
 * ## Custom Providers
 * ## 自定义提供方
 *
 * If you've added custom models via settings.json, this function may not detect
 * overflow errors from those providers. To add support:
 * 如果你通过 settings.json 添加了自定义模型，本函数可能无法检测这些提供方的溢出错误。若要添加支持：
 *
 * 1. Send a request that exceeds the model's context window
 *    发送一个超出该模型上下文窗口的请求
 * 2. Check the errorMessage in the response
 *    查看响应中的 errorMessage
 * 3. Create a regex pattern that matches the error
 *    编写一个能匹配该错误的正则模式
 * 4. The pattern should be added to OVERFLOW_PATTERNS in this file, or
 *    check the errorMessage yourself before calling this function
 *    将该模式添加到本文件的 OVERFLOW_PATTERNS 中，或者在调用本函数前自行检查 errorMessage
 *
 * @param message - The assistant message to check
 *                  待检查的助手消息
 * @param contextWindow - Optional context window size for detecting silent overflow (z.ai)
 *                        可选的上下文窗口大小，用于检测静默溢出（z.ai）
 * @returns true if the message indicates a context overflow
 *          若该消息表示发生了上下文溢出，则返回 true
 */
export function isContextOverflow(message: AssistantMessage, contextWindow?: number): boolean {
	// Case 1: Check error message patterns
	// 情况 1：检查错误消息模式
	if (message.stopReason === "error" && message.errorMessage) {
		// Skip messages matching known non-overflow patterns (e.g. throttling / rate-limit)
		// 跳过匹配已知非溢出模式的消息（例如节流 / 限流）
		const isNonOverflow = NON_OVERFLOW_PATTERNS.some((p) => p.test(message.errorMessage!));
		if (!isNonOverflow && OVERFLOW_PATTERNS.some((p) => p.test(message.errorMessage!))) {
			return true;
		}
	}

	// Case 2: Silent overflow (z.ai style) - successful but usage exceeds context
	// 情况 2：静默溢出（z.ai 风格）—— 请求成功但用量超出了上下文
	if (contextWindow && message.stopReason === "stop") {
		const inputTokens = message.usage.input + message.usage.cacheRead;
		if (inputTokens > contextWindow) {
			return true;
		}
	}

	// Case 3: Length-stop overflow (Xiaomi MiMo style) - server truncates oversized input
	// to fit the context window, leaving no room for output. Returns stopReason "length"
	// with output=0 and input+cacheRead filling the context window.
	// 情况 3：长度停止型溢出（小米 MiMo 风格）—— 服务端截断超长输入以适配上下文窗口，
	// 导致没有剩余空间用于输出。会返回 stopReason "length"，output=0，且 input+cacheRead 填满上下文窗口。
	if (contextWindow && message.stopReason === "length" && message.usage.output === 0) {
		const inputTokens = message.usage.input + message.usage.cacheRead;
		if (inputTokens >= contextWindow * 0.99) {
			return true;
		}
	}

	return false;
}

/**
 * Get the overflow patterns for testing purposes.
 * 获取溢出检测模式列表，供测试使用。
 */
export function getOverflowPatterns(): RegExp[] {
	return [...OVERFLOW_PATTERNS];
}
