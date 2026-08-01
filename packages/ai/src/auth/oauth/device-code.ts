const CANCEL_MESSAGE = "Login cancelled";
const TIMEOUT_MESSAGE = "Device flow timed out";
const SLOW_DOWN_TIMEOUT_MESSAGE =
	"Device flow timed out after one or more slow_down responses. This is often caused by clock drift in WSL or VM environments. Please sync or restart the VM clock and try again.";
const MINIMUM_INTERVAL_MS = 1000;
// RFC 8628 section 3.2: if the authorization server omits `interval`, the client must use 5 seconds.
// RFC 8628 第 3.2 节：若授权服务器未返回 `interval`，客户端必须使用 5 秒。
const DEFAULT_POLL_INTERVAL_SECONDS = 5;
// RFC 8628 section 3.5: `slow_down` means the polling interval must increase by 5 seconds.
// RFC 8628 第 3.5 节：`slow_down` 表示轮询间隔必须增加 5 秒。
const SLOW_DOWN_INTERVAL_INCREMENT_MS = 5000;

type OAuthDeviceCodeIncompletePollResult =
	| { status: "pending" }
	| { status: "slow_down"; intervalSeconds?: number }
	| { status: "failed"; message: string };

export type OAuthDeviceCodePollResult<T> = OAuthDeviceCodeIncompletePollResult | { status: "complete"; value: T };

export type OAuthDeviceCodePollOptions<T> = {
	intervalSeconds?: number;
	expiresInSeconds?: number;
	waitBeforeFirstPoll?: boolean;
	poll: () => Promise<OAuthDeviceCodePollResult<T>>;
	signal?: AbortSignal;
};

function abortableSleep(ms: number, signal: AbortSignal | undefined, cancelMessage: string): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(new Error(cancelMessage));
			return;
		}

		const onAbort = () => {
			clearTimeout(timeout);
			reject(new Error(cancelMessage));
		};
		const timeout = setTimeout(() => {
			signal?.removeEventListener("abort", onAbort);
			resolve();
		}, ms);

		signal?.addEventListener("abort", onAbort, { once: true });
	});
}

export async function pollOAuthDeviceCodeFlow<T>(options: OAuthDeviceCodePollOptions<T>): Promise<T> {
	const deadline =
		typeof options.expiresInSeconds === "number"
			? Date.now() + options.expiresInSeconds * 1000
			: Number.POSITIVE_INFINITY;
	let intervalMs = Math.max(
		MINIMUM_INTERVAL_MS,
		Math.floor((options.intervalSeconds ?? DEFAULT_POLL_INTERVAL_SECONDS) * 1000),
	);

	let slowDownResponses = 0;
	if (options.waitBeforeFirstPoll) {
		const remainingMs = deadline - Date.now();
		if (remainingMs > 0) {
			await abortableSleep(Math.min(intervalMs, remainingMs), options.signal, CANCEL_MESSAGE);
		}
	}

	while (Date.now() < deadline) {
		if (options.signal?.aborted) {
			throw new Error(CANCEL_MESSAGE);
		}

		const result = await options.poll();
		if (result.status === "complete") {
			return result.value;
		}
		if (result.status === "failed") {
			throw new Error(result.message);
		}
		if (result.status === "slow_down") {
			slowDownResponses += 1;
			// Use the server-provided interval when given (GitHub reports the new required minimum
			// 当服务器提供了 interval 时优先采用（GitHub 会在 `interval` 中给出新的最小要求值）；
			// in `interval`); trusting only a client-tracked value risks polling early forever under
			// 若仅信任客户端自行维护的值，在 WSL/虚拟机时钟漂移的情况下可能导致永远提前轮询。
			// WSL/VM clock drift. Otherwise apply RFC 8628 section 3.5: increase by 5 seconds.
			// 否则按 RFC 8628 第 3.5 节处理：间隔增加 5 秒。
			intervalMs =
				typeof result.intervalSeconds === "number" &&
				Number.isFinite(result.intervalSeconds) &&
				result.intervalSeconds > 0
					? Math.max(MINIMUM_INTERVAL_MS, Math.floor(result.intervalSeconds * 1000))
					: Math.max(MINIMUM_INTERVAL_MS, intervalMs + SLOW_DOWN_INTERVAL_INCREMENT_MS);
		}

		const remainingMs = deadline - Date.now();
		if (remainingMs <= 0) {
			break;
		}

		await abortableSleep(Math.min(intervalMs, remainingMs), options.signal, CANCEL_MESSAGE);
	}

	throw new Error(slowDownResponses > 0 ? SLOW_DOWN_TIMEOUT_MESSAGE : TIMEOUT_MESSAGE);
}
