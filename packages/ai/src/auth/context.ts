import type { AuthContext } from "./types.ts";

interface NodeFsModule {
	access(path: string): Promise<void>;
}

interface NodeOsModule {
	homedir(): string;
}

// Variable specifier so browser bundlers do not try to resolve node builtins.
// 使用变量形式的模块说明符（specifier），以免浏览器打包器尝试解析 Node 内置模块。
const importNodeModule = (specifier: string): Promise<unknown> => import(specifier);

function getProcessEnv(): Record<string, string | undefined> | undefined {
	const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
	return proc?.env;
}

/**
 * Default auth context: env vars from `process.env` (undefined in browsers),
 * file existence via node:fs (always false in browsers).
 * 默认的鉴权上下文（auth context）：环境变量取自 `process.env`（在浏览器中为
 * undefined），文件是否存在通过 node:fs 判断（在浏览器中恒为 false）。
 */
export function defaultProviderAuthContext(): AuthContext {
	return {
		async env(name: string): Promise<string | undefined> {
			const value = getProcessEnv()?.[name];
			return typeof value === "string" && value.trim().length > 0 ? value : undefined;
		},

		async fileExists(path: string): Promise<boolean> {
			try {
				const fs = (await importNodeModule("node:fs/promises")) as NodeFsModule;
				let resolved = path;
				if (resolved.startsWith("~")) {
					const os = (await importNodeModule("node:os")) as NodeOsModule;
					resolved = os.homedir() + resolved.slice(1);
				}
				await fs.access(resolved);
				return true;
			} catch {
				return false;
			}
		},
	};
}
