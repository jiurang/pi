// Shared normalization for provider HTTP error objects.
// 针对提供方（provider）HTTP 错误对象的通用归一化处理。
//
// Endpoints behind a proxy / gateway may return a non-2xx response whose body
// the provider SDK cannot fold into `error.message`. The SDK error object still
// carries the HTTP status and the raw/parsed body, but under SDK-specific field
// names. Provider catch blocks that read only `error.message` therefore drop
// the body and surface opaque messages like `"403 status code (no body)"` or
// collapse to `"Unknown: UnknownError"`.
// 位于代理/网关之后的端点可能返回非 2xx 响应，而提供方 SDK 无法把其响应体折叠进
// `error.message`。SDK 的错误对象仍然携带 HTTP 状态码和原始/已解析的响应体，
// 只是放在各 SDK 专有的字段名下。因此，只读取 `error.message` 的提供方 catch 代码块
// 会丢失响应体，进而暴露出像 `"403 status code (no body)"` 这样含义模糊的消息，
// 或者退化成 `"Unknown: UnknownError"`。
//
// `normalizeProviderError` probes the known SDK field shapes (Mistral,
// `openai`, `@google/genai`, AWS Bedrock) and returns a struct each provider
// composes into its display string. The `messageCarriesBody` flag captures the
// Anthropic / `@google/genai` happy path where the SDK already folded the body
// into the message, so providers can preserve it without double-printing.
// `normalizeProviderError` 会探测已知的 SDK 字段结构（Mistral、`openai`、
// `@google/genai`、AWS Bedrock），并返回一个结构体，供各提供方组装成展示字符串。
// `messageCarriesBody` 标志用于表示 Anthropic / `@google/genai` 的理想情况：
// SDK 已经把响应体折叠进了消息，因此提供方可以保留它而不会重复打印。

export const MAX_PROVIDER_ERROR_BODY_CHARS = 4000;

export interface NormalizedProviderError {
	/**
	 * HTTP status code, when one could be extracted from the SDK error object.
	 * HTTP 状态码，仅在能够从 SDK 错误对象中提取到时才有值。
	 */
	status?: number;
	/**
	 * Raw HTTP body reason, already trimmed and truncated to the cap.
	 * 原始 HTTP 响应体内容，已完成首尾空白裁剪并截断至上限长度。
	 */
	body?: string;
	/**
	 * `error.message`, or `safeJsonStringify(error)` for a non-`Error` throw.
	 * 即 `error.message`；若抛出的不是 `Error` 对象，则为 `safeJsonStringify(error)`。
	 */
	message: string;
	/**
	 * True when `message` already contains the body (no separate body to add).
	 * 当 `message` 已经包含响应体内容时为 true（无需再单独追加响应体）。
	 */
	messageCarriesBody: boolean;
}

type SdkErrorShape = Error & {
	statusCode?: unknown;
	status?: unknown;
	body?: unknown;
	error?: unknown;
	$metadata?: { httpStatusCode?: unknown };
	$response?: { statusCode?: unknown; body?: unknown };
};

export function normalizeProviderError(error: unknown): NormalizedProviderError {
	if (!(error instanceof Error)) {
		return { message: safeJsonStringify(error), messageCarriesBody: false };
	}

	const sdkError = error as SdkErrorShape;
	const status = extractStatus(sdkError);
	const body = extractBody(sdkError);
	const messageCarriesBody = body === undefined || error.message.includes(body);

	return {
		status,
		body,
		message: error.message,
		messageCarriesBody,
	} satisfies NormalizedProviderError;
}

/**
 * Probe the HTTP status, first numeric hit wins, in SDK-field order:
 * `statusCode` (Mistral) → `status` (`openai`, `@google/genai`) →
 * `$metadata.httpStatusCode` (Bedrock) → `$response.statusCode` (Bedrock).
 * 按 SDK 字段顺序探测 HTTP 状态码，取第一个命中的数值：
 * `statusCode`（Mistral） → `status`（`openai`、`@google/genai`） →
 * `$metadata.httpStatusCode`（Bedrock） → `$response.statusCode`（Bedrock）。
 */
function extractStatus(error: SdkErrorShape): number | undefined {
	if (typeof error.statusCode === "number") return error.statusCode;
	if (typeof error.status === "number") return error.status;
	if (typeof error.$metadata?.httpStatusCode === "number") return error.$metadata.httpStatusCode;
	if (typeof error.$response?.statusCode === "number") return error.$response.statusCode;
	return undefined;
}

/**
 * Probe the raw body reason, first usable hit wins, in SDK-field order:
 * `body` string (Mistral) → `error` parsed JSON body object (`openai` SDK's
 * `this.error`) → `$response.body` (Bedrock). Empty objects and unread response
 * streams are treated as no body so they do not surface as `"{}"` or serialized
 * stream internals. The chosen body is truncated to the cap.
 * 按 SDK 字段顺序探测原始响应体内容，取第一个可用的命中项：
 * `body` 字符串（Mistral） → `error` 已解析的 JSON 响应体对象（`openai` SDK 的
 * `this.error`） → `$response.body`（Bedrock）。空对象和尚未读取的响应流会被视为“无响应体”，
 * 以免它们以 `"{}"` 或序列化后的流内部结构形式暴露出来。选中的响应体会被截断至上限长度。
 */
function extractBody(error: SdkErrorShape): string | undefined {
	const bodyText = pickBodyText(error);
	if (bodyText === undefined) return undefined;
	const trimmed = bodyText.trim();
	if (trimmed.length === 0) return undefined;
	return truncateErrorText(trimmed, MAX_PROVIDER_ERROR_BODY_CHARS);
}

function pickBodyText(error: SdkErrorShape): string | undefined {
	if (typeof error.body === "string") return error.body;
	if (isPlainNonEmptyObject(error.error)) return safeJsonStringify(error.error);
	const responseBody = error.$response?.body;
	if (typeof responseBody === "string") return responseBody;
	if (isReadableStreamLike(responseBody)) return undefined;
	if (isPlainNonEmptyObject(responseBody)) return safeJsonStringify(responseBody);
	return undefined;
}

function isReadableStreamLike(value: unknown): boolean {
	return typeof value === "object" && value !== null && "pipe" in value && typeof value.pipe === "function";
}

/**
 * Only a PLAIN object counts as an HTTP body. SDK error fields can hold class
 * instances instead of parsed bodies — AWS SDK v3's `$response.body` is an
 * HTTP stream/response wrapper object, and stringifying one produced garbage
 * like `{"_events":...}` as the "body", which then REPLACED `error.message`
 * in the composed display string. `error.message` is where the SDK puts the
 * real deserialized exception text ("Input is too long...", schema validation
 * details, ...), so the one useful string was discarded for noise. A class
 * instance yields no body, `messageCarriesBody` stays true, and the real
 * message survives. Complements the `pipe` sniffing above: web
 * ReadableStreams (pipeTo/pipeThrough, no `pipe`) and non-stream SDK wrapper
 * classes fail the prototype check, while parsed JSON bodies (plain objects
 * by construction) still pass.
 * 只有“纯对象（PLAIN object）”才算作 HTTP 响应体。SDK 的错误字段中可能存放的是类实例，
 * 而非已解析的响应体 —— AWS SDK v3 的 `$response.body` 就是一个 HTTP 流/响应包装对象，
 * 把它字符串化会得到形如 `{"_events":...}` 的垃圾内容并被当作“响应体”，进而在组装出的
 * 展示字符串中“替换掉” `error.message`。而 `error.message` 恰恰是 SDK 存放真实反序列化
 * 异常文本的地方（"Input is too long..."、schema 校验细节等），于是唯一有用的字符串被
 * 噪声挤掉了。若为类实例则不产出响应体，`messageCarriesBody` 保持为 true，真实消息得以保留。
 * 本检查与上文的 `pipe` 嗅探互为补充：Web 的 ReadableStream（只有 pipeTo/pipeThrough，
 * 没有 `pipe`）和非流式的 SDK 包装类都无法通过原型检查，而已解析的 JSON 响应体
 * （构造上就是纯对象）仍能通过。
 */
function isPlainNonEmptyObject(value: unknown): boolean {
	if (typeof value !== "object" || value === null) return false;
	const proto = Object.getPrototypeOf(value);
	if (proto !== Object.prototype && proto !== null) return false;
	return Object.keys(value).length > 0;
}

/**
 * Compose a display string from a normalized error. When the message already
 * carries the body (Anthropic / `@google/genai` happy path) or no body/status
 * was extracted, the message is returned unchanged. Otherwise the status and
 * body are surfaced, with an optional provider prefix.
 * 由归一化后的错误组装出展示字符串。当消息已经携带响应体（Anthropic / `@google/genai`
 * 的理想情况），或者未能提取到响应体/状态码时，直接原样返回该消息。
 * 否则会把状态码和响应体展示出来，并可附加一个可选的提供方前缀。
 *
 * - no prefix: `"<status>: <body>"`
 *   无前缀：`"<status>: <body>"`
 * - prefix:    `"<prefix> (<status>): <body>"`
 *   有前缀：`"<prefix> (<status>): <body>"`
 */
export function formatProviderError(norm: NormalizedProviderError, prefix?: string): string {
	if (norm.messageCarriesBody || norm.status === undefined || norm.body === undefined) {
		return prefix !== undefined && norm.status !== undefined
			? `${prefix} (${norm.status}): ${norm.message}`
			: norm.message;
	}
	return prefix !== undefined ? `${prefix} (${norm.status}): ${norm.body}` : `${norm.status}: ${norm.body}`;
}

export function truncateErrorText(text: string, maxChars: number): string {
	if (text.length <= maxChars) return text;
	return `${text.slice(0, maxChars)}... [truncated ${text.length - maxChars} chars]`;
}

export function safeJsonStringify(value: unknown): string {
	try {
		const serialized = JSON.stringify(value);
		return serialized === undefined ? String(value) : serialized;
	} catch {
		return String(value);
	}
}
