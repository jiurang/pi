import type { Agent as HttpsAgent } from "node:https";
import {
	BedrockRuntimeClient,
	type BedrockRuntimeClientConfig,
	BedrockRuntimeServiceException,
	StopReason as BedrockStopReason,
	type Tool as BedrockTool,
	CachePointType,
	CacheTTL,
	type ContentBlock,
	type ContentBlockDeltaEvent,
	type ContentBlockStartEvent,
	type ContentBlockStopEvent,
	ConversationRole,
	ConverseStreamCommand,
	type ConverseStreamMetadataEvent,
	ImageFormat,
	type Message,
	type SystemContentBlock,
	type ToolChoice,
	type ToolConfiguration,
	type ToolResultContentBlock,
	ToolResultStatus,
} from "@aws-sdk/client-bedrock-runtime";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import type { BuildMiddleware, DocumentType, MetadataBearer } from "@smithy/types";
import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import { calculateCost } from "../models.ts";
import type {
	Api,
	AssistantMessage,
	CacheRetention,
	Context,
	ImageContent,
	Model,
	ProviderEnv,
	SimpleStreamOptions,
	StopReason,
	StreamFunction,
	StreamOptions,
	TextContent,
	ThinkingBudgets,
	ThinkingContent,
	ThinkingLevel,
	Tool,
	ToolCall,
	ToolResultMessage,
} from "../types.ts";
import { appendAssistantMessageDiagnostic } from "../utils/diagnostics.ts";
import { normalizeProviderError } from "../utils/error-body.ts";
import { AssistantMessageEventStream } from "../utils/event-stream.ts";
import { providerHeadersToRecord } from "../utils/headers.ts";
import { parseStreamingJson } from "../utils/json-parse.ts";
import { resolveHttpProxyUrlForTarget } from "../utils/node-http-proxy.ts";
import { getProviderEnvValue } from "../utils/provider-env.ts";
import { sanitizeSurrogates } from "../utils/sanitize-unicode.ts";
import { resolveJsonSchemaStrictSampling } from "./constrained-sampling.ts";
import {
	adjustMaxTokensForThinking,
	buildBaseOptions,
	clampMaxTokensToContext,
	clampReasoning,
} from "./simple-options.ts";
import { transformMessages } from "./transform-messages.ts";

export type BedrockThinkingDisplay = "summarized" | "omitted";

export interface BedrockOptions extends StreamOptions {
	region?: string;
	profile?: string;
	toolChoice?: "auto" | "any" | "none" | { type: "tool"; name: string };
	/* See https://docs.aws.amazon.com/bedrock/latest/userguide/inference-reasoning.html for supported models.
	   支持的模型请参见 https://docs.aws.amazon.com/bedrock/latest/userguide/inference-reasoning.html 。 */
	reasoning?: ThinkingLevel;
	/* Custom token budgets per thinking level. Overrides default budgets.
	   为每个思考等级自定义 token 预算。会覆盖默认预算。 */
	thinkingBudgets?: ThinkingBudgets;
	/* Only supported by Claude 4.x models, see https://docs.aws.amazon.com/bedrock/latest/userguide/claude-messages-extended-thinking.html#claude-messages-extended-thinking-tool-use-interleaved
	   仅 Claude 4.x 系列模型支持，参见 https://docs.aws.amazon.com/bedrock/latest/userguide/claude-messages-extended-thinking.html#claude-messages-extended-thinking-tool-use-interleaved */
	interleavedThinking?: boolean;
	/**
	 * Controls how Claude's thinking content is returned in responses.
	 * 控制 Claude 的思考（thinking）内容在响应中的返回方式。
	 * - "summarized": Thinking blocks contain summarized thinking text (default here).
	 *   "summarized"：思考块中包含经过摘要的思考文本（此处的默认值）。
	 * - "omitted": Thinking content is redacted but the signature still travels back
	 *   for multi-turn continuity, reducing time-to-first-text-token.
	 *   "omitted"：思考内容被隐去，但签名（signature）仍会回传以保持多轮对话的连续性，
	 *   从而缩短首个文本 token 的响应时间。
	 *
	 * Note: Anthropic's API default for Claude Opus 4.8 and Mythos Preview is
	 * "omitted". We default to "summarized" here to keep behavior consistent with
	 * older Claude 4 models. Only applies to Claude models on Bedrock.
	 * 注意：Anthropic API 对 Claude Opus 4.8 与 Mythos Preview 的默认值是 "omitted"。
	 * 这里我们默认使用 "summarized"，以便与较旧的 Claude 4 模型行为保持一致。
	 * 仅适用于 Bedrock 上的 Claude 模型。
	 */
	thinkingDisplay?: BedrockThinkingDisplay;
	/** Key-value pairs attached to the inference request for cost allocation tagging.
	 * 附加到推理请求上的键值对，用于成本分摊标记。
	 * Keys: max 64 chars, no `aws:` prefix. Values: max 256 chars. Max 50 pairs.
	 * 键：最多 64 个字符，且不能以 `aws:` 为前缀。值：最多 256 个字符。最多 50 对。
	 * Tags appear in AWS Cost Explorer split cost allocation data.
	 * 这些标签会出现在 AWS Cost Explorer 的分摊成本数据中。
	 * @see https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_ConverseStream.html */
	requestMetadata?: Record<string, string>;
	/** Bearer token for Bedrock API key authentication.
	 * 用于 Bedrock API key 认证的 Bearer token。
	 * When set, bypasses SigV4 signing and sends Authorization: Bearer <token> instead.
	 * 设置后将跳过 SigV4 签名，改为发送 Authorization: Bearer <token>。
	 * Requires `bedrock:CallWithBearerToken` IAM permission on the token's identity.
	 * 要求该 token 对应的身份具备 `bedrock:CallWithBearerToken` IAM 权限。
	 * Set via AWS_BEARER_TOKEN_BEDROCK env var or pass directly.
	 * 可通过 AWS_BEARER_TOKEN_BEDROCK 环境变量设置，或直接传入。
	 * @see https://docs.aws.amazon.com/service-authorization/latest/reference/list_amazonbedrock.html */
	bearerToken?: string;
}

type Block = (TextContent | ThinkingContent | ToolCall) & { index?: number; partialJson?: string };

const EMPTY_TEXT_PLACEHOLDER = "<empty>";

export const stream: StreamFunction<"bedrock-converse-stream", BedrockOptions> = (
	model: Model<"bedrock-converse-stream">,
	context: Context,
	options: BedrockOptions = {},
): AssistantMessageEventStream => {
	const stream = new AssistantMessageEventStream();

	(async () => {
		const output: AssistantMessage = {
			role: "assistant",
			content: [],
			api: "bedrock-converse-stream" as Api,
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
			stopReason: "pending",
			timestamp: Date.now(),
		};

		const blocks = output.content as Block[];

		// A profile explicitly configured through pi's auth flow (the `profile`
		// 通过 pi 认证流程显式配置的 profile（`profile` 选项，或已存凭据环境中
		// option or scoped `AWS_PROFILE` on the stored credential's env) must win
		// 限定作用域的 `AWS_PROFILE`）必须优先于环境中的
		// over ambient AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY. The SDK default
		// AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY。SDK 的默认凭据链本身
		// chain already prefers a configured profile over env keys, but only when
		// 已经会优先使用配置的 profile 而非环境变量密钥，但仅在客户端配置中
		// `credentials` is not set on the client config. See #6957.
		// 未设置 `credentials` 时才成立。参见 #6957。
		const optionsProfile = options.profile || options.env?.AWS_PROFILE;
		const config: BedrockRuntimeClientConfig = {
			profile: optionsProfile || getProviderEnvValue("AWS_PROFILE", options.env),
		};
		const configuredRegion = getConfiguredBedrockRegion(options);
		const hasAmbientConfiguredProfile = Boolean(getProviderEnvValue("AWS_PROFILE"));
		const endpointRegion = getStandardBedrockEndpointRegion(model.baseUrl);
		const useExplicitEndpoint = shouldUseExplicitBedrockEndpoint(
			model.baseUrl,
			configuredRegion,
			hasAmbientConfiguredProfile,
		);

		// Only pin standard AWS Bedrock runtime endpoints when no region or ambient AWS_PROFILE is configured.
		// 仅在未配置 region 且环境中也没有 AWS_PROFILE 时，才固定使用标准的 AWS Bedrock runtime 端点。
		// This preserves custom endpoints (VPC/proxy) from #3402 without forcing built-in
		// 这样既保留了 #3402 中的自定义端点（VPC/代理），又不会让内置目录中的默认值
		// catalog defaults such as us-east-1 to override AWS_REGION/AWS_PROFILE.
		// （例如 us-east-1）强行覆盖 AWS_REGION/AWS_PROFILE。
		if (useExplicitEndpoint) {
			config.endpoint = model.baseUrl;
		}

		// Resolve bearer token for Bedrock API key auth.
		// 解析用于 Bedrock API key 认证的 bearer token。
		const skipAuth = getProviderEnvValue("AWS_BEDROCK_SKIP_AUTH", options.env) === "1";
		const bearerToken =
			options.bearerToken ||
			options.apiKey ||
			getProviderEnvValue("AWS_BEARER_TOKEN_BEDROCK", options.env) ||
			undefined;
		const useBearerToken = bearerToken !== undefined && !skipAuth;

		// in Node.js/Bun environment only
		// 仅在 Node.js/Bun 环境中执行
		if (typeof process !== "undefined" && (process.versions?.node || process.versions?.bun)) {
			// Region resolution: ARN-embedded > explicit option > env vars > SDK default chain.
			// region 解析优先级：ARN 中内嵌的 > 显式选项 > 环境变量 > SDK 默认链。
			// When the model ID is an inference profile ARN, extract the region from it.
			// 当模型 ID 是推理配置文件（inference profile）的 ARN 时，从中提取 region。
			// This avoids conflicts with AWS_REGION set for other services.
			// 这样可以避免与为其他服务设置的 AWS_REGION 冲突。
			const arnRegionMatch = model.id.match(/^arn:aws(?:-[a-z0-9-]+)?:bedrock:([a-z0-9-]+):/);
			if (arnRegionMatch) {
				config.region = arnRegionMatch[1];
			} else if (configuredRegion) {
				config.region = configuredRegion;
			} else if (endpointRegion && useExplicitEndpoint) {
				config.region = endpointRegion;
			} else if (!hasAmbientConfiguredProfile) {
				config.region = "us-east-1";
			}

			// Support proxies that don't need authentication
			// 支持无需认证的代理
			if (skipAuth) {
				config.credentials = {
					accessKeyId: "dummy-access-key",
					secretAccessKey: "dummy-secret-key",
				};
			}

			const credentials = getConfiguredBedrockCredentials(options.env);
			if (!skipAuth && credentials && !optionsProfile) {
				config.credentials = credentials;
			}

			const proxyUrl = resolveHttpProxyUrlForTarget(model.baseUrl, options.env);
			if (proxyUrl) {
				// Bedrock runtime uses NodeHttp2Handler by default since v3.798.0, which is based
				// 自 v3.798.0 起，Bedrock runtime 默认使用 NodeHttp2Handler，它基于
				// on `http2` module and has no support for http agent.
				// `http2` 模块，不支持 http agent。
				// Use NodeHttpHandler to support HTTP(S) proxy agents.
				// 因此改用 NodeHttpHandler 以支持 HTTP(S) 代理 agent。
				config.requestHandler = new NodeHttpHandler({
					httpAgent: new HttpProxyAgent(proxyUrl),
					httpsAgent: new HttpsProxyAgent(proxyUrl) as unknown as HttpsAgent,
				});
			} else if (getProviderEnvValue("AWS_BEDROCK_FORCE_HTTP1", options.env) === "1") {
				// Some custom endpoints require HTTP/1.1 instead of HTTP/2
				// 某些自定义端点要求使用 HTTP/1.1 而非 HTTP/2
				config.requestHandler = new NodeHttpHandler();
			}
		} else {
			// Non-Node environment (browser): fall back to us-east-1 since
			// 非 Node 环境（浏览器）：由于无法解析配置文件，
			// there's no config file resolution available.
			// 回退到 us-east-1。
			config.region =
				configuredRegion || (endpointRegion && useExplicitEndpoint ? endpointRegion : undefined) || "us-east-1";
		}

		if (useBearerToken) {
			config.token = { token: bearerToken };
			config.authSchemePreference = ["httpBearerAuth"];
		}

		// Kept outside the try so the catch can still correlate a mid-stream failure:
		// 放在 try 之外，以便 catch 仍能关联流中途发生的失败：
		// exceptions delivered as stream events carry no HTTP metadata of their own.
		// 以流事件形式传递的异常自身不携带任何 HTTP 元数据。
		let responseRequestId: string | undefined;

		try {
			const client = new BedrockRuntimeClient(config);
			const customHeaders = providerHeadersToRecord(options.headers);
			if (customHeaders) {
				addCustomHeadersMiddleware(client, customHeaders);
			}
			const cacheRetention = resolveCacheRetention(options.cacheRetention, options.env);
			const inferenceMaxTokens = options.maxTokens ?? (isAnthropicClaudeModel(model) ? model.maxTokens : undefined);
			let commandInput = {
				modelId: model.id,
				messages: convertMessages(context, model, cacheRetention, options.env),
				system: buildSystemPrompt(context.systemPrompt, model, cacheRetention, options.env),
				inferenceConfig: {
					...(inferenceMaxTokens !== undefined && { maxTokens: inferenceMaxTokens }),
					...(options.temperature !== undefined && { temperature: options.temperature }),
				},
				toolConfig: convertToolConfig(context.tools, options.toolChoice, model.compat?.supportsStrictMode ?? false),
				additionalModelRequestFields: buildAdditionalModelRequestFields(model, options),
				...(options.requestMetadata !== undefined && { requestMetadata: options.requestMetadata }),
			};
			const nextCommandInput = await options?.onPayload?.(commandInput, model);
			if (nextCommandInput !== undefined) {
				commandInput = nextCommandInput as typeof commandInput;
			}
			const command = new ConverseStreamCommand(commandInput);

			const response = await client.send(command, { abortSignal: options.signal });
			responseRequestId = normalizeDiagnosticValue(response.$metadata.requestId);
			if (response.$metadata.httpStatusCode !== undefined) {
				const responseHeaders: Record<string, string> = {};
				if (response.$metadata.requestId) {
					responseHeaders["x-amzn-requestid"] = response.$metadata.requestId;
				}
				await options?.onResponse?.({ status: response.$metadata.httpStatusCode, headers: responseHeaders }, model);
			}

			for await (const item of response.stream!) {
				if (item.messageStart) {
					if (item.messageStart.role !== ConversationRole.ASSISTANT) {
						throw new Error("Unexpected assistant message start but got user message start instead");
					}
					stream.push({ type: "start", partial: output });
				} else if (item.contentBlockStart) {
					handleContentBlockStart(item.contentBlockStart, blocks, output, stream);
				} else if (item.contentBlockDelta) {
					handleContentBlockDelta(item.contentBlockDelta, blocks, output, stream);
				} else if (item.contentBlockStop) {
					handleContentBlockStop(item.contentBlockStop, blocks, output, stream);
				} else if (item.messageStop) {
					output.rawStopReason = item.messageStop.stopReason;
					const { stopReason, errorMessage } = mapStopReason(item.messageStop.stopReason);
					output.stopReason = stopReason;
					if (errorMessage) {
						output.errorMessage = errorMessage;
					}
				} else if (item.metadata) {
					handleMetadata(item.metadata, model, output);
				} else if (item.internalServerException) {
					throw item.internalServerException;
				} else if (item.modelStreamErrorException) {
					throw item.modelStreamErrorException;
				} else if (item.validationException) {
					throw item.validationException;
				} else if (item.throttlingException) {
					throw item.throttlingException;
				} else if (item.serviceUnavailableException) {
					throw item.serviceUnavailableException;
				}
			}

			if (options.signal?.aborted) {
				throw new Error("Request was aborted");
			}

			if (output.stopReason === "pending") {
				throw new Error("Bedrock stream ended without a stop reason");
			}
			if (output.stopReason === "error" || output.stopReason === "aborted") {
				throw new Error(output.errorMessage || "An unknown error occurred");
			}

			stream.push({ type: "done", reason: output.stopReason, message: output });
			stream.end();
		} catch (error) {
			for (const block of output.content) {
				delete (block as Block).index;
				// partialJson is only a streaming scratch buffer; never persist it.
				// partialJson 只是流式处理的临时缓冲区；绝不要持久化它。
				delete (block as Block).partialJson;
			}
			output.stopReason = options.signal?.aborted ? "aborted" : "error";
			output.errorMessage = formatBedrockError(error);
			if (output.stopReason === "error") {
				appendBedrockFailureDiagnostic(output, error, responseRequestId);
			}
			stream.push({ type: "error", reason: output.stopReason, error: output });
			stream.end();
		}
	})();

	return stream;
};

/**
 * Human-readable prefixes for Bedrock SDK exception names.
 * Bedrock SDK 异常名称对应的可读前缀。
 * The downstream retry logic in agent-session matches patterns like
 * agent-session 中下游的重试逻辑会匹配诸如 `server.?error` 和
 * `server.?error` and `service.?unavailable`, so we preserve the legacy
 * `service.?unavailable` 这类模式，因此我们保留旧的前缀格式，
 * prefix format rather than using the raw SDK exception name.
 * 而不是直接使用 SDK 原始的异常名称。
 */
const BEDROCK_ERROR_PREFIXES: Record<string, string> = {
	InternalServerException: "Internal server error",
	ModelStreamErrorException: "Model stream error",
	ValidationException: "Validation error",
	ThrottlingException: "Throttling error",
	ServiceUnavailableException: "Service unavailable",
};

/**
 * Some models reject the account/profile's configured Bedrock data retention mode
 * 某些模型会拒绝账号/配置文件所设置的 Bedrock 数据保留模式
 * (e.g. "data retention mode 'default' is not available for this model"). Point
 * （例如 "data retention mode 'default' is not available for this model"）。
 * users at the AWS docs explaining how to configure a supported mode.
 * 此时引导用户查看 AWS 文档，了解如何配置受支持的模式。
 */
const BEDROCK_DATA_RETENTION_DOCS_URL = "https://docs.aws.amazon.com/bedrock/latest/userguide/data-retention.html";

/**
 * Format a Bedrock error with a human-readable prefix.
 * 为 Bedrock 错误加上可读前缀进行格式化。
 * AWS SDK exceptions (both from `client.send()` and from stream event items)
 * AWS SDK 抛出的异常（无论来自 `client.send()` 还是流事件项）
 * extend BedrockRuntimeServiceException. We map the `.name` to a stable
 * 都继承自 BedrockRuntimeServiceException。我们将 `.name` 映射为稳定的
 * human-readable prefix so downstream consumers (retry logic, context-overflow
 * 可读前缀，使下游消费方（重试逻辑、上下文溢出检测）能够
 * detection) can distinguish error categories via simple string matching.
 * 通过简单的字符串匹配区分错误类别。
 */
function formatBedrockError(error: unknown): string {
	const norm = normalizeProviderError(error);
	// Surface the raw HTTP body (with status) when the SDK did not fold it into
	// 当 SDK 未把原始 HTTP 响应体合入 message 时，直接暴露该响应体（含状态码）；
	// the message; otherwise fall back to the message. This is what stops a
	// 否则回退使用 message。正是这一点避免了网关返回的 403
	// gateway 403 from collapsing to `Unknown: UnknownError`.
	// 被压缩成 `Unknown: UnknownError`。
	const core =
		!norm.messageCarriesBody && norm.status !== undefined && norm.body !== undefined
			? `${norm.status}: ${norm.body}`
			: norm.message;
	const dataRetentionHint = /data retention mode/i.test(core)
		? ` See ${BEDROCK_DATA_RETENTION_DOCS_URL} for supported data retention modes.`
		: "";
	if (error instanceof BedrockRuntimeServiceException) {
		const prefix = BEDROCK_ERROR_PREFIXES[error.name] ?? error.name;
		return `${prefix}: ${core}${dataRetentionHint}`;
	}
	return `${core}${dataRetentionHint}`;
}

type SdkErrorMetadata = { $metadata?: { httpStatusCode?: unknown; requestId?: unknown } };

/** Over-long header values are dropped rather than truncated: a truncated request id is not a request id.
 * 过长的响应头值会被丢弃而非截断：被截断的 request id 已经不再是有效的 request id。 */
const MAX_BEDROCK_DIAGNOSTIC_VALUE_CHARS = 200;

function normalizeDiagnosticValue(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	if (trimmed.length === 0 || trimmed.length > MAX_BEDROCK_DIAGNOSTIC_VALUE_CHARS) return undefined;
	return trimmed;
}

/**
 * The SDK puts the modeled code on `error.name` for service exceptions and unmodeled stream errors alike, so
 * 无论是服务异常还是未建模的流错误，SDK 都会把建模的错误码放在 `error.name` 上，
 * do not narrow to `BedrockRuntimeServiceException`. Modeled Bedrock errors all end in `Exception`, unlike
 * 因此不要收窄为 `BedrockRuntimeServiceException`。已建模的 Bedrock 错误名称都以 `Exception` 结尾，
 * transport names such as `TimeoutError`.
 * 这与 `TimeoutError` 之类的传输层错误名不同。
 */
function extractBedrockErrorCode(error: unknown): string | undefined {
	if (!(error instanceof Error) || !error.name.endsWith("Exception")) return undefined;
	return normalizeDiagnosticValue(error.name);
}

/**
 * Structured metadata alongside `errorMessage`, which stays byte-identical because `isRetryableAssistantError`
 * 与 `errorMessage` 并存的结构化元数据；`errorMessage` 保持逐字节不变，因为 `isRetryableAssistantError`
 * matches against it. Unknown fields are omitted, never guessed: a modeled mid-stream exception reaches us as
 * 会对其进行匹配。未知字段一律省略、绝不猜测：流中途的已建模异常传到这里时只是一个
 * a bare object literal, leaving only `fallbackRequestId`. `details` only, as the throw is not always `Error`.
 * 裸对象字面量，只剩下 `fallbackRequestId`。只记录 `details`，因为抛出的值不一定是 `Error`。
 */
function appendBedrockFailureDiagnostic(
	output: AssistantMessage,
	error: unknown,
	fallbackRequestId: string | undefined,
): void {
	const metadata = (error as SdkErrorMetadata)?.$metadata;
	const details: Record<string, unknown> = {};

	if (typeof metadata?.httpStatusCode === "number") details.status = metadata.httpStatusCode;

	const errorCode = extractBedrockErrorCode(error);
	if (errorCode !== undefined) details.errorCode = errorCode;

	const requestId = normalizeDiagnosticValue(metadata?.requestId) ?? fallbackRequestId;
	if (requestId !== undefined) details.requestId = requestId;

	if (Object.keys(details).length === 0) return;

	appendAssistantMessageDiagnostic(output, { type: "bedrock_response_failure", timestamp: Date.now(), details });
}

/**
 * Header keys that must never be overwritten by caller-supplied headers.
 * 绝不允许被调用方自定义请求头覆盖的请求头键名。
 * `host` and `x-amz-*` participate in the SigV4 canonical request; `authorization`
 * `host` 与 `x-amz-*` 会参与 SigV4 规范请求的构造；`authorization`
 * is owned by SigV4 or the bearer-token path (config.token + authSchemePreference).
 * 则由 SigV4 或 bearer token 路径（config.token + authSchemePreference）负责。
 * Compared case-insensitively (caller key is lower-cased before lookup).
 * 比较时不区分大小写（调用方的键在查找前会转为小写）。
 */
const RESERVED_HEADER_EXACT = new Set(["authorization", "host"]);

function isReservedHeader(key: string): boolean {
	const lower = key.toLowerCase();
	return lower.startsWith("x-amz-") || RESERVED_HEADER_EXACT.has(lower);
}

/**
 * Attach caller-supplied headers to the outgoing Bedrock request via a Smithy
 * 通过 Smithy 的 `build` 阶段中间件，把调用方提供的请求头附加到发往 Bedrock 的请求上。
 * `build`-step middleware. The `build` step runs after request serialisation but
 * `build` 阶段在请求序列化之后、SigV4 签名之前执行，
 * before SigV4 signing, so injected headers are covered by the signature. Reserved
 * 因此注入的请求头会被签名覆盖。保留的 SigV4 / 认证类请求头
 * SigV4 / auth headers (`x-amz-*`, `authorization`, `host`) are silently skipped;
 * （`x-amz-*`、`authorization`、`host`）会被静默跳过；
 * all other caller headers override any existing same-named header on the request.
 * 其余调用方请求头会覆盖请求上已有的同名请求头。
 */
function addCustomHeadersMiddleware(client: BedrockRuntimeClient, headers: Record<string, string>): void {
	const middleware: BuildMiddleware<object, MetadataBearer> = (next) => async (args) => {
		const request = args.request;
		if (request && typeof request === "object" && "headers" in request) {
			const requestHeaders = (request as { headers: Record<string, string> }).headers;
			for (const [key, value] of Object.entries(headers)) {
				if (!isReservedHeader(key)) {
					requestHeaders[key] = value;
				}
			}
		}
		return next(args);
	};
	client.middlewareStack.add(middleware, { step: "build", name: "pi-ai-custom-headers", priority: "low" });
}

export const streamSimple: StreamFunction<"bedrock-converse-stream", SimpleStreamOptions> = (
	model: Model<"bedrock-converse-stream">,
	context: Context,
	options?: SimpleStreamOptions,
): AssistantMessageEventStream => {
	const base = buildBaseOptions(model, context, options, undefined);
	if (!options?.reasoning) {
		return stream(model, context, { ...base, reasoning: undefined } satisfies BedrockOptions);
	}

	if (isAnthropicClaudeModel(model)) {
		if (supportsAdaptiveThinking(model.id, model.name)) {
			return stream(model, context, {
				...base,
				reasoning: options.reasoning,
				thinkingBudgets: options.thinkingBudgets,
			} satisfies BedrockOptions);
		}

		// Undefined means the caller did not request an output cap; let the helper use the model cap.
		// undefined 表示调用方未指定输出上限；此时让辅助函数使用模型自身的上限。
		// Do not coerce to 0 here, or the thinking budget would become the entire maxTokens value.
		// 不要在这里强制转为 0，否则思考预算会占满整个 maxTokens 值。
		const adjusted = adjustMaxTokensForThinking(
			base.maxTokens,
			model.maxTokens,
			options.reasoning,
			options.thinkingBudgets,
		);

		const maxTokens = clampMaxTokensToContext(model, context, adjusted.maxTokens);

		return stream(model, context, {
			...base,
			maxTokens,
			reasoning: options.reasoning,
			thinkingBudgets: {
				...(options.thinkingBudgets || {}),
				[clampReasoning(options.reasoning)!]: Math.min(adjusted.thinkingBudget, Math.max(0, maxTokens - 1024)),
			},
		} satisfies BedrockOptions);
	}

	return stream(model, context, {
		...base,
		reasoning: options.reasoning,
		thinkingBudgets: options.thinkingBudgets,
	} satisfies BedrockOptions);
};

function handleContentBlockStart(
	event: ContentBlockStartEvent,
	blocks: Block[],
	output: AssistantMessage,
	stream: AssistantMessageEventStream,
): void {
	const index = event.contentBlockIndex!;
	const start = event.start;

	if (start?.toolUse) {
		const block: Block = {
			type: "toolCall",
			id: start.toolUse.toolUseId || "",
			name: start.toolUse.name || "",
			arguments: {},
			partialJson: "",
			index,
		};
		output.content.push(block);
		stream.push({ type: "toolcall_start", contentIndex: blocks.length - 1, partial: output });
	}
}

function handleContentBlockDelta(
	event: ContentBlockDeltaEvent,
	blocks: Block[],
	output: AssistantMessage,
	stream: AssistantMessageEventStream,
): void {
	const contentBlockIndex = event.contentBlockIndex!;
	const delta = event.delta;
	let index = blocks.findIndex((b) => b.index === contentBlockIndex);
	let block = blocks[index];

	if (delta?.text !== undefined) {
		// If no text block exists yet, create one, as `handleContentBlockStart` is not sent for text blocks
		// 如果还没有文本块，则新建一个，因为文本块不会触发 `handleContentBlockStart`
		if (!block) {
			const newBlock: Block = { type: "text", text: "", index: contentBlockIndex };
			output.content.push(newBlock);
			index = blocks.length - 1;
			block = blocks[index];
			stream.push({ type: "text_start", contentIndex: index, partial: output });
		}
		if (block.type === "text") {
			block.text += delta.text;
			stream.push({ type: "text_delta", contentIndex: index, delta: delta.text, partial: output });
		}
	} else if (delta?.toolUse && block?.type === "toolCall") {
		block.partialJson = (block.partialJson || "") + (delta.toolUse.input || "");
		block.arguments = parseStreamingJson(block.partialJson);
		stream.push({ type: "toolcall_delta", contentIndex: index, delta: delta.toolUse.input || "", partial: output });
	} else if (delta?.reasoningContent) {
		let thinkingBlock = block;
		let thinkingIndex = index;

		if (!thinkingBlock) {
			const newBlock: Block = { type: "thinking", thinking: "", thinkingSignature: "", index: contentBlockIndex };
			output.content.push(newBlock);
			thinkingIndex = blocks.length - 1;
			thinkingBlock = blocks[thinkingIndex];
			stream.push({ type: "thinking_start", contentIndex: thinkingIndex, partial: output });
		}

		if (thinkingBlock?.type === "thinking") {
			if (delta.reasoningContent.text) {
				thinkingBlock.thinking += delta.reasoningContent.text;
				stream.push({
					type: "thinking_delta",
					contentIndex: thinkingIndex,
					delta: delta.reasoningContent.text,
					partial: output,
				});
			}
			if (delta.reasoningContent.signature) {
				thinkingBlock.thinkingSignature =
					(thinkingBlock.thinkingSignature || "") + delta.reasoningContent.signature;
			}
		}
	}
}

function handleMetadata(
	event: ConverseStreamMetadataEvent,
	model: Model<"bedrock-converse-stream">,
	output: AssistantMessage,
): void {
	if (event.usage) {
		output.usage.input = event.usage.inputTokens || 0;
		output.usage.output = event.usage.outputTokens || 0;
		output.usage.cacheRead = event.usage.cacheReadInputTokens || 0;
		output.usage.cacheWrite = event.usage.cacheWriteInputTokens || 0;
		output.usage.totalTokens = event.usage.totalTokens || output.usage.input + output.usage.output;
		calculateCost(model, output.usage);
	}
}

function handleContentBlockStop(
	event: ContentBlockStopEvent,
	blocks: Block[],
	output: AssistantMessage,
	stream: AssistantMessageEventStream,
): void {
	const index = blocks.findIndex((b) => b.index === event.contentBlockIndex);
	const block = blocks[index];
	if (!block) return;
	delete (block as Block).index;

	switch (block.type) {
		case "text":
			stream.push({ type: "text_end", contentIndex: index, content: block.text, partial: output });
			break;
		case "thinking":
			stream.push({ type: "thinking_end", contentIndex: index, content: block.thinking, partial: output });
			break;
		case "toolCall":
			block.arguments = parseStreamingJson(block.partialJson);
			// Finalize in-place and strip the scratch buffer so replay only
			// 就地完成收尾并清除临时缓冲区，使回放时只携带
			// carries parsed arguments.
			// 已解析的参数。
			delete (block as Block).partialJson;
			stream.push({ type: "toolcall_end", contentIndex: index, toolCall: block, partial: output });
			break;
	}
}

/**
 * Check if the model supports adaptive thinking (Opus 4.6+, Sonnet 4.6).
 * 检查模型是否支持自适应思考（adaptive thinking，Opus 4.6+、Sonnet 4.6）。
 * Checks both model ID and model name to support application inference profiles
 * 同时检查模型 ID 与模型名称，以支持 ARN 中不包含模型名称的
 * whose ARNs don't contain the model name.
 * 应用推理配置文件（application inference profile）。
 */
function getModelMatchCandidates(modelId: string, modelName?: string): string[] {
	const values = modelName ? [modelId, modelName] : [modelId];
	return values.flatMap((value) => {
		const lower = value.toLowerCase();
		return [lower, lower.replace(/[\s_.:]+/g, "-")];
	});
}

function supportsAdaptiveThinking(modelId: string, modelName?: string): boolean {
	const candidates = getModelMatchCandidates(modelId, modelName);
	return candidates.some(
		(s) =>
			s.includes("opus-4-6") ||
			s.includes("opus-4-7") ||
			s.includes("opus-4-8") ||
			s.includes("opus-5") ||
			s.includes("sonnet-4-6") ||
			s.includes("sonnet-5") ||
			s.includes("fable-5"),
	);
}

function supportsNativeXhighEffort(model: Model<"bedrock-converse-stream">): boolean {
	const candidates = getModelMatchCandidates(model.id, model.name);
	return candidates.some(
		(s) =>
			s.includes("opus-4-7") ||
			s.includes("opus-4-8") ||
			s.includes("opus-5") ||
			s.includes("sonnet-5") ||
			s.includes("fable-5"),
	);
}

function mapThinkingLevelToEffort(
	model: Model<"bedrock-converse-stream">,
	level: SimpleStreamOptions["reasoning"],
): "low" | "medium" | "high" | "xhigh" | "max" {
	if (level === "xhigh" && supportsNativeXhighEffort(model)) return "xhigh";

	const mapped = level ? model.thinkingLevelMap?.[level] : undefined;
	if (typeof mapped === "string") return mapped as "low" | "medium" | "high" | "xhigh" | "max";

	switch (level) {
		case "minimal":
		case "low":
			return "low";
		case "medium":
			return "medium";
		case "high":
			return "high";
		default:
			return "high";
	}
}

/**
 * Resolve cache retention preference.
 * 解析缓存保留（cache retention）偏好设置。
 * Defaults to "short" and uses PI_CACHE_RETENTION for backward compatibility.
 * 默认为 "short"，并使用 PI_CACHE_RETENTION 以保持向后兼容。
 */
function resolveCacheRetention(cacheRetention?: CacheRetention, env?: ProviderEnv): CacheRetention {
	if (cacheRetention) {
		return cacheRetention;
	}
	if (getProviderEnvValue("PI_CACHE_RETENTION", env) === "long") {
		return "long";
	}
	return "short";
}

/**
 * Check if the model is an Anthropic Claude model on Bedrock.
 * 检查该模型是否为 Bedrock 上的 Anthropic Claude 模型。
 * Checks both model ID and model name to support application inference profiles
 * 同时检查模型 ID 与模型名称，以支持 ARN 中不包含模型名称的
 * whose ARNs don't contain the model name.
 * 应用推理配置文件（application inference profile）。
 */
function isAnthropicClaudeModel(model: Model<"bedrock-converse-stream">): boolean {
	const id = model.id.toLowerCase();
	const name = model.name?.toLowerCase() ?? "";
	return (
		id.includes("anthropic.claude") ||
		id.includes("anthropic/claude") ||
		name.includes("anthropic.claude") ||
		name.includes("anthropic/claude") ||
		name.includes("claude")
	);
}

/**
 * Check if the model supports prompt caching.
 * 检查模型是否支持提示词缓存（prompt caching）。
 * Supported: Claude 3.5 Haiku, Claude 3.7 Sonnet, Claude 4.x models, Claude 5 models
 * 已支持：Claude 3.5 Haiku、Claude 3.7 Sonnet、Claude 4.x 系列、Claude 5 系列。
 *
 * For base models and system-defined inference profiles the model ID / ARN
 * 对于基础模型和系统定义的推理配置文件，模型 ID / ARN 中包含模型名称，
 * contains the model name, so we can decide locally.
 * 因此可以在本地直接判断。
 *
 * For application inference profiles (whose ARNs don't contain the model name),
 * 对于应用推理配置文件（其 ARN 不包含模型名称），
 * also checks model.name which is user-controlled via models.json or registerProvider.
 * 还会检查 model.name，该值由用户通过 models.json 或 registerProvider 控制。
 * As a last resort, set AWS_BEDROCK_FORCE_CACHE=1 to enable cache points.
 * 作为最后手段，可设置 AWS_BEDROCK_FORCE_CACHE=1 来启用缓存点（cache point）。
 * Amazon Nova models have automatic caching and don't need explicit cache points.
 * Amazon Nova 系列模型具备自动缓存，无需显式的缓存点。
 */
function supportsPromptCaching(model: Model<"bedrock-converse-stream">, env?: ProviderEnv): boolean {
	const candidates = getModelMatchCandidates(model.id, model.name);

	const hasClaudeRef = candidates.some((s) => s.includes("claude"));
	if (!hasClaudeRef) {
		// Application inference profiles don't contain the model name in the ARN.
		// 应用推理配置文件的 ARN 中不包含模型名称。
		// Allow users to force cache points via environment variable.
		// 允许用户通过环境变量强制启用缓存点。
		if (getProviderEnvValue("AWS_BEDROCK_FORCE_CACHE", env) === "1") return true;
		return false;
	}
	// Claude 5 models (fable-5, opus-5, sonnet-5)
	// Claude 5 系列模型（fable-5、opus-5、sonnet-5）
	if (candidates.some((s) => s.includes("fable-5") || s.includes("opus-5") || s.includes("sonnet-5"))) return true;
	// Claude 4.x models (opus-4, sonnet-4, haiku-4)
	// Claude 4.x 系列模型（opus-4、sonnet-4、haiku-4）
	if (candidates.some((s) => s.includes("-4-"))) return true;
	// Claude 3.7 Sonnet
	// Claude 3.7 Sonnet 模型
	if (candidates.some((s) => s.includes("claude-3-7-sonnet"))) return true;
	// Claude 3.5 Haiku
	// Claude 3.5 Haiku 模型
	if (candidates.some((s) => s.includes("claude-3-5-haiku"))) return true;
	return false;
}

/**
 * Check if the model supports thinking signatures in reasoningContent.
 * 检查模型是否支持 reasoningContent 中的思考签名（thinking signature）。
 * Only Anthropic Claude models support the signature field.
 * 只有 Anthropic Claude 系列模型支持 signature 字段。
 * Other models (OpenAI, Qwen, Minimax, Moonshot, etc.) reject it with:
 * 其他模型（OpenAI、Qwen、Minimax、Moonshot 等）会拒绝该字段并报错：
 * "This model doesn't support the reasoningContent.reasoningText.signature field"
 *
 * Checks both model ID and model name to support application inference profiles.
 * 同时检查模型 ID 与模型名称，以支持应用推理配置文件。
 */
function supportsThinkingSignature(model: Model<"bedrock-converse-stream">): boolean {
	return isAnthropicClaudeModel(model);
}

function buildSystemPrompt(
	systemPrompt: string | undefined,
	model: Model<"bedrock-converse-stream">,
	cacheRetention: CacheRetention,
	env?: ProviderEnv,
): SystemContentBlock[] | undefined {
	if (!systemPrompt) return undefined;

	const blocks: SystemContentBlock[] = [{ text: sanitizeSurrogates(systemPrompt) }];

	// Add cache point for supported Claude models when caching is enabled
	// 启用缓存且模型受支持时，为 Claude 模型添加缓存点
	if (cacheRetention !== "none" && supportsPromptCaching(model, env)) {
		blocks.push({
			cachePoint: { type: CachePointType.DEFAULT, ...(cacheRetention === "long" ? { ttl: CacheTTL.ONE_HOUR } : {}) },
		});
	}

	return blocks;
}

function normalizeToolCallId(id: string): string {
	const sanitized = id.replace(/[^a-zA-Z0-9_-]/g, "_");
	return sanitized.length > 64 ? sanitized.slice(0, 64) : sanitized;
}

function createNonBlankTextBlock(text: string): ContentBlock.TextMember | undefined {
	const sanitized = sanitizeSurrogates(text);
	return sanitized.trim().length === 0 ? undefined : { text: sanitized };
}

function createRequiredTextBlock(text: string): ContentBlock.TextMember {
	return createNonBlankTextBlock(text) ?? { text: EMPTY_TEXT_PLACEHOLDER };
}

function convertToolResultContent(content: (TextContent | ImageContent)[]): ToolResultContentBlock[] {
	const result: ToolResultContentBlock[] = [];
	for (const c of content) {
		if (c.type === "image") {
			result.push({ image: createImageBlock(c.mimeType, c.data) });
		} else {
			const textBlock = createNonBlankTextBlock(c.text);
			if (textBlock) result.push(textBlock);
		}
	}
	if (result.length === 0) result.push({ text: EMPTY_TEXT_PLACEHOLDER });
	return result;
}

function convertMessages(
	context: Context,
	model: Model<"bedrock-converse-stream">,
	cacheRetention: CacheRetention,
	env?: ProviderEnv,
): Message[] {
	const result: Message[] = [];
	const transformedMessages = transformMessages(context.messages, model, normalizeToolCallId);

	for (let i = 0; i < transformedMessages.length; i++) {
		const m = transformedMessages[i];

		switch (m.role) {
			case "user": {
				const content: ContentBlock[] = [];
				if (typeof m.content === "string") {
					content.push(createRequiredTextBlock(m.content));
				} else {
					for (const c of m.content) {
						switch (c.type) {
							case "text": {
								const textBlock = createNonBlankTextBlock(c.text);
								if (textBlock) content.push(textBlock);
								break;
							}
							case "image":
								content.push({ image: createImageBlock(c.mimeType, c.data) });
								break;
							default:
								continue;
						}
					}
					if (content.length === 0) content.push({ text: EMPTY_TEXT_PLACEHOLDER });
				}
				result.push({
					role: ConversationRole.USER,
					content,
				});
				break;
			}
			case "assistant": {
				// Skip assistant messages with empty content (e.g., from aborted requests)
				// 跳过内容为空的助手消息（例如来自被中止的请求）
				// Bedrock rejects messages with empty content arrays
				// Bedrock 会拒绝 content 数组为空的消息
				if (m.content.length === 0) {
					continue;
				}
				const contentBlocks: ContentBlock[] = [];
				for (const c of m.content) {
					switch (c.type) {
						case "text": {
							// Skip empty text blocks
							// 跳过空的文本块
							const textBlock = createNonBlankTextBlock(c.text);
							if (!textBlock) continue;
							contentBlocks.push(textBlock);
							break;
						}
						case "toolCall":
							contentBlocks.push({
								toolUse: { toolUseId: c.id, name: c.name, input: c.arguments },
							});
							break;
						case "thinking": {
							// Skip empty thinking blocks
							// 跳过空的思考块
							const thinking = sanitizeSurrogates(c.thinking);
							if (thinking.trim().length === 0) continue;
							// Only Anthropic models support the signature field in reasoningText.
							// 只有 Anthropic 模型支持 reasoningText 中的 signature 字段。
							// For other models, we omit the signature to avoid errors like:
							// 对于其他模型，我们会省略 signature 以避免如下错误：
							// "This model doesn't support the reasoningContent.reasoningText.signature field"
							if (supportsThinkingSignature(model)) {
								// Signatures arrive after thinking deltas. If a partial or externally
								// 签名会在思考增量（delta）之后才到达。如果一条不完整的消息或外部
								// persisted message lacks a signature, Bedrock rejects the replayed
								// 持久化的消息缺少签名，Bedrock 会拒绝被回放的推理块。
								// reasoning block. Fall back to plain text, matching Anthropic.
								// 此时回退为纯文本，与 Anthropic 的做法保持一致。
								if (!c.thinkingSignature || c.thinkingSignature.trim().length === 0) {
									contentBlocks.push({ text: thinking });
								} else {
									contentBlocks.push({
										reasoningContent: {
											reasoningText: {
												text: thinking,
												signature: c.thinkingSignature,
											},
										},
									});
								}
							} else {
								contentBlocks.push({
									reasoningContent: {
										reasoningText: { text: thinking },
									},
								});
							}
							break;
						}
						default:
							continue;
					}
				}
				// Skip if all content blocks were filtered out
				// 如果所有内容块都被过滤掉了，则跳过该消息
				if (contentBlocks.length === 0) {
					continue;
				}
				result.push({
					role: ConversationRole.ASSISTANT,
					content: contentBlocks,
				});
				break;
			}
			case "toolResult": {
				// Collect all consecutive toolResult messages into a single user message
				// 将所有连续的 toolResult 消息合并到一条用户消息中
				// Bedrock requires all tool results to be in one message
				// Bedrock 要求所有工具结果必须位于同一条消息内
				const toolResults: ContentBlock.ToolResultMember[] = [];

				// Add current tool result with all content blocks combined
				// 添加当前工具结果，并合并其全部内容块
				toolResults.push({
					toolResult: {
						toolUseId: m.toolCallId,
						content: convertToolResultContent(m.content),
						status: m.isError ? ToolResultStatus.ERROR : ToolResultStatus.SUCCESS,
					},
				});

				// Look ahead for consecutive toolResult messages
				// 向后查找连续的 toolResult 消息
				let j = i + 1;
				while (j < transformedMessages.length && transformedMessages[j].role === "toolResult") {
					const nextMsg = transformedMessages[j] as ToolResultMessage;
					toolResults.push({
						toolResult: {
							toolUseId: nextMsg.toolCallId,
							content: convertToolResultContent(nextMsg.content),
							status: nextMsg.isError ? ToolResultStatus.ERROR : ToolResultStatus.SUCCESS,
						},
					});
					j++;
				}

				// Skip the messages we've already processed
				// 跳过已经处理过的消息
				i = j - 1;

				result.push({
					role: ConversationRole.USER,
					content: toolResults,
				});
				break;
			}
			default:
				continue;
		}
	}

	// Add cache point to the last user message for supported Claude models when caching is enabled
	// 启用缓存且模型受支持时，为最后一条用户消息添加缓存点
	if (cacheRetention !== "none" && supportsPromptCaching(model, env) && result.length > 0) {
		const lastMessage = result[result.length - 1];
		if (lastMessage.role === ConversationRole.USER && lastMessage.content) {
			(lastMessage.content as ContentBlock[]).push({
				cachePoint: {
					type: CachePointType.DEFAULT,
					...(cacheRetention === "long" ? { ttl: CacheTTL.ONE_HOUR } : {}),
				},
			});
		}
	}

	return result;
}

function convertToolConfig(
	tools: Tool[] | undefined,
	toolChoice: BedrockOptions["toolChoice"],
	supportsStrictMode: boolean,
): ToolConfiguration | undefined {
	if (!tools?.length) return undefined;
	if (toolChoice === "none") return undefined;

	const bedrockTools: BedrockTool[] = tools.map((tool) => {
		const strict = resolveJsonSchemaStrictSampling(tool, supportsStrictMode);
		return {
			toolSpec: {
				name: tool.name,
				description: tool.description,
				inputSchema: { json: tool.parameters as unknown as DocumentType },
				...(strict === true ? { strict: true } : {}),
			},
		};
	});

	let bedrockToolChoice: ToolChoice | undefined;
	switch (toolChoice) {
		case "auto":
			bedrockToolChoice = { auto: {} };
			break;
		case "any":
			bedrockToolChoice = { any: {} };
			break;
		default:
			if (toolChoice?.type === "tool") {
				bedrockToolChoice = { tool: { name: toolChoice.name } };
			}
	}

	return { tools: bedrockTools, toolChoice: bedrockToolChoice };
}

function mapStopReason(reason: string | undefined): { stopReason: StopReason; errorMessage?: string } {
	switch (reason) {
		case BedrockStopReason.END_TURN:
		case BedrockStopReason.STOP_SEQUENCE:
			return { stopReason: "stop" };
		case BedrockStopReason.MAX_TOKENS:
		case BedrockStopReason.MODEL_CONTEXT_WINDOW_EXCEEDED:
			return { stopReason: "length" };
		case BedrockStopReason.TOOL_USE:
			return { stopReason: "toolUse" };
		default:
			return reason
				? { stopReason: "error", errorMessage: `Provider stopped with: ${reason}` }
				: { stopReason: "error" };
	}
}

function getConfiguredBedrockRegion(options: BedrockOptions): string | undefined {
	return (
		options.region ||
		getProviderEnvValue("AWS_REGION", options.env) ||
		getProviderEnvValue("AWS_DEFAULT_REGION", options.env) ||
		undefined
	);
}

function getConfiguredBedrockCredentials(env?: ProviderEnv): BedrockRuntimeClientConfig["credentials"] | undefined {
	const accessKeyId = getProviderEnvValue("AWS_ACCESS_KEY_ID", env);
	const secretAccessKey = getProviderEnvValue("AWS_SECRET_ACCESS_KEY", env);
	if (!accessKeyId || !secretAccessKey) {
		return undefined;
	}
	const sessionToken = getProviderEnvValue("AWS_SESSION_TOKEN", env);
	return {
		accessKeyId,
		secretAccessKey,
		...(sessionToken ? { sessionToken } : {}),
	};
}

function getStandardBedrockEndpointRegion(baseUrl: string | undefined): string | undefined {
	if (!baseUrl) {
		return undefined;
	}

	try {
		const { hostname } = new URL(baseUrl);
		const match = hostname.toLowerCase().match(/^bedrock-runtime(?:-fips)?\.([a-z0-9-]+)\.amazonaws\.com(?:\.cn)?$/);
		return match?.[1];
	} catch {
		return undefined;
	}
}

function shouldUseExplicitBedrockEndpoint(
	baseUrl: string,
	configuredRegion: string | undefined,
	hasAmbientConfiguredProfile: boolean,
): boolean {
	const endpointRegion = getStandardBedrockEndpointRegion(baseUrl);
	if (!endpointRegion) {
		return true;
	}

	return !configuredRegion && !hasAmbientConfiguredProfile;
}

function isGovCloudBedrockTarget(model: Model<"bedrock-converse-stream">, options: BedrockOptions): boolean {
	const region = getConfiguredBedrockRegion(options);
	if (region?.toLowerCase().startsWith("us-gov-")) {
		return true;
	}

	const modelId = model.id.toLowerCase();
	return modelId.startsWith("us-gov.") || modelId.startsWith("arn:aws-us-gov:");
}

function buildAdditionalModelRequestFields(
	model: Model<"bedrock-converse-stream">,
	options: BedrockOptions,
): Record<string, any> | undefined {
	if (!options.reasoning || !model.reasoning) {
		return undefined;
	}

	if (isAnthropicClaudeModel(model)) {
		// GovCloud Bedrock currently rejects the Claude thinking.display field.
		// GovCloud 上的 Bedrock 目前会拒绝 Claude 的 thinking.display 字段。
		// Omit it there until the GovCloud Converse schema catches up.
		// 在 GovCloud 的 Converse schema 跟进之前，这里先省略该字段。
		const display = isGovCloudBedrockTarget(model, options) ? undefined : (options.thinkingDisplay ?? "summarized");
		const result: Record<string, any> = supportsAdaptiveThinking(model.id, model.name)
			? {
					thinking: { type: "adaptive", ...(display !== undefined ? { display } : {}) },
					output_config: { effort: mapThinkingLevelToEffort(model, options.reasoning) },
				}
			: (() => {
					const defaultBudgets: Record<ThinkingLevel, number> = {
						minimal: 1024,
						low: 2048,
						medium: 8192,
						high: 16384,
						xhigh: 16384, // Budget-based Claude clamps extended levels to high
						// 基于预算模式的 Claude 会把扩展等级钳制到 high
						max: 16384,
					};

					// Custom budgets only cover token-based levels through high.
					// 自定义预算仅覆盖到 high 为止的基于 token 的等级。
					const level = options.reasoning === "xhigh" || options.reasoning === "max" ? "high" : options.reasoning;
					const budget = options.thinkingBudgets?.[level] ?? defaultBudgets[options.reasoning];

					return {
						thinking: {
							type: "enabled",
							budget_tokens: budget,
							...(display !== undefined ? { display } : {}),
						},
					};
				})();

		if (!supportsAdaptiveThinking(model.id, model.name) && (options.interleavedThinking ?? true)) {
			result.anthropic_beta = ["interleaved-thinking-2025-05-14"];
		}

		return result;
	}

	return undefined;
}

function createImageBlock(mimeType: string, data: string) {
	let format: ImageFormat;
	switch (mimeType) {
		case "image/jpeg":
		case "image/jpg":
			format = ImageFormat.JPEG;
			break;
		case "image/png":
			format = ImageFormat.PNG;
			break;
		case "image/gif":
			format = ImageFormat.GIF;
			break;
		case "image/webp":
			format = ImageFormat.WEBP;
			break;
		default:
			throw new Error(`Unknown image type: ${mimeType}`);
	}

	const binaryString = atob(data);
	const bytes = new Uint8Array(binaryString.length);
	for (let i = 0; i < binaryString.length; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}

	return { source: { bytes }, format };
}
