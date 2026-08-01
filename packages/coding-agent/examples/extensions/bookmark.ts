/**
 * Entry bookmarking example.
 * 条目书签示例。
 *
 * Shows setLabel to mark entries with labels for easy navigation in /tree.
 * 演示如何使用 setLabel 为条目打标签,便于在 /tree 中导航。
 * Labels appear in the tree view and help you find important points.
 * 标签会显示在树状视图中,帮助你快速定位重要节点。
 *
 * Usage: /bookmark [label] - bookmark the last assistant message
 * 用法: /bookmark [label] —— 为最后一条助手消息添加书签
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	pi.registerCommand("bookmark", {
		description: "Bookmark last message (usage: /bookmark [label])",
		handler: async (args, ctx) => {
			const label = args.trim() || `bookmark-${Date.now()}`;

			// Find the last assistant message entry
			// 查找最后一条助手消息条目
			const entries = ctx.sessionManager.getEntries();
			for (let i = entries.length - 1; i >= 0; i--) {
				const entry = entries[i];
				if (entry.type === "message" && entry.message.role === "assistant") {
					pi.setLabel(entry.id, label);
					ctx.ui.notify(`Bookmarked as: ${label}`, "info");
					return;
				}
			}

			ctx.ui.notify("No assistant message to bookmark", "warning");
		},
	});

	// Remove bookmark
	// 移除书签
	pi.registerCommand("unbookmark", {
		description: "Remove bookmark from last labeled entry",
		handler: async (_args, ctx) => {
			const entries = ctx.sessionManager.getEntries();
			for (let i = entries.length - 1; i >= 0; i--) {
				const entry = entries[i];
				const label = ctx.sessionManager.getLabel(entry.id);
				if (label) {
					pi.setLabel(entry.id, undefined);
					ctx.ui.notify(`Removed bookmark: ${label}`, "info");
					return;
				}
			}
			ctx.ui.notify("No bookmarked entry found", "warning");
		},
	});
}
