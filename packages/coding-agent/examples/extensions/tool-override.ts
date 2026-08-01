/**
 * Tool Override Example - Demonstrates overriding built-in tools
 * 工具覆盖示例 —— 演示如何覆盖内置工具
 *
 * Extensions can register tools with the same name as built-in tools to replace them.
 * 扩展可以注册与内置工具同名的工具,从而将其替换掉。
 * This is useful for:
 * 这在以下场景中很有用:
 * - Adding logging or auditing to tool calls
 *   为工具调用添加日志记录或审计
 * - Implementing access control or sandboxing
 *   实现访问控制或沙箱隔离
 * - Routing tool calls to remote systems (e.g., pi-ssh-remote)
 *   将工具调用转发到远程系统(例如 pi-ssh-remote)
 * - Modifying tool behavior for specific workflows
 *   针对特定工作流修改工具的行为
 *
 * This example overrides the `read` tool to:
 * 本示例覆盖 `read` 工具以实现:
 * 1. Log all file access to a log file
 *    将所有文件访问记录写入日志文件
 * 2. Block access to sensitive paths (e.g., .env files)
 *    阻止访问敏感路径(例如 .env 文件)
 * 3. Delegate to the original read implementation for allowed files
 *    对于允许访问的文件,委托给原始的 read 实现来处理
 *
 * Since no custom renderCall/renderResult are provided, the built-in renderer
 * is used automatically (syntax highlighting, line numbers, truncation warnings).
 * 由于没有提供自定义的 renderCall/renderResult,系统会自动使用内置渲染器
 * (包含语法高亮、行号、截断提示等)。
 *
 * Usage:
 * 用法:
 *   pi -e ./tool-override.ts
 */

import type { TextContent } from "@earendil-works/pi-ai";
import { type ExtensionAPI, getAgentDir, withFileMutationQueue } from "@earendil-works/pi-coding-agent";
import { constants, readFileSync } from "fs";
import { access, appendFile, readFile } from "fs/promises";
import { join, resolve } from "path";
import { Type } from "typebox";

const LOG_FILE = join(getAgentDir(), "read-access.log");

// Paths that are blocked from reading
// 被禁止读取的路径
const BLOCKED_PATTERNS = [
	/\.env$/,
	/\.env\..+$/,
	/secrets?\.(json|yaml|yml|toml)$/i,
	/credentials?\.(json|yaml|yml|toml)$/i,
	/\/\.ssh\//,
	/\/\.aws\//,
	/\/\.gnupg\//,
];

function isBlockedPath(path: string): boolean {
	return BLOCKED_PATTERNS.some((pattern) => pattern.test(path));
}

async function logAccess(path: string, allowed: boolean, reason?: string) {
	const timestamp = new Date().toISOString();
	const status = allowed ? "ALLOWED" : "BLOCKED";
	const msg = reason ? ` (${reason})` : "";
	const line = `[${timestamp}] ${status}: ${path}${msg}\n`;

	try {
		await withFileMutationQueue(LOG_FILE, async () => {
			await appendFile(LOG_FILE, line);
		});
	} catch {
		// Ignore logging errors
		// 忽略日志记录过程中的错误
	}
}

const readSchema = Type.Object({
	path: Type.String({ description: "Path to the file to read (relative or absolute)" }),
	offset: Type.Optional(Type.Number({ description: "Line number to start reading from (1-indexed)" })),
	limit: Type.Optional(Type.Number({ description: "Maximum number of lines to read" })),
});

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		// Same name as built-in - this will override it
		// 与内置工具同名 —— 这会覆盖掉内置实现
		name: "read",
		label: "read (audited)",
		description:
			"Read the contents of a file with access logging. Some sensitive paths (.env, secrets, credentials) are blocked.",
		parameters: readSchema,

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const { path, offset, limit } = params;
			const absolutePath = resolve(ctx.cwd, path);

			// Check if path is blocked
			// 检查该路径是否处于禁止访问范围
			if (isBlockedPath(absolutePath)) {
				await logAccess(absolutePath, false, "matches blocked pattern");
				return {
					content: [
						{
							type: "text",
							text: `Access denied: "${path}" matches a blocked pattern (sensitive file). This tool blocks access to .env files, secrets, credentials, and SSH/AWS/GPG directories.`,
						},
					],
					details: { blocked: true },
				};
			}

			// Log allowed access
			// 记录被允许的访问
			await logAccess(absolutePath, true);

			// Perform the actual read (simplified implementation)
			// 执行实际的读取操作(此处为简化实现)
			try {
				await access(absolutePath, constants.R_OK);
				const content = await readFile(absolutePath, "utf-8");
				const lines = content.split("\n");

				// Apply offset and limit
				// 应用 offset(起始偏移)和 limit(读取上限)
				const startLine = offset ? Math.max(0, offset - 1) : 0;
				const endLine = limit ? startLine + limit : lines.length;
				const selectedLines = lines.slice(startLine, endLine);

				// Basic truncation (50KB limit)
				// 基础的截断处理(限制为 50KB)
				let text = selectedLines.join("\n");
				const maxBytes = 50 * 1024;
				if (Buffer.byteLength(text, "utf-8") > maxBytes) {
					text = `${text.slice(0, maxBytes)}\n\n[Output truncated at 50KB]`;
				}

				return {
					content: [{ type: "text", text }] as TextContent[],
					details: { lines: lines.length },
				};
			} catch (error: any) {
				return {
					content: [{ type: "text", text: `Error reading file: ${error.message}` }] as TextContent[],
					details: { error: true },
				};
			}
		},

		// No renderCall/renderResult - uses built-in renderer automatically
		// 未提供 renderCall/renderResult —— 会自动使用内置渲染器
		// (syntax highlighting, line numbers, truncation warnings, etc.)
		// (包含语法高亮、行号、截断提示等)
	});

	// Also register a command to view the access log
	// 同时注册一个用于查看访问日志的命令
	pi.registerCommand("read-log", {
		description: "View the file access log",
		handler: async (_args, ctx) => {
			try {
				const log = readFileSync(LOG_FILE, "utf-8");
				// Last 20 entries
				// 最近的 20 条记录
				const lines = log.trim().split("\n").slice(-20);
				ctx.ui.notify(`Recent file access:\n${lines.join("\n")}`, "info");
			} catch {
				ctx.ui.notify("No access log found", "info");
			}
		},
	});
}
