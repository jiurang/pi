/**
 * Workaround for https://github.com/oven-sh/bun/issues/27802
 * 针对 https://github.com/oven-sh/bun/issues/27802 的临时解决方案。
 *
 * Bun compiled binaries have an empty `process.env` when running inside
 * sandbox environments (e.g. nono on Linux/macOS). On Linux we can recover
 * the environment from `/proc/self/environ`.
 * Bun 编译出的二进制文件在沙箱（sandbox）环境（例如 Linux/macOS 上的 nono）中运行时，
 * `process.env` 会是空的。在 Linux 上我们可以从 `/proc/self/environ` 中恢复环境变量。
 *
 * Keep this in sync with getBunSandboxEnvValue() in
 * packages/ai/src/utils/provider-env.ts. The ai package duplicates the lookup
 * for direct consumers that do not go through this coding-agent entrypoint.
 * 请保持本文件与 packages/ai/src/utils/provider-env.ts 中的 getBunSandboxEnvValue() 同步。
 * ai 包中重复实现了该查找逻辑，以服务那些不经由 coding-agent 入口的直接使用方。
 */

import { readFileSync } from "node:fs";

/**
 * Restore environment variables from `/proc/self/environ` when running
 * inside a sandbox where Bun's `process.env` is empty.
 * 当在沙箱环境中运行且 Bun 的 `process.env` 为空时，
 * 从 `/proc/self/environ` 恢复环境变量。
 */
export function restoreSandboxEnv(): void {
	if (!process.versions?.bun) return;

	// If process.env already has entries, nothing to fix.
	// 如果 process.env 中已有内容，则无需修复。
	if (Object.keys(process.env).length > 0) return;

	try {
		const data = readFileSync("/proc/self/environ", "utf-8");
		for (const entry of data.split("\0")) {
			const idx = entry.indexOf("=");
			if (idx > 0) {
				process.env[entry.slice(0, idx)] = entry.slice(idx + 1);
			}
		}
	} catch {
		// /proc/self/environ may not be readable; ignore.
		// /proc/self/environ 可能不可读；忽略该错误。
	}
}
