/**
 * Simple chat interface demo using tui.ts
 * 使用 tui.ts 实现的简易聊天界面演示
 */

import chalk from "chalk";
import { CombinedAutocompleteProvider } from "../src/autocomplete.ts";
import { Editor } from "../src/components/editor.ts";
import { Loader } from "../src/components/loader.ts";
import { Markdown } from "../src/components/markdown.ts";
import { Text } from "../src/components/text.ts";
import { TuiMainScreen } from "../src/TuiMainScreen.ts";
import { ProcessTerminal } from "../src/terminal.ts";
import type { TUI } from "../src/tui.ts";
import { defaultEditorTheme, defaultMarkdownTheme } from "./test-themes.ts";

// Create terminal
// 创建终端
const terminal = new ProcessTerminal();

// Create TUI
// 创建 TUI
const tui: TUI = new TuiMainScreen(terminal);

// Create chat container with some initial messages
// 创建聊天容器，并放入一些初始消息
tui.addChild(
	new Text("Welcome to Simple Chat!\n\nType your messages below. Type '/' for commands. Press Ctrl+C to exit."),
);

// Create editor with autocomplete
// 创建带自动补全的编辑器
const editor = new Editor(tui, defaultEditorTheme);

// Set up autocomplete provider with slash commands and file completion
// 配置自动补全提供者（provider），支持斜杠命令和文件路径补全
const autocompleteProvider = new CombinedAutocompleteProvider(
	[
		{ name: "delete", description: "Delete the last message" },
		{ name: "clear", description: "Clear all messages" },
	],
	process.cwd(),
);
editor.setAutocompleteProvider(autocompleteProvider);

tui.addChild(editor);

// Focus the editor
// 将焦点设置到编辑器
tui.setFocus(editor);

// Track if we're waiting for bot response
// 记录当前是否正在等待机器人（bot）回复
let isResponding = false;

// Handle message submission
// 处理消息提交
editor.onSubmit = (value: string) => {
	// Prevent submission if already responding
	// 如果正在回复中，则阻止提交
	if (isResponding) {
		return;
	}

	const trimmed = value.trim();

	// Handle slash commands
	// 处理斜杠命令
	if (trimmed === "/delete") {
		const children = tui.children;
		// Remove component before editor (if there are any besides the initial text)
		// 移除编辑器之前的组件（前提是除初始文本外还有其他组件）
		if (children.length > 3) {
			// children[0] = "Welcome to Simple Chat!"
			// children[1] = "Type your messages below..."
			// children[2...n-1] = messages
			// children[n] = editor
			children.splice(children.length - 2, 1);
		}
		tui.requestRender();
		return;
	}

	if (trimmed === "/clear") {
		const children = tui.children;
		// Remove all messages but keep the welcome text and editor
		// 移除所有消息，但保留欢迎文本和编辑器
		children.splice(2, children.length - 3);
		tui.requestRender();
		return;
	}

	if (trimmed) {
		isResponding = true;
		editor.disableSubmit = true;

		const userMessage = new Markdown(value, 1, 1, defaultMarkdownTheme);

		const children = tui.children;
		children.splice(children.length - 1, 0, userMessage);

		const loader = new Loader(
			tui,
			(s) => chalk.cyan(s),
			(s) => chalk.dim(s),
			"Thinking...",
		);
		children.splice(children.length - 1, 0, loader);

		tui.requestRender();

		setTimeout(() => {
			tui.removeChild(loader);

			// Simulate a response
			// 模拟一条回复
			const responses = [
				"That's interesting! Tell me more.",
				"I see what you mean.",
				"Fascinating perspective!",
				"Could you elaborate on that?",
				"That makes sense to me.",
				"I hadn't thought of it that way.",
				"Great point!",
				"Thanks for sharing that.",
			];
			const randomResponse = responses[Math.floor(Math.random() * responses.length)];

			// Add assistant message with no background (transparent)
			// 添加助手消息，不带背景色（透明）
			const botMessage = new Markdown(randomResponse, 1, 1, defaultMarkdownTheme);
			children.splice(children.length - 1, 0, botMessage);

			// Re-enable submit
			// 重新启用提交
			isResponding = false;
			editor.disableSubmit = false;

			// Request render
			// 请求重新渲染
			tui.requestRender();
		}, 1000);
	}
};

// Start the TUI
// 启动 TUI
tui.start();
