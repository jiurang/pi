/**
 * Prompt Customizer Extension
 * 提示词定制扩展
 *
 * Demonstrates using systemPromptOptions to make informed, context-aware
 * modifications to the system prompt without re-discovering resources.
 * 演示如何利用 systemPromptOptions 对系统提示词（system prompt）做出有依据、
 * 感知上下文的修改，而无需重新发现（re-discover）各类资源。
 *
 * This extension adds tool-specific guidance based on what tools and skills
 * are currently active, respecting whatever the user has configured.
 * 本扩展会根据当前激活的工具和技能（skills）添加针对性的工具使用指引，
 * 并尊重用户已有的各项配置。
 *
 * Usage:
 * 用法：
 * 1. Copy this file to ~/.pi/agent/extensions/ or your project's .pi/extensions/
 *    将本文件复制到 ~/.pi/agent/extensions/ 或项目的 .pi/extensions/ 目录下
 * 2. Use the extension — it automatically adapts to your active tools and skills
 *    直接使用该扩展——它会自动适配你当前激活的工具与技能
 */

import type { BuildSystemPromptOptions, ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * Adds tool-specific guidance that adapts to the active tool set.
 * 添加可根据当前激活工具集自适应的工具专属指引。
 * Instead of appending one-size-fits-all instructions, this reads what's
 * actually loaded and tailors the guidance accordingly.
 * 它不会追加千篇一律的通用指令，而是读取实际已加载的内容，并据此定制相应的指引。
 */
function addToolGuidance(options: BuildSystemPromptOptions, basePrompt: string): string {
	const hasTool = (name: string) => options.selectedTools?.includes(name) ?? false;

	const parts: string[] = [];

	if (hasTool("read")) {
		parts.push(
			"• Use the `read` tool for file contents (supports text and images).",
			"  - For large files, use `offset` and `limit` to read in chunks.",
		);
	}

	if (hasTool("bash")) {
		parts.push("• Execute commands with the `bash` tool. Use it for file operations like `ls`, `find`, `grep`.");
	}

	if (hasTool("edit")) {
		parts.push(
			"• Use the `edit` tool for precise text replacements in files. Match exact content including whitespace.",
		);
	}

	if (hasTool("write")) {
		parts.push("• Use the `write` tool to create new files or overwrite existing ones completely.");
	}

	if (options.skills && options.skills.length > 0) {
		const skillNames = options.skills.map((s) => s.name).join(", ");
		parts.push(`\nAvailable skills: ${skillNames}`, "Use skill documentation for best practices on specific tools.");
	}

	if (parts.length === 0) {
		return basePrompt;
	}

	return `${basePrompt}

## Tool Guidance

${parts.join("\n")}
`;
}

/**
 * Merges extension instructions with user-provided append prompts.
 * 将扩展提供的指令与用户提供的追加提示词合并。
 * This respects whatever the user configured via --append-system-prompt
 * flags or files, rather than duplicating that work.
 * 该做法会尊重用户通过 --append-system-prompt 命令行参数或文件所做的配置，
 * 而不是重复完成这部分工作。
 */
function mergeWithUserAppend(options: BuildSystemPromptOptions): string {
	const userAppend = options.appendSystemPrompt;
	const extensionSpecific = `
## Extension-Added Context

This prompt includes tool guidance and skill information loaded dynamically.
If you have additional requirements, configure them via --append-system-prompt or project context files.
`;

	if (userAppend) {
		return `${userAppend}\n\n${extensionSpecific}`;
	}

	return extensionSpecific;
}

export default function promptCustomizer(pi: ExtensionAPI) {
	pi.on("before_agent_start", async (event) => {
		const { systemPrompt, systemPromptOptions } = event;

		const customPrompt = addToolGuidance(systemPromptOptions, systemPrompt);
		const appendSection = mergeWithUserAppend(systemPromptOptions);

		return {
			systemPrompt: `${customPrompt}${appendSection}`,
		};
	});
}
