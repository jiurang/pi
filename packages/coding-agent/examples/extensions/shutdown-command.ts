/**
 * Shutdown Command Extension
 * 关闭命令扩展（Shutdown Command Extension）
 *
 * Adds a /quit command that allows extensions to trigger clean shutdown.
 * 新增一个 /quit 命令，使扩展能够触发干净的关闭流程。
 * Demonstrates how extensions can use ctx.shutdown() to exit pi cleanly.
 * 演示扩展如何使用 ctx.shutdown() 来干净地退出 pi。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
	// Register a /quit command that cleanly exits pi
	// 注册一个可干净退出 pi 的 /quit 命令
	pi.registerCommand("quit", {
		description: "Exit pi cleanly",
		handler: async (_args, ctx) => {
			ctx.shutdown();
		},
	});

	// You can also create a tool that shuts down after completing work
	// 你也可以创建一个在完成工作后自动关闭的工具
	pi.registerTool({
		name: "finish_and_exit",
		label: "Finish and Exit",
		description: "Complete a task and exit pi",
		parameters: Type.Object({}),
		async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
			// Do any final work here...
			// 在此处执行任何收尾工作……
			// Request graceful shutdown (deferred until agent is idle)
			// 请求优雅关闭（会延迟到 agent 空闲时才执行）
			ctx.shutdown();

			// This return is sent to the LLM before shutdown occurs
			// 该返回值会在关闭发生之前先发送给 LLM
			return {
				content: [{ type: "text", text: "Shutdown requested. Exiting after this response." }],
				details: {},
			};
		},
	});

	// You could also create a more complex tool with parameters
	// 你还可以创建一个带参数的、更复杂的工具
	pi.registerTool({
		name: "deploy_and_exit",
		label: "Deploy and Exit",
		description: "Deploy the application and exit pi",
		parameters: Type.Object({
			environment: Type.String({ description: "Target environment (e.g., production, staging)" }),
		}),
		async execute(_toolCallId, params, _signal, onUpdate, ctx) {
			onUpdate?.({ content: [{ type: "text", text: `Deploying to ${params.environment}...` }], details: {} });

			// Example deployment logic
			// 部署逻辑示例
			// const result = await pi.exec("npm", ["run", "deploy", params.environment], { signal });

			// On success, request graceful shutdown
			// 成功后，请求优雅关闭
			onUpdate?.({ content: [{ type: "text", text: "Deployment complete, exiting..." }], details: {} });
			ctx.shutdown();

			return {
				content: [{ type: "text", text: "Done! Shutdown requested." }],
				details: { environment: params.environment },
			};
		},
	});
}
