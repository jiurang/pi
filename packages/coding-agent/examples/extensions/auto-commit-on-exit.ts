/**
 * Auto-Commit on Exit Extension
 * 退出时自动提交（Auto-Commit on Exit）扩展。
 *
 * Automatically commits changes when the agent exits.
 * 在 agent 退出时自动提交改动。
 * Uses the last assistant message to generate a commit message.
 * 使用最后一条 assistant 消息来生成提交信息。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	pi.on("session_shutdown", async (_event, ctx) => {
		// Check for uncommitted changes
		// 检查是否存在未提交的改动
		const { stdout: status, code } = await pi.exec("git", ["status", "--porcelain"]);

		if (code !== 0 || status.trim().length === 0) {
			// Not a git repo or no changes
			// 不是 git 仓库，或者没有任何改动
			return;
		}

		// Find the last assistant message for commit context
		// 查找最后一条 assistant 消息，作为提交信息的上下文
		const entries = ctx.sessionManager.getEntries();
		let lastAssistantText = "";
		for (let i = entries.length - 1; i >= 0; i--) {
			const entry = entries[i];
			if (entry.type === "message" && entry.message.role === "assistant") {
				const content = entry.message.content;
				if (Array.isArray(content)) {
					lastAssistantText = content
						.filter((c): c is { type: "text"; text: string } => c.type === "text")
						.map((c) => c.text)
						.join("\n");
				}
				break;
			}
		}

		// Generate a simple commit message
		// 生成一条简单的提交信息
		const firstLine = lastAssistantText.split("\n")[0] || "Work in progress";
		const commitMessage = `[pi] ${firstLine.slice(0, 50)}${firstLine.length > 50 ? "..." : ""}`;

		// Stage and commit
		// 暂存并提交
		await pi.exec("git", ["add", "-A"]);
		const { code: commitCode } = await pi.exec("git", ["commit", "-m", commitMessage]);

		if (commitCode === 0 && ctx.hasUI) {
			ctx.ui.notify(`Auto-committed: ${commitMessage}`, "info");
		}
	});
}
