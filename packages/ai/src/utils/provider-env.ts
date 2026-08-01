import type { ProviderEnv } from "../types.ts";

let procEnvCache: Map<string, string> | null = null;

/**
 * Fallback for https://github.com/oven-sh/bun/issues/27802.
 * 针对 https://github.com/oven-sh/bun/issues/27802 的回退方案。
 * Bun compiled binaries can expose an empty process.env inside Linux sandboxes
 * even though /proc/self/environ contains the environment.
 * Bun 编译出的二进制文件在 Linux 沙箱中可能暴露出空的 process.env，
 * 即使 /proc/self/environ 中包含了环境变量。
 *
 * This intentionally duplicates restoreSandboxEnv() in
 * packages/coding-agent/src/bun/restore-sandbox-env.ts. The ai package can be
 * used directly, without going through that entrypoint, so provider env lookup
 * must not depend on process.env having been patched.
 * 此处有意重复实现了 packages/coding-agent/src/bun/restore-sandbox-env.ts 中的
 * restoreSandboxEnv()。ai 包可以被直接使用而不经过那个入口点，因此提供商的
 * 环境变量查找不能依赖 process.env 已被修补这一前提。
 */
function getBunSandboxEnvValue(name: string): string | undefined {
	if (typeof process === "undefined" || !process.versions?.bun || Object.keys(process.env).length > 0) {
		return undefined;
	}

	if (procEnvCache === null) {
		procEnvCache = new Map();
		try {
			const { readFileSync } = require("node:fs") as {
				readFileSync(path: string, encoding: BufferEncoding): string;
			};
			const data = readFileSync("/proc/self/environ", "utf-8");
			for (const entry of data.split("\0")) {
				const idx = entry.indexOf("=");
				if (idx > 0) {
					procEnvCache.set(entry.slice(0, idx), entry.slice(idx + 1));
				}
			}
		} catch {
			// /proc/self/environ may not exist or may not be readable.
			// /proc/self/environ 可能不存在，或者不可读。
		}
	}

	return procEnvCache.get(name);
}

/**
 * Resolve a provider env value from scoped overrides, normal process.env, then
 * the duplicated Bun sandbox fallback for direct pi-ai consumers.
 * 依次从作用域内的覆盖值、常规的 process.env，以及为直接使用 pi-ai 的调用方
 * 所重复实现的 Bun 沙箱回退方案中解析提供商的环境变量值。
 */
export function getProviderEnvValue(name: string, env?: ProviderEnv): string | undefined {
	return (
		env?.[name] ||
		(typeof process !== "undefined" ? process.env[name] : undefined) ||
		getBunSandboxEnvValue(name) ||
		undefined
	);
}
