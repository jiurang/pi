/**
 * Minimal SDK Usage
 * SDK 最简用法
 *
 * Uses all defaults: discovers skills, extensions, tools, context files
 * from cwd and ~/.pi/agent.
 * 全部采用默认配置：从 cwd 与 ~/.pi/agent 中发现技能(skills)、扩展(extensions)、
 * 工具(tools)以及上下文文件(context files)。
 * Model chosen from settings or first available.
 * 模型则取自设置项，或选用第一个可用的模型。
 */

import { createAgentSession } from "@earendil-works/pi-coding-agent";

const { session } = await createAgentSession();

try {
	session.subscribe((event) => {
		if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
			process.stdout.write(event.assistantMessageEvent.delta);
		}
	});

	await session.prompt("What files are in the current directory?");
	session.state.messages.forEach((msg) => {
		console.log(msg);
	});
	console.log();
} finally {
	session.dispose();
}
