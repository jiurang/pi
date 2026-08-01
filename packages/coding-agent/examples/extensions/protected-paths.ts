/**
 * Protected Paths Extension
 * 受保护路径扩展(Extension)
 *
 * Blocks write and edit operations to protected paths.
 * 拦截针对受保护路径的写入(write)与编辑(edit)操作。
 * Useful for preventing accidental modifications to sensitive files.
 * 可用于防止意外修改敏感文件。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	const protectedPaths = [".env", ".git/", "node_modules/"];

	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName !== "write" && event.toolName !== "edit") {
			return undefined;
		}

		const path = event.input.path as string;
		const isProtected = protectedPaths.some((p) => path.includes(p));

		if (isProtected) {
			if (ctx.hasUI) {
				ctx.ui.notify(`Blocked write to protected path: ${path}`, "warning");
			}
			return { block: true, reason: `Path "${path}" is protected` };
		}

		return undefined;
	});
}
