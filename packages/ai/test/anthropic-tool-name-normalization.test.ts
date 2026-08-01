import { Type } from "typebox";
import { describe, expect, it } from "vitest";
import { getModel, stream } from "../src/compat.ts";
import type { Context, Tool } from "../src/types.ts";
import { resolveApiKey } from "./oauth.ts";

const oauthToken = await resolveApiKey("anthropic");

/**
 * Tests for Anthropic OAuth tool name normalization.
 * 针对 Anthropic OAuth 工具名称归一化的测试。
 *
 * When using Claude Code OAuth, tool names must match CC's canonical casing.
 * 使用 Claude Code OAuth 时，工具名称必须与 CC（Claude Code）的规范大小写一致。
 * The normalization should:
 * 归一化过程应当：
 * 1. Convert tool names that match CC tools (case-insensitive) to CC casing on outbound
 * 1. 出站（outbound）时，将（不区分大小写）能匹配上 CC 工具的名称转换为 CC 的大小写形式
 * 2. Convert tool names back to the original casing on inbound
 * 2. 入站（inbound）时，将工具名称转换回原始的大小写形式
 *
 * This is a simple case-insensitive lookup, NOT a mapping of different names.
 * 这只是一个简单的不区分大小写的查找，而不是把不同名称互相映射。
 * e.g., "todowrite" -> "TodoWrite" -> "todowrite" (round-trip works)
 * 例如："todowrite" -> "TodoWrite" -> "todowrite"（往返转换可正常还原）
 *
 * The old `find -> Glob` mapping was WRONG because:
 * 旧的 `find -> Glob` 映射是错误的，原因是：
 * - Outbound: "find" -> "Glob"
 * - 出站："find" -> "Glob"
 * - Inbound: "Glob" -> ??? (no tool named "glob" in context.tools, only "find")
 * - 入站："Glob" -> ???（context.tools 中并没有名为 "glob" 的工具，只有 "find"）
 * - Result: tool call has name "Glob" but no tool exists with that name
 * - 结果：工具调用的名称是 "Glob"，但并不存在该名称的工具
 */
describe.skipIf(!oauthToken)("Anthropic OAuth tool name normalization", () => {
	const model = getModel("anthropic", "claude-sonnet-4-6");

	it("should normalize user-defined tool matching CC name (todowrite -> TodoWrite -> todowrite)", async () => {
		// User defines a tool named "todowrite" (lowercase)
		// 用户定义了一个名为 "todowrite" 的工具（全小写）
		// CC has "TodoWrite" - this should round-trip correctly
		// CC 中对应的是 "TodoWrite" —— 这里应当能正确地往返还原
		const todoTool: Tool = {
			name: "todowrite",
			description: "Write a todo item",
			parameters: Type.Object({
				task: Type.String({ description: "The task to add" }),
			}),
		};

		const context: Context = {
			systemPrompt: "You are a helpful assistant. Use the todowrite tool when asked to add todos.",
			messages: [
				{
					role: "user",
					content: "Add a todo: buy milk. Use the todowrite tool.",
					timestamp: Date.now(),
				},
			],
			tools: [todoTool],
		};

		const s = stream(model, context, { apiKey: oauthToken });
		let toolCallName: string | undefined;

		for await (const event of s) {
			if (event.type === "toolcall_end") {
				const toolCall = event.partial.content[event.contentIndex];
				if (toolCall.type === "toolCall") {
					toolCallName = toolCall.name;
				}
			}
		}

		const response = await s.result();
		expect(response.stopReason, `Error: ${response.errorMessage}`).toBe("toolUse");

		// The tool call should come back with the ORIGINAL name "todowrite", not "TodoWrite"
		// 返回的工具调用应当使用原始名称 "todowrite"，而不是 "TodoWrite"
		expect(toolCallName).toBe("todowrite");
	});

	it("should handle pi's built-in tools (read, write, edit, bash)", async () => {
		// Pi's tools use lowercase names, CC uses PascalCase
		// Pi 的工具使用小写名称，而 CC 使用帕斯卡命名法（PascalCase）
		const readTool: Tool = {
			name: "read",
			description: "Read a file",
			parameters: Type.Object({
				path: Type.String({ description: "File path" }),
			}),
		};

		const context: Context = {
			systemPrompt: "You are a helpful assistant. Use the read tool to read files.",
			messages: [
				{
					role: "user",
					content: "Read the file /tmp/test.txt using the read tool.",
					timestamp: Date.now(),
				},
			],
			tools: [readTool],
		};

		const s = stream(model, context, { apiKey: oauthToken });
		let toolCallName: string | undefined;

		for await (const event of s) {
			if (event.type === "toolcall_end") {
				const toolCall = event.partial.content[event.contentIndex];
				if (toolCall.type === "toolCall") {
					toolCallName = toolCall.name;
				}
			}
		}

		const response = await s.result();
		expect(response.stopReason, `Error: ${response.errorMessage}`).toBe("toolUse");

		// The tool call should come back with the ORIGINAL name "read", not "Read"
		// 返回的工具调用应当使用原始名称 "read"，而不是 "Read"
		expect(toolCallName).toBe("read");
	});

	it("should NOT map find to Glob - find is not a CC tool name", async () => {
		// Pi has a "find" tool, CC has "Glob" - these are DIFFERENT tools
		// Pi 有一个 "find" 工具，CC 有 "Glob" —— 它们是不同的工具
		// The old code incorrectly mapped find -> Glob, which broke the round-trip
		// 旧代码错误地把 find 映射成了 Glob，这破坏了往返还原，
		// because there's no tool named "glob" in context.tools
		// 因为 context.tools 中并不存在名为 "glob" 的工具
		const findTool: Tool = {
			name: "find",
			description: "Find files by pattern",
			parameters: Type.Object({
				pattern: Type.String({ description: "Glob pattern" }),
			}),
		};

		const context: Context = {
			systemPrompt: "You are a helpful assistant. Use the find tool to search for files.",
			messages: [
				{
					role: "user",
					content: "Find all .ts files using the find tool.",
					timestamp: Date.now(),
				},
			],
			tools: [findTool],
		};

		const s = stream(model, context, { apiKey: oauthToken });
		let toolCallName: string | undefined;

		for await (const event of s) {
			if (event.type === "toolcall_end") {
				const toolCall = event.partial.content[event.contentIndex];
				if (toolCall.type === "toolCall") {
					toolCallName = toolCall.name;
				}
			}
		}

		const response = await s.result();
		expect(response.stopReason, `Error: ${response.errorMessage}`).toBe("toolUse");

		// With the BROKEN find -> Glob mapping:
		// 在有问题的 find -> Glob 映射下：
		// - Sent as "Glob" to Anthropic
		// - 以 "Glob" 的名称发送给 Anthropic
		// - Received back as "Glob"
		// - 返回时仍然是 "Glob"
		// - fromClaudeCodeName("Glob", tools) looks for tool.name.toLowerCase() === "glob"
		// - fromClaudeCodeName("Glob", tools) 会查找 tool.name.toLowerCase() === "glob"
		// - No match (tool is named "find"), returns "Glob"
		// - 没有匹配项（工具名为 "find"），于是返回 "Glob"
		// - Test fails: toolCallName is "Glob" instead of "find"
		// - 测试失败：toolCallName 是 "Glob" 而不是 "find"
		//
		// With the CORRECT implementation (no find->Glob mapping):
		// 在正确的实现下（不做 find->Glob 映射）：
		// - Sent as "find" to Anthropic (no CC tool named "Find")
		// - 以 "find" 的名称发送给 Anthropic（CC 中没有名为 "Find" 的工具）
		// - Received back as "find"
		// - 返回时仍然是 "find"
		// - Test passes: toolCallName is "find"
		// - 测试通过：toolCallName 是 "find"
		expect(toolCallName).toBe("find");
	});

	it("should handle custom tools that don't match any CC tool names", async () => {
		// A completely custom tool should pass through unchanged
		// 完全自定义的工具应当原样透传、不做任何改动
		const customTool: Tool = {
			name: "my_custom_tool",
			description: "A custom tool",
			parameters: Type.Object({
				input: Type.String({ description: "Input value" }),
			}),
		};

		const context: Context = {
			systemPrompt: "You are a helpful assistant. Use my_custom_tool when asked.",
			messages: [
				{
					role: "user",
					content: "Use my_custom_tool with input 'hello'.",
					timestamp: Date.now(),
				},
			],
			tools: [customTool],
		};

		const s = stream(model, context, { apiKey: oauthToken });
		let toolCallName: string | undefined;

		for await (const event of s) {
			if (event.type === "toolcall_end") {
				const toolCall = event.partial.content[event.contentIndex];
				if (toolCall.type === "toolCall") {
					toolCallName = toolCall.name;
				}
			}
		}

		const response = await s.result();
		expect(response.stopReason, `Error: ${response.errorMessage}`).toBe("toolUse");

		// Custom tool names should pass through unchanged
		// 自定义工具名称应当原样透传、不做任何改动
		expect(toolCallName).toBe("my_custom_tool");
	});
});
