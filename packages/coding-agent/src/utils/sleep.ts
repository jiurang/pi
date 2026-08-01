/**
 * Sleep helper that respects abort signal.
 * 支持中止信号（abort signal）的延时辅助函数。
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(new Error("Aborted"));
			return;
		}

		const timeout = setTimeout(resolve, ms);

		signal?.addEventListener("abort", () => {
			clearTimeout(timeout);
			reject(new Error("Aborted"));
		});
	});
}
