/**
 * Merge and Resolve
 * 合并与冲突解决
 *
 * Keeps the working branch up to date with its upstream tracking ref.
 * 保持工作分支与其上游跟踪引用（upstream tracking ref）同步。
 * After each agent turn, fetches and merges. Clean merges complete
 * silently. When conflicts arise, the working tree is left dirty and
 * the agent receives a follow-up message listing each conflict block
 * with file, line range, and ours/theirs sections so it can resolve them.
 * 在 agent 每一轮对话结束后执行 fetch 与 merge。若合并干净则静默完成。
 * 若出现冲突，则保留工作区的未提交改动，并向 agent 发送一条后续消息，
 * 列出每个冲突块的文件、行号范围以及 ours/theirs 区段，以便其解决冲突。
 * Also re-sends unresolved conflicts from a previous incomplete merge.
 * 同时也会重新发送上一次未完成合并中尚未解决的冲突。
 *
 * Start pi with this extension:
 * 使用该扩展启动 pi：
 *   pi -e ./examples/extensions/git-merge-and-resolve.ts
 */
import { createReadStream } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

interface ConflictBlock {
	file: string;
	startLine: number;
	separatorLine: number;
	endLine: number;
}

/** Parse conflict markers from working tree files with unmerged paths. 从工作区中处于未合并（unmerged）状态的文件里解析冲突标记。 */
async function findConflicts(pi: ExtensionAPI, cwd: string): Promise<ConflictBlock[]> {
	const { stdout, code } = await pi.exec("git", ["diff", "--name-only", "--diff-filter=U"]);
	if (code !== 0 || !stdout.trim()) return [];

	const blocks: ConflictBlock[] = [];
	for (const file of stdout.trim().split("\n")) {
		try {
			const rl = createInterface({ input: createReadStream(join(cwd, file), "utf-8") });
			let lineNo = 0;
			let blockStart: number | undefined;
			let separatorLine: number | undefined;
			for await (const line of rl) {
				lineNo++;
				if (line.startsWith("<<<<<<<")) {
					blockStart = lineNo;
					separatorLine = undefined;
				} else if (line.startsWith("=======") && blockStart !== undefined) {
					separatorLine = lineNo;
				} else if (line.startsWith(">>>>>>>") && blockStart !== undefined && separatorLine !== undefined) {
					blocks.push({ file, startLine: blockStart, separatorLine, endLine: lineNo });
					blockStart = undefined;
					separatorLine = undefined;
				}
			}
		} catch {}
	}
	return blocks;
}

function formatRange(start: number, end: number): string {
	if (start > end) return "empty";
	if (start === end) return `${start}`;
	return `${start}-${end}`;
}

function formatConflicts(ref: string, blocks: ConflictBlock[]): string {
	const lines = [`Merged ${ref} with conflicts:`, ""];
	for (const b of blocks) {
		const ours = formatRange(b.startLine + 1, b.separatorLine - 1);
		const theirs = formatRange(b.separatorLine + 1, b.endLine - 1);
		lines.push(`  ${b.file}:${b.startLine}-${b.endLine} (ours ${ours}, theirs ${theirs})`);
	}
	lines.push("", "Resolve these conflicts.");
	return lines.join("\n");
}

export default function (pi: ExtensionAPI) {
	pi.on("agent_end", async (_event, ctx) => {
		const { code: revParseCode } = await pi.exec("git", ["rev-parse", "--git-dir"]);
		if (revParseCode !== 0) return;

		let ref = "MERGE_HEAD";

		// If not already in a merge, attempt one
		// 如果当前尚未处于合并状态，则尝试发起一次合并
		const { code: mergeHeadCode } = await pi.exec("git", ["rev-parse", "MERGE_HEAD"]);
		if (mergeHeadCode !== 0) {
			// Only attempt a new merge if the working tree is clean
			// 仅在工作区干净（无未提交改动）时才尝试新的合并
			const { stdout: status } = await pi.exec("git", ["status", "--porcelain"]);
			if (status.trim()) return;

			const { stdout: upstream, code: upstreamCode } = await pi.exec("git", [
				"rev-parse",
				"--abbrev-ref",
				"--symbolic-full-name",
				"@{u}",
			]);
			if (upstreamCode !== 0) return;

			ref = upstream.trim();
			const remote = ref.split("/")[0];
			ctx.ui.notify(`git-merge-and-resolve: fetching ${remote}, merging ${ref}`, "info");

			const { code: fetchCode, stderr: fetchErr } = await pi.exec("git", ["fetch", remote]);
			if (fetchCode !== 0) {
				ctx.ui.notify(`git-merge-and-resolve: fetch failed: ${fetchErr.trim()}`, "warning");
				return;
			}

			const { code: mergeCode } = await pi.exec("git", ["merge", "--no-ff", ref]);
			if (mergeCode === 0) return;
		}

		// Either we just merged with conflicts, or we were already in an unfinished merge
		// 此时要么是刚刚合并并产生了冲突，要么是原本就处于一次未完成的合并中
		const conflicts = await findConflicts(pi, ctx.cwd);
		if (conflicts.length === 0) return;

		pi.sendUserMessage(formatConflicts(ref, conflicts), { deliverAs: "followUp" });
	});
}
