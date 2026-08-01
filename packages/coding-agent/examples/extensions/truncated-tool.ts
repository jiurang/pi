/**
 * Truncated Tool Example - Demonstrates proper output truncation for custom tools
 * 输出截断工具示例 —— 演示如何为自定义工具正确地截断输出
 *
 * Custom tools MUST truncate their output to avoid overwhelming the LLM context.
 * 自定义工具必须截断其输出,以免撑爆 LLM 的上下文。
 * The built-in limit is 50KB (~10k tokens) and 2000 lines, whichever is hit first.
 * 内置的限制是 50KB(约 1 万个 token)和 2000 行,以先达到者为准。
 *
 * This example shows how to:
 * 本示例展示了如何:
 * 1. Use the built-in truncation utilities
 *    使用内置的截断工具函数
 * 2. Write full output to a temp file when truncated
 *    在发生截断时将完整输出写入临时文件
 * 3. Inform the LLM where to find the complete output
 *    告知 LLM 到哪里可以找到完整输出
 * 4. Custom rendering of tool calls and results
 *    自定义工具调用与结果的渲染方式
 *
 * The `rg` tool here wraps ripgrep with proper truncation. Compare this to the
 * built-in `grep` tool in src/core/tools/grep.ts for a more complete implementation.
 * 这里的 `rg` 工具封装了 ripgrep 并做了恰当的截断处理。可以对照 src/core/tools/grep.ts
 * 中内置的 `grep` 工具,那是一个更完整的实现。
 */

import { mkdtemp, writeFile } from "node:fs/promises";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	DEFAULT_MAX_BYTES,
	DEFAULT_MAX_LINES,
	formatSize,
	type TruncationResult,
	truncateHead,
	withFileMutationQueue,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { execSync } from "child_process";
import { tmpdir } from "os";
import { join } from "path";
import { Type } from "typebox";

const RgParams = Type.Object({
	pattern: Type.String({ description: "Search pattern (regex)" }),
	path: Type.Optional(Type.String({ description: "Directory to search (default: current directory)" })),
	glob: Type.Optional(Type.String({ description: "File glob pattern, e.g. '*.ts'" })),
});

interface RgDetails {
	pattern: string;
	path?: string;
	glob?: string;
	matchCount: number;
	truncation?: TruncationResult;
	fullOutputPath?: string;
}

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "rg",
		label: "ripgrep",
		// Document the truncation limits in the tool description so the LLM knows
		// 在工具描述中说明截断限制,以便 LLM 知晓
		description: `Search file contents using ripgrep. Output is truncated to ${DEFAULT_MAX_LINES} lines or ${formatSize(DEFAULT_MAX_BYTES)} (whichever is hit first). If truncated, full output is saved to a temp file.`,
		parameters: RgParams,

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const { pattern, path: searchPath, glob } = params;

			// Build the ripgrep command
			// 构建 ripgrep 命令
			const args = ["rg", "--line-number", "--color=never"];
			if (glob) args.push("--glob", glob);
			args.push(pattern);
			args.push(searchPath || ".");

			let output: string;
			try {
				output = execSync(args.join(" "), {
					cwd: ctx.cwd,
					encoding: "utf-8",
					// 100MB buffer to capture full output
					// 使用 100MB 的缓冲区以捕获完整输出
					maxBuffer: 100 * 1024 * 1024,
				});
			} catch (err: any) {
				// ripgrep exits with 1 when no matches found
				// 未找到匹配项时,ripgrep 会以退出码 1 结束
				if (err.status === 1) {
					return {
						content: [{ type: "text", text: "No matches found" }],
						details: { pattern, path: searchPath, glob, matchCount: 0 } as RgDetails,
					};
				}
				throw new Error(`ripgrep failed: ${err.message}`);
			}

			if (!output.trim()) {
				return {
					content: [{ type: "text", text: "No matches found" }],
					details: { pattern, path: searchPath, glob, matchCount: 0 } as RgDetails,
				};
			}

			// Apply truncation using built-in utilities
			// 使用内置工具函数执行截断
			// truncateHead keeps the first N lines/bytes (good for search results)
			// truncateHead 保留开头的 N 行/字节(适用于搜索结果)
			// truncateTail keeps the last N lines/bytes (good for logs/command output)
			// truncateTail 保留末尾的 N 行/字节(适用于日志/命令输出)
			const truncation = truncateHead(output, {
				maxLines: DEFAULT_MAX_LINES,
				maxBytes: DEFAULT_MAX_BYTES,
			});

			// Count matches (each non-empty line with a match)
			// 统计匹配数量(每一个包含匹配的非空行算一条)
			const matchCount = output.split("\n").filter((line) => line.trim()).length;

			const details: RgDetails = {
				pattern,
				path: searchPath,
				glob,
				matchCount,
			};

			let resultText = truncation.content;

			if (truncation.truncated) {
				// Save full output to a temp file so LLM can access it if needed
				// 将完整输出保存到临时文件,以便 LLM 在需要时访问
				const tempDir = await mkdtemp(join(tmpdir(), "pi-rg-"));
				const tempFile = join(tempDir, "output.txt");
				await withFileMutationQueue(tempFile, async () => {
					await writeFile(tempFile, output, "utf8");
				});

				details.truncation = truncation;
				details.fullOutputPath = tempFile;

				// Add truncation notice - this helps the LLM understand the output is incomplete
				// 添加截断提示 —— 这有助于让 LLM 明白输出是不完整的
				const truncatedLines = truncation.totalLines - truncation.outputLines;
				const truncatedBytes = truncation.totalBytes - truncation.outputBytes;

				resultText += `\n\n[Output truncated: showing ${truncation.outputLines} of ${truncation.totalLines} lines`;
				resultText += ` (${formatSize(truncation.outputBytes)} of ${formatSize(truncation.totalBytes)}).`;
				resultText += ` ${truncatedLines} lines (${formatSize(truncatedBytes)}) omitted.`;
				resultText += ` Full output saved to: ${tempFile}]`;
			}

			return {
				content: [{ type: "text", text: resultText }],
				details,
			};
		},

		// Custom rendering of the tool call (shown before/during execution)
		// 自定义工具调用的渲染(在执行前/执行中展示)
		renderCall(args, theme, _context) {
			let text = theme.fg("toolTitle", theme.bold("rg "));
			text += theme.fg("accent", `"${args.pattern}"`);
			if (args.path) {
				text += theme.fg("muted", ` in ${args.path}`);
			}
			if (args.glob) {
				text += theme.fg("dim", ` --glob ${args.glob}`);
			}
			return new Text(text, 0, 0);
		},

		// Custom rendering of the tool result
		// 自定义工具结果的渲染
		renderResult(result, { expanded, isPartial }, theme, _context) {
			const details = result.details as RgDetails | undefined;

			// Handle streaming/partial results
			// 处理流式/部分结果
			if (isPartial) {
				return new Text(theme.fg("warning", "Searching..."), 0, 0);
			}

			// No matches
			// 无匹配结果
			if (!details || details.matchCount === 0) {
				return new Text(theme.fg("dim", "No matches found"), 0, 0);
			}

			// Build result display
			// 构建结果展示内容
			let text = theme.fg("success", `${details.matchCount} matches`);

			// Show truncation warning if applicable
			// 如有必要,显示截断警告
			if (details.truncation?.truncated) {
				text += theme.fg("warning", " (truncated)");
			}

			// In expanded view, show the actual matches
			// 在展开视图中显示实际的匹配内容
			if (expanded) {
				const content = result.content[0];
				if (content?.type === "text") {
					// Show first 20 lines in expanded view, or all if fewer
					// 在展开视图中显示前 20 行,不足 20 行则全部显示
					const lines = content.text.split("\n").slice(0, 20);
					for (const line of lines) {
						text += `\n${theme.fg("dim", line)}`;
					}
					if (content.text.split("\n").length > 20) {
						text += `\n${theme.fg("muted", "... (use read tool to see full output)")}`;
					}
				}

				// Show temp file path if truncated
				// 若发生截断,则显示临时文件路径
				if (details.fullOutputPath) {
					text += `\n${theme.fg("dim", `Full output: ${details.fullOutputPath}`)}`;
				}
			}

			return new Text(text, 0, 0);
		},
	});
}
