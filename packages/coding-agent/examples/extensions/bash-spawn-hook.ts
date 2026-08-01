/**
 * Bash Spawn Hook Example
 * Bash 进程创建钩子(spawn hook)示例
 *
 * Adjusts command, cwd, and env before execution.
 * 在执行前调整命令、工作目录(cwd)和环境变量(env)。
 *
 * Usage:
 * 用法:
 *   pi -e ./bash-spawn-hook.ts
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createBashTool } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	const cwd = process.cwd();

	const bashTool = createBashTool(cwd, {
		spawnHook: ({ command, cwd, env }) => ({
			command: `source ~/.profile\n${command}`,
			cwd,
			env: { ...env, PI_SPAWN_HOOK: "1" },
		}),
	});

	pi.registerTool({
		...bashTool,
		execute: async (id, params, signal, onUpdate, _ctx) => {
			return bashTool.execute(id, params, signal, onUpdate);
		},
	});
}
