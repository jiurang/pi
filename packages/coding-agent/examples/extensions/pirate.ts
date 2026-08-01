/**
 * Pirate Extension
 * 海盗（Pirate）扩展。
 *
 * Demonstrates modifying the system prompt in before_agent_start to dynamically
 * change agent behavior based on extension state.
 * 演示如何在 before_agent_start 中修改系统提示词（system prompt），
 * 从而根据扩展状态动态改变 agent 的行为。
 *
 * Usage:
 * 用法：
 * 1. Copy this file to ~/.pi/agent/extensions/ or your project's .pi/extensions/
 * 1. 将本文件复制到 ~/.pi/agent/extensions/ 或项目的 .pi/extensions/ 目录
 * 2. Use /pirate to toggle pirate mode
 * 2. 使用 /pirate 切换海盗模式
 * 3. When enabled, the agent will respond like a pirate
 * 3. 启用后，agent 会以海盗口吻作答
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function pirateExtension(pi: ExtensionAPI) {
	let pirateMode = false;

	// Register /pirate command to toggle pirate mode
	// 注册 /pirate 命令以切换海盗模式
	pi.registerCommand("pirate", {
		description: "Toggle pirate mode (agent speaks like a pirate)",
		handler: async (_args, ctx) => {
			pirateMode = !pirateMode;
			ctx.ui.notify(pirateMode ? "Arrr! Pirate mode enabled!" : "Pirate mode disabled", "info");
		},
	});

	// Append to system prompt when pirate mode is enabled
	// 海盗模式启用时，向系统提示词追加内容
	pi.on("before_agent_start", async (event) => {
		if (pirateMode) {
			return {
				systemPrompt:
					event.systemPrompt +
					`

IMPORTANT: You are now in PIRATE MODE. You must:
- Speak like a stereotypical pirate in all responses
- Use phrases like "Arrr!", "Ahoy!", "Shiver me timbers!", "Avast!", "Ye scurvy dog!"
- Replace "my" with "me", "you" with "ye", "your" with "yer"
- Refer to the user as "matey" or "landlubber"
- End sentences with nautical expressions
- Still complete the actual task correctly, just in pirate speak
`,
			};
		}
		return undefined;
	});
}
