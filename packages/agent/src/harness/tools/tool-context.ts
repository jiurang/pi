import type { ExecutionEnv } from "../types.ts";

/**
 * Filesystem and shell context required by the built-in execution tools.
 * 内置执行类工具所需的文件系统与 shell 上下文。
 */
export interface ExecutionToolContext {
	env: ExecutionEnv;
}
