/**
 * Debug script to reproduce streaming rendering issues.
 * 用于复现流式渲染问题的调试脚本。
 * Uses real fixture data that caused the bug.
 * 使用触发该 bug 的真实测试夹具（fixture）数据。
 * Run with: npx tsx test/streaming-render-debug.ts
 * 运行方式：npx tsx test/streaming-render-debug.ts
 */

import type { AssistantMessage } from "@earendil-works/pi-ai";
import { ProcessTerminal, type TUI, TuiMainScreen } from "@earendil-works/pi-tui";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { AssistantMessageComponent } from "../src/modes/interactive/components/assistant-message.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize dark theme with full color support
// 初始化深色主题，并启用完整色彩支持
process.env.COLORTERM = "truecolor";
initTheme("dark");

// Load the real fixture that caused the bug
// 加载触发该 bug 的真实夹具数据
const fixtureMessage: AssistantMessage = JSON.parse(
	readFileSync(join(__dirname, "fixtures/assistant-message-with-thinking-code.json"), "utf-8"),
);

// Extract thinking and text content
// 提取思考（thinking）内容与文本内容
const thinkingContent = fixtureMessage.content.find((c) => c.type === "thinking");
const textContent = fixtureMessage.content.find((c) => c.type === "text");

if (!thinkingContent || thinkingContent.type !== "thinking") {
	console.error("No thinking content in fixture");
	process.exit(1);
}

const fullThinkingText = thinkingContent.thinking;
const fullTextContent = textContent && textContent.type === "text" ? textContent.text : "";

async function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
	const terminal = new ProcessTerminal();
	const tui: TUI = new TuiMainScreen(terminal);

	// Start with empty message
	// 从一条空消息开始
	const message = {
		role: "assistant",
		content: [{ type: "thinking", thinking: "" }],
	} as AssistantMessage;

	const component = new AssistantMessageComponent(message, false);
	tui.addChild(component);
	tui.start();

	// Simulate streaming thinking content
	// 模拟流式输出的思考内容
	let thinkingBuffer = "";
	const chunkSize = 10; // characters per "token"
	// 每个“token”包含的字符数

	for (let i = 0; i < fullThinkingText.length; i += chunkSize) {
		thinkingBuffer += fullThinkingText.slice(i, i + chunkSize);

		// Update message content
		// 更新消息内容
		const updatedMessage = {
			role: "assistant",
			content: [{ type: "thinking", thinking: thinkingBuffer }],
		} as AssistantMessage;

		component.updateContent(updatedMessage);
		tui.requestRender();

		await sleep(15); // Simulate token delay
		// 模拟 token 之间的延迟
	}

	// Now add the text content
	// 现在追加文本内容
	await sleep(500);

	const finalMessage = {
		role: "assistant",
		content: [
			{ type: "thinking", thinking: fullThinkingText },
			{ type: "text", text: fullTextContent },
		],
	} as AssistantMessage;

	component.updateContent(finalMessage);
	tui.requestRender();

	// Keep alive for a moment to see the result
	// 保持运行一小段时间以便观察结果
	await sleep(3000);

	tui.stop();
	process.exit(0);
}

main().catch(console.error);
