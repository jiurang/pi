/**
 * Git Checkpoint Extension
 * Git 检查点(checkpoint)扩展
 *
 * Creates git stash checkpoints at each turn so /fork can restore code state.
 * 在每一轮对话中创建 git stash 检查点,使 /fork 能够恢复代码状态。
 * When forking, offers to restore code to that point in history.
 * 执行 fork 时,会提示将代码恢复到历史中的对应节点。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	const checkpoints = new Map<string, string>();
	let currentEntryId: string | undefined;

	// Track the current entry ID when user messages are saved
	// 在用户消息被保存时,记录当前条目的 ID
	pi.on("tool_result", async (_event, ctx) => {
		const leaf = ctx.sessionManager.getLeafEntry();
		if (leaf) currentEntryId = leaf.id;
	});

	pi.on("turn_start", async () => {
		// Create a git stash entry before LLM makes changes
		// 在 LLM 修改代码之前创建一个 git stash 条目
		const { stdout } = await pi.exec("git", ["stash", "create"]);
		const ref = stdout.trim();
		if (ref && currentEntryId) {
			checkpoints.set(currentEntryId, ref);
		}
	});

	pi.on("session_before_fork", async (event, ctx) => {
		const ref = checkpoints.get(event.entryId);
		if (!ref) return;

		if (!ctx.hasUI) {
			// In non-interactive mode, don't restore automatically
			// 在非交互模式下,不自动恢复
			return;
		}

		const choice = await ctx.ui.select("Restore code state?", [
			"Yes, restore code to that point",
			"No, keep current code",
		]);

		if (choice?.startsWith("Yes")) {
			await pi.exec("git", ["stash", "apply", ref]);
			ctx.ui.notify("Code restored to checkpoint", "info");
		}
	});

	pi.on("agent_end", async () => {
		// Clear checkpoints after agent completes
		// agent 执行完成后清空检查点
		checkpoints.clear();
	});
}
