/**
 * Commands Extension
 * 命令扩展（Commands Extension）
 *
 * Demonstrates the pi.getCommands() API by providing a /commands command
 * that lists all available slash commands in the current session.
 * 通过提供一个 /commands 命令来演示 pi.getCommands() API，该命令会列出当前会话中所有可用的斜杠命令。
 *
 * Usage:
 * 用法：
 * 1. Copy this file to ~/.pi/agent/extensions/ or your project's .pi/extensions/
 *    将此文件复制到 ~/.pi/agent/extensions/ 或你项目的 .pi/extensions/ 目录下
 * 2. Use /commands to see available commands
 *    使用 /commands 查看可用命令
 * 3. Use /commands extensions to filter by source
 *    使用 /commands extensions 按来源进行筛选
 */

import type { ExtensionAPI, SlashCommandInfo } from "@earendil-works/pi-coding-agent";

export default function commandsExtension(pi: ExtensionAPI) {
	pi.registerCommand("commands", {
		description: "List available slash commands",
		getArgumentCompletions: (prefix) => {
			const sources = ["extension", "prompt", "skill"];
			const filtered = sources.filter((s) => s.startsWith(prefix));
			return filtered.length > 0 ? filtered.map((s) => ({ value: s, label: s })) : null;
		},
		handler: async (args, ctx) => {
			const commands = pi.getCommands();
			const sourceFilter = args.trim() as "extension" | "prompt" | "skill" | "";

			// Filter by source if specified
			// 若指定了来源，则按来源进行筛选
			const filtered = sourceFilter ? commands.filter((c) => c.source === sourceFilter) : commands;

			if (filtered.length === 0) {
				ctx.ui.notify(sourceFilter ? `No ${sourceFilter} commands found` : "No commands found", "info");
				return;
			}

			// Build selection items grouped by source
			// 构建按来源分组的选项列表
			const formatCommand = (cmd: SlashCommandInfo): string => {
				const desc = cmd.description ? ` - ${cmd.description}` : "";
				return `/${cmd.name}${desc}`;
			};

			const items: string[] = [];
			const sources: Array<{ key: "extension" | "prompt" | "skill"; label: string }> = [
				{ key: "extension", label: "Extensions" },
				{ key: "prompt", label: "Prompts" },
				{ key: "skill", label: "Skills" },
			];

			for (const { key, label } of sources) {
				const cmds = filtered.filter((c) => c.source === key);
				if (cmds.length > 0) {
					items.push(`--- ${label} ---`);
					items.push(...cmds.map(formatCommand));
				}
			}

			// Show in a selector (user can scroll and see all commands)
			// 在选择器中展示（用户可滚动查看所有命令）
			const selected = await ctx.ui.select("Available Commands", items);

			// If user selected a command (not a header), offer to show its path
			// 若用户选中的是一条命令（而非分组标题），则询问是否显示其路径
			if (selected && !selected.startsWith("---")) {
				const cmdName = selected.split(" - ")[0].slice(1); // Remove leading / 去掉开头的 /
				const cmd = commands.find((c) => c.name === cmdName);
				if (cmd?.sourceInfo.path) {
					const showPath = await ctx.ui.confirm(cmd.name, `View source path?\n${cmd.sourceInfo.path}`);
					if (showPath) {
						ctx.ui.notify(cmd.sourceInfo.path, "info");
					}
				}
			}
		},
	});
}
