/**
 * Extensions Configuration
 * 扩展（Extensions）配置
 *
 * Extensions intercept agent events and can register custom tools.
 * 扩展可以拦截 agent 事件，并注册自定义工具。
 * They provide a unified system for extensions, custom tools, commands, and more.
 * 它们为扩展、自定义工具、命令等提供了一套统一的机制。
 *
 * By default, extension files are discovered from:
 * 默认情况下，扩展文件会从以下位置被发现：
 * - ~/.pi/agent/extensions/
 * - <cwd>/.pi/extensions/
 * - Paths specified in settings.json "extensions" array
 *   settings.json 中 "extensions" 数组所指定的路径
 *
 * An extension is a TypeScript file that exports a default function:
 * 一个扩展就是一个默认导出（default export）某个函数的 TypeScript 文件：
 *   export default function (pi: ExtensionAPI) { ... }
 */

import {
	createAgentSession,
	DefaultResourceLoader,
	getAgentDir,
	SessionManager,
} from "@earendil-works/pi-coding-agent";

// Extensions are discovered automatically from standard locations.
// 扩展会自动从标准位置被发现。
// You can also add paths via settings.json or DefaultResourceLoader options.
// 你也可以通过 settings.json 或 DefaultResourceLoader 的选项来添加路径。

const resourceLoader = new DefaultResourceLoader({
	cwd: process.cwd(),
	agentDir: getAgentDir(),
	additionalExtensionPaths: ["./my-logging-extension.ts", "./my-safety-extension.ts"],
	extensionFactories: [
		(pi) => {
			pi.on("agent_start", () => {
				console.log("[Inline Extension] Agent starting");
			});
		},
	],
});
await resourceLoader.reload();

const { session } = await createAgentSession({
	resourceLoader,
	sessionManager: SessionManager.inMemory(),
});

try {
	session.subscribe((event) => {
		if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
			process.stdout.write(event.assistantMessageEvent.delta);
		}
	});

	await session.prompt("List files in the current directory.");
	console.log();
} finally {
	session.dispose();
}

// Example extension file (./my-logging-extension.ts):
// 扩展文件示例（./my-logging-extension.ts）：
/*
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	pi.on("agent_start", async () => {
		console.log("[Extension] Agent starting");
	});

	pi.on("tool_call", async (event) => {
		console.log(\`[Extension] Tool: \${event.toolName}\`);
		// Return { block: true, reason: "..." } to block execution
		return undefined;
	});

	pi.on("agent_end", async (event) => {
		console.log(\`[Extension] Done, \${event.messages.length} messages\`);
	});

	// Register a custom tool
	pi.registerTool({
		name: "my_tool",
		label: "My Tool",
		description: "Does something useful",
		parameters: Type.Object({
			input: Type.String(),
		}),
		execute: async (_toolCallId, params, _signal, _onUpdate, _ctx) => ({
			content: [{ type: "text", text: \`Processed: \${params.input}\` }],
			details: {},
		}),
	});

	// Register a command
	pi.registerCommand("mycommand", {
		description: "Do something",
		handler: async (args, ctx) => {
			ctx.ui.notify(\`Command executed with: \${args}\`);
		},
	});
}
*/
