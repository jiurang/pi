import { vi } from "vitest";

/**
 * Enable network code paths for tests that replace external I/O with local fixtures or mocks.
 * 为那些用本地夹具（fixture）或 mock 替代外部 I/O 的测试启用联网代码路径。
 */
export function allowNetwork(): void {
	vi.stubEnv("PI_OFFLINE", undefined);
}
