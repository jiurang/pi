import type { AssistantMessage } from "../types.ts";

function buildProviderErrorPattern(patterns: readonly string[]): RegExp {
	return new RegExp(patterns.join("|"), "i");
}

const NON_RETRYABLE_PROVIDER_LIMIT_ERROR_PATTERN = buildProviderErrorPattern([
	// OpenCode Go/free-tier limits returned as 429 JSON error types by OpenCode's
	// Zen API. These are subscription/account limits, not transient throttles.
	// OpenCode 的 Zen API 以 429 JSON 错误类型返回的 OpenCode Go/免费额度限制。
	// 这些属于订阅/账户层面的限制，而非临时性限流。
	"GoUsageLimitError",
	"FreeUsageLimitError",

	// OpenCode Go subscription-limit text asks users to enable available-balance
	// usage after rolling/weekly/monthly limits are reached.
	// OpenCode Go 的订阅限额提示文案：在滚动/每周/每月限额用尽后，引导用户启用可用余额进行消费。
	"Monthly usage limit reached",
	"available balance",

	// Generic quota/budget/billing exhaustion. `insufficient_quota` is OpenAI's
	// quota/billing error code; the other strings cover common gateway wording.
	// 通用的配额/预算/账单耗尽。`insufficient_quota` 是 OpenAI 的配额/计费错误码；
	// 其余字符串覆盖了各类网关常见的措辞。
	"insufficient_quota",
	"out of budget",
	"quota exceeded",
	"billing",
]);

const RETRYABLE_PROVIDER_ERROR_PATTERN = buildProviderErrorPattern([
	// Generic provider load, HTTP status, and server-side transient failures.
	// 通用的提供方过载、HTTP 状态码，以及服务端临时性故障。
	"overloaded",
	"rate.?limit",
	"too many requests",
	"429",
	"500",
	"502",
	"503",
	"504",
	"524",
	"service.?unavailable",
	"server.?error",
	"internal.?error",

	// Wrapper/provider text for transient upstream failures, including OpenRouter
	// "Provider returned error" responses (#2264).
	// 包装层/提供方针对上游临时性故障给出的文案，包括 OpenRouter 的
	// "Provider returned error" 响应（#2264）。
	"provider.?returned.?error",

	// Network, proxy, and fetch transport failures. This includes OpenAI Codex
	// raw-fetch failures such as "upstream connect", "connection refused", and
	// "reset before headers" (#733), plus OpenRouter connection drops (#3317).
	// 网络、代理与 fetch 传输层故障。其中包括 OpenAI Codex 的原生 fetch 失败，
	// 例如 "upstream connect"、"connection refused" 和 "reset before headers"（#733），
	// 以及 OpenRouter 的连接中断（#3317）。
	"network.?error",
	"connection.?error",
	"connection.?refused",
	"connection.?lost",
	"other side closed",
	"fetch failed",
	"getaddrinfo",
	"ENOTFOUND",
	"EAI_AGAIN",
	"upstream.?connect",
	"reset before headers",
	"socket hang up",
	"socket connection was closed",
	"timed? out",
	"timeout",
	"terminated",

	// WebSocket transports can report close/error text instead of HTTP/fetch text.
	// WebSocket 传输层可能上报关闭/错误文案，而不是 HTTP/fetch 类文案。
	"websocket.?closed",
	"websocket.?error",

	// Premature stream endings from SDKs and transports. Anthropic can throw
	// "stream ended without ..." and "Anthropic stream ended before message_stop"
	// (#4433); Bedrock/Smithy can throw an HTTP/2 no-response error (#3594).
	// 来自 SDK 与传输层的流提前结束。Anthropic 可能抛出 "stream ended without ..." 和
	// "Anthropic stream ended before message_stop"（#4433）；Bedrock/Smithy 可能抛出
	// HTTP/2 无响应错误（#3594）。
	"ended without",
	"stream ended before message_stop",
	"stream ended before a terminal response event",
	"http2 request did not get a response",

	// Provider-requested retry delay cap failures should flow through the outer
	// retry policy so callers can surface/abort the backoff (#1123).
	// 提供方要求的重试延迟超过上限而导致的失败，应交由外层重试策略处理，
	// 以便调用方能够展示/中止退避等待（#1123）。
	"retry delay",

	// Explicit retry guidance emitted mid-stream by OpenAI Responses and Bedrock
	// stream exceptions (#6019).
	// OpenAI Responses 与 Bedrock 流式异常在流传输过程中给出的显式重试提示（#6019）。
	"you can retry your request",
	"try your request again",
	"please retry your request",

	// gRPC based providers (e.g. NVIDIA NIM)
	// 基于 gRPC 的提供方（例如 NVIDIA NIM）
	"ResourceExhausted",
]);

/**
 * Retry policy: bounded attempts with exponential backoff (`baseDelayMs * 2^(attempt-1)`).
 * 重试策略：次数受限的重试尝试，配合指数退避（`baseDelayMs * 2^(attempt-1)`）。
 * Matches `settings.retry` (`enabled`, `maxRetries`, `baseDelayMs`) in coding-agent; kept
 * here so the classifier and the policy-driven retry loop live together and stay reusable
 * by the SDK and other callers.
 * 与 coding-agent 中的 `settings.retry`（`enabled`、`maxRetries`、`baseDelayMs`）保持一致；
 * 放在这里是为了让错误分类器与策略驱动的重试循环位于同一处，并可被 SDK 及其他调用方复用。
 */
export interface RetryPolicy {
	enabled: boolean;
	/**
	 * Max retry attempts (0 = no retries). The initial call never counts as a retry.
	 * 最大重试次数（0 表示不重试）。首次调用永远不计入重试次数。
	 */
	maxRetries: number;
	/**
	 * Base delay in ms. Per-attempt delay is `baseDelayMs * 2^(attempt-1)` before jitter.
	 * 基础延迟（毫秒）。在加入抖动（jitter）之前，每次尝试的延迟为 `baseDelayMs * 2^(attempt-1)`。
	 */
	baseDelayMs: number;
}

/**
 * Optional callbacks emitted by {@link retryAssistantCall} around each retry.
 * 由 {@link retryAssistantCall} 在每次重试前后触发的可选回调。
 */
export interface RetryCallbacks {
	/**
	 * Emitted before the backoff sleep of each retry attempt (1-indexed).
	 * 在每次重试尝试的退避等待之前触发（序号从 1 开始）。
	 */
	onRetryScheduled?: (
		attempt: number,
		maxAttempts: number,
		delayMs: number,
		errorMessage: string,
	) => void | Promise<void>;
	/**
	 * Emitted after the backoff sleep, immediately before the retried call starts.
	 * 在退避等待结束之后、重试调用即将开始之前触发。
	 */
	onRetryAttemptStart?: () => void | Promise<void>;
	/**
	 * Emitted once when the loop ends: success if a later call completed normally.
	 * 在循环结束时触发一次：若后续某次调用正常完成，则表示成功。
	 */
	onRetryFinished?: (success: boolean, attempt: number, finalError?: string) => void | Promise<void>;
}

class RetrySleepAbortError extends Error {
	constructor() {
		super("Aborted");
	}
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(new RetrySleepAbortError());
			return;
		}
		const timeout = setTimeout(resolve, ms);
		signal?.addEventListener(
			"abort",
			() => {
				clearTimeout(timeout);
				reject(new RetrySleepAbortError());
			},
			{ once: true },
		);
	});
}

/**
 * Run a single assistant-producing call with bounded retry on transient errors.
 * 执行一次产出助手（assistant）消息的调用，并在遇到临时性错误时进行次数受限的重试。
 *
 * Behavior:
 * 行为说明：
 * - A successful response is returned immediately. Aborts are terminal and never
 *   retried, but reported as unsuccessful if they happen after a retry was scheduled.
 *   Aborts during the backoff sleep are normalized to an aborted `AssistantMessage`
 *   too, so callers do not need to care when cancellation happened.
 *   成功的响应会立即返回。中止（abort）是终态且永不重试，但若发生在已安排重试之后，
 *   则会被报告为未成功。退避等待期间发生的中止同样会被归一化为一条已中止的
 *   `AssistantMessage`，因此调用方无需关心取消究竟发生在哪个时刻。
 * - A non-retryable error (per {@link isRetryableAssistantError}, including quota/
 *   billing exhaustion) is returned immediately so deterministic errors fail fast.
 *   不可重试的错误（依据 {@link isRetryableAssistantError} 判定，包括配额/账单耗尽）
 *   会立即返回，从而让确定性错误快速失败。
 * - Otherwise retries up to `maxRetries` times with exponential backoff, emitting
 *   `onRetryScheduled` before each sleep, `onRetryAttemptStart` after each sleep before
 *   the retried call starts, and `onRetryFinished` once at the end (whether the loop
 *   ends in success, exhausted retries, or an aborted backoff).
 *   否则将以指数退避方式最多重试 `maxRetries` 次，并在每次等待前触发 `onRetryScheduled`，
 *   在每次等待之后、重试调用开始之前触发 `onRetryAttemptStart`，并在最后触发一次
 *   `onRetryFinished`（无论循环是以成功、重试次数耗尽还是退避被中止而结束）。
 *
 * When `policy` is undefined or disabled, the first response is returned unchanged
 * (equivalent to calling `produce()` directly).
 * 当 `policy` 为 undefined 或被禁用时，第一次响应会原样返回（等价于直接调用 `produce()`）。
 */
export async function retryAssistantCall(
	produce: () => Promise<AssistantMessage>,
	policy: RetryPolicy | undefined,
	signal: AbortSignal | undefined,
	callbacks?: RetryCallbacks,
): Promise<AssistantMessage> {
	const maxAttempts = policy?.enabled ? policy.maxRetries : 0;

	let attempt = 0;
	let lastRetry: { attempt: number; errorMessage: string } | undefined;
	for (;;) {
		const response = await produce();

		// Abort: terminal but not successful. Never retry an aborted message.
		// 中止：属于终态但不算成功。永远不要重试一条已中止的消息。
		if (response.stopReason === "aborted") {
			if (lastRetry) await callbacks?.onRetryFinished?.(false, lastRetry.attempt);
			return response;
		}

		// Success: non-error, non-abort responses return as-is.
		// 成功：非错误、非中止的响应原样返回。
		if (response.stopReason !== "error") {
			if (lastRetry) await callbacks?.onRetryFinished?.(true, lastRetry.attempt);
			return response;
		}

		// Non-retryable, or budget exhausted: return the final error message.
		// 不可重试，或重试预算已耗尽：返回最终的错误消息。
		if (attempt >= maxAttempts || !isRetryableAssistantError(response)) {
			if (lastRetry) await callbacks?.onRetryFinished?.(false, lastRetry.attempt, response.errorMessage);
			return response;
		}

		attempt++;
		lastRetry = { attempt, errorMessage: response.errorMessage || "Unknown error" };
		const delayMs = policy!.baseDelayMs * 2 ** (attempt - 1);
		await callbacks?.onRetryScheduled?.(attempt, maxAttempts, delayMs, lastRetry.errorMessage);

		// Normalize aborts during retry backoff to the same AssistantMessage shape as
		// provider stream aborts, so callers do not need to care when cancellation happened.
		// 将重试退避期间发生的中止归一化为与提供方流式中止相同的 AssistantMessage 结构，
		// 这样调用方就无需关心取消究竟发生在哪个时刻。
		try {
			await sleep(delayMs, signal);
		} catch (error) {
			await callbacks?.onRetryFinished?.(false, attempt, lastRetry.errorMessage);
			if (error instanceof RetrySleepAbortError) {
				return { ...response, stopReason: "aborted", errorMessage: undefined };
			}
			throw error;
		}
		await callbacks?.onRetryAttemptStart?.();
	}
}

/**
 * Classifies whether a failed assistant message looks like a transient provider
 * or transport error, so callers can decide if the last assistant turn should be
 * restarted.
 * 判断一条失败的助手消息是否属于临时性的提供方或传输层错误，以便调用方决定是否
 * 重新执行上一轮助手回合（turn）。
 *
 * This does not implement retry policy. Callers should first handle context
 * overflow separately, then apply their own retry budget, backoff, and reporting
 * before restarting the assistant turn.
 * 本函数并不实现重试策略。调用方应先单独处理上下文溢出，然后在重启助手回合之前，
 * 应用自己的重试预算、退避策略与上报逻辑。
 */
export function isRetryableAssistantError(message: AssistantMessage): boolean {
	if (message.stopReason !== "error" || !message.errorMessage) return false;
	const errorMessage = message.errorMessage;
	if (NON_RETRYABLE_PROVIDER_LIMIT_ERROR_PATTERN.test(errorMessage)) return false;
	return RETRYABLE_PROVIDER_ERROR_PATTERN.test(errorMessage);
}
