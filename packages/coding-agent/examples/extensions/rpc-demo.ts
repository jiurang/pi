/**
 * RPC Extension UI Demo
 * RPC 扩展 UI 演示
 *
 * Purpose-built extension that exercises all RPC-supported extension UI methods.
 * 一个专门编写的扩展，用于演练所有 RPC 所支持的扩展 UI 方法。
 * Designed to be loaded alongside the rpc-extension-ui-example.ts script to
 * demonstrate the full extension UI protocol.
 * 设计上与 rpc-extension-ui-example.ts 脚本配合加载，以完整演示扩展 UI 协议。
 *
 * UI methods exercised:
 * 所演练的 UI 方法：
 * - select() - on tool_call for dangerous bash commands
 *   select() —— 在 tool_call 时针对危险的 bash 命令使用
 * - confirm() - on session_before_switch
 *   confirm() —— 在 session_before_switch 时使用
 * - input() - via /rpc-input command
 *   input() —— 通过 /rpc-input 命令使用
 * - editor() - via /rpc-editor command
 *   editor() —— 通过 /rpc-editor 命令使用
 * - notify() - after each dialog completes
 *   notify() —— 在每个对话框完成后使用
 * - setStatus() - on turn_start/turn_end
 *   setStatus() —— 在 turn_start/turn_end 时使用
 * - setWidget() - on session_start
 *   setWidget() —— 在 session_start 时使用
 * - setTitle() - on session_start
 *   setTitle() —— 在 session_start 时使用
 * - setEditorText() - via /rpc-prefill command
 *   setEditorText() —— 通过 /rpc-prefill 命令使用
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	let turnCount = 0;

	// -- setTitle, setWidget, setStatus on session lifecycle --
	// -- 会话生命周期中的 setTitle、setWidget、setStatus --

	pi.on("session_start", async (event, ctx) => {
		ctx.ui.setTitle(event.reason === "new" ? "pi RPC Demo (new session)" : "pi RPC Demo");
		ctx.ui.setWidget("rpc-demo", ["--- RPC Extension UI Demo ---", "Loaded and ready."]);
		ctx.ui.setStatus("rpc-demo", `Turns: ${turnCount}`);
	});

	// -- setStatus on turn lifecycle --
	// -- 轮次（turn）生命周期中的 setStatus --

	pi.on("turn_start", async (_event, ctx) => {
		turnCount++;
		ctx.ui.setStatus("rpc-demo", `Turn ${turnCount} running...`);
	});

	pi.on("turn_end", async (_event, ctx) => {
		ctx.ui.setStatus("rpc-demo", `Turn ${turnCount} done`);
	});

	// -- select on dangerous tool calls --
	// -- 危险工具调用时的 select --

	pi.on("tool_call", async (event, ctx) => {
		if (event.toolName !== "bash") return undefined;

		const command = event.input.command as string;
		const isDangerous = /\brm\s+(-rf?|--recursive)/i.test(command) || /\bsudo\b/i.test(command);

		if (isDangerous) {
			if (!ctx.hasUI) {
				return { block: true, reason: "Dangerous command blocked (no UI)" };
			}

			const choice = await ctx.ui.select(`Dangerous command: ${command}`, ["Allow", "Block"]);
			if (choice !== "Allow") {
				ctx.ui.notify("Command blocked by user", "warning");
				return { block: true, reason: "Blocked by user" };
			}
			ctx.ui.notify("Command allowed", "info");
		}

		return undefined;
	});

	// -- confirm on session clear --
	// -- 清空会话时的 confirm --

	pi.on("session_before_switch", async (event, ctx) => {
		if (event.reason !== "new") return;
		if (!ctx.hasUI) return;

		const confirmed = await ctx.ui.confirm("Clear session?", "All messages will be lost.");
		if (!confirmed) {
			ctx.ui.notify("Clear cancelled", "info");
			return { cancel: true };
		}
	});

	// -- input via command --
	// -- 通过命令触发的 input --

	pi.registerCommand("rpc-input", {
		description: "Prompt for text input (demonstrates ctx.ui.input in RPC)",
		handler: async (_args, ctx) => {
			const value = await ctx.ui.input("Enter a value", "type something...");
			if (value) {
				ctx.ui.notify(`You entered: ${value}`, "info");
			} else {
				ctx.ui.notify("Input cancelled", "info");
			}
		},
	});

	// -- editor via command --
	// -- 通过命令触发的 editor --

	pi.registerCommand("rpc-editor", {
		description: "Open multi-line editor (demonstrates ctx.ui.editor in RPC)",
		handler: async (_args, ctx) => {
			const text = await ctx.ui.editor("Edit some text", "Line 1\nLine 2\nLine 3");
			if (text) {
				ctx.ui.notify(`Editor submitted (${text.split("\n").length} lines)`, "info");
			} else {
				ctx.ui.notify("Editor cancelled", "info");
			}
		},
	});

	// -- setEditorText via command --
	// -- 通过命令触发的 setEditorText --

	pi.registerCommand("rpc-prefill", {
		description: "Prefill the input editor (demonstrates ctx.ui.setEditorText in RPC)",
		handler: async (_args, ctx) => {
			ctx.ui.setEditorText("This text was set by the rpc-demo extension.");
			ctx.ui.notify("Editor prefilled", "info");
		},
	});
}
