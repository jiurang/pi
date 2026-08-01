/**
 * Inline Bash Extension - expands inline bash commands in user prompts.
 * 内联 Bash 扩展——展开用户提示词中的内联 bash 命令。
 *
 * Start pi with this extension:
 * 使用该扩展启动 pi：
 *   pi -e ./examples/extensions/inline-bash.ts
 *
 * Then type prompts with inline bash:
 * 然后输入带有内联 bash 的提示词：
 *   What's in !{pwd}?
 *   The current branch is !{git branch --show-current} and status: !{git status --short}
 *   My node version is !{node --version}
 *
 * The !{command} patterns are executed and replaced with their output before
 * the prompt is sent to the agent.
 * 在提示词发送给 agent 之前，!{command} 模式会被执行并替换为其输出结果。
 *
 * Note: Regular !command syntax (whole-line bash) is preserved and works as before.
 * 注意：常规的 !command 语法（整行 bash）保持不变，行为与之前一致。
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	const PATTERN = /!\{([^}]+)\}/g;
	const TIMEOUT_MS = 30000;

	pi.on("input", async (event, ctx) => {
		const text = event.text;

		// Don't process if it's a whole-line bash command (starts with !)
		// 如果是整行 bash 命令（以 ! 开头）则不做处理
		// This preserves the existing !command behavior
		// 这样可以保留既有的 !command 行为
		if (text.trimStart().startsWith("!") && !text.trimStart().startsWith("!{")) {
			return { action: "continue" };
		}

		// Check if there are any inline bash patterns
		// 检查是否存在内联 bash 模式
		if (!PATTERN.test(text)) {
			return { action: "continue" };
		}

		// Reset regex state after test()
		// 在 test() 之后重置正则表达式状态
		PATTERN.lastIndex = 0;

		let result = text;
		const expansions: Array<{ command: string; output: string; error?: string }> = [];

		// Find all matches first (to avoid issues with replacing while iterating)
		// 先找出所有匹配项（以避免边遍历边替换所导致的问题）
		const matches: Array<{ full: string; command: string }> = [];
		let match = PATTERN.exec(text);
		while (match) {
			matches.push({ full: match[0], command: match[1] });
			match = PATTERN.exec(text);
		}

		// Execute each command and collect results
		// 逐条执行命令并收集结果
		for (const { full, command } of matches) {
			try {
				const bashResult = await pi.exec("bash", ["-c", command], {
					timeout: TIMEOUT_MS,
				});

				const output = bashResult.stdout || bashResult.stderr || "";
				const trimmed = output.trim();

				if (bashResult.code !== 0 && bashResult.stderr) {
					expansions.push({
						command,
						output: trimmed,
						error: `exit code ${bashResult.code}`,
					});
				} else {
					expansions.push({ command, output: trimmed });
				}

				result = result.replace(full, trimmed);
			} catch (err) {
				const errorMsg = err instanceof Error ? err.message : String(err);
				expansions.push({ command, output: "", error: errorMsg });
				result = result.replace(full, `[error: ${errorMsg}]`);
			}
		}

		// Show what was expanded (if UI available)
		// 展示展开了哪些内容（如果 UI 可用）
		if (ctx.hasUI && expansions.length > 0) {
			const summary = expansions
				.map((e) => {
					const status = e.error ? ` (${e.error})` : "";
					const preview = e.output.length > 50 ? `${e.output.slice(0, 50)}...` : e.output;
					return `!{${e.command}}${status} -> "${preview}"`;
				})
				.join("\n");

			ctx.ui.notify(`Expanded ${expansions.length} inline command(s):\n${summary}`, "info");
		}

		return { action: "transform", text: result, images: event.images };
	});
}
