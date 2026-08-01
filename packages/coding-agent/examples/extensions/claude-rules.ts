/**
 * Claude Rules Extension
 * Claude 规则扩展
 *
 * Scans the project's .claude/rules/ folder for rule files and lists them
 * in the system prompt. The agent can then use the read tool to load
 * specific rules when needed.
 * 扫描项目的 .claude/rules/ 目录以查找规则文件，并将它们列在系统提示词
 * （system prompt）中。随后 agent 便可以在需要时使用 read 工具加载具体的规则。
 *
 * Best practices for .claude/rules/:
 * .claude/rules/ 的最佳实践：
 * - Keep rules focused: Each file should cover one topic (e.g., testing.md, api-design.md)
 *   保持规则聚焦：每个文件只覆盖一个主题（例如 testing.md、api-design.md）
 * - Use descriptive filenames: The filename should indicate what the rules cover
 *   使用描述性的文件名：文件名应能表明该规则涵盖的内容
 * - Use conditional rules sparingly: Only add paths frontmatter when rules truly apply to specific file types
 *   谨慎使用条件规则：仅当规则确实只适用于特定文件类型时，才添加 paths 前置元数据（frontmatter）
 * - Organize with subdirectories: Group related rules (e.g., frontend/, backend/)
 *   用子目录进行组织：将相关规则分组（例如 frontend/、backend/）
 *
 * Usage:
 * 用法：
 * 1. Copy this file to ~/.pi/agent/extensions/ or your project's .pi/extensions/
 *    将本文件复制到 ~/.pi/agent/extensions/ 或项目的 .pi/extensions/ 目录下
 * 2. Create .claude/rules/ folder in your project root
 *    在项目根目录中创建 .claude/rules/ 文件夹
 * 3. Add .md files with your rules
 *    添加包含你的规则的 .md 文件
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * Recursively find all .md files in a directory
 * 递归查找目录中的所有 .md 文件
 */
function findMarkdownFiles(dir: string, basePath: string = ""): string[] {
	const results: string[] = [];

	if (!fs.existsSync(dir)) {
		return results;
	}

	const entries = fs.readdirSync(dir, { withFileTypes: true });

	for (const entry of entries) {
		const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;

		if (entry.isDirectory()) {
			results.push(...findMarkdownFiles(path.join(dir, entry.name), relativePath));
		} else if (entry.isFile() && entry.name.endsWith(".md")) {
			results.push(relativePath);
		}
	}

	return results;
}

export default function claudeRulesExtension(pi: ExtensionAPI) {
	let ruleFiles: string[] = [];
	let rulesDir: string = "";

	// Scan for rules on session start
	// 在会话开始时扫描规则
	pi.on("session_start", async (_event, ctx) => {
		rulesDir = path.join(ctx.cwd, ".claude", "rules");
		ruleFiles = findMarkdownFiles(rulesDir);

		if (ruleFiles.length > 0) {
			ctx.ui.notify(`Found ${ruleFiles.length} rule(s) in .claude/rules/`, "info");
		}
	});

	// Append available rules to system prompt
	// 将可用规则追加到系统提示词（system prompt）中
	pi.on("before_agent_start", async (event) => {
		if (ruleFiles.length === 0) {
			return;
		}

		const rulesList = ruleFiles.map((f) => `- .claude/rules/${f}`).join("\n");

		return {
			systemPrompt:
				event.systemPrompt +
				`

## Project Rules

The following project rules are available in .claude/rules/:

${rulesList}

When working on tasks related to these rules, use the read tool to load the relevant rule files for guidance.
`,
		};
	});
}
