/**
 * Minimal Mode Example - Demonstrates a "minimal" tool display mode
 * 极简模式示例 —— 演示一种“极简”工具展示模式
 *
 * This extension overrides built-in tools to provide custom rendering:
 * 该扩展覆盖内置工具以提供自定义渲染：
 * - Collapsed mode: Only shows the tool call (command/path), no output
 *   折叠模式：仅显示工具调用（命令/路径），不显示输出
 * - Expanded mode: Shows full output like the built-in renderers
 *   展开模式：像内置渲染器一样显示完整输出
 *
 * This demonstrates how a "minimal mode" could work, where ctrl+o cycles through:
 * 这演示了“极简模式”可以如何工作，其中 ctrl+o 会循环切换：
 * - Standard: Shows truncated output (current default)
 *   标准：显示截断后的输出（当前默认）
 * - Expanded: Shows full output (current expanded)
 *   展开：显示完整输出（当前的展开态）
 * - Minimal: Shows only tool call, no output (this extension's collapsed mode)
 *   极简：仅显示工具调用，不显示输出（本扩展的折叠模式）
 *
 * Usage:
 * 用法：
 *   pi -e ./minimal-mode.ts
 *
 * Then use ctrl+o to toggle between minimal (collapsed) and full (expanded) views.
 * 然后使用 ctrl+o 在极简（折叠）视图与完整（展开）视图之间切换。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	createBashTool,
	createEditTool,
	createFindTool,
	createGrepTool,
	createLsTool,
	createReadTool,
	createWriteTool,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { homedir } from "os";

/**
 * Shorten a path by replacing home directory with ~
 * 通过将主目录（home directory）替换为 ~ 来缩短路径
 */
function shortenPath(path: string): string {
	const home = homedir();
	if (path.startsWith(home)) {
		return `~${path.slice(home.length)}`;
	}
	return path;
}

// Cache for built-in tools by cwd
// 按 cwd（当前工作目录）缓存内置工具
const toolCache = new Map<string, ReturnType<typeof createBuiltInTools>>();

function createBuiltInTools(cwd: string) {
	return {
		read: createReadTool(cwd),
		bash: createBashTool(cwd),
		edit: createEditTool(cwd),
		write: createWriteTool(cwd),
		find: createFindTool(cwd),
		grep: createGrepTool(cwd),
		ls: createLsTool(cwd),
	};
}

function getBuiltInTools(cwd: string) {
	let tools = toolCache.get(cwd);
	if (!tools) {
		tools = createBuiltInTools(cwd);
		toolCache.set(cwd, tools);
	}
	return tools;
}

export default function (pi: ExtensionAPI) {
	// =========================================================================
	// Read Tool
	// read 工具（读取文件）
	// =========================================================================
	pi.registerTool({
		name: "read",
		label: "read",
		description:
			"Read the contents of a file. Supports text files and images (jpg, png, gif, webp). Images are sent as attachments. For text files, output is truncated to 2000 lines or 50KB (whichever is hit first). Use offset/limit for large files.",
		parameters: getBuiltInTools(process.cwd()).read.parameters,

		async execute(toolCallId, params, signal, onUpdate, ctx) {
			const tools = getBuiltInTools(ctx.cwd);
			return tools.read.execute(toolCallId, params, signal, onUpdate);
		},

		renderCall(args, theme, _context) {
			const path = shortenPath(args.path || "");
			let pathDisplay = path ? theme.fg("accent", path) : theme.fg("toolOutput", "...");

			// Show line range if specified
			// 如果指定了行范围，则显示行范围
			if (args.offset !== undefined || args.limit !== undefined) {
				const startLine = args.offset ?? 1;
				const endLine = args.limit !== undefined ? startLine + args.limit - 1 : "";
				pathDisplay += theme.fg("warning", `:${startLine}${endLine ? `-${endLine}` : ""}`);
			}

			return new Text(`${theme.fg("toolTitle", theme.bold("read"))} ${pathDisplay}`, 0, 0);
		},

		renderResult(result, { expanded }, theme, _context) {
			// Minimal mode: show nothing in collapsed state
			// 极简模式：在折叠状态下不显示任何内容
			if (!expanded) {
				return new Text("", 0, 0);
			}

			// Expanded mode: show full output
			// 展开模式：显示完整输出
			const textContent = result.content.find((c) => c.type === "text");
			if (!textContent || textContent.type !== "text") {
				return new Text("", 0, 0);
			}

			const lines = textContent.text.split("\n");
			const output = lines.map((line) => theme.fg("toolOutput", line)).join("\n");
			return new Text(`\n${output}`, 0, 0);
		},
	});

	// =========================================================================
	// Bash Tool
	// bash 工具（执行命令）
	// =========================================================================
	pi.registerTool({
		name: "bash",
		label: "bash",
		description:
			"Execute a bash command in the current working directory. Returns stdout and stderr. Output is truncated to last 2000 lines or 50KB (whichever is hit first).",
		parameters: getBuiltInTools(process.cwd()).bash.parameters,

		async execute(toolCallId, params, signal, onUpdate, ctx) {
			const tools = getBuiltInTools(ctx.cwd);
			return tools.bash.execute(toolCallId, params, signal, onUpdate);
		},

		renderCall(args, theme, _context) {
			const command = args.command || "...";
			const timeout = args.timeout as number | undefined;
			const timeoutSuffix = timeout ? theme.fg("muted", ` (timeout ${timeout}s)`) : "";

			return new Text(theme.fg("toolTitle", theme.bold(`$ ${command}`)) + timeoutSuffix, 0, 0);
		},

		renderResult(result, { expanded }, theme, _context) {
			// Minimal mode: show nothing in collapsed state
			// 极简模式：在折叠状态下不显示任何内容
			if (!expanded) {
				return new Text("", 0, 0);
			}

			// Expanded mode: show full output
			// 展开模式：显示完整输出
			const textContent = result.content.find((c) => c.type === "text");
			if (!textContent || textContent.type !== "text") {
				return new Text("", 0, 0);
			}

			const output = textContent.text
				.trim()
				.split("\n")
				.map((line) => theme.fg("toolOutput", line))
				.join("\n");

			if (!output) {
				return new Text("", 0, 0);
			}

			return new Text(`\n${output}`, 0, 0);
		},
	});

	// =========================================================================
	// Write Tool
	// write 工具（写入文件）
	// =========================================================================
	pi.registerTool({
		name: "write",
		label: "write",
		description:
			"Write content to a file. Creates the file if it doesn't exist, overwrites if it does. Automatically creates parent directories.",
		parameters: getBuiltInTools(process.cwd()).write.parameters,

		async execute(toolCallId, params, signal, onUpdate, ctx) {
			const tools = getBuiltInTools(ctx.cwd);
			return tools.write.execute(toolCallId, params, signal, onUpdate);
		},

		renderCall(args, theme, _context) {
			const path = shortenPath(args.path || "");
			const pathDisplay = path ? theme.fg("accent", path) : theme.fg("toolOutput", "...");
			const lineCount = args.content ? args.content.split("\n").length : 0;
			const lineInfo = lineCount > 0 ? theme.fg("muted", ` (${lineCount} lines)`) : "";

			return new Text(`${theme.fg("toolTitle", theme.bold("write"))} ${pathDisplay}${lineInfo}`, 0, 0);
		},

		renderResult(result, { expanded }, theme, _context) {
			// Minimal mode: show nothing (file was written)
			// 极简模式：不显示任何内容（文件已写入）
			if (!expanded) {
				return new Text("", 0, 0);
			}

			// Expanded mode: show error if any
			// 展开模式：如果有错误则显示错误
			if (result.content.some((c) => c.type === "text" && c.text)) {
				const textContent = result.content.find((c) => c.type === "text");
				if (textContent?.type === "text" && textContent.text) {
					return new Text(`\n${theme.fg("error", textContent.text)}`, 0, 0);
				}
			}

			return new Text("", 0, 0);
		},
	});

	// =========================================================================
	// Edit Tool
	// edit 工具（编辑文件）
	// =========================================================================
	pi.registerTool({
		name: "edit",
		label: "edit",
		description:
			"Edit a file by replacing exact text. The oldText must match exactly (including whitespace). Use this for precise, surgical edits.",
		parameters: getBuiltInTools(process.cwd()).edit.parameters,

		async execute(toolCallId, params, signal, onUpdate, ctx) {
			const tools = getBuiltInTools(ctx.cwd);
			return tools.edit.execute(toolCallId, params, signal, onUpdate);
		},

		renderCall(args, theme, _context) {
			const path = shortenPath(args.path || "");
			const pathDisplay = path ? theme.fg("accent", path) : theme.fg("toolOutput", "...");

			return new Text(`${theme.fg("toolTitle", theme.bold("edit"))} ${pathDisplay}`, 0, 0);
		},

		renderResult(result, { expanded }, theme, _context) {
			// Minimal mode: show nothing in collapsed state
			// 极简模式：在折叠状态下不显示任何内容
			if (!expanded) {
				return new Text("", 0, 0);
			}

			// Expanded mode: show diff or error
			// 展开模式：显示差异（diff）或错误
			const textContent = result.content.find((c) => c.type === "text");
			if (!textContent || textContent.type !== "text") {
				return new Text("", 0, 0);
			}

			// For errors, show the error message
			// 对于错误，显示错误信息
			const text = textContent.text;
			if (text.includes("Error") || text.includes("error")) {
				return new Text(`\n${theme.fg("error", text)}`, 0, 0);
			}

			// Otherwise show the text (would be nice to show actual diff here)
			// 否则显示文本（如果这里能显示真正的 diff 就更好了）
			return new Text(`\n${theme.fg("toolOutput", text)}`, 0, 0);
		},
	});

	// =========================================================================
	// Find Tool
	// find 工具（查找文件）
	// =========================================================================
	pi.registerTool({
		name: "find",
		label: "find",
		description:
			"Find files by name pattern (glob). Searches recursively from the specified path. Output limited to 200 results.",
		parameters: getBuiltInTools(process.cwd()).find.parameters,

		async execute(toolCallId, params, signal, onUpdate, ctx) {
			const tools = getBuiltInTools(ctx.cwd);
			return tools.find.execute(toolCallId, params, signal, onUpdate);
		},

		renderCall(args, theme, _context) {
			const pattern = args.pattern || "";
			const path = shortenPath(args.path || ".");
			const limit = args.limit;

			let text = `${theme.fg("toolTitle", theme.bold("find"))} ${theme.fg("accent", pattern)}`;
			text += theme.fg("toolOutput", ` in ${path}`);
			if (limit !== undefined) {
				text += theme.fg("toolOutput", ` (limit ${limit})`);
			}

			return new Text(text, 0, 0);
		},

		renderResult(result, { expanded }, theme, _context) {
			if (!expanded) {
				// Minimal: just show count
				// 极简：只显示数量
				const textContent = result.content.find((c) => c.type === "text");
				if (textContent?.type === "text") {
					const count = textContent.text.trim().split("\n").filter(Boolean).length;
					if (count > 0) {
						return new Text(theme.fg("muted", ` → ${count} files`), 0, 0);
					}
				}
				return new Text("", 0, 0);
			}

			// Expanded: show full results
			// 展开：显示完整结果
			const textContent = result.content.find((c) => c.type === "text");
			if (!textContent || textContent.type !== "text") {
				return new Text("", 0, 0);
			}

			const output = textContent.text
				.trim()
				.split("\n")
				.map((line) => theme.fg("toolOutput", line))
				.join("\n");

			return new Text(`\n${output}`, 0, 0);
		},
	});

	// =========================================================================
	// Grep Tool
	// grep 工具（内容搜索）
	// =========================================================================
	pi.registerTool({
		name: "grep",
		label: "grep",
		description:
			"Search file contents by regex pattern. Uses ripgrep for fast searching. Output limited to 200 matches.",
		parameters: getBuiltInTools(process.cwd()).grep.parameters,

		async execute(toolCallId, params, signal, onUpdate, ctx) {
			const tools = getBuiltInTools(ctx.cwd);
			return tools.grep.execute(toolCallId, params, signal, onUpdate);
		},

		renderCall(args, theme, _context) {
			const pattern = args.pattern || "";
			const path = shortenPath(args.path || ".");
			const glob = args.glob;
			const limit = args.limit;

			let text = `${theme.fg("toolTitle", theme.bold("grep"))} ${theme.fg("accent", `/${pattern}/`)}`;
			text += theme.fg("toolOutput", ` in ${path}`);
			if (glob) {
				text += theme.fg("toolOutput", ` (${glob})`);
			}
			if (limit !== undefined) {
				text += theme.fg("toolOutput", ` limit ${limit}`);
			}

			return new Text(text, 0, 0);
		},

		renderResult(result, { expanded }, theme, _context) {
			if (!expanded) {
				// Minimal: just show match count
				// 极简：只显示匹配数量
				const textContent = result.content.find((c) => c.type === "text");
				if (textContent?.type === "text") {
					const count = textContent.text.trim().split("\n").filter(Boolean).length;
					if (count > 0) {
						return new Text(theme.fg("muted", ` → ${count} matches`), 0, 0);
					}
				}
				return new Text("", 0, 0);
			}

			// Expanded: show full results
			// 展开：显示完整结果
			const textContent = result.content.find((c) => c.type === "text");
			if (!textContent || textContent.type !== "text") {
				return new Text("", 0, 0);
			}

			const output = textContent.text
				.trim()
				.split("\n")
				.map((line) => theme.fg("toolOutput", line))
				.join("\n");

			return new Text(`\n${output}`, 0, 0);
		},
	});

	// =========================================================================
	// Ls Tool
	// ls 工具（列目录）
	// =========================================================================
	pi.registerTool({
		name: "ls",
		label: "ls",
		description:
			"List directory contents with file sizes. Shows files and directories with their sizes. Output limited to 500 entries.",
		parameters: getBuiltInTools(process.cwd()).ls.parameters,

		async execute(toolCallId, params, signal, onUpdate, ctx) {
			const tools = getBuiltInTools(ctx.cwd);
			return tools.ls.execute(toolCallId, params, signal, onUpdate);
		},

		renderCall(args, theme, _context) {
			const path = shortenPath(args.path || ".");
			const limit = args.limit;

			let text = `${theme.fg("toolTitle", theme.bold("ls"))} ${theme.fg("accent", path)}`;
			if (limit !== undefined) {
				text += theme.fg("toolOutput", ` (limit ${limit})`);
			}

			return new Text(text, 0, 0);
		},

		renderResult(result, { expanded }, theme, _context) {
			if (!expanded) {
				// Minimal: just show entry count
				// 极简：只显示条目数量
				const textContent = result.content.find((c) => c.type === "text");
				if (textContent?.type === "text") {
					const count = textContent.text.trim().split("\n").filter(Boolean).length;
					if (count > 0) {
						return new Text(theme.fg("muted", ` → ${count} entries`), 0, 0);
					}
				}
				return new Text("", 0, 0);
			}

			// Expanded: show full listing
			// 展开：显示完整列表
			const textContent = result.content.find((c) => c.type === "text");
			if (!textContent || textContent.type !== "text") {
				return new Text("", 0, 0);
			}

			const output = textContent.text
				.trim()
				.split("\n")
				.map((line) => theme.fg("toolOutput", line))
				.join("\n");

			return new Text(`\n${output}`, 0, 0);
		},
	});
}
