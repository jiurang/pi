import type { StreamFn } from "./types.ts";

let defaultStreamFn: StreamFn | undefined;

/**
 * Configure the fallback used by Agent and low-level loops when callers omit streamFn.
 * 配置在调用方未提供 streamFn 时，Agent 及底层循环所使用的兜底实现。
 *
 * Hosts that provide a default model runtime can install its stream function here
 * without making pi-agent-core depend on a provider catalog or compatibility layer.
 * 提供了默认模型运行时的宿主可以在此安装其流式函数，从而无需让 pi-agent-core 依赖
 * 提供方目录（provider catalog）或兼容层。
 */
export function setDefaultStreamFn(streamFn: StreamFn | undefined): void {
	defaultStreamFn = streamFn;
}

export function getDefaultStreamFn(): StreamFn {
	if (!defaultStreamFn) {
		throw new Error("No default stream function configured. Pass streamFn explicitly or call setDefaultStreamFn().");
	}
	return defaultStreamFn;
}
