import type { AnthropicOptions } from "./api/anthropic-messages.ts";
import type { AzureOpenAIResponsesOptions } from "./api/azure-openai-responses.ts";
import type { BedrockOptions } from "./api/bedrock-converse-stream.ts";
import type { GoogleOptions } from "./api/google-generative-ai.ts";
import type { GoogleVertexOptions } from "./api/google-vertex.ts";
import type { MistralOptions } from "./api/mistral-conversations.ts";
import type { OpenAICodexResponsesOptions } from "./api/openai-codex-responses.ts";
import type { OpenAICompletionsOptions } from "./api/openai-completions.ts";
import type { OpenAIResponsesOptions } from "./api/openai-responses.ts";
import type { PiMessagesOptions } from "./api/pi-messages.ts";
import type { AssistantMessageDiagnostic } from "./utils/diagnostics.ts";
import type { AssistantMessageEventStream } from "./utils/event-stream.ts";

export type { AssistantMessageEventStream } from "./utils/event-stream.ts";

export type KnownApi =
	| "openai-completions"
	| "mistral-conversations"
	| "openai-responses"
	| "azure-openai-responses"
	| "openai-codex-responses"
	| "anthropic-messages"
	| "bedrock-converse-stream"
	| "google-generative-ai"
	| "google-vertex"
	| "pi-messages";

export type Api = KnownApi | (string & {});

export type KnownImagesApi = "openrouter-images";

export type ImagesApi = KnownImagesApi | (string & {});

export type KnownProvider =
	| "amazon-bedrock"
	| "ant-ling"
	| "anthropic"
	| "google"
	| "google-vertex"
	| "openai"
	| "azure-openai-responses"
	| "openai-codex"
	| "radius"
	| "nvidia"
	| "deepseek"
	| "github-copilot"
	| "xai"
	| "groq"
	| "cerebras"
	| "openrouter"
	| "vercel-ai-gateway"
	| "zai"
	| "zai-coding-cn"
	| "mistral"
	| "minimax"
	| "minimax-cn"
	| "moonshotai"
	| "moonshotai-cn"
	| "huggingface"
	| "fireworks"
	| "together"
	| "opencode"
	| "opencode-go"
	| "kimi-coding"
	| "cloudflare-workers-ai"
	| "cloudflare-ai-gateway"
	| "qwen-token-plan"
	| "qwen-token-plan-cn"
	| "xiaomi"
	| "xiaomi-token-plan-cn"
	| "xiaomi-token-plan-ams"
	| "xiaomi-token-plan-sgp";
export type ProviderId = KnownProvider | string;

export type KnownImagesProvider = "openrouter";

export type ImagesProviderId = KnownImagesProvider | string;

export type ThinkingLevel = "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
export type ModelThinkingLevel = "off" | ThinkingLevel;
export type ThinkingLevelMap = Partial<Record<ModelThinkingLevel, string | null>>;
export type ChatTemplateKwargValue =
	| string
	| number
	| boolean
	| null
	| {
			$var: "thinking.enabled" | "thinking.effort";
			omitWhenOff?: boolean;
	  };

/** Token budgets for each thinking level (token-based providers only)
 *  各思考等级对应的 token 预算（仅适用于基于 token 计量的提供方 provider） */
export interface ThinkingBudgets {
	minimal?: number;
	low?: number;
	medium?: number;
	high?: number;
}

// Base options all providers share
// 所有提供方（provider）共享的基础选项
export type CacheRetention = "none" | "short" | "long";

export type Transport = "sse" | "websocket" | "websocket-cached" | "auto";

/** Provider-scoped environment overrides. Values take precedence over process.env.
 *  提供方（provider）作用域内的环境变量覆盖项。这些值的优先级高于 process.env。 */
export type ProviderEnv = Record<string, string>;
export type ProviderHeaders = Record<string, string | null>;
export type FetchFunction = typeof globalThis.fetch;
export type SessionAffinityFormat = "openai" | "openai-nosession" | "openrouter";

export interface ProviderResponse {
	status: number;
	headers: Record<string, string>;
}

export interface StreamOptions {
	temperature?: number;
	maxTokens?: number;
	signal?: AbortSignal;
	apiKey?: string;
	/**
	 * Optional fetch implementation for provider HTTP requests.
	 * 用于提供方（provider）HTTP 请求的可选 fetch 实现。
	 * Defaults to `globalThis.fetch`. Provider adapters that cannot inject a custom implementation may reject it.
	 * 默认为 `globalThis.fetch`。无法注入自定义实现的提供方适配器可能会拒绝该选项。
	 * This does not affect WebSocket transports.
	 * 该选项不影响 WebSocket 传输方式。
	 */
	fetch?: FetchFunction;
	/**
	 * Preferred transport for providers that support multiple transports.
	 * 对于支持多种传输方式的提供方（provider），此处指定首选传输方式。
	 * Providers that do not support this option ignore it.
	 * 不支持该选项的提供方会忽略它。
	 */
	transport?: Transport;
	/**
	 * Prompt cache retention preference. Providers map this to their supported values.
	 * 提示词缓存（prompt cache）保留时长偏好。提供方会将其映射到自身支持的取值。
	 * Default: "short".
	 * 默认值："short"。
	 */
	cacheRetention?: CacheRetention;
	/**
	 * Optional session identifier for providers that support session-based caching.
	 * 可选的会话标识符，供支持基于会话（session）缓存的提供方使用。
	 * Providers can use this to enable prompt caching, request routing, or other
	 * session-aware features. Ignored by providers that don't support it.
	 * 提供方可借此启用提示词缓存、请求路由或其他会话感知特性。不支持的提供方会忽略它。
	 */
	sessionId?: string;
	/**
	 * Optional callback for inspecting or replacing provider payloads before sending.
	 * 可选回调，用于在发送前检查或替换提供方的请求负载（payload）。
	 * Return undefined to keep the payload unchanged.
	 * 返回 undefined 表示保持负载不变。
	 */
	onPayload?: (payload: unknown, model: Model<Api>) => unknown | undefined | Promise<unknown | undefined>;
	/**
	 * Optional callback invoked after an HTTP response is received and before
	 * its body stream is consumed.
	 * 可选回调，在收到 HTTP 响应之后、消费其响应体流之前被调用。
	 */
	onResponse?: (response: ProviderResponse, model: Model<Api>) => void | Promise<void>;
	/**
	 * Optional custom HTTP headers to include in API requests.
	 * 可选的自定义 HTTP 请求头，将包含在 API 请求中。
	 * Merged with provider defaults; caller values override default headers.
	 * 会与提供方默认请求头合并；调用方提供的值会覆盖默认请求头。
	 * On AWS Bedrock these are injected via a Smithy `build`-step middleware so
	 * they are covered by SigV4 signing; reserved headers (`x-amz-*`,
	 * `authorization`, `host`) are silently ignored to preserve SigV4 / bearer auth.
	 * 在 AWS Bedrock 上，这些请求头通过 Smithy 的 `build` 阶段中间件注入，因此会被纳入 SigV4 签名；
	 * 保留请求头（`x-amz-*`、`authorization`、`host`）会被静默忽略，以保证 SigV4 / bearer 认证正常工作。
	 * A null value suppresses a provider/API default header with the same name.
	 * 值为 null 时，会抑制（移除）提供方/API 中同名的默认请求头。
	 */
	headers?: ProviderHeaders;
	/**
	 * HTTP request timeout in milliseconds for providers/SDKs that support it.
	 * HTTP 请求超时时间（毫秒），适用于支持该配置的提供方/SDK。
	 * For example, OpenAI and Anthropic SDK clients default to 10 minutes.
	 * 例如，OpenAI 和 Anthropic 的 SDK 客户端默认为 10 分钟。
	 */
	timeoutMs?: number;
	/**
	 * WebSocket connect timeout in milliseconds for providers that support
	 * WebSocket transports. This covers the connection/open handshake only;
	 * stream idleness after connection uses timeoutMs.
	 * WebSocket 连接超时时间（毫秒），适用于支持 WebSocket 传输的提供方。
	 * 该配置仅覆盖连接/打开握手阶段；连接建立之后的流空闲超时使用 timeoutMs。
	 */
	websocketConnectTimeoutMs?: number;
	/**
	 * Maximum retry attempts for providers/SDKs that support client-side retries.
	 * 最大重试次数，适用于支持客户端重试的提供方/SDK。
	 * For example, OpenAI and Anthropic SDK clients default to 2.
	 * 例如，OpenAI 和 Anthropic 的 SDK 客户端默认为 2 次。
	 */
	maxRetries?: number;
	/**
	 * Maximum delay in milliseconds to wait for a retry when the server requests a long wait.
	 * 当服务端要求长时间等待时，重试所允许的最大等待时长（毫秒）。
	 * If the server's requested delay exceeds this value, the request fails immediately
	 * with an error containing the requested delay, allowing higher-level retry logic
	 * to handle it with user visibility.
	 * 如果服务端要求的延迟超过该值，请求会立即失败，并抛出包含该延迟时长的错误，
	 * 以便上层重试逻辑在用户可见的情况下进行处理。
	 * Default: 60000 (60 seconds). Set to 0 to disable the cap.
	 * 默认值：60000（60 秒）。设为 0 可禁用该上限。
	 */
	maxRetryDelayMs?: number;
	/**
	 * Optional metadata to include in API requests.
	 * 可选的元数据（metadata），将包含在 API 请求中。
	 * Providers extract the fields they understand and ignore the rest.
	 * 提供方会提取自身能识别的字段，忽略其余字段。
	 * For example, Anthropic uses `user_id` for abuse tracking and rate limiting.
	 * 例如，Anthropic 使用 `user_id` 进行滥用追踪和速率限制。
	 */
	metadata?: Record<string, unknown>;
	/**
	 * Provider-scoped environment values. These take precedence over process.env for
	 * provider configuration such as regional settings, endpoint placeholders, and
	 * proxy variables.
	 * 提供方（provider）作用域内的环境变量值。对于区域设置、端点占位符、代理变量等提供方配置，
	 * 这些值的优先级高于 process.env。
	 */
	env?: ProviderEnv;
}

export type ProviderStreamOptions = StreamOptions & Record<string, unknown>;

/**
 * Maps known APIs to their full provider-specific stream option types.
 * 将已知的 API 映射到各自完整的、提供方（provider）专属的流式选项类型。
 * Type-only imports from API implementation modules are erased at emit, so
 * this is tree-shake safe.
 * 从 API 实现模块引入的纯类型 import 在编译输出时会被擦除，因此这对 tree-shaking 是安全的。
 */
export interface ApiOptionsMap {
	"anthropic-messages": AnthropicOptions;
	"openai-completions": OpenAICompletionsOptions;
	"openai-responses": OpenAIResponsesOptions;
	"openai-codex-responses": OpenAICodexResponsesOptions;
	"azure-openai-responses": AzureOpenAIResponsesOptions;
	"google-generative-ai": GoogleOptions;
	"google-vertex": GoogleVertexOptions;
	"mistral-conversations": MistralOptions;
	"bedrock-converse-stream": BedrockOptions;
	"pi-messages": PiMessagesOptions;
}

/**
 * Full stream options for an API. Known APIs resolve to their concrete option
 * type; custom API strings fall back to the generic shape.
 * 某个 API 的完整流式选项。已知 API 会解析为其具体的选项类型；
 * 自定义 API 字符串则回退到通用的选项结构。
 */
export type ApiStreamOptions<TApi extends Api> = TApi extends keyof ApiOptionsMap
	? ApiOptionsMap[TApi]
	: StreamOptions & Record<string, unknown>;

/**
 * The uniform stream contract of an API implementation module: every module
 * under `src/api/` exports exactly `stream` and `streamSimple`, so the module
 * itself satisfies this interface. Lazy wrappers (`lazyApi()`) and provider
 * factories pass these around as values. This is the untyped dispatch shape;
 * per-API option typing lives on the implementation modules themselves and on
 * `Provider.stream()` via `ApiStreamOptions`.
 * API 实现模块的统一流式契约：`src/api/` 下的每个模块都恰好导出 `stream` 和 `streamSimple`，
 * 因此模块本身即满足该接口。惰性包装器（`lazyApi()`）和提供方（provider）工厂会将其作为值传递。
 * 这是未做类型细化的分发结构；各 API 专属的选项类型定义位于实现模块自身，
 * 以及通过 `ApiStreamOptions` 体现在 `Provider.stream()` 上。
 */
export interface ProviderStreams {
	stream(model: Model<Api>, context: Context, options?: StreamOptions): AssistantMessageEventStream;
	streamSimple(model: Model<Api>, context: Context, options?: SimpleStreamOptions): AssistantMessageEventStream;
}

/**
 * The uniform contract of an image-generation API implementation module:
 * every image API module under `src/api/` exports exactly `generateImages`,
 * so the module itself satisfies this interface. Lazy wrappers and image
 * provider factories pass these around as values.
 * 图像生成 API 实现模块的统一契约：`src/api/` 下的每个图像 API 模块都恰好导出 `generateImages`，
 * 因此模块本身即满足该接口。惰性包装器和图像提供方（provider）工厂会将其作为值传递。
 */
export interface ProviderImages {
	generateImages(
		model: ImagesModel<ImagesApi>,
		context: ImagesContext,
		options?: ImagesOptions,
	): Promise<AssistantImages>;
}

export interface ImagesOptions {
	signal?: AbortSignal;
	apiKey?: string;
	/** Optional fetch implementation for provider HTTP requests. Defaults to `globalThis.fetch`.
	 *  用于提供方（provider）HTTP 请求的可选 fetch 实现。默认为 `globalThis.fetch`。 */
	fetch?: FetchFunction;
	/**
	 * Provider-scoped environment values. These take precedence over process.env for
	 * provider configuration such as endpoint placeholders and proxy variables.
	 * 提供方（provider）作用域内的环境变量值。对于端点占位符、代理变量等提供方配置，
	 * 这些值的优先级高于 process.env。
	 */
	env?: ProviderEnv;
	/**
	 * Optional callback for inspecting or replacing provider payloads before sending.
	 * 可选回调，用于在发送前检查或替换提供方的请求负载（payload）。
	 * Return undefined to keep the payload unchanged.
	 * 返回 undefined 表示保持负载不变。
	 */
	onPayload?: (payload: unknown, model: ImagesModel<ImagesApi>) => unknown | undefined | Promise<unknown | undefined>;
	/**
	 * Optional callback invoked after an HTTP response is received.
	 * 可选回调，在收到 HTTP 响应之后被调用。
	 */
	onResponse?: (response: ProviderResponse, model: ImagesModel<ImagesApi>) => void | Promise<void>;
	/**
	 * Optional custom HTTP headers to include in API requests.
	 * 可选的自定义 HTTP 请求头，将包含在 API 请求中。
	 * Merged with provider defaults; can override default headers.
	 * 会与提供方默认请求头合并；可以覆盖默认请求头。
	 * A null value suppresses a provider/API default header with the same name.
	 * 值为 null 时，会抑制（移除）提供方/API 中同名的默认请求头。
	 */
	headers?: ProviderHeaders;
	/**
	 * HTTP request timeout in milliseconds for providers/SDKs that support it.
	 * HTTP 请求超时时间（毫秒），适用于支持该配置的提供方/SDK。
	 */
	timeoutMs?: number;
	/**
	 * Maximum retry attempts for providers/SDKs that support client-side retries.
	 * 最大重试次数，适用于支持客户端重试的提供方/SDK。
	 */
	maxRetries?: number;
	/**
	 * Maximum delay in milliseconds to wait for a retry when the server requests a long wait.
	 * 当服务端要求长时间等待时，重试所允许的最大等待时长（毫秒）。
	 * If the server's requested delay exceeds this value, the request fails immediately
	 * with an error containing the requested delay, allowing higher-level retry logic
	 * to handle it with user visibility.
	 * 如果服务端要求的延迟超过该值，请求会立即失败，并抛出包含该延迟时长的错误，
	 * 以便上层重试逻辑在用户可见的情况下进行处理。
	 * Default: 60000 (60 seconds). Set to 0 to disable the cap.
	 * 默认值：60000（60 秒）。设为 0 可禁用该上限。
	 */
	maxRetryDelayMs?: number;
	/**
	 * Optional metadata to include in API requests.
	 * 可选的元数据（metadata），将包含在 API 请求中。
	 * Providers extract the fields they understand and ignore the rest.
	 * 提供方会提取自身能识别的字段，忽略其余字段。
	 */
	metadata?: Record<string, unknown>;
}

export type ProviderImagesOptions = ImagesOptions & Record<string, unknown>;

// Unified options with reasoning passed to streamSimple() and completeSimple()
// 传递给 streamSimple() 和 completeSimple() 的统一选项，包含推理（reasoning）配置
export interface SimpleStreamOptions extends StreamOptions {
	reasoning?: ThinkingLevel;
	/** Custom token budgets for thinking levels (token-based providers only)
	 *  各思考等级的自定义 token 预算（仅适用于基于 token 计量的提供方 provider） */
	thinkingBudgets?: ThinkingBudgets;
}

// Generic StreamFunction with typed options.
// 带类型化选项的通用 StreamFunction。
//
// Contract:
// 契约约定：
// - Must return an AssistantMessageEventStream.
// - 必须返回一个 AssistantMessageEventStream。
// - Once invoked, request/model/runtime failures should be encoded in the
//   returned stream, not thrown.
// - 一旦被调用，请求/模型/运行时的失败应编码到返回的流中，而不是以抛出异常的形式表现。
// - Error termination must produce an AssistantMessage with stopReason
//   "error" or "aborted" and errorMessage, emitted via the stream protocol.
// - 以错误方式终止时，必须产生一个 stopReason 为 "error" 或 "aborted" 且带有 errorMessage 的
//   AssistantMessage，并通过流协议发出。
export type StreamFunction<TApi extends Api = Api, TOptions extends StreamOptions = StreamOptions> = (
	model: Model<TApi>,
	context: Context,
	options?: TOptions,
) => AssistantMessageEventStream;

export type ImagesFunction<TApi extends ImagesApi = ImagesApi, TOptions extends ImagesOptions = ImagesOptions> = (
	model: ImagesModel<TApi>,
	context: ImagesContext,
	options?: TOptions,
) => Promise<AssistantImages>;

export interface TextSignatureV1 {
	v: 1;
	id: string;
	phase?: "commentary" | "final_answer";
}

export interface TextContent {
	type: "text";
	text: string;
	textSignature?: string; // e.g., for OpenAI responses, message metadata (legacy id string or TextSignatureV1 JSON)
	// 例如：对于 OpenAI Responses API，这里是消息元数据（旧版的 id 字符串或 TextSignatureV1 JSON）
}

export interface ThinkingContent {
	type: "thinking";
	thinking: string;
	thinkingSignature?: string; // e.g., for OpenAI responses, the reasoning item ID
	// 例如：对于 OpenAI Responses API，这里是推理（reasoning）条目的 ID
	/** When true, the thinking content was redacted by safety filters. The opaque
	 *  encrypted payload is stored in `thinkingSignature` so it can be passed back
	 *  to the API for multi-turn continuity.
	 *  为 true 时，表示思考内容已被安全过滤器脱敏（redacted）。不透明的加密负载存放在
	 *  `thinkingSignature` 中，以便回传给 API 以保持多轮对话的连续性。 */
	redacted?: boolean;
}

export interface ImageContent {
	type: "image";
	data: string; // base64 encoded image data
	// base64 编码的图像数据
	mimeType: string; // e.g., "image/jpeg", "image/png"
	// 例如："image/jpeg"、"image/png"
}

export interface ToolCall {
	type: "toolCall";
	id: string;
	name: string;
	arguments: Record<string, any>;
	thoughtSignature?: string; // Google-specific: opaque signature for reusing thought context
	// Google 专属：用于复用思考上下文的不透明签名
}

export interface Usage {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	/** Subset of `cacheWrite` written with 1h retention. Only Anthropic reports this split.
	 *  `cacheWrite` 中以 1 小时保留时长写入的部分。只有 Anthropic 会上报这一细分数据。 */
	cacheWrite1h?: number;
	/**
	 * Reasoning/thinking tokens, when the provider reports them. This is a subset of
	 * `output`: `output` already includes these tokens. Set to a number (possibly 0) by
	 * providers that expose a reasoning breakdown; left undefined by providers that don't.
	 * 推理/思考所消耗的 token 数（当提供方上报时）。它是 `output` 的子集：`output` 已经包含这些 token。
	 * 会暴露推理用量明细的提供方会将其设为一个数字（可能为 0）；不暴露的提供方则保持 undefined。
	 */
	reasoning?: number;
	totalTokens: number;
	cost: {
		input: number;
		output: number;
		cacheRead: number;
		cacheWrite: number;
		total: number;
	};
}

export type StopReason = "pending" | "stop" | "length" | "toolUse" | "error" | "aborted";

export interface UserMessage {
	role: "user";
	content: string | (TextContent | ImageContent)[];
	timestamp: number; // Unix timestamp in milliseconds
	// Unix 时间戳，单位为毫秒
}

export interface AssistantMessage {
	role: "assistant";
	content: (TextContent | ThinkingContent | ToolCall)[];
	api: Api;
	provider: ProviderId;
	model: string;
	responseModel?: string; // Concrete `chunk.model` when different from the requested `model` (e.g. OpenRouter `auto` -> `anthropic/...`)
	// 当实际返回的 `chunk.model` 与请求的 `model` 不同时，记录具体的模型（例如 OpenRouter 的 `auto` -> `anthropic/...`）
	responseId?: string; // Provider-specific response/message identifier when the upstream API exposes one
	// 当上游 API 暴露该信息时，记录提供方专属的响应/消息标识符
	diagnostics?: AssistantMessageDiagnostic[]; // Redacted provider/runtime diagnostics for failures and recoveries.
	// 针对失败与恢复情形、经过脱敏处理的提供方/运行时诊断信息。
	usage: Usage;
	stopReason: StopReason;
	errorMessage?: string;
	rawStopReason?: string;
	timestamp: number; // Unix timestamp in milliseconds
	// Unix 时间戳，单位为毫秒
}

export interface ToolResultMessage<TDetails = any> {
	role: "toolResult";
	toolCallId: string;
	toolName: string;
	content: (TextContent | ImageContent)[]; // Supports text and images
	// 支持文本与图像
	details?: TDetails;
	/** Usage from the tool execution itself, if available. Not part of main LLM context accounting.
	 *  工具执行自身产生的用量（如果可获取）。不计入主 LLM 上下文的用量统计。 */
	usage?: Usage;
	/**
	 * Names from `Context.tools` that became available after this result.
	 * 在本次工具结果之后变为可用的工具名称（取自 `Context.tools`）。
	 * Providers with native deferred tool loading use this as the load point;
	 * other providers ignore it and use `Context.tools` normally.
	 * 原生支持延迟加载工具的提供方会以此作为加载时机；其他提供方会忽略它，并照常使用 `Context.tools`。
	 */
	addedToolNames?: string[];
	isError: boolean;
	timestamp: number; // Unix timestamp in milliseconds
	// Unix 时间戳，单位为毫秒
}

export type Message = UserMessage | AssistantMessage | ToolResultMessage;

export type ImagesInputContent = TextContent | ImageContent;
export type ImagesOutputContent = TextContent | ImageContent;

export interface ImagesContext {
	input: ImagesInputContent[];
}

export type ImagesStopReason = "stop" | "error" | "aborted";

export interface AssistantImages {
	api: ImagesApi;
	provider: ImagesProviderId;
	model: string;
	output: ImagesOutputContent[];
	responseId?: string;
	usage?: Usage;
	stopReason: ImagesStopReason;
	errorMessage?: string;
	timestamp: number; // Unix timestamp in milliseconds
	// Unix 时间戳，单位为毫秒
}

import type { TSchema } from "typebox";

/** OpenAI grammar variants for constrained sampling.
 *  用于受约束采样（constrained sampling）的 OpenAI 语法（grammar）变体。 */
export type GrammarFormat = "openai_lark" | "openai_regex";

export type GrammarVariants = Partial<Record<GrammarFormat, string>>;

/**
 * Optional provider-side constrained sampling configs for a tool.
 * 工具（tool）在提供方侧的可选受约束采样（constrained sampling）配置。
 *
 * The `json_schema` value roughly maps to the concept of `strict` in APIs which is
 * implemented as json-schema constrained sampling by APIs. Grammar variants let
 * callers provide provider-specific encodings of the same intended language.
 * `json_schema` 取值大致对应各 API 中的 `strict` 概念，这些 API 将其实现为基于 json-schema 的受约束采样。
 * 语法（grammar）变体则允许调用方针对同一目标语言提供不同提供方专属的编码形式。
 */
export type ConstrainedSamplingConfig =
	| {
			type: "json_schema";
			strict: "prefer" | "require";
	  }
	| {
			type: "grammar";
			variants: GrammarVariants;
	  };

export interface Tool<TParameters extends TSchema = TSchema> {
	name: string;
	description: string;
	parameters: TParameters;
	constrainedSampling?: false | ConstrainedSamplingConfig;
}

export interface Context {
	systemPrompt?: string;
	messages: Message[];
	tools?: Tool[];
}

/**
 * Event protocol for AssistantMessageEventStream.
 * AssistantMessageEventStream 的事件协议。
 *
 * Streams should emit `start` before partial updates, then terminate with either:
 * 流应在发出增量更新之前先发出 `start`，然后以下列两者之一终止：
 * - `done` carrying the final successful AssistantMessage, or
 * - `done`，携带最终成功的 AssistantMessage；或者
 * - `error` carrying the final AssistantMessage with stopReason "error" or "aborted"
 *   and errorMessage.
 * - `error`，携带 stopReason 为 "error" 或 "aborted" 且带有 errorMessage 的最终 AssistantMessage。
 */
export type AssistantMessageEvent =
	| { type: "start"; partial: AssistantMessage }
	| { type: "text_start"; contentIndex: number; partial: AssistantMessage }
	| { type: "text_delta"; contentIndex: number; delta: string; partial: AssistantMessage }
	| { type: "text_end"; contentIndex: number; content: string; partial: AssistantMessage }
	| { type: "thinking_start"; contentIndex: number; partial: AssistantMessage }
	| { type: "thinking_delta"; contentIndex: number; delta: string; partial: AssistantMessage }
	| { type: "thinking_end"; contentIndex: number; content: string; partial: AssistantMessage }
	| { type: "toolcall_start"; contentIndex: number; partial: AssistantMessage }
	| { type: "toolcall_delta"; contentIndex: number; delta: string; partial: AssistantMessage }
	| { type: "toolcall_end"; contentIndex: number; toolCall: ToolCall; partial: AssistantMessage }
	| { type: "done"; reason: Extract<StopReason, "stop" | "length" | "toolUse">; message: AssistantMessage }
	| { type: "error"; reason: Extract<StopReason, "aborted" | "error">; error: AssistantMessage };

/**
 * Compatibility settings for OpenAI-compatible completions APIs.
 * 针对 OpenAI 兼容 completions API 的兼容性设置。
 * Use this to override URL-based auto-detection for custom providers.
 * 可用它为自定义提供方（provider）覆盖基于 URL 的自动探测结果。
 */
export interface OpenAICompletionsCompat {
	/** Whether the provider supports the `store` field. Default: auto-detected from URL.
	 *  提供方是否支持 `store` 字段。默认值：根据 URL 自动探测。 */
	supportsStore?: boolean;
	/** Whether the provider supports the `developer` role (vs `system`). Default: auto-detected from URL.
	 *  提供方是否支持 `developer` 角色（相对于 `system`）。默认值：根据 URL 自动探测。 */
	supportsDeveloperRole?: boolean;
	/** Whether the provider supports `reasoning_effort`. Default: auto-detected from URL.
	 *  提供方是否支持 `reasoning_effort`。默认值：根据 URL 自动探测。 */
	supportsReasoningEffort?: boolean;
	/** Whether the provider supports `stream_options: { include_usage: true }` for token usage in streaming responses. Default: true.
	 *  提供方是否支持通过 `stream_options: { include_usage: true }` 在流式响应中返回 token 用量。默认值：true。 */
	supportsUsageInStreaming?: boolean;
	/** Whether streamed responses include `finish_reason`. When false, pi infers `stop` or `toolUse` when the stream ends. Default: true.
	 *  流式响应中是否包含 `finish_reason`。为 false 时，pi 会在流结束时推断出 `stop` 或 `toolUse`。默认值：true。 */
	supportsFinishReason?: boolean;
	/** Which field to use for max tokens. Default: auto-detected from URL.
	 *  使用哪个字段来指定最大 token 数。默认值：根据 URL 自动探测。 */
	maxTokensField?: "max_completion_tokens" | "max_tokens";
	/** Whether tool results require the `name` field. Default: auto-detected from URL.
	 *  工具结果（tool result）是否必须包含 `name` 字段。默认值：根据 URL 自动探测。 */
	requiresToolResultName?: boolean;
	/** Whether a user message after tool results requires an assistant message in between. Default: auto-detected from URL.
	 *  工具结果之后的用户消息之间是否必须插入一条助手（assistant）消息。默认值：根据 URL 自动探测。 */
	requiresAssistantAfterToolResult?: boolean;
	/** Whether thinking blocks must be converted to text blocks with <thinking> delimiters. Default: auto-detected from URL.
	 *  思考块是否必须转换为带 <thinking> 分隔符的文本块。默认值：根据 URL 自动探测。 */
	requiresThinkingAsText?: boolean;
	/** Whether all replayed assistant messages must include an empty reasoning_content field when reasoning is enabled. Default: auto-detected from URL.
	 *  启用推理（reasoning）时，所有回放的助手消息是否都必须包含一个空的 reasoning_content 字段。默认值：根据 URL 自动探测。 */
	requiresReasoningContentOnAssistantMessages?: boolean;
	/** Format for reasoning/thinking parameter. "openai" uses reasoning_effort, "openrouter" uses reasoning: { effort }, "deepseek" uses thinking: { type } plus reasoning_effort when supported, "together" uses reasoning: { enabled } plus reasoning_effort when supported, "zai" uses thinking: { type }, "qwen" uses top-level enable_thinking: boolean, "qwen-chat-template" uses chat_template_kwargs.enable_thinking and preserve_thinking, "chat-template" uses configurable chat_template_kwargs, "string-thinking" uses top-level thinking: string, and "ant-ling" uses reasoning: { effort } only when the mapped effort is non-null. Default: "openai".
	 *  推理/思考参数的格式。"openai" 使用 reasoning_effort；"openrouter" 使用 reasoning: { effort }；"deepseek" 使用 thinking: { type }，并在支持时附加 reasoning_effort；"together" 使用 reasoning: { enabled }，并在支持时附加 reasoning_effort；"zai" 使用 thinking: { type }；"qwen" 使用顶层的 enable_thinking: boolean；"qwen-chat-template" 使用 chat_template_kwargs.enable_thinking 和 preserve_thinking；"chat-template" 使用可配置的 chat_template_kwargs；"string-thinking" 使用顶层的 thinking: string；"ant-ling" 仅在映射后的 effort 非 null 时使用 reasoning: { effort }。默认值："openai"。 */
	thinkingFormat?:
		| "openai"
		| "openrouter"
		| "deepseek"
		| "together"
		| "zai"
		| "qwen"
		| "chat-template"
		| "qwen-chat-template"
		| "string-thinking"
		| "ant-ling";
	/** Kwargs to send as `chat_template_kwargs` when `thinkingFormat` is `chat-template`. Use `{ "$var": "thinking.enabled" }` or `{ "$var": "thinking.effort" }` for pi-controlled thinking values.
	 *  当 `thinkingFormat` 为 `chat-template` 时，作为 `chat_template_kwargs` 发送的关键字参数。使用 `{ "$var": "thinking.enabled" }` 或 `{ "$var": "thinking.effort" }` 可让思考相关取值由 pi 控制。 */
	chatTemplateKwargs?: Record<string, ChatTemplateKwargValue>;
	/** OpenRouter-compatible routing preferences sent as the `provider` request field.
	 *  以请求中的 `provider` 字段发送的 OpenRouter 兼容路由偏好。 */
	openRouterRouting?: OpenRouterRouting;
	/** Vercel AI Gateway routing preferences. Only used when baseUrl points to Vercel AI Gateway.
	 *  Vercel AI Gateway 的路由偏好。仅当 baseUrl 指向 Vercel AI Gateway 时才会使用。 */
	vercelGatewayRouting?: VercelGatewayRouting;
	/** Whether z.ai supports top-level `tool_stream: true` for streaming tool call deltas. Default: false.
	 *  z.ai 是否支持顶层的 `tool_stream: true`，以流式返回工具调用（tool call）的增量。默认值：false。 */
	zaiToolStream?: boolean;
	/** Whether the provider supports OpenAI custom tools with Lark/regex grammar formats. When false, grammar-constrained tools fall back to normal function tools. Default: false; the generated model catalog enables it for capable models.
	 *  提供方是否支持采用 Lark/正则语法格式的 OpenAI 自定义工具。为 false 时，受语法约束的工具会回退为普通的函数工具。默认值：false；生成的模型目录会为具备该能力的模型启用它。 */
	supportsOpenAIGrammarTools?: boolean;
	/** Whether the provider supports the `strict` field in tool definitions. Default: true.
	 *  提供方是否支持工具定义中的 `strict` 字段。默认值：true。 */
	supportsStrictMode?: boolean;
	/** Cache control convention for prompt caching. "anthropic" applies Anthropic-style `cache_control` markers to the system prompt, last tool definition, and last user, assistant, or tool-result text content.
	 *  提示词缓存（prompt caching）的缓存控制约定。"anthropic" 会将 Anthropic 风格的 `cache_control` 标记应用到系统提示词、最后一个工具定义，以及最后一条用户、助手或工具结果的文本内容上。 */
	cacheControlFormat?: "anthropic";
	/** Whether to send session-affinity data from `options.sessionId`. Default: false.
	 *  是否根据 `options.sessionId` 发送会话亲和性（session affinity）数据。默认值：false。 */
	sendSessionAffinityHeaders?: boolean;
	/** Provider-specific deferred tool serialization mode.
	 *  提供方专属的延迟工具（deferred tool）序列化模式。 */
	deferredToolsMode?: "kimi";
	/** Session-affinity header format: `openai` sends `session_id`, `x-client-request-id`, and `x-session-affinity`; `openai-nosession` sends `x-client-request-id` and `x-session-affinity`; `openrouter` sends `x-session-id`. Does not affect the `prompt_cache_key` body param, which is governed by cache retention. Default: auto-detected.
	 *  会话亲和性请求头的格式：`openai` 发送 `session_id`、`x-client-request-id` 和 `x-session-affinity`；`openai-nosession` 发送 `x-client-request-id` 和 `x-session-affinity`；`openrouter` 发送 `x-session-id`。该设置不影响请求体参数 `prompt_cache_key`，后者由缓存保留策略决定。默认值：自动探测。 */
	sessionAffinityFormat?: SessionAffinityFormat;
	/** Whether the provider supports long prompt cache retention (`prompt_cache_retention: "24h"` or Anthropic-style `cache_control.ttl: "1h"`, depending on format). Default: true.
	 *  提供方是否支持长时间的提示词缓存保留（视格式而定，为 `prompt_cache_retention: "24h"` 或 Anthropic 风格的 `cache_control.ttl: "1h"`）。默认值：true。 */
	supportsLongCacheRetention?: boolean;
}

/** Compatibility settings for OpenAI Responses APIs.
 *  针对 OpenAI Responses API 的兼容性设置。 */
export interface OpenAIResponsesCompat {
	/** Whether the provider supports the `developer` role (vs `system`). Default: true.
	 *  提供方是否支持 `developer` 角色（相对于 `system`）。默认值：true。 */
	supportsDeveloperRole?: boolean;
	/** Session-affinity header format: `openai` sends `session_id` and `x-client-request-id`; `openai-nosession` sends `x-client-request-id`; `openrouter` sends `x-session-id`. Does not affect the `prompt_cache_key` body param, which is governed by cache retention. Default: auto-detected.
	 *  会话亲和性请求头的格式：`openai` 发送 `session_id` 和 `x-client-request-id`；`openai-nosession` 发送 `x-client-request-id`；`openrouter` 发送 `x-session-id`。该设置不影响请求体参数 `prompt_cache_key`，后者由缓存保留策略决定。默认值：自动探测。 */
	sessionAffinityFormat?: SessionAffinityFormat;
	/** Whether the provider supports `prompt_cache_retention: "24h"`. Default: true.
	 *  提供方是否支持 `prompt_cache_retention: "24h"`。默认值：true。 */
	supportsLongCacheRetention?: boolean;
	/** Whether the provider supports strict JSON-schema function tools. Defaults are API-specific; generated OpenAI models enable it explicitly.
	 *  提供方是否支持严格（strict）JSON-schema 函数工具。默认值因 API 而异；生成的 OpenAI 模型会显式启用它。 */
	supportsStrictMode?: boolean;
	/** Whether to emit OpenAI custom tools with Lark/regex grammar formats. When false, grammar-constrained tools fall back to normal function tools. Default: false; the generated model catalog enables it for capable models.
	 *  是否输出采用 Lark/正则语法格式的 OpenAI 自定义工具。为 false 时，受语法约束的工具会回退为普通的函数工具。默认值：false；生成的模型目录会为具备该能力的模型启用它。 */
	supportsOpenAIGrammarTools?: boolean;
	/** Whether the model supports client-executed tool search for deferred tools. Default: false.
	 *  模型是否支持针对延迟工具（deferred tool）的客户端执行式工具检索。默认值：false。 */
	supportsToolSearch?: boolean;
	/** Whether the model accepts `prompt_cache_options` (OpenAI GPT-5.6+ explicit prompt caching). Older OpenAI models reject the parameter. Default: false.
	 *  模型是否接受 `prompt_cache_options`（OpenAI GPT-5.6+ 的显式提示词缓存）。较旧的 OpenAI 模型会拒绝该参数。默认值：false。 */
	supportsExplicitPromptCacheMode?: boolean;
}

/** Compatibility settings for Anthropic Messages-compatible APIs.
 *  针对 Anthropic Messages 兼容 API 的兼容性设置。 */
export interface AnthropicMessagesCompat {
	/**
	 * Whether the provider accepts per-tool `eager_input_streaming`.
	 * 提供方是否接受按工具粒度设置的 `eager_input_streaming`。
	 * When false, the Anthropic provider omits `tools[].eager_input_streaming`
	 * and sends the legacy `fine-grained-tool-streaming-2025-05-14` beta header
	 * for tool-enabled requests.
	 * 为 false 时，Anthropic 提供方会省略 `tools[].eager_input_streaming`，
	 * 并为启用了工具的请求发送旧版的 `fine-grained-tool-streaming-2025-05-14` beta 请求头。
	 * Default: true.
	 * 默认值：true。
	 */
	supportsEagerToolInputStreaming?: boolean;
	/** Whether the provider supports Anthropic long cache retention (`cache_control.ttl: "1h"`). Default: true.
	 *  提供方是否支持 Anthropic 的长缓存保留（`cache_control.ttl: "1h"`）。默认值：true。 */
	supportsLongCacheRetention?: boolean;
	/**
	 * Whether to send the `x-session-affinity` header from `options.sessionId`
	 * when caching is enabled. Required for providers like Fireworks that use
	 * session affinity for prompt cache routing (requests to the same replica
	 * maximize cache hits).
	 * 启用缓存时，是否根据 `options.sessionId` 发送 `x-session-affinity` 请求头。
	 * 对于 Fireworks 这类使用会话亲和性来做提示词缓存路由的提供方，这是必需的
	 * （请求落到同一副本可最大化缓存命中率）。
	 * Default: false.
	 * 默认值：false。
	 */
	sendSessionAffinityHeaders?: boolean;
	/**
	 * Whether the provider supports Anthropic-style `cache_control` markers on
	 * tool definitions. When false, `cache_control` is omitted from tool params.
	 * 提供方是否支持在工具定义上使用 Anthropic 风格的 `cache_control` 标记。
	 * 为 false 时，工具参数中会省略 `cache_control`。
	 * Some Anthropic-compatible providers (e.g., Fireworks) do not support this
	 * field on tools and may reject or ignore it.
	 * 某些 Anthropic 兼容的提供方（例如 Fireworks）不支持工具上的该字段，可能会拒绝或忽略它。
	 * Default: true.
	 * 默认值：true。
	 */
	supportsCacheControlOnTools?: boolean;
	/**
	 * Whether the model accepts the Anthropic `temperature` request field.
	 * 模型是否接受 Anthropic 的 `temperature` 请求字段。
	 * Claude Opus 4.7+ rejects non-default temperature values.
	 * Claude Opus 4.7+ 会拒绝非默认的 temperature 取值。
	 * Default: true.
	 * 默认值：true。
	 */
	supportsTemperature?: boolean;
	/**
	 * Whether to force adaptive thinking (`thinking.type: "adaptive"` plus
	 * `output_config.effort`) regardless of the model id. Built-in models that
	 * require adaptive thinking set this in generated metadata. Custom
	 * Anthropic-compatible providers can set this to `true` for any model whose
	 * upstream requires the adaptive format. Set to `false` to
	 * opt out on overridden built-in models.
	 * 是否无视模型 id 强制启用自适应思考（`thinking.type: "adaptive"` 加上 `output_config.effort`）。
	 * 需要自适应思考的内置模型会在生成的元数据中设置该项。自定义的 Anthropic 兼容提供方可以为
	 * 任何上游要求使用自适应格式的模型将其设为 `true`。对被覆盖的内置模型可设为 `false` 以退出该行为。
	 * Default: false.
	 * 默认值：false。
	 */
	forceAdaptiveThinking?: boolean;
	/** Whether to replay empty thinking signatures as `signature: ""` instead of converting thinking to text. Default: false.
	 *  回放时是否将空的思考签名表示为 `signature: ""`，而不是把思考内容转换为文本。默认值：false。 */
	allowEmptySignature?: boolean;
	/** Whether the provider supports Anthropic strict tool schemas. Default: false; generated Anthropic models enable it explicitly.
	 *  提供方是否支持 Anthropic 的严格（strict）工具 schema。默认值：false；生成的 Anthropic 模型会显式启用它。 */
	supportsStrictTools?: boolean;
	/**
	 * Whether the provider supports deferred tools loaded by `tool_reference`
	 * blocks in tool results. Default: true for first-party Anthropic models
	 * except Haiku and models older than Claude 4.5; false for other providers.
	 * 提供方是否支持通过工具结果中的 `tool_reference` 块加载延迟工具（deferred tool）。
	 * 默认值：对于 Anthropic 第一方模型为 true（Haiku 以及早于 Claude 4.5 的模型除外）；其他提供方为 false。
	 */
	supportsToolReferences?: boolean;
}

/** Compatibility settings for Amazon Bedrock models.
 *  针对 Amazon Bedrock 模型的兼容性设置。 */
export interface BedrockCompat {
	/** Whether the model supports Bedrock strict tool schemas. Default: false.
	 *  模型是否支持 Bedrock 的严格（strict）工具 schema。默认值：false。 */
	supportsStrictMode?: boolean;
}

/**
 * OpenRouter provider routing preferences.
 * OpenRouter 的提供方（provider）路由偏好。
 * Controls which upstream providers OpenRouter routes requests to.
 * 控制 OpenRouter 将请求路由到哪些上游提供方。
 * Sent as the `provider` field in the OpenRouter API request body.
 * 以 OpenRouter API 请求体中的 `provider` 字段发送。
 * @see https://openrouter.ai/docs/guides/routing/provider-selection
 */
export interface OpenRouterRouting {
	/** Whether to allow backup providers to serve requests. Default: true.
	 *  是否允许由备用提供方来处理请求。默认值：true。 */
	allow_fallbacks?: boolean;
	/** Whether to filter providers to only those that support all parameters in the request. Default: false.
	 *  是否将提供方过滤为仅保留支持请求中全部参数的那些。默认值：false。 */
	require_parameters?: boolean;
	/** Data collection setting. "allow" (default): allow providers that may store/train on data. "deny": only use providers that don't collect user data.
	 *  数据采集设置。"allow"（默认）：允许可能存储数据或用数据训练的提供方。"deny"：仅使用不采集用户数据的提供方。 */
	data_collection?: "deny" | "allow";
	/** Whether to restrict routing to only ZDR (Zero Data Retention) endpoints.
	 *  是否将路由限制为仅使用 ZDR（Zero Data Retention，零数据留存）端点。 */
	zdr?: boolean;
	/** Whether to restrict routing to only models that allow text distillation.
	 *  是否将路由限制为仅使用允许文本蒸馏（distillation）的模型。 */
	enforce_distillable_text?: boolean;
	/** An ordered list of provider names/slugs to try in sequence, falling back to the next if unavailable.
	 *  一个有序的提供方名称/标识（slug）列表，按顺序依次尝试；若某个不可用则回退到下一个。 */
	order?: string[];
	/** List of provider names/slugs to exclusively allow for this request.
	 *  本次请求仅允许使用的提供方名称/标识（slug）列表。 */
	only?: string[];
	/** List of provider names/slugs to skip for this request.
	 *  本次请求需要跳过的提供方名称/标识（slug）列表。 */
	ignore?: string[];
	/** A list of quantization levels to filter providers by (e.g., ["fp16", "bf16", "fp8", "fp6", "int8", "int4", "fp4", "fp32"]).
	 *  用于筛选提供方的量化（quantization）精度级别列表（例如 ["fp16", "bf16", "fp8", "fp6", "int8", "int4", "fp4", "fp32"]）。 */
	quantizations?: string[];
	/** Sorting strategy. Can be a string (e.g., "price", "throughput", "latency") or an object with `by` and `partition`.
	 *  排序策略。可以是字符串（例如 "price"、"throughput"、"latency"），也可以是包含 `by` 和 `partition` 的对象。 */
	sort?:
		| string
		| {
				/** The sorting metric: "price", "throughput", "latency".
				 *  排序所依据的指标："price"、"throughput"、"latency"。 */
				by?: string;
				/** Partitioning strategy: "model" (default) or "none".
				 *  分区（partition）策略："model"（默认）或 "none"。 */
				partition?: string | null;
		  };
	/** Maximum price per million tokens (USD).
	 *  每百万 token 的最高价格（美元）。 */
	max_price?: {
		/** Price per million prompt tokens.
		 *  每百万提示词（prompt）token 的价格。 */
		prompt?: number | string;
		/** Price per million completion tokens.
		 *  每百万补全（completion）token 的价格。 */
		completion?: number | string;
		/** Price per image.
		 *  每张图像的价格。 */
		image?: number | string;
		/** Price per audio unit.
		 *  每单位音频的价格。 */
		audio?: number | string;
		/** Price per request.
		 *  每次请求的价格。 */
		request?: number | string;
	};
	/** Preferred minimum throughput (tokens/second). Can be a number (applies to p50) or an object with percentile-specific cutoffs.
	 *  期望的最低吞吐量（token/秒）。可以是一个数字（作用于 p50），也可以是按分位数分别设定阈值的对象。 */
	preferred_min_throughput?:
		| number
		| {
				/** Minimum tokens/second at the 50th percentile.
				 *  第 50 百分位处的最低 token/秒。 */
				p50?: number;
				/** Minimum tokens/second at the 75th percentile.
				 *  第 75 百分位处的最低 token/秒。 */
				p75?: number;
				/** Minimum tokens/second at the 90th percentile.
				 *  第 90 百分位处的最低 token/秒。 */
				p90?: number;
				/** Minimum tokens/second at the 99th percentile.
				 *  第 99 百分位处的最低 token/秒。 */
				p99?: number;
		  };
	/** Preferred maximum latency (seconds). Can be a number (applies to p50) or an object with percentile-specific cutoffs.
	 *  期望的最大延迟（秒）。可以是一个数字（作用于 p50），也可以是按分位数分别设定阈值的对象。 */
	preferred_max_latency?:
		| number
		| {
				/** Maximum latency in seconds at the 50th percentile.
				 *  第 50 百分位处的最大延迟（秒）。 */
				p50?: number;
				/** Maximum latency in seconds at the 75th percentile.
				 *  第 75 百分位处的最大延迟（秒）。 */
				p75?: number;
				/** Maximum latency in seconds at the 90th percentile.
				 *  第 90 百分位处的最大延迟（秒）。 */
				p90?: number;
				/** Maximum latency in seconds at the 99th percentile.
				 *  第 99 百分位处的最大延迟（秒）。 */
				p99?: number;
		  };
}

/**
 * Vercel AI Gateway routing preferences.
 * Vercel AI Gateway 的路由偏好。
 * Controls which upstream providers the gateway routes requests to.
 * 控制该网关将请求路由到哪些上游提供方（provider）。
 * @see https://vercel.com/docs/ai-gateway/models-and-providers/provider-options
 */
export interface VercelGatewayRouting {
	/** List of provider slugs to exclusively use for this request (e.g., ["bedrock", "anthropic"]).
	 *  本次请求仅使用的提供方标识（slug）列表（例如 ["bedrock", "anthropic"]）。 */
	only?: string[];
	/** List of provider slugs to try in order (e.g., ["anthropic", "openai"]).
	 *  按顺序依次尝试的提供方标识（slug）列表（例如 ["anthropic", "openai"]）。 */
	order?: string[];
}

export interface ModelCostRates {
	input: number; // $/million tokens
	// 美元/百万 token
	output: number; // $/million tokens
	// 美元/百万 token
	cacheRead: number; // $/million tokens
	// 美元/百万 token
	cacheWrite: number; // $/million tokens
	// 美元/百万 token
}

export interface ModelCostTier extends ModelCostRates {
	/** Use this tier for requests whose total input usage exceeds this token count.
	 *  当请求的总输入用量超过该 token 数时，使用此价格档位。 */
	inputTokensAbove: number;
}

export interface ModelCost extends ModelCostRates {
	/** Request-wide pricing tiers. The highest matching input threshold applies to the full request.
	 *  作用于整个请求的价格档位。匹配到的最高输入阈值档位将适用于整个请求。 */
	tiers?: ModelCostTier[];
}

// Model interface for the unified model system
// 统一模型体系所使用的 Model 接口
export interface Model<TApi extends Api> {
	id: string;
	name: string;
	api: TApi;
	provider: ProviderId;
	baseUrl: string;
	reasoning: boolean;
	/**
	 * Maps pi thinking levels to provider/model-specific values.
	 * 将 pi 的思考等级映射到提供方（provider）/模型专属的取值。
	 * Missing keys use provider defaults. null marks a level as unsupported.
	 * 缺失的键使用提供方默认值。取值为 null 表示该等级不受支持。
	 */
	thinkingLevelMap?: ThinkingLevelMap;
	input: ("text" | "image")[];
	cost: ModelCost;
	contextWindow: number;
	maxTokens: number;
	headers?: Record<string, string>;
	/** Compatibility overrides for OpenAI-compatible APIs. If not set, auto-detected from baseUrl.
	 *  针对 OpenAI 兼容 API 的兼容性覆盖项。若未设置，则根据 baseUrl 自动探测。 */
	compat?: TApi extends "openai-completions"
		? OpenAICompletionsCompat
		: TApi extends "openai-responses" | "azure-openai-responses" | "openai-codex-responses"
			? OpenAIResponsesCompat
			: TApi extends "anthropic-messages"
				? AnthropicMessagesCompat
				: TApi extends "bedrock-converse-stream"
					? BedrockCompat
					: never;
}

export interface ImagesModel<TApi extends ImagesApi>
	extends Omit<Model<Api>, "api" | "provider" | "reasoning" | "contextWindow" | "maxTokens" | "compat"> {
	api: TApi;
	provider: ImagesProviderId;
	output: ("text" | "image")[];
}
