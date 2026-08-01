/**
 * Reload Runtime Extension
 * 运行时(runtime)重载扩展
 *
 * Demonstrates ctx.reload() from ExtensionCommandContext and an LLM-callable
 * tool that queues a follow-up command to trigger reload.
 * 演示 ExtensionCommandContext 提供的 ctx.reload(),以及一个可由 LLM 调用的工具,
 * 该工具会排入一条后续命令来触发重载。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
	// Command entrypoint for reload.
	// 重载功能的命令入口。
	// Treat reload as terminal for this handler.
	// 对该处理器而言,将 reload 视为终止性操作。
	pi.registerCommand("reload-runtime", {
		description: "Reload extensions, skills, prompts, themes, and context files",
		handler: async (_args, ctx) => {
			await ctx.reload();
			return;
		},
	});

	// LLM-callable tool. Tools get ExtensionContext, so they cannot call ctx.reload() directly.
	// 可由 LLM 调用的工具。工具拿到的是 ExtensionContext,因此无法直接调用 ctx.reload()。
	// Instead, queue a follow-up user command that executes the command above.
	// 替代做法是排入一条后续用户命令,由它去执行上面注册的命令。
	pi.registerTool({
		name: "reload_runtime",
		label: "Reload Runtime",
		description: "Reload extensions, skills, prompts, themes, and context files",
		parameters: Type.Object({}),
		async execute() {
			pi.sendUserMessage("/reload-runtime", { deliverAs: "followUp" });
			return {
				content: [{ type: "text", text: "Queued /reload-runtime as a follow-up command." }],
				details: {},
			};
		},
	});
}
