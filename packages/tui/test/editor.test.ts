import assert from "node:assert";
import { describe, it } from "node:test";
import { stripVTControlCharacters } from "node:util";
import { type AutocompleteProvider, CombinedAutocompleteProvider } from "../src/autocomplete.ts";
import { Editor, wordWrapLine } from "../src/components/editor.ts";
import { TuiMainScreen } from "../src/TuiMainScreen.ts";
import type { TUI } from "../src/tui.ts";
import { visibleWidth } from "../src/utils.ts";
import { defaultEditorTheme } from "./test-themes.ts";
import { VirtualTerminal } from "./virtual-terminal.ts";

/**
 * Create a TUI with a virtual terminal for testing
 * 创建一个带有虚拟终端（virtual terminal）的 TUI，用于测试
 */
function createTestTUI(cols = 80, rows = 24): TUI {
	return new TuiMainScreen(new VirtualTerminal(cols, rows));
}

/**
 * Standard applyCompletion that replaces prefix with item.value
 * 标准的 applyCompletion 实现，用 item.value 替换前缀（prefix）
 */
function applyCompletion(
	lines: string[],
	cursorLine: number,
	cursorCol: number,
	item: { value: string },
	prefix: string,
): { lines: string[]; cursorLine: number; cursorCol: number } {
	const line = lines[cursorLine] || "";
	const before = line.slice(0, cursorCol - prefix.length);
	const after = line.slice(cursorCol);
	const newLines = [...lines];
	newLines[cursorLine] = before + item.value + after;
	return {
		lines: newLines,
		cursorLine,
		cursorCol: cursorCol - prefix.length + item.value.length,
	};
}

async function flushAutocomplete(): Promise<void> {
	await Promise.resolve();
	await new Promise((resolve) => setImmediate(resolve));
}

describe("Editor component", () => {
	describe("Prompt history navigation", () => {
		it("does nothing on Up arrow when history is empty", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.handleInput("\x1b[A"); // Up arrow
			// 上箭头

			assert.strictEqual(editor.getText(), "");
		});

		it("shows most recent history entry on Up arrow when editor is empty", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.addToHistory("first prompt");
			editor.addToHistory("second prompt");

			editor.handleInput("\x1b[A"); // Up arrow
			// 上箭头

			assert.strictEqual(editor.getText(), "second prompt");
		});

		it("cycles through history entries on repeated Up arrow", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.addToHistory("first");
			editor.addToHistory("second");
			editor.addToHistory("third");

			editor.handleInput("\x1b[A"); // Up - shows "third"
			// 上箭头 —— 显示 "third"
			assert.strictEqual(editor.getText(), "third");

			editor.handleInput("\x1b[A"); // Up - shows "second"
			// 上箭头 —— 显示 "second"
			assert.strictEqual(editor.getText(), "second");

			editor.handleInput("\x1b[A"); // Up - shows "first"
			// 上箭头 —— 显示 "first"
			assert.strictEqual(editor.getText(), "first");

			editor.handleInput("\x1b[A"); // Up - stays at "first" (oldest)
			// 上箭头 —— 停留在 "first"（最旧的一条）
			assert.strictEqual(editor.getText(), "first");
		});

		it("jumps to start before entering history from a non-empty draft", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.addToHistory("prompt");
			editor.setText("draft");
			editor.handleInput("\x1b[D");
			editor.handleInput("\x1b[D");

			editor.handleInput("\x1b[A"); // Up - jumps to start before history browsing
			// 上箭头 —— 在浏览历史记录之前先跳到开头
			assert.strictEqual(editor.getText(), "draft");
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 0 });

			editor.handleInput("\x1b[A"); // Up at start - shows "prompt"
			// 位于开头时按上箭头 —— 显示 "prompt"
			assert.strictEqual(editor.getText(), "prompt");

			editor.handleInput("\x1b[B"); // Down - restores draft
			// 下箭头 —— 恢复草稿（draft）
			assert.strictEqual(editor.getText(), "draft");
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 0 });
		});

		it("navigates forward through history with Down arrow", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.addToHistory("first");
			editor.addToHistory("second");
			editor.addToHistory("third");
			editor.setText("draft");

			// Go to oldest
			// 前往最旧的一条
			editor.handleInput("\x1b[A"); // start of draft
			// 草稿（draft）的开头
			editor.handleInput("\x1b[A"); // third
			// 第三条（third）
			editor.handleInput("\x1b[A"); // second
			// 第二条（second）
			editor.handleInput("\x1b[A"); // first
			// 第一条（first）

			// Navigate back
			// 向回导航
			editor.handleInput("\x1b[B"); // second
			// 第二条（second）
			assert.strictEqual(editor.getText(), "second");

			editor.handleInput("\x1b[B"); // third
			// 第三条（third）
			assert.strictEqual(editor.getText(), "third");

			editor.handleInput("\x1b[B"); // draft
			// 草稿（draft）
			assert.strictEqual(editor.getText(), "draft");
		});

		it("exits history mode when typing a character", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.addToHistory("old prompt");

			editor.handleInput("\x1b[A"); // Up - shows "old prompt"
			// 上箭头 —— 显示 "old prompt"
			editor.handleInput("x"); // Type a character - exits history mode
			// 输入一个字符 —— 退出历史记录模式

			assert.strictEqual(editor.getText(), "xold prompt");
		});

		it("exits history mode on setText", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.addToHistory("first");
			editor.addToHistory("second");

			editor.handleInput("\x1b[A"); // Up - shows "second"
			// 上箭头 —— 显示 "second"
			editor.setText(""); // External clear
			// 外部清空

			// Up should start fresh from most recent
			// 上箭头应当从最近一条开始重新浏览
			editor.handleInput("\x1b[A");
			assert.strictEqual(editor.getText(), "second");
		});

		it("does not add empty strings to history", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.addToHistory("");
			editor.addToHistory("   ");
			editor.addToHistory("valid");

			editor.handleInput("\x1b[A");
			assert.strictEqual(editor.getText(), "valid");

			// Should not have more entries
			// 不应再有更多的历史条目
			editor.handleInput("\x1b[A");
			assert.strictEqual(editor.getText(), "valid");
		});

		it("does not add consecutive duplicates to history", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.addToHistory("same");
			editor.addToHistory("same");
			editor.addToHistory("same");

			editor.handleInput("\x1b[A"); // "same"
			// "same"（同一条）
			assert.strictEqual(editor.getText(), "same");

			editor.handleInput("\x1b[A"); // stays at "same" (only one entry)
			// 停留在 "same"（只有一条历史条目）
			assert.strictEqual(editor.getText(), "same");
		});

		it("allows non-consecutive duplicates in history", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.addToHistory("first");
			editor.addToHistory("second");
			editor.addToHistory("first"); // Not consecutive, should be added
			// 非连续重复，应当被加入历史记录

			editor.handleInput("\x1b[A"); // "first"
			// "first"（第一条）
			assert.strictEqual(editor.getText(), "first");

			editor.handleInput("\x1b[A"); // "second"
			// "second"（第二条）
			assert.strictEqual(editor.getText(), "second");

			editor.handleInput("\x1b[A"); // "first" (older one)
			// "first"（更早的那一条）
			assert.strictEqual(editor.getText(), "first");
		});

		it("uses cursor movement instead of history when editor has content", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.addToHistory("history item");
			editor.setText("line1\nline2");

			// Cursor is at end of line2, Up should move to line1
			// 光标位于 line2 的末尾，按上箭头应当移动到 line1
			editor.handleInput("\x1b[A"); // Up - cursor movement
			// 上箭头 —— 光标移动

			// Insert character to verify cursor position
			// 插入一个字符以验证光标位置
			editor.handleInput("X");

			// X should be inserted in line1, not replace with history
			// X 应当被插入到 line1 中，而不是用历史记录替换内容
			assert.strictEqual(editor.getText(), "line1X\nline2");
		});

		it("limits history to 100 entries", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			// Add 105 entries
			// 添加 105 条历史条目
			for (let i = 0; i < 105; i++) {
				editor.addToHistory(`prompt ${i}`);
			}

			// Navigate to oldest
			// 导航到最旧的一条
			for (let i = 0; i < 100; i++) {
				editor.handleInput("\x1b[A");
			}

			// Should be at entry 5 (oldest kept), not entry 0
			// 应当位于第 5 条（保留下来的最旧一条），而不是第 0 条
			assert.strictEqual(editor.getText(), "prompt 5");

			// One more Up should not change anything
			// 再按一次上箭头不应改变任何内容
			editor.handleInput("\x1b[A");
			assert.strictEqual(editor.getText(), "prompt 5");
		});

		it("places cursor at start after browsing history upward", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.addToHistory("older entry");
			editor.addToHistory("line1\nline2\nline3");

			editor.handleInput("\x1b[A"); // Up - shows multi-line entry at start
			// 上箭头 —— 显示多行条目，光标位于开头
			assert.strictEqual(editor.getText(), "line1\nline2\nline3");
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 0 });

			editor.handleInput("\x1b[A"); // Up again - immediately navigates to older entry
			// 再按上箭头 —— 立即导航到更旧的条目
			assert.strictEqual(editor.getText(), "older entry");
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 0 });
		});

		it("places cursor at end after browsing history downward", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.addToHistory("older entry");
			editor.addToHistory("line1\nline2\nline3");
			editor.addToHistory("newer entry");

			editor.handleInput("\x1b[A"); // newer entry
			// 更新的条目
			editor.handleInput("\x1b[A"); // multi-line entry
			// 多行条目
			editor.handleInput("\x1b[A"); // older entry
			// 更旧的条目

			editor.handleInput("\x1b[B"); // Down - shows multi-line entry at end
			// 下箭头 —— 显示多行条目，光标位于末尾
			assert.strictEqual(editor.getText(), "line1\nline2\nline3");
			assert.deepStrictEqual(editor.getCursor(), { line: 2, col: 5 });

			editor.handleInput("\x1b[B"); // Down again - immediately navigates to newer entry
			// 再按下箭头 —— 立即导航到更新的条目
			assert.strictEqual(editor.getText(), "newer entry");
		});

		it("allows opposite-direction cursor movement within multi-line history entry", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.addToHistory("line1\nline2\nline3");

			editor.handleInput("\x1b[A"); // Up - shows entry at start
			// 上箭头 —— 显示该条目，光标位于开头
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 0 });

			editor.handleInput("\x1b[B"); // Down - cursor moves to line2
			// 下箭头 —— 光标移动到 line2
			assert.strictEqual(editor.getText(), "line1\nline2\nline3");
			assert.deepStrictEqual(editor.getCursor(), { line: 1, col: 0 });

			editor.handleInput("\x1b[A"); // Up - cursor moves back to line1
			// 上箭头 —— 光标移回 line1
			assert.strictEqual(editor.getText(), "line1\nline2\nline3");
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 0 });
		});
	});

	describe("public state accessors", () => {
		it("returns cursor position", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 0 });

			editor.handleInput("a");
			editor.handleInput("b");
			editor.handleInput("c");

			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 3 });

			editor.handleInput("\x1b[D"); // Left
			// 左箭头
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 2 });
		});

		it("returns lines as a defensive copy", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);
			editor.setText("a\nb");

			const lines = editor.getLines();
			assert.deepStrictEqual(lines, ["a", "b"]);

			lines[0] = "mutated";
			assert.deepStrictEqual(editor.getLines(), ["a", "b"]);
		});
	});

	describe("Backslash+Enter newline workaround", () => {
		it("inserts backslash immediately (no buffering)", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.handleInput("\\");

			// Backslash should be visible immediately, not buffered
			// 反斜杠应当立即可见，而不是被缓冲（buffered）起来
			assert.strictEqual(editor.getText(), "\\");
		});

		it("converts standalone backslash to newline on Enter", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.handleInput("\\");
			editor.handleInput("\r");

			assert.strictEqual(editor.getText(), "\n");
		});

		it("inserts backslash normally when followed by other characters", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.handleInput("\\");
			editor.handleInput("x");

			assert.strictEqual(editor.getText(), "\\x");
		});

		it("does not trigger newline when backslash is not immediately before cursor", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);
			let submitted = false;

			editor.onSubmit = () => {
				submitted = true;
			};

			editor.handleInput("\\");
			editor.handleInput("x");
			editor.handleInput("\r");

			// Should submit, not insert newline (backslash not at cursor)
			// 应当触发提交（submit），而不是插入换行符（反斜杠不在光标前）
			assert.strictEqual(submitted, true);
		});

		it("only removes one backslash when multiple are present", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.handleInput("\\");
			editor.handleInput("\\");
			editor.handleInput("\\");
			assert.strictEqual(editor.getText(), "\\\\\\");

			editor.handleInput("\r");
			// Only the last backslash is removed, newline inserted
			// 只移除最后一个反斜杠，并插入换行符
			assert.strictEqual(editor.getText(), "\\\\\n");
		});
	});

	describe("Kitty CSI-u handling", () => {
		it("ignores printable CSI-u sequences with unsupported modifiers", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.handleInput("\x1b[99;9u");

			assert.strictEqual(editor.getText(), "");
		});

		it("inserts shifted CSI-u letters as text", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.handleInput("\x1b[69;2u");

			assert.strictEqual(editor.getText(), "E");
		});

		it("inserts shifted xterm modifyOtherKeys letters as text", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.handleInput("\x1b[27;2;69~");

			assert.strictEqual(editor.getText(), "E");
		});
	});

	describe("Unicode text editing behavior", () => {
		it("inserts mixed ASCII, umlauts, and emojis as literal text", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.handleInput("H");
			editor.handleInput("e");
			editor.handleInput("l");
			editor.handleInput("l");
			editor.handleInput("o");
			editor.handleInput(" ");
			editor.handleInput("ä");
			editor.handleInput("ö");
			editor.handleInput("ü");
			editor.handleInput(" ");
			editor.handleInput("😀");

			const text = editor.getText();
			assert.strictEqual(text, "Hello äöü 😀");
		});

		it("deletes single-code-unit unicode characters (umlauts) with Backspace", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.handleInput("ä");
			editor.handleInput("ö");
			editor.handleInput("ü");

			// Delete the last character (ü)
			// 删除最后一个字符（ü）
			editor.handleInput("\x7f"); // Backspace
			// 退格键（Backspace）

			const text = editor.getText();
			assert.strictEqual(text, "äö");
		});

		it("deletes multi-code-unit emojis with single Backspace", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.handleInput("😀");
			editor.handleInput("👍");

			// Delete the last emoji (👍) - single backspace deletes whole grapheme cluster
			// 删除最后一个表情符号（👍）—— 一次退格即可删除整个字形簇（grapheme cluster）
			editor.handleInput("\x7f"); // Backspace
			// 退格键（Backspace）

			const text = editor.getText();
			assert.strictEqual(text, "😀");
		});

		it("inserts characters at the correct position after cursor movement over umlauts", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.handleInput("ä");
			editor.handleInput("ö");
			editor.handleInput("ü");

			// Move cursor left twice
			// 将光标向左移动两次
			editor.handleInput("\x1b[D"); // Left arrow
			// 左箭头
			editor.handleInput("\x1b[D"); // Left arrow
			// 左箭头

			// Insert 'x' in the middle
			// 在中间插入 'x'
			editor.handleInput("x");

			const text = editor.getText();
			assert.strictEqual(text, "äxöü");
		});

		it("moves cursor across multi-code-unit emojis with single arrow key", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.handleInput("😀");
			editor.handleInput("👍");
			editor.handleInput("🎉");

			// Move cursor left over last emoji (🎉) - single arrow moves over whole grapheme
			// 将光标向左越过最后一个表情符号（🎉）—— 一次方向键即可跨越整个字形（grapheme）
			editor.handleInput("\x1b[D"); // Left arrow
			// 左箭头

			// Move cursor left over second emoji (👍)
			// 将光标向左越过第二个表情符号（👍）
			editor.handleInput("\x1b[D");

			// Insert 'x' between first and second emoji
			// 在第一个和第二个表情符号之间插入 'x'
			editor.handleInput("x");

			const text = editor.getText();
			assert.strictEqual(text, "😀x👍🎉");
		});

		it("preserves umlauts across line breaks", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.handleInput("ä");
			editor.handleInput("ö");
			editor.handleInput("ü");
			editor.handleInput("\n"); // new line
			// 换行
			editor.handleInput("Ä");
			editor.handleInput("Ö");
			editor.handleInput("Ü");

			const text = editor.getText();
			assert.strictEqual(text, "äöü\nÄÖÜ");
		});

		it("replaces the entire document with unicode text via setText (paste simulation)", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			// Simulate bracketed paste / programmatic replacement
			// 模拟括号粘贴模式（bracketed paste）/ 程序化替换
			editor.setText("Hällö Wörld! 😀 äöüÄÖÜß");

			const text = editor.getText();
			assert.strictEqual(text, "Hällö Wörld! 😀 äöüÄÖÜß");
		});

		it("moves cursor to document start on Ctrl+A and inserts at the beginning", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.handleInput("a");
			editor.handleInput("b");
			editor.handleInput("\x01"); // Ctrl+A (move to start)
			// Ctrl+A（移动到开头）
			editor.handleInput("x"); // Insert at start
			// 在开头插入

			const text = editor.getText();
			assert.strictEqual(text, "xab");
		});

		it("deletes words correctly with Ctrl+W and Alt+Backspace", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			// Basic word deletion
			// 基本的单词删除
			editor.setText("foo bar baz");
			editor.handleInput("\x17"); // Ctrl+W
			// Ctrl+W（向前删除单词）
			assert.strictEqual(editor.getText(), "foo bar ");

			// Trailing whitespace
			// 尾部空白字符
			editor.setText("foo bar   ");
			editor.handleInput("\x17");
			assert.strictEqual(editor.getText(), "foo ");

			// Punctuation run
			// 连续的标点符号
			editor.setText("foo bar...");
			editor.handleInput("\x17");
			assert.strictEqual(editor.getText(), "foo bar");

			// ASCII punctuation inside Intl word-like segments preserves old boundaries
			// Intl 类单词分段（word-like segment）内部的 ASCII 标点符号保持原有的边界划分
			editor.setText("foo.bar");
			editor.handleInput("\x17");
			assert.strictEqual(editor.getText(), "foo.");

			editor.setText("foo:bar");
			editor.handleInput("\x17");
			assert.strictEqual(editor.getText(), "foo:");

			// Delete across multiple lines
			// 跨多行删除
			editor.setText("line one\nline two");
			editor.handleInput("\x17");
			assert.strictEqual(editor.getText(), "line one\nline ");

			// Delete empty line (merge)
			// 删除空行（合并行）
			editor.setText("line one\n");
			editor.handleInput("\x17");
			assert.strictEqual(editor.getText(), "line one");

			// Grapheme safety (emoji as a word)
			// 字形（grapheme）安全性（把表情符号当作一个单词）
			editor.setText("foo 😀😀 bar");
			editor.handleInput("\x17");
			assert.strictEqual(editor.getText(), "foo 😀😀 ");
			editor.handleInput("\x17");
			assert.strictEqual(editor.getText(), "foo ");

			// Alt+Backspace
			// Alt+Backspace（向前删除单词）
			editor.setText("foo bar");
			editor.handleInput("\x1b\x7f"); // Alt+Backspace (legacy)
			// Alt+Backspace（旧式序列）
			assert.strictEqual(editor.getText(), "foo ");
		});

		it("navigates words correctly with Ctrl+Left/Right", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("foo bar... baz");
			// Cursor at end
			// 光标位于末尾

			// Move left over baz
			// 向左越过 baz
			editor.handleInput("\x1b[1;5D"); // Ctrl+Left
			// Ctrl+Left（按单词向左移动）
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 11 }); // after '...'
			// 位于 '...' 之后

			// Move left over punctuation
			// 向左越过标点符号
			editor.handleInput("\x1b[1;5D"); // Ctrl+Left
			// Ctrl+Left（按单词向左移动）
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 7 }); // after 'bar'
			// 位于 'bar' 之后

			// Move left over bar
			// 向左越过 bar
			editor.handleInput("\x1b[1;5D"); // Ctrl+Left
			// Ctrl+Left（按单词向左移动）
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 4 }); // after 'foo '
			// 位于 'foo ' 之后

			// Move right over bar
			// 向右越过 bar
			editor.handleInput("\x1b[1;5C"); // Ctrl+Right
			// Ctrl+Right（按单词向右移动）
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 7 }); // at end of 'bar'
			// 位于 'bar' 的末尾

			// Move right over punctuation run
			// 向右越过连续的标点符号
			editor.handleInput("\x1b[1;5C"); // Ctrl+Right
			// Ctrl+Right（按单词向右移动）
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 10 }); // after '...'
			// 位于 '...' 之后

			// Move right skips space and lands after baz
			// 向右移动会跳过空格并停在 baz 之后
			editor.handleInput("\x1b[1;5C"); // Ctrl+Right
			// Ctrl+Right（按单词向右移动）
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 14 }); // end of line
			// 行末

			// Test forward from start with leading whitespace
			// 测试从带有前导空白的开头向前移动
			editor.setText("   foo bar");
			editor.handleInput("\x01"); // Ctrl+A to go to start
			// Ctrl+A 跳到开头
			editor.handleInput("\x1b[1;5C"); // Ctrl+Right
			// Ctrl+Right（按单词向右移动）
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 6 }); // after 'foo'
			// 位于 'foo' 之后

			// ASCII punctuation inside Intl word-like segments preserves old boundaries
			// Intl 类单词分段（word-like segment）内部的 ASCII 标点符号保持原有的边界划分
			editor.setText("foo.bar baz");
			editor.handleInput("\x1b[1;5D"); // Ctrl+Left over baz
			// Ctrl+Left 越过 baz
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 8 });
			editor.handleInput("\x1b[1;5D"); // Ctrl+Left over bar
			// Ctrl+Left 越过 bar
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 4 });
			editor.handleInput("\x1b[1;5D"); // Ctrl+Left over .
			// Ctrl+Left 越过 .
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 3 });

			editor.handleInput("\x01"); // Ctrl+A
			// Ctrl+A（移动到开头）
			editor.handleInput("\x1b[1;5C"); // Ctrl+Right over foo
			// Ctrl+Right 越过 foo
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 3 });
			editor.handleInput("\x1b[1;5C"); // Ctrl+Right over .
			// Ctrl+Right 越过 .
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 4 });
			editor.handleInput("\x1b[1;5C"); // Ctrl+Right over bar
			// Ctrl+Right 越过 bar
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 7 });
		});

		it("stops at fullwidth Chinese punctuation (issue #4972)", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			// 你好，世界 = 你好(0-2) ，(2-3) 世界(3-5)
			editor.setText("你好，世界");
			// Cursor at end (col 5)
			// 光标位于末尾（第 5 列）

			// Move left over 世界
			// 向左越过 世界
			editor.handleInput("\x1b[1;5D"); // Ctrl+Left
			// Ctrl+Left（按单词向左移动）
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 3 }); // after ，
			// 位于 ， 之后

			// Move left over ，
			// 向左越过 ，
			editor.handleInput("\x1b[1;5D"); // Ctrl+Left
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 2 }); // after 你好
			// 位于 你好 之后

			// Move left over 你好
			// 向左越过 你好
			editor.handleInput("\x1b[1;5D"); // Ctrl+Left
			// Ctrl+Left（按单词向左移动）
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 0 }); // start
			// 开头

			// Move right over 你好
			// 向右越过 你好
			editor.handleInput("\x1b[1;5C"); // Ctrl+Right
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 2 }); // after 你好
			// 位于 你好 之后

			// Move right over ，
			// 向右越过 ，
			editor.handleInput("\x1b[1;5C"); // Ctrl+Right
			// Ctrl+Right（按单词向右移动）
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 3 }); // after ，
			// 位于 ， 之后

			// Move right over 世界
			// 向右越过 世界
			editor.handleInput("\x1b[1;5C"); // Ctrl+Right
			// Ctrl+Right（按单词向右移动）
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 5 }); // end
			// 末尾
		});

		it("handles mixed CJK and ASCII word movement", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			// "hello你好，world世界" = hello(0-5) 你好(5-7) ，(7-8) world(8-13) 世界(13-15)
			editor.setText("hello你好，world世界");
			// Cursor at end (col 15)
			// 光标位于末尾（第 15 列）

			// Move left over 世界
			// 向左越过 世界
			editor.handleInput("\x1b[1;5D"); // Ctrl+Left
			// Ctrl+Left（按单词向左移动）
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 13 }); // after 'world'
			// 位于 'world' 之后

			// Move left over world
			// 向左越过 world
			editor.handleInput("\x1b[1;5D"); // Ctrl+Left
			// Ctrl+Left（按单词向左移动）
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 8 }); // after ，
			// 位于 ， 之后

			// Move left over ，
			// 向左越过 ，
			editor.handleInput("\x1b[1;5D"); // Ctrl+Left
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 7 }); // after 你好
			// 位于 你好 之后

			// Move left over 你好
			// 向左越过 你好
			editor.handleInput("\x1b[1;5D"); // Ctrl+Left
			// Ctrl+Left（按单词向左移动）
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 5 }); // after 'hello'
			// 位于 'hello' 之后

			// Move left over hello
			// 向左越过 hello
			editor.handleInput("\x1b[1;5D"); // Ctrl+Left
			// Ctrl+Left（按单词向左移动）
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 0 }); // start
			// 开头

			// Forward from start
			// 从开头向前移动
			editor.handleInput("\x1b[1;5C"); // Ctrl+Right
			// Ctrl+Right（按单词向右移动）
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 5 }); // after 'hello'
			// 位于 'hello' 之后

			editor.handleInput("\x1b[1;5C"); // Ctrl+Right
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 7 }); // after 你好
			// 位于 你好 之后

			editor.handleInput("\x1b[1;5C"); // Ctrl+Right
			// Ctrl+Right（按单词向右移动）
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 8 }); // after ，
			// 位于 ， 之后

			editor.handleInput("\x1b[1;5C"); // Ctrl+Right
			// Ctrl+Right（按单词向右移动）
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 13 }); // after 'world'
			// 位于 'world' 之后

			editor.handleInput("\x1b[1;5C"); // Ctrl+Right
			// Ctrl+Right（按单词向右移动）
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 15 }); // end
			// 末尾
		});
	});

	describe("Scroll indicators", () => {
		it("keeps truncated scroll indicators within width and preserves their color (issue #6962)", () => {
			const width = 10;
			const borderColor = (text: string) => `\x1b[35m${text}\x1b[39m`;
			const editor = new Editor(createTestTUI(width), { ...defaultEditorTheme, borderColor });
			editor.setText(Array.from({ length: 20 }, (_, index) => `line ${index}`).join("\n"));

			// Render once to initialize wrapping, then move the cursor so content remains above and below the viewport.
			// 先渲染一次以初始化换行（wrapping），然后移动光标，使视口（viewport）上下都仍有内容。
			editor.render(width);
			for (let index = 0; index < 10; index++) editor.handleInput("\x1b[A");

			const lines = editor.render(width);
			const topBorder = lines[0]!;
			const bottomBorder = lines.at(-1)!;

			assert.match(stripVTControlCharacters(topBorder), /^─── ↑/);
			assert.match(stripVTControlCharacters(bottomBorder), /^─── ↓/);
			assert.strictEqual(topBorder, borderColor(stripVTControlCharacters(topBorder)));
			assert.strictEqual(bottomBorder, borderColor(stripVTControlCharacters(bottomBorder)));
			for (const line of lines) {
				assert.strictEqual(visibleWidth(line), width, `line exceeds width ${width}: ${JSON.stringify(line)}`);
			}
		});
	});

	describe("Grapheme-aware text wrapping", () => {
		it("wraps lines correctly when text contains wide emojis", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);
			const width = 20;

			// ✅ is 2 columns wide, so "Hello ✅ World" is 14 columns
			// ✅ 宽度为 2 列，因此 "Hello ✅ World" 共 14 列
			editor.setText("Hello ✅ World");
			const lines = editor.render(width);

			// All content lines (between borders) should fit within width
			// 所有内容行（位于边框之间）都应当适配给定宽度
			for (let i = 1; i < lines.length - 1; i++) {
				const lineWidth = visibleWidth(lines[i]!);
				assert.strictEqual(lineWidth, width, `Line ${i} has width ${lineWidth}, expected ${width}`);
			}
		});

		it("wraps long text with emojis at correct positions", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);
			const width = 10;

			// Each ✅ is 2 columns. "✅✅✅✅✅" = 10 columns, fits exactly
			// 每个 ✅ 占 2 列。"✅✅✅✅✅" = 10 列，正好放得下
			// "✅✅✅✅✅✅" = 12 columns, needs wrap
			// "✅✅✅✅✅✅" = 12 列，需要换行
			editor.setText("✅✅✅✅✅✅");
			const lines = editor.render(width);

			// Should have 2 content lines (plus 2 border lines)
			// 应当有 2 行内容（外加 2 行边框）
			// First line: 5 emojis (10 cols), second line: 1 emoji (2 cols) + padding
			// 第一行：5 个表情符号（10 列）；第二行：1 个表情符号（2 列）+ 填充（padding）
			for (let i = 1; i < lines.length - 1; i++) {
				const lineWidth = visibleWidth(lines[i]!);
				assert.strictEqual(lineWidth, width, `Line ${i} has width ${lineWidth}, expected ${width}`);
			}
		});

		it("renders isolated Thai and Lao AM clusters without width drift", () => {
			for (const text of ["ำabc", "ຳabc"]) {
				const editor = new Editor(createTestTUI(), defaultEditorTheme);
				const width = 8;
				editor.setText(text);

				for (const line of editor.render(width)) {
					assert.strictEqual(visibleWidth(line), width, `line width drift for ${JSON.stringify(text)}: ${line}`);
				}
			}
		});

		it("wraps CJK characters correctly (each is 2 columns wide)", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);
			const width = 10 + 1; // +1 col reserved for cursor
			// +1 列预留给光标

			// Each CJK char is 2 columns. "日本語テスト" = 6 chars = 12 columns
			// 每个 CJK（中日韩）字符占 2 列。"日本語テスト" = 6 个字符 = 12 列
			editor.setText("日本語テスト");
			const lines = editor.render(width);

			for (let i = 1; i < lines.length - 1; i++) {
				const lineWidth = visibleWidth(lines[i]!);
				assert.strictEqual(lineWidth, width, `Line ${i} has width ${lineWidth}, expected ${width}`);
			}

			// Verify content split correctly
			// 验证内容被正确拆分
			const contentLines = lines.slice(1, -1).map((l) => stripVTControlCharacters(l).trim());
			assert.strictEqual(contentLines.length, 2);
			assert.strictEqual(contentLines[0], "日本語テス"); // 5 chars = 10 columns
			// 5 个字符 = 10 列
			assert.strictEqual(contentLines[1], "ト"); // 1 char = 2 columns (+ padding)
			// 1 个字符 = 2 列（外加填充）
		});

		it("handles mixed ASCII and wide characters in wrapping", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);
			const width = 15 + 1; // +1 col reserved for cursor
			// +1 列预留给光标

			// "Test ✅ OK 日本" = 4 + 1 + 2 + 1 + 2 + 1 + 4 = 15 columns (fits in width-1=15)
			// "Test ✅ OK 日本" = 4 + 1 + 2 + 1 + 2 + 1 + 4 = 15 列（可放入 width-1=15 的宽度中）
			editor.setText("Test ✅ OK 日本");
			const lines = editor.render(width);

			// Should fit in one content line
			// 应当能容纳在一行内容中
			const contentLines = lines.slice(1, -1);
			assert.strictEqual(contentLines.length, 1);

			const lineWidth = visibleWidth(contentLines[0]!);
			assert.strictEqual(lineWidth, width);
		});

		it("renders cursor correctly on wide characters", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);
			const width = 20;

			editor.setText("A✅B");
			// Cursor should be at end (after B)
			// 光标应当位于末尾（B 之后）
			const lines = editor.render(width);

			// The cursor (reverse video space) should be visible
			// 光标（反显空格，reverse video）应当可见
			const contentLine = lines[1]!;
			assert.ok(contentLine.includes("\x1b[7m"), "Should have reverse video cursor");

			// Line should still be correct width
			// 该行的宽度仍应正确
			assert.strictEqual(visibleWidth(contentLine), width);
		});

		it("does not exceed terminal width with emoji at wrap boundary", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);
			const width = 11;

			// "0123456789✅" = 10 ASCII + 2-wide emoji = 12 columns
			// "0123456789✅" = 10 个 ASCII 字符 + 1 个宽度为 2 的表情符号 = 12 列
			// Should wrap before the emoji since it would exceed width
			// 由于会超出宽度，应当在该表情符号之前换行
			editor.setText("0123456789✅");
			const lines = editor.render(width);

			for (let i = 1; i < lines.length - 1; i++) {
				const lineWidth = visibleWidth(lines[i]!);
				assert.ok(lineWidth <= width, `Line ${i} has width ${lineWidth}, exceeds max ${width}`);
			}
		});

		it("shows cursor at end of line before wrap, wraps on next char", () => {
			const width = 10;
			for (const paddingX of [0, 1]) {
				const editor = new Editor(createTestTUI(width + paddingX), defaultEditorTheme, { paddingX });

				// Type 9 chars → fills layoutWidth exactly, cursor at end on same line
				// 输入 9 个字符 → 正好填满 layoutWidth，光标停在同一行的末尾
				for (const ch of "aaaaaaaaa") editor.handleInput(ch);
				let lines = editor.render(width + paddingX);
				let contentLines = lines.slice(1, -1);
				assert.strictEqual(contentLines.length, 1, "Should be 1 content line before wrap");
				assert.ok(contentLines[0]!.endsWith("\x1b[7m \x1b[0m"), "Cursor should be at end of line");

				// Type 1 more → text wraps to second line
				// 再输入 1 个字符 → 文本换行到第二行
				editor.handleInput("a");
				lines = editor.render(width + paddingX);
				contentLines = lines.slice(1, -1);
				assert.strictEqual(contentLines.length, 2, "Should wrap to 2 content lines");
			}
		});
	});

	describe("Word wrapping", () => {
		it("wraps at word boundaries instead of mid-word", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);
			const width = 40;

			editor.setText("Hello world this is a test of word wrapping functionality");
			const lines = editor.render(width);

			// Get content lines (between borders)
			// 获取内容行（位于边框之间）
			const contentLines = lines.slice(1, -1).map((l) => stripVTControlCharacters(l).trim());

			// Should NOT break mid-word
			// 不应在单词中间断行
			// Line 1 should end with a complete word
			// 第 1 行应当以一个完整的单词结尾
			assert.ok(!contentLines[0]!.endsWith("-"), "Line should not end with hyphen (mid-word break)");

			// Each content line should be complete words
			// 每一行内容都应当由完整的单词组成
			for (const line of contentLines) {
				// Words at end of line should be complete (no partial words)
				// 行末的单词应当是完整的（不应出现被截断的单词）
				const lastChar = line.trimEnd().slice(-1);
				assert.ok(lastChar === "" || /[\w.,!?;:]/.test(lastChar), `Line ends unexpectedly with: "${lastChar}"`);
			}
		});

		it("does not start lines with leading whitespace after word wrap", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);
			const width = 20;

			editor.setText("Word1 Word2 Word3 Word4 Word5 Word6");
			const lines = editor.render(width);

			// Get content lines (between borders)
			// 获取内容行（位于边框之间）
			const contentLines = lines.slice(1, -1);

			// No line should start with whitespace (except for padding at the end)
			// 任何一行都不应以空白字符开头（末尾的填充除外）
			for (let i = 0; i < contentLines.length; i++) {
				const line = stripVTControlCharacters(contentLines[i]!);
				const trimmedStart = line.trimStart();
				// The line should either be all padding or start with a word character
				// 该行要么全是填充（padding），要么以一个单词字符开头
				if (trimmedStart.length > 0) {
					assert.ok(!/^\s+\S/.test(line.trimEnd()), `Line ${i} starts with unexpected whitespace before content`);
				}
			}
		});

		it("breaks long words (URLs) at character level", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);
			const width = 30;

			editor.setText("Check https://example.com/very/long/path/that/exceeds/width here");
			const lines = editor.render(width);

			// All lines should fit within width
			// 所有行都应当适配给定宽度
			for (let i = 1; i < lines.length - 1; i++) {
				const lineWidth = visibleWidth(lines[i]!);
				assert.strictEqual(lineWidth, width, `Line ${i} has width ${lineWidth}, expected ${width}`);
			}
		});

		it("preserves multiple spaces within words on same line", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);
			const width = 50;

			editor.setText("Word1   Word2    Word3");
			const lines = editor.render(width);

			const contentLine = stripVTControlCharacters(lines[1]!).trim();
			// Multiple spaces should be preserved
			// 多个连续空格应当被保留
			assert.ok(contentLine.includes("Word1   Word2"), "Multiple spaces should be preserved");
		});

		it("handles empty string", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);
			const width = 40;

			editor.setText("");
			const lines = editor.render(width);

			// Should have border + empty content + border
			// 应当由 边框 + 空内容 + 边框 组成
			assert.strictEqual(lines.length, 3);
		});

		it("handles single word that fits exactly", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);
			const width = 10 + 1; // +1 col reserved for cursor
			// +1 列预留给光标

			editor.setText("1234567890");
			const lines = editor.render(width);

			// Should have exactly 3 lines (top border, content, bottom border)
			// 应当正好有 3 行（上边框、内容、下边框）
			assert.strictEqual(lines.length, 3);
			const contentLine = stripVTControlCharacters(lines[1]!);
			assert.ok(contentLine.includes("1234567890"), "Content should contain the word");
		});

		it("wraps word to next line when it ends exactly at terminal width", () => {
			// "hello " (6) + "world" (5) = 11, but "world" is non-whitespace ending at width.
			// "hello "（6）+ "world"（5）= 11，但 "world" 是恰好在宽度处结束的非空白内容。
			// Thus, wrap it to next line. The trailing space stays with "hello" on line 1
			// 因此应将其换到下一行。尾部空格与 "hello" 一起保留在第 1 行
			const chunks = wordWrapLine("hello world test", 11);

			assert.strictEqual(chunks.length, 2);
			assert.strictEqual(chunks[0]!.text, "hello ");
			assert.strictEqual(chunks[1]!.text, "world test");
		});

		it("keeps whitespace at terminal width boundary on same line", () => {
			// "hello world " is exactly 12 chars (including trailing space)
			// "hello world " 正好是 12 个字符（包含尾部空格）
			// The space at position 12 should stay on the first line
			// 位于第 12 个位置的空格应当保留在第一行
			const chunks = wordWrapLine("hello world test", 12);

			assert.strictEqual(chunks.length, 2);
			assert.strictEqual(chunks[0]!.text, "hello world ");
			assert.strictEqual(chunks[1]!.text, "test");
		});

		it("handles unbreakable word filling width exactly followed by space", () => {
			const chunks = wordWrapLine("aaaaaaaaaaaa aaaa", 12);

			assert.strictEqual(chunks.length, 2);
			assert.strictEqual(chunks[0]!.text, "aaaaaaaaaaaa");
			assert.strictEqual(chunks[1]!.text, " aaaa");
		});

		it("wraps word to next line when it fits width but not remaining space", () => {
			const chunks = wordWrapLine("      aaaaaaaaaaaa", 12);

			assert.strictEqual(chunks.length, 2);
			assert.strictEqual(chunks[0]!.text, "      ");
			assert.strictEqual(chunks[1]!.text, "aaaaaaaaaaaa");
		});

		it("keeps word with multi-space and following word together when they fit", () => {
			const chunks = wordWrapLine("Lorem ipsum dolor sit amet,    consectetur", 30);

			assert.strictEqual(chunks.length, 2);
			assert.strictEqual(chunks[0]!.text, "Lorem ipsum dolor sit ");
			assert.strictEqual(chunks[1]!.text, "amet,    consectetur");
		});

		it("keeps word with multi-space and following word when they fill width exactly", () => {
			const chunks = wordWrapLine("Lorem ipsum dolor sit amet,              consectetur", 30);

			assert.strictEqual(chunks.length, 2);
			assert.strictEqual(chunks[0]!.text, "Lorem ipsum dolor sit ");
			assert.strictEqual(chunks[1]!.text, "amet,              consectetur");
		});

		it("splits when word plus multi-space plus word exceeds width", () => {
			const chunks = wordWrapLine("Lorem ipsum dolor sit amet,               consectetur", 30);

			assert.strictEqual(chunks.length, 3);
			assert.strictEqual(chunks[0]!.text, "Lorem ipsum dolor sit ");
			assert.strictEqual(chunks[1]!.text, "amet,               ");
			assert.strictEqual(chunks[2]!.text, "consectetur");
		});

		it("breaks long whitespace at line boundary", () => {
			const chunks = wordWrapLine("Lorem ipsum dolor sit amet,                         consectetur", 30);

			assert.strictEqual(chunks.length, 3);
			assert.strictEqual(chunks[0]!.text, "Lorem ipsum dolor sit ");
			assert.strictEqual(chunks[1]!.text, "amet,                         ");
			assert.strictEqual(chunks[2]!.text, "consectetur");
		});

		it("breaks long whitespace at line boundary 2", () => {
			const chunks = wordWrapLine("Lorem ipsum dolor sit amet,                          consectetur", 30);

			assert.strictEqual(chunks.length, 3);
			assert.strictEqual(chunks[0]!.text, "Lorem ipsum dolor sit ");
			assert.strictEqual(chunks[1]!.text, "amet,                         ");
			assert.strictEqual(chunks[2]!.text, " consectetur");
		});

		it("breaks whitespace spanning full lines", () => {
			const chunks = wordWrapLine("Lorem ipsum dolor sit amet,                                     consectetur", 30);

			assert.strictEqual(chunks.length, 3);
			assert.strictEqual(chunks[0]!.text, "Lorem ipsum dolor sit ");
			assert.strictEqual(chunks[1]!.text, "amet,                         ");
			assert.strictEqual(chunks[2]!.text, "            consectetur");
		});

		it("force-breaks when wide char after word boundary wrap still overflows", () => {
			// " " (1) + "a"*186 (186) + "你" (2) = 189 visible width
			// " "（1）+ "a" 重复 186 次（186）+ "你"（2）= 可见宽度 189
			// maxWidth = 187: backtracking to the space would leave 186 + 2 = 188 > 187,
			// maxWidth = 187：回溯到空格处会剩下 186 + 2 = 188 > 187，
			// so the algorithm must force-break before the wide char instead.
			// 因此算法必须改为在该宽字符之前强制断行。
			const line = ` ${"a".repeat(186)}你`;
			const chunks = wordWrapLine(line, 187);

			for (const chunk of chunks) {
				assert.ok(
					visibleWidth(chunk.text) <= 187,
					`chunk "${chunk.text.slice(0, 20)}..." has visible width ${visibleWidth(chunk.text)}, expected <= 187`,
				);
			}
			// Verify no content is lost
			// 验证没有内容丢失
			const reconstructed = chunks.map((c) => line.slice(c.startIndex, c.endIndex)).join("");
			assert.strictEqual(reconstructed, line);
		});

		it("splits oversized atomic segment across multiple chunks", () => {
			// Simulate a paste marker wider than maxWidth by passing pre-segmented data
			// 通过传入预先分段（pre-segmented）的数据，模拟一个宽度超过 maxWidth 的粘贴标记（paste marker）
			const marker = "[paste #1 +20 lines]"; // 21 chars
			// 21 个字符
			const line = `A${marker}B`;
			const segments: Intl.SegmentData[] = [
				{ segment: "A", index: 0, input: line },
				{ segment: marker, index: 1, input: line },
				{ segment: "B", index: 1 + marker.length, input: line },
			];

			const chunks = wordWrapLine(line, 10, segments);

			// Every chunk must fit within maxWidth
			// 每个分块（chunk）都必须适配 maxWidth
			for (const chunk of chunks) {
				assert.ok(
					visibleWidth(chunk.text) <= 10,
					`chunk "${chunk.text}" has visible width ${visibleWidth(chunk.text)}, expected <= 10`,
				);
			}

			// Verify no content is lost
			// 验证没有内容丢失
			const reconstructed = chunks.map((c) => line.slice(c.startIndex, c.endIndex)).join("");
			assert.strictEqual(reconstructed, line);
		});

		it("splits oversized atomic segment at start of line", () => {
			const marker = "[paste #1 +20 lines]"; // 21 chars
			// 21 个字符
			const line = `${marker}B`;
			const segments: Intl.SegmentData[] = [
				{ segment: marker, index: 0, input: line },
				{ segment: "B", index: marker.length, input: line },
			];

			const chunks = wordWrapLine(line, 10, segments);

			for (const chunk of chunks) {
				assert.ok(visibleWidth(chunk.text) <= 10);
			}
			// "B" ends up on the last line (either alone or with the marker tail)
			// "B" 最终会落在最后一行（单独占一行，或与标记（marker）的尾部同行）
			assert.strictEqual(chunks[chunks.length - 1]!.text.includes("B"), true);

			const reconstructed = chunks.map((c) => line.slice(c.startIndex, c.endIndex)).join("");
			assert.strictEqual(reconstructed, line);
		});

		it("splits oversized atomic segment at end of line", () => {
			const marker = "[paste #1 +20 lines]"; // 21 chars
			// 21 个字符
			const line = `A${marker}`;
			const segments: Intl.SegmentData[] = [
				{ segment: "A", index: 0, input: line },
				{ segment: marker, index: 1, input: line },
			];

			const chunks = wordWrapLine(line, 10, segments);

			for (const chunk of chunks) {
				assert.ok(visibleWidth(chunk.text) <= 10);
			}
			assert.strictEqual(chunks[0]!.text, "A");

			const reconstructed = chunks.map((c) => line.slice(c.startIndex, c.endIndex)).join("");
			assert.strictEqual(reconstructed, line);
		});

		it("splits consecutive oversized atomic segments", () => {
			const m1 = "[paste #1 +20 lines]"; // 21 chars
			// 21 个字符
			const m2 = "[paste #2 +30 lines]"; // 21 chars
			// 21 个字符
			const line = `${m1}${m2}`;
			const segments: Intl.SegmentData[] = [
				{ segment: m1, index: 0, input: line },
				{ segment: m2, index: m1.length, input: line },
			];

			const chunks = wordWrapLine(line, 10, segments);

			for (const chunk of chunks) {
				assert.ok(
					visibleWidth(chunk.text) <= 10,
					`chunk "${chunk.text}" has visible width ${visibleWidth(chunk.text)}, expected <= 10`,
				);
			}

			const reconstructed = chunks.map((c) => line.slice(c.startIndex, c.endIndex)).join("");
			assert.strictEqual(reconstructed, line);
		});

		it("wraps normally after oversized atomic segment", () => {
			const marker = "[paste #1 +20 lines]"; // 21 chars
			// 21 个字符
			const line = `${marker} hello world`;
			const segments: Intl.SegmentData[] = [
				{ segment: marker, index: 0, input: line },
				{ segment: " ", index: marker.length, input: line },
				{ segment: "h", index: marker.length + 1, input: line },
				{ segment: "e", index: marker.length + 2, input: line },
				{ segment: "l", index: marker.length + 3, input: line },
				{ segment: "l", index: marker.length + 4, input: line },
				{ segment: "o", index: marker.length + 5, input: line },
				{ segment: " ", index: marker.length + 6, input: line },
				{ segment: "w", index: marker.length + 7, input: line },
				{ segment: "o", index: marker.length + 8, input: line },
				{ segment: "r", index: marker.length + 9, input: line },
				{ segment: "l", index: marker.length + 10, input: line },
				{ segment: "d", index: marker.length + 11, input: line },
			];

			const chunks = wordWrapLine(line, 10, segments);

			// All chunks must fit
			// 所有分块（chunk）都必须放得下
			for (const chunk of chunks) {
				assert.ok(
					visibleWidth(chunk.text) <= 10,
					`chunk "${chunk.text}" has visible width ${visibleWidth(chunk.text)}, expected <= 10`,
				);
			}

			// Last chunk should contain "world" (normal wrapping resumes)
			// 最后一个分块应当包含 "world"（恢复为正常换行）
			assert.strictEqual(chunks[chunks.length - 1]!.text, "world");

			const reconstructed = chunks.map((c) => line.slice(c.startIndex, c.endIndex)).join("");
			assert.strictEqual(reconstructed, line);
		});
	});

	describe("Kill ring", () => {
		it("Ctrl+W saves deleted text to kill ring and Ctrl+Y yanks it", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("foo bar baz");
			editor.handleInput("\x17"); // Ctrl+W - deletes "baz"
			// Ctrl+W —— 删除 "baz"
			assert.strictEqual(editor.getText(), "foo bar ");

			// Move to beginning and yank
			// 移动到开头并粘贴（yank）
			editor.handleInput("\x01"); // Ctrl+A
			// Ctrl+A（移动到开头）
			editor.handleInput("\x19"); // Ctrl+Y
			// Ctrl+Y（粘贴 / yank）
			assert.strictEqual(editor.getText(), "bazfoo bar ");
		});

		it("Ctrl+U saves deleted text to kill ring", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("hello world");
			// Move cursor to middle
			// 将光标移动到中间
			editor.handleInput("\x01"); // Ctrl+A (start)
			// Ctrl+A（开头）
			editor.handleInput("\x1b[C"); // Right 5 times
			// 右箭头 5 次
			editor.handleInput("\x1b[C");
			editor.handleInput("\x1b[C");
			editor.handleInput("\x1b[C");
			editor.handleInput("\x1b[C");
			editor.handleInput("\x1b[C"); // After "hello "
			// 位于 "hello " 之后

			editor.handleInput("\x15"); // Ctrl+U - deletes "hello "
			// Ctrl+U —— 删除 "hello "
			assert.strictEqual(editor.getText(), "world");

			editor.handleInput("\x19"); // Ctrl+Y
			// Ctrl+Y（粘贴 / yank）
			assert.strictEqual(editor.getText(), "hello world");
		});

		it("Ctrl+K saves deleted text to kill ring", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("hello world");
			editor.handleInput("\x01"); // Ctrl+A (start)
			// Ctrl+A（开头）
			editor.handleInput("\x0b"); // Ctrl+K - deletes "hello world"
			// Ctrl+K —— 删除 "hello world"

			assert.strictEqual(editor.getText(), "");

			editor.handleInput("\x19"); // Ctrl+Y
			// Ctrl+Y（粘贴 / yank）
			assert.strictEqual(editor.getText(), "hello world");
		});

		it("Ctrl+Y does nothing when kill ring is empty", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("test");
			editor.handleInput("\x19"); // Ctrl+Y
			// Ctrl+Y（粘贴 / yank）
			assert.strictEqual(editor.getText(), "test");
		});

		it("Alt+Y cycles through kill ring after Ctrl+Y", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			// Create kill ring with multiple entries
			// 构造一个包含多个条目的 kill ring（删除环）
			editor.setText("first");
			editor.handleInput("\x17"); // Ctrl+W - deletes "first"
			// Ctrl+W —— 删除 "first"
			editor.setText("second");
			editor.handleInput("\x17"); // Ctrl+W - deletes "second"
			// Ctrl+W —— 删除 "second"
			editor.setText("third");
			editor.handleInput("\x17"); // Ctrl+W - deletes "third"
			// Ctrl+W —— 删除 "third"

			// Kill ring now has: [first, second, third]
			// 此时 kill ring 中包含：[first, second, third]
			assert.strictEqual(editor.getText(), "");

			editor.handleInput("\x19"); // Ctrl+Y - yanks "third" (most recent)
			// Ctrl+Y —— 粘贴（yank）"third"（最近的一条）
			assert.strictEqual(editor.getText(), "third");

			editor.handleInput("\x1by"); // Alt+Y - cycles to "second"
			// Alt+Y —— 循环切换到 "second"
			assert.strictEqual(editor.getText(), "second");

			editor.handleInput("\x1by"); // Alt+Y - cycles to "first"
			// Alt+Y —— 循环切换到 "first"
			assert.strictEqual(editor.getText(), "first");

			editor.handleInput("\x1by"); // Alt+Y - cycles back to "third"
			// Alt+Y —— 循环回到 "third"
			assert.strictEqual(editor.getText(), "third");
		});

		it("Alt+Y does nothing if not preceded by yank", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("test");
			editor.handleInput("\x17"); // Ctrl+W - deletes "test"
			// Ctrl+W —— 删除 "test"
			editor.setText("other");

			// Type something to break the yank chain
			// 输入一些内容以打断 yank（粘贴）链
			editor.handleInput("x");
			assert.strictEqual(editor.getText(), "otherx");

			// Alt+Y should do nothing
			// Alt+Y 应当不产生任何效果
			editor.handleInput("\x1by"); // Alt+Y
			// Alt+Y（粘贴回溯 / yank-pop）
			assert.strictEqual(editor.getText(), "otherx");
		});

		it("Alt+Y does nothing if kill ring has ≤1 entry", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("only");
			editor.handleInput("\x17"); // Ctrl+W - deletes "only"
			// Ctrl+W —— 删除 "only"

			editor.handleInput("\x19"); // Ctrl+Y - yanks "only"
			// Ctrl+Y —— 粘贴（yank）"only"
			assert.strictEqual(editor.getText(), "only");

			editor.handleInput("\x1by"); // Alt+Y - should do nothing (only 1 entry)
			// Alt+Y —— 应当不产生任何效果（只有 1 个条目）
			assert.strictEqual(editor.getText(), "only");
		});

		it("consecutive Ctrl+W accumulates into one kill ring entry", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("one two three");
			editor.handleInput("\x17"); // Ctrl+W - deletes "three"
			// Ctrl+W —— 删除 "three"
			editor.handleInput("\x17"); // Ctrl+W - deletes "two " (prepended)
			// Ctrl+W —— 删除 "two "（前置追加到已有内容之前）
			editor.handleInput("\x17"); // Ctrl+W - deletes "one " (prepended)
			// Ctrl+W —— 删除 "one "（前置追加到已有内容之前）

			assert.strictEqual(editor.getText(), "");

			// Should be one combined entry
			// 应当合并为一个条目
			editor.handleInput("\x19"); // Ctrl+Y
			// Ctrl+Y（粘贴 / yank）
			assert.strictEqual(editor.getText(), "one two three");
		});

		it("Ctrl+U accumulates multiline deletes including newlines", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			// Start with multiline text, cursor at end
			// 以多行文本作为起点，光标位于末尾
			editor.setText("line1\nline2\nline3");
			// Cursor is at end of line3 (line 2, col 5)
			// 光标位于 line3 的末尾（第 2 行，第 5 列）

			// Delete "line3"
			// 删除 "line3"
			editor.handleInput("\x15"); // Ctrl+U
			// Ctrl+U（删除到行首）
			assert.strictEqual(editor.getText(), "line1\nline2\n");

			// Delete newline (at start of empty line 2, merges with line1)
			// 删除换行符（位于空的第 2 行开头，与 line1 合并）
			editor.handleInput("\x15"); // Ctrl+U
			// Ctrl+U（删除到行首）
			assert.strictEqual(editor.getText(), "line1\nline2");

			// Delete "line2"
			// 删除 "line2"
			editor.handleInput("\x15"); // Ctrl+U
			// Ctrl+U（删除到行首）
			assert.strictEqual(editor.getText(), "line1\n");

			// Delete newline
			// 删除换行符
			editor.handleInput("\x15"); // Ctrl+U
			// Ctrl+U（删除到行首）
			assert.strictEqual(editor.getText(), "line1");

			// Delete "line1"
			// 删除 "line1"
			editor.handleInput("\x15"); // Ctrl+U
			// Ctrl+U（删除到行首）
			assert.strictEqual(editor.getText(), "");

			// All deletions accumulated into one entry: "line1\nline2\nline3"
			// 所有删除操作累积成一个条目："line1\nline2\nline3"
			editor.handleInput("\x19"); // Ctrl+Y
			// Ctrl+Y（粘贴 / yank）
			assert.strictEqual(editor.getText(), "line1\nline2\nline3");
		});

		it("backward deletions prepend, forward deletions append during accumulation", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("prefix|suffix");
			// Position cursor at |
			// 将光标定位到 | 处
			editor.handleInput("\x01"); // Ctrl+A
			// Ctrl+A（移动到开头）
			for (let i = 0; i < 6; i++) editor.handleInput("\x1b[C"); // Move right 6 times
			// 向右移动 6 次

			editor.handleInput("\x0b"); // Ctrl+K - deletes "suffix" (forward)
			// Ctrl+K —— 删除 "suffix"（向前删除）
			editor.handleInput("\x0b"); // Ctrl+K - deletes "|" (forward, appended)
			// Ctrl+K —— 删除 "|"（向前删除，追加到已有内容之后）
			assert.strictEqual(editor.getText(), "prefix");

			editor.handleInput("\x19"); // Ctrl+Y
			// Ctrl+Y（粘贴 / yank）
			assert.strictEqual(editor.getText(), "prefix|suffix");
		});

		it("non-delete actions break kill accumulation", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			// Delete "baz", then type "x" to break accumulation, then delete "x"
			// 先删除 "baz"，再输入 "x" 以打断累积，然后删除 "x"
			editor.setText("foo bar baz");
			editor.handleInput("\x17"); // Ctrl+W - deletes "baz"
			// Ctrl+W —— 删除 "baz"
			assert.strictEqual(editor.getText(), "foo bar ");

			editor.handleInput("x"); // Typing breaks accumulation
			// 输入字符会打断累积
			assert.strictEqual(editor.getText(), "foo bar x");

			editor.handleInput("\x17"); // Ctrl+W - deletes "x" (separate entry, not accumulated)
			// Ctrl+W —— 删除 "x"（作为独立条目，不参与累积）
			assert.strictEqual(editor.getText(), "foo bar ");

			// Yank most recent - should be "x", not "xbaz"
			// 粘贴（yank）最近的一条 —— 应当是 "x"，而不是 "xbaz"
			editor.handleInput("\x19"); // Ctrl+Y
			// Ctrl+Y（粘贴 / yank）
			assert.strictEqual(editor.getText(), "foo bar x");

			// Cycle to previous - should be "baz" (separate entry)
			// 循环切换到上一条 —— 应当是 "baz"（独立条目）
			editor.handleInput("\x1by"); // Alt+Y
			// Alt+Y（粘贴回溯 / yank-pop）
			assert.strictEqual(editor.getText(), "foo bar baz");
		});

		it("non-yank actions break Alt+Y chain", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("first");
			editor.handleInput("\x17"); // Ctrl+W
			// Ctrl+W（向前删除单词）
			editor.setText("second");
			editor.handleInput("\x17"); // Ctrl+W
			// Ctrl+W（向前删除单词）
			editor.setText("");

			editor.handleInput("\x19"); // Ctrl+Y - yanks "second"
			// Ctrl+Y —— 粘贴（yank）"second"
			assert.strictEqual(editor.getText(), "second");

			editor.handleInput("x"); // Type breaks yank chain
			// 输入字符会打断 yank（粘贴）链
			assert.strictEqual(editor.getText(), "secondx");

			editor.handleInput("\x1by"); // Alt+Y - should do nothing
			// Alt+Y —— 应当不产生任何效果
			assert.strictEqual(editor.getText(), "secondx");
		});

		it("kill ring rotation persists after cycling", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("first");
			editor.handleInput("\x17"); // deletes "first"
			// 删除 "first"
			editor.setText("second");
			editor.handleInput("\x17"); // deletes "second"
			// 删除 "second"
			editor.setText("third");
			editor.handleInput("\x17"); // deletes "third"
			// 删除 "third"
			editor.setText("");

			// Ring: [first, second, third]
			// 环（ring）内容：[first, second, third]

			editor.handleInput("\x19"); // Ctrl+Y - yanks "third"
			// Ctrl+Y —— 粘贴（yank）"third"
			editor.handleInput("\x1by"); // Alt+Y - cycles to "second", ring rotates
			// Alt+Y —— 循环切换到 "second"，环随之轮转

			// Now ring is: [third, first, second]
			// 此时环的内容为：[third, first, second]
			assert.strictEqual(editor.getText(), "second");

			// Do something else
			// 执行其他操作
			editor.handleInput("x");
			editor.setText("");

			// New yank should get "second" (now at end after rotation)
			// 新的一次粘贴（yank）应当取到 "second"（轮转后它位于末尾）
			editor.handleInput("\x19"); // Ctrl+Y
			// Ctrl+Y（粘贴 / yank）
			assert.strictEqual(editor.getText(), "second");
		});

		it("consecutive deletions across lines coalesce into one entry", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			// "1\n2\n3" with cursor at end, delete everything with Ctrl+W
			// 文本为 "1\n2\n3"，光标位于末尾，用 Ctrl+W 删除全部内容
			editor.setText("1\n2\n3");
			editor.handleInput("\x17"); // Ctrl+W - deletes "3"
			// Ctrl+W —— 删除 "3"
			assert.strictEqual(editor.getText(), "1\n2\n");

			editor.handleInput("\x17"); // Ctrl+W - deletes newline (merge with prev line)
			// Ctrl+W —— 删除换行符（与上一行合并）
			assert.strictEqual(editor.getText(), "1\n2");

			editor.handleInput("\x17"); // Ctrl+W - deletes "2"
			// Ctrl+W —— 删除 "2"
			assert.strictEqual(editor.getText(), "1\n");

			editor.handleInput("\x17"); // Ctrl+W - deletes newline
			// Ctrl+W —— 删除换行符
			assert.strictEqual(editor.getText(), "1");

			editor.handleInput("\x17"); // Ctrl+W - deletes "1"
			// Ctrl+W —— 删除 "1"
			assert.strictEqual(editor.getText(), "");

			// All deletions should have accumulated into one entry
			// 所有删除操作都应当累积为一个条目
			editor.handleInput("\x19"); // Ctrl+Y
			// Ctrl+Y（粘贴 / yank）
			assert.strictEqual(editor.getText(), "1\n2\n3");
		});

		it("Ctrl+K at line end deletes newline and coalesces", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			// "ab" on line 1, "cd" on line 2, cursor at end of line 1
			// 第 1 行是 "ab"，第 2 行是 "cd"，光标位于第 1 行末尾
			editor.setText("");
			editor.handleInput("a");
			editor.handleInput("b");
			editor.handleInput("\n");
			editor.handleInput("c");
			editor.handleInput("d");
			// Move to end of first line
			// 移动到第一行的末尾
			editor.handleInput("\x1b[A"); // Up arrow
			// 上箭头
			editor.handleInput("\x05"); // Ctrl+E - end of line
			// Ctrl+E —— 行末

			// Now at end of "ab", Ctrl+K should delete newline (merge with "cd")
			// 此时位于 "ab" 的末尾，Ctrl+K 应当删除换行符（与 "cd" 合并）
			editor.handleInput("\x0b"); // Ctrl+K - deletes newline
			// Ctrl+K —— 删除换行符
			assert.strictEqual(editor.getText(), "abcd");

			// Continue deleting
			// 继续删除
			editor.handleInput("\x0b"); // Ctrl+K - deletes "cd"
			// Ctrl+K —— 删除 "cd"
			assert.strictEqual(editor.getText(), "ab");

			// Both deletions should accumulate
			// 两次删除操作都应当被累积
			editor.handleInput("\x19"); // Ctrl+Y
			// Ctrl+Y（粘贴 / yank）
			assert.strictEqual(editor.getText(), "ab\ncd");
		});

		it("handles yank in middle of text", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("word");
			editor.handleInput("\x17"); // Ctrl+W - deletes "word"
			// Ctrl+W —— 删除 "word"
			editor.setText("hello world");

			// Move to middle (after "hello ")
			// 移动到中间（"hello " 之后）
			editor.handleInput("\x01"); // Ctrl+A
			// Ctrl+A（移动到开头）
			for (let i = 0; i < 6; i++) editor.handleInput("\x1b[C");

			editor.handleInput("\x19"); // Ctrl+Y
			// Ctrl+Y（粘贴 / yank）
			assert.strictEqual(editor.getText(), "hello wordworld");
		});

		it("handles yank-pop in middle of text", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			// Create two kill ring entries
			// 创建两个 kill ring（删除环）条目
			editor.setText("FIRST");
			editor.handleInput("\x17"); // Ctrl+W - deletes "FIRST"
			// Ctrl+W —— 删除 "FIRST"
			editor.setText("SECOND");
			editor.handleInput("\x17"); // Ctrl+W - deletes "SECOND"
			// Ctrl+W —— 删除 "SECOND"

			// Ring: ["FIRST", "SECOND"]
			// 环（ring）内容：["FIRST", "SECOND"]

			// Set up "hello world" and position cursor after "hello "
			// 设置文本为 "hello world" 并将光标定位到 "hello " 之后
			editor.setText("hello world");
			editor.handleInput("\x01"); // Ctrl+A - go to start of line
			// Ctrl+A —— 跳到行首
			for (let i = 0; i < 6; i++) editor.handleInput("\x1b[C"); // Move right 6
			// 向右移动 6 次

			// Yank "SECOND" in the middle
			// 在中间位置粘贴（yank）"SECOND"
			editor.handleInput("\x19"); // Ctrl+Y
			// Ctrl+Y（粘贴 / yank）
			assert.strictEqual(editor.getText(), "hello SECONDworld");

			// Yank-pop replaces "SECOND" with "FIRST"
			// yank-pop（粘贴回溯）用 "FIRST" 替换 "SECOND"
			editor.handleInput("\x1by"); // Alt+Y
			// Alt+Y（粘贴回溯 / yank-pop）
			assert.strictEqual(editor.getText(), "hello FIRSTworld");
		});

		it("multiline yank and yank-pop in middle of text", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			// Create single-line entry
			// 创建一个单行条目
			editor.setText("SINGLE");
			editor.handleInput("\x17"); // Ctrl+W - deletes "SINGLE"
			// Ctrl+W —— 删除 "SINGLE"

			// Create multiline entry via consecutive Ctrl+U
			// 通过连续按 Ctrl+U 创建一个多行条目
			editor.setText("A\nB");
			editor.handleInput("\x15"); // Ctrl+U - deletes "B"
			// Ctrl+U —— 删除 "B"
			editor.handleInput("\x15"); // Ctrl+U - deletes newline
			// Ctrl+U —— 删除换行符
			editor.handleInput("\x15"); // Ctrl+U - deletes "A"
			// Ctrl+U —— 删除 "A"
			// Ring: ["SINGLE", "A\nB"]
			// 环（ring）内容：["SINGLE", "A\nB"]

			// Insert in middle of "hello world"
			// 在 "hello world" 的中间插入
			editor.setText("hello world");
			editor.handleInput("\x01"); // Ctrl+A
			// Ctrl+A（移动到开头）
			for (let i = 0; i < 6; i++) editor.handleInput("\x1b[C");

			// Yank multiline "A\nB"
			// 粘贴（yank）多行内容 "A\nB"
			editor.handleInput("\x19"); // Ctrl+Y
			// Ctrl+Y（粘贴 / yank）
			assert.strictEqual(editor.getText(), "hello A\nBworld");

			// Yank-pop replaces with "SINGLE"
			// yank-pop（粘贴回溯）将其替换为 "SINGLE"
			editor.handleInput("\x1by"); // Alt+Y
			// Alt+Y（粘贴回溯 / yank-pop）
			assert.strictEqual(editor.getText(), "hello SINGLEworld");
		});

		it("Alt+D deletes word forward and saves to kill ring", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("hello world test");
			editor.handleInput("\x01"); // Ctrl+A - go to start
			// Ctrl+A —— 跳到开头

			editor.handleInput("\x1bd"); // Alt+D - deletes "hello"
			// Alt+D —— 删除 "hello"
			assert.strictEqual(editor.getText(), " world test");

			editor.handleInput("\x1bd"); // Alt+D - deletes " world" (skips whitespace, then word)
			// Alt+D —— 删除 " world"（先跳过空白字符，再删除单词）
			assert.strictEqual(editor.getText(), " test");

			// Yank should get accumulated text
			// 粘贴（yank）应当取到累积后的文本
			editor.handleInput("\x19"); // Ctrl+Y
			// Ctrl+Y（粘贴 / yank）
			assert.strictEqual(editor.getText(), "hello world test");
		});

		it("Alt+D at end of line deletes newline", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("line1\nline2");
			// Move to start of document, then to end of first line
			// 先移动到文档开头，再移动到第一行的末尾
			editor.handleInput("\x1b[A"); // Up arrow - go to first line
			// 上箭头 —— 跳到第一行
			editor.handleInput("\x05"); // Ctrl+E - end of line
			// Ctrl+E —— 行末

			editor.handleInput("\x1bd"); // Alt+D - deletes newline (merges lines)
			// Alt+D —— 删除换行符（合并两行）
			assert.strictEqual(editor.getText(), "line1line2");

			editor.handleInput("\x19"); // Ctrl+Y
			// Ctrl+Y（粘贴 / yank）
			assert.strictEqual(editor.getText(), "line1\nline2");
		});
	});

	describe("Undo", () => {
		it("does nothing when undo stack is empty", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.handleInput("\x1b[45;5u"); // Ctrl+- (undo)
			// Ctrl+-（撤销）
			assert.strictEqual(editor.getText(), "");
		});

		it("coalesces consecutive word characters into one undo unit", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.handleInput("h");
			editor.handleInput("e");
			editor.handleInput("l");
			editor.handleInput("l");
			editor.handleInput("o");
			editor.handleInput(" ");
			editor.handleInput("w");
			editor.handleInput("o");
			editor.handleInput("r");
			editor.handleInput("l");
			editor.handleInput("d");
			assert.strictEqual(editor.getText(), "hello world");

			// Undo removes " world" (space captured state before it, so we restore to "hello")
			// 撤销会移除 " world"（空格在其之前捕获了状态，因此恢复到 "hello"）
			editor.handleInput("\x1b[45;5u"); // Ctrl+- (undo)
			// Ctrl+-（撤销）
			assert.strictEqual(editor.getText(), "hello");

			// Undo removes "hello"
			// 撤销会移除 "hello"
			editor.handleInput("\x1b[45;5u"); // Ctrl+- (undo)
			// Ctrl+-（撤销）
			assert.strictEqual(editor.getText(), "");
		});

		it("undoes spaces one at a time", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.handleInput("h");
			editor.handleInput("e");
			editor.handleInput("l");
			editor.handleInput("l");
			editor.handleInput("o");
			editor.handleInput(" ");
			editor.handleInput(" ");
			assert.strictEqual(editor.getText(), "hello  ");

			editor.handleInput("\x1b[45;5u"); // Ctrl+- (undo) - removes second " "
			// Ctrl+-（撤销）—— 移除第二个 " "
			assert.strictEqual(editor.getText(), "hello ");

			editor.handleInput("\x1b[45;5u"); // Ctrl+- (undo) - removes first " "
			// Ctrl+-（撤销）—— 移除第一个 " "
			assert.strictEqual(editor.getText(), "hello");

			editor.handleInput("\x1b[45;5u"); // Ctrl+- (undo) - removes "hello"
			// Ctrl+-（撤销）—— 移除 "hello"
			assert.strictEqual(editor.getText(), "");
		});

		it("undoes newlines and signals next word to capture state", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.handleInput("h");
			editor.handleInput("e");
			editor.handleInput("l");
			editor.handleInput("l");
			editor.handleInput("o");
			editor.handleInput("\n");
			editor.handleInput("w");
			editor.handleInput("o");
			editor.handleInput("r");
			editor.handleInput("l");
			editor.handleInput("d");
			assert.strictEqual(editor.getText(), "hello\nworld");

			editor.handleInput("\x1b[45;5u"); // Ctrl+- (undo)
			// Ctrl+-（撤销）
			assert.strictEqual(editor.getText(), "hello\n");

			editor.handleInput("\x1b[45;5u"); // Ctrl+- (undo)
			// Ctrl+-（撤销）
			assert.strictEqual(editor.getText(), "hello");

			editor.handleInput("\x1b[45;5u"); // Ctrl+- (undo)
			// Ctrl+-（撤销）
			assert.strictEqual(editor.getText(), "");
		});

		it("undoes backspace", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.handleInput("h");
			editor.handleInput("e");
			editor.handleInput("l");
			editor.handleInput("l");
			editor.handleInput("o");
			editor.handleInput("\x7f"); // Backspace
			// 退格键（Backspace）
			assert.strictEqual(editor.getText(), "hell");

			editor.handleInput("\x1b[45;5u"); // Ctrl+- (undo)
			// Ctrl+-（撤销）
			assert.strictEqual(editor.getText(), "hello");
		});

		it("undoes forward delete", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.handleInput("h");
			editor.handleInput("e");
			editor.handleInput("l");
			editor.handleInput("l");
			editor.handleInput("o");
			editor.handleInput("\x01"); // Ctrl+A - go to start
			// Ctrl+A —— 跳到开头
			editor.handleInput("\x1b[C"); // Right arrow
			// 右箭头
			editor.handleInput("\x1b[3~"); // Delete key
			// Delete 键
			assert.strictEqual(editor.getText(), "hllo");

			editor.handleInput("\x1b[45;5u"); // Ctrl+- (undo)
			// Ctrl+-（撤销）
			assert.strictEqual(editor.getText(), "hello");
		});

		it("undoes Ctrl+W (delete word backward)", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.handleInput("h");
			editor.handleInput("e");
			editor.handleInput("l");
			editor.handleInput("l");
			editor.handleInput("o");
			editor.handleInput(" ");
			editor.handleInput("w");
			editor.handleInput("o");
			editor.handleInput("r");
			editor.handleInput("l");
			editor.handleInput("d");
			assert.strictEqual(editor.getText(), "hello world");

			editor.handleInput("\x17"); // Ctrl+W
			// Ctrl+W（向前删除单词）
			assert.strictEqual(editor.getText(), "hello ");

			editor.handleInput("\x1b[45;5u"); // Ctrl+- (undo)
			// Ctrl+-（撤销）
			assert.strictEqual(editor.getText(), "hello world");
		});

		it("undoes Ctrl+K (delete to line end)", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.handleInput("h");
			editor.handleInput("e");
			editor.handleInput("l");
			editor.handleInput("l");
			editor.handleInput("o");
			editor.handleInput(" ");
			editor.handleInput("w");
			editor.handleInput("o");
			editor.handleInput("r");
			editor.handleInput("l");
			editor.handleInput("d");
			editor.handleInput("\x01"); // Ctrl+A - go to start
			// Ctrl+A —— 跳到开头
			for (let i = 0; i < 6; i++) editor.handleInput("\x1b[C"); // Move right 6 times
			// 向右移动 6 次

			editor.handleInput("\x0b"); // Ctrl+K
			// Ctrl+K（删除到行末）
			assert.strictEqual(editor.getText(), "hello ");

			editor.handleInput("\x1b[45;5u"); // Ctrl+- (undo)
			// Ctrl+-（撤销）
			assert.strictEqual(editor.getText(), "hello world");

			editor.handleInput("|");
			assert.strictEqual(editor.getText(), "hello |world");
		});

		it("undoes Ctrl+U (delete to line start)", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.handleInput("h");
			editor.handleInput("e");
			editor.handleInput("l");
			editor.handleInput("l");
			editor.handleInput("o");
			editor.handleInput(" ");
			editor.handleInput("w");
			editor.handleInput("o");
			editor.handleInput("r");
			editor.handleInput("l");
			editor.handleInput("d");
			editor.handleInput("\x01"); // Ctrl+A - go to start
			// Ctrl+A —— 跳到开头
			for (let i = 0; i < 6; i++) editor.handleInput("\x1b[C"); // Move right 6 times
			// 向右移动 6 次

			editor.handleInput("\x15"); // Ctrl+U
			// Ctrl+U（删除到行首）
			assert.strictEqual(editor.getText(), "world");

			editor.handleInput("\x1b[45;5u"); // Ctrl+- (undo)
			// Ctrl+-（撤销）
			assert.strictEqual(editor.getText(), "hello world");
		});

		it("undoes yank", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.handleInput("h");
			editor.handleInput("e");
			editor.handleInput("l");
			editor.handleInput("l");
			editor.handleInput("o");
			editor.handleInput(" ");
			editor.handleInput("\x17"); // Ctrl+W - delete "hello "
			// Ctrl+W —— 删除 "hello "
			editor.handleInput("\x19"); // Ctrl+Y - yank
			// Ctrl+Y —— 粘贴（yank）
			assert.strictEqual(editor.getText(), "hello ");

			editor.handleInput("\x1b[45;5u"); // Ctrl+- (undo)
			// Ctrl+-（撤销）
			assert.strictEqual(editor.getText(), "");
		});

		it("undoes single-line paste atomically", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("hello world");
			editor.handleInput("\x01"); // Ctrl+A - go to start
			// Ctrl+A —— 跳到开头
			for (let i = 0; i < 5; i++) editor.handleInput("\x1b[C"); // Move right 5 (after "hello", before space)
			// 向右移动 5 次（位于 "hello" 之后、空格之前）

			// Simulate bracketed paste of "beep boop"
			// 模拟对 "beep boop" 的括号粘贴（bracketed paste）
			editor.handleInput("\x1b[200~beep boop\x1b[201~");
			assert.strictEqual(editor.getText(), "hellobeep boop world");

			// Single undo should restore entire pre-paste state
			// 一次撤销应当恢复到粘贴之前的完整状态
			editor.handleInput("\x1b[45;5u"); // Ctrl+- (undo)
			// Ctrl+-（撤销）
			assert.strictEqual(editor.getText(), "hello world");

			editor.handleInput("|");
			assert.strictEqual(editor.getText(), "hello| world");
		});

		it("does not trigger autocomplete during single-line paste", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);
			let suggestionCalls = 0;

			const mockProvider: AutocompleteProvider = {
				getSuggestions: async () => {
					suggestionCalls += 1;
					return null;
				},
				applyCompletion,
			};

			editor.setAutocompleteProvider(mockProvider);
			editor.handleInput("\x1b[200~look at @node_modules/react/index.js please\x1b[201~");

			assert.strictEqual(editor.getText(), "look at @node_modules/react/index.js please");
			assert.strictEqual(suggestionCalls, 0);
			assert.strictEqual(editor.isShowingAutocomplete(), false);
		});

		it("decodes CSI-u Ctrl+letter sequences inside bracketed paste (tmux popup)", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			// tmux popups with extended-keys-format=csi-u re-encode \n in pastes as
			// 启用 extended-keys-format=csi-u 的 tmux 弹窗会把粘贴内容中的 \n 重新编码为
			// \x1b[106;5u (Ctrl+J). Without decoding, the per-char filter strips ESC
			// \x1b[106;5u（Ctrl+J）。若不解码，逐字符过滤器会剥离 ESC
			// and leaks "[106;5u" between lines. See issue #3599.
			// 并在行与行之间漏出 "[106;5u"。参见 issue #3599。
			editor.handleInput("\x1b[200~line1\x1b[106;5uline2\x1b[106;5uline3\x1b[201~");
			assert.strictEqual(editor.getText(), "line1\nline2\nline3");
		});

		it("undoes multi-line paste atomically", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("hello world");
			editor.handleInput("\x01"); // Ctrl+A - go to start
			// Ctrl+A —— 跳到开头
			for (let i = 0; i < 5; i++) editor.handleInput("\x1b[C"); // Move right 5 (after "hello", before space)
			// 向右移动 5 次（位于 "hello" 之后、空格之前）

			// Simulate bracketed paste of multi-line text
			// 模拟多行文本的括号粘贴（bracketed paste）
			editor.handleInput("\x1b[200~line1\nline2\nline3\x1b[201~");
			assert.strictEqual(editor.getText(), "helloline1\nline2\nline3 world");

			// Single undo should restore entire pre-paste state
			// 一次撤销应当恢复到粘贴之前的完整状态
			editor.handleInput("\x1b[45;5u"); // Ctrl+- (undo)
			// Ctrl+-（撤销）
			assert.strictEqual(editor.getText(), "hello world");

			editor.handleInput("|");
			assert.strictEqual(editor.getText(), "hello| world");
		});

		it("undoes insertTextAtCursor atomically", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("hello world");
			editor.handleInput("\x01"); // Ctrl+A - go to start
			// Ctrl+A —— 跳到开头
			for (let i = 0; i < 5; i++) editor.handleInput("\x1b[C"); // Move right 5 (after "hello", before space)
			// 向右移动 5 次（位于 "hello" 之后、空格之前）

			// Programmatic insertion (e.g., clipboard image path)
			// 程序化插入（例如剪贴板中的图片路径）
			editor.insertTextAtCursor("/tmp/image.png");
			assert.strictEqual(editor.getText(), "hello/tmp/image.png world");

			// Single undo should restore entire pre-insert state
			// 一次撤销应当恢复到插入之前的完整状态
			editor.handleInput("\x1b[45;5u"); // Ctrl+- (undo)
			// Ctrl+-（撤销）
			assert.strictEqual(editor.getText(), "hello world");

			editor.handleInput("|");
			assert.strictEqual(editor.getText(), "hello| world");
		});

		it("insertTextAtCursor handles multiline text", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("hello world");
			editor.handleInput("\x01"); // Ctrl+A - go to start
			// Ctrl+A —— 跳到开头
			for (let i = 0; i < 5; i++) editor.handleInput("\x1b[C"); // Move right 5 (after "hello", before space)
			// 向右移动 5 次（位于 "hello" 之后、空格之前）

			// Insert multiline text
			// 插入多行文本
			editor.insertTextAtCursor("line1\nline2\nline3");
			assert.strictEqual(editor.getText(), "helloline1\nline2\nline3 world");

			// Cursor should be at end of inserted text (after "line3", before " world")
			// 光标应当位于所插入文本的末尾（"line3" 之后、" world" 之前）
			const cursor = editor.getCursor();
			assert.strictEqual(cursor.line, 2);
			assert.strictEqual(cursor.col, 5); // "line3".length
			// "line3".length（"line3" 的长度）

			// Single undo should restore entire pre-insert state
			// 一次撤销应当恢复到插入之前的完整状态
			editor.handleInput("\x1b[45;5u"); // Ctrl+- (undo)
			// Ctrl+-（撤销）
			assert.strictEqual(editor.getText(), "hello world");
		});

		it("insertTextAtCursor normalizes CRLF and CR line endings", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("");

			// Insert text with CRLF
			// 插入含 CRLF 的文本
			editor.insertTextAtCursor("a\r\nb\r\nc");
			assert.strictEqual(editor.getText(), "a\nb\nc");

			editor.handleInput("\x1b[45;5u"); // Undo
			// 撤销
			assert.strictEqual(editor.getText(), "");

			// Insert text with CR only
			// 插入仅含 CR 的文本
			editor.insertTextAtCursor("x\ry\rz");
			assert.strictEqual(editor.getText(), "x\ny\nz");
		});

		it("undoes setText to empty string", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.handleInput("h");
			editor.handleInput("e");
			editor.handleInput("l");
			editor.handleInput("l");
			editor.handleInput("o");
			editor.handleInput(" ");
			editor.handleInput("w");
			editor.handleInput("o");
			editor.handleInput("r");
			editor.handleInput("l");
			editor.handleInput("d");
			assert.strictEqual(editor.getText(), "hello world");

			editor.setText("");
			assert.strictEqual(editor.getText(), "");

			editor.handleInput("\x1b[45;5u"); // Ctrl+- (undo)
			// Ctrl+-（撤销）
			assert.strictEqual(editor.getText(), "hello world");
		});

		it("clears undo stack on submit", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);
			let submitted = "";
			editor.onSubmit = (text) => {
				submitted = text;
			};

			editor.handleInput("h");
			editor.handleInput("e");
			editor.handleInput("l");
			editor.handleInput("l");
			editor.handleInput("o");
			editor.handleInput("\r"); // Enter - submit
			// Enter —— 提交

			assert.strictEqual(submitted, "hello");
			assert.strictEqual(editor.getText(), "");

			// Undo should do nothing - stack was cleared
			// 撤销应当不产生任何效果 —— 撤销栈已被清空
			editor.handleInput("\x1b[45;5u"); // Ctrl+- (undo)
			// Ctrl+-（撤销）
			assert.strictEqual(editor.getText(), "");
		});

		it("exits history browsing mode on undo", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			// Add "hello" to history
			// 把 "hello" 添加到历史记录
			editor.addToHistory("hello");
			assert.strictEqual(editor.getText(), "");

			// Type "world"
			// 输入 "world"
			editor.handleInput("w");
			editor.handleInput("o");
			editor.handleInput("r");
			editor.handleInput("l");
			editor.handleInput("d");
			assert.strictEqual(editor.getText(), "world");

			// Ctrl+W - delete word
			// Ctrl+W —— 删除单词
			editor.handleInput("\x17"); // Ctrl+W
			// Ctrl+W（向前删除单词）
			assert.strictEqual(editor.getText(), "");

			// Press Up - enter history browsing, shows "hello"
			// 按上箭头 —— 进入历史浏览，显示 "hello"
			editor.handleInput("\x1b[A"); // Up arrow
			// 上箭头
			assert.strictEqual(editor.getText(), "hello");

			// Undo should restore to "" (state before entering history browsing)
			// 撤销应当恢复到 ""（进入历史浏览之前的状态）
			editor.handleInput("\x1b[45;5u"); // Ctrl+- (undo)
			// Ctrl+-（撤销）
			assert.strictEqual(editor.getText(), "");

			// Undo again should restore to "world" (state before Ctrl+W)
			// 再撤销一次应当恢复到 "world"（按 Ctrl+W 之前的状态）
			editor.handleInput("\x1b[45;5u"); // Ctrl+- (undo)
			// Ctrl+-（撤销）
			assert.strictEqual(editor.getText(), "world");
		});

		it("undo restores to pre-history state even after multiple history navigations", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			// Add history entries
			// 添加历史条目
			editor.addToHistory("first");
			editor.addToHistory("second");
			editor.addToHistory("third");

			// Type something
			// 输入一些内容
			editor.handleInput("c");
			editor.handleInput("u");
			editor.handleInput("r");
			editor.handleInput("r");
			editor.handleInput("e");
			editor.handleInput("n");
			editor.handleInput("t");
			assert.strictEqual(editor.getText(), "current");

			// Clear editor
			// 清空编辑器
			editor.handleInput("\x17"); // Ctrl+W
			// Ctrl+W（向前删除单词）
			assert.strictEqual(editor.getText(), "");

			// Navigate through history multiple times
			// 多次浏览历史记录
			editor.handleInput("\x1b[A"); // Up - "third"
			// 上箭头 —— "third"
			assert.strictEqual(editor.getText(), "third");
			editor.handleInput("\x1b[A"); // Up - "second"
			// 上箭头 —— "second"
			assert.strictEqual(editor.getText(), "second");
			editor.handleInput("\x1b[A"); // Up - "first"
			// 上箭头 —— "first"
			assert.strictEqual(editor.getText(), "first");

			// Undo should go back to "" (state before we started browsing), not intermediate states
			// 撤销应当回到 ""（开始浏览历史之前的状态），而不是中间状态
			editor.handleInput("\x1b[45;5u"); // Ctrl+- (undo)
			// Ctrl+-（撤销）
			assert.strictEqual(editor.getText(), "");

			// Another undo goes back to "current"
			// 再撤销一次会回到 "current"
			editor.handleInput("\x1b[45;5u"); // Ctrl+- (undo)
			// Ctrl+-（撤销）
			assert.strictEqual(editor.getText(), "current");
		});

		it("cursor movement starts new undo unit", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.handleInput("h");
			editor.handleInput("e");
			editor.handleInput("l");
			editor.handleInput("l");
			editor.handleInput("o");
			editor.handleInput(" ");
			editor.handleInput("w");
			editor.handleInput("o");
			editor.handleInput("r");
			editor.handleInput("l");
			editor.handleInput("d");
			assert.strictEqual(editor.getText(), "hello world");

			// Move cursor left 5 (to after "hello ")
			// 将光标向左移动 5 次（到 "hello " 之后）
			for (let i = 0; i < 5; i++) editor.handleInput("\x1b[D");

			// Type "lol" in the middle
			// 在中间输入 "lol"
			editor.handleInput("l");
			editor.handleInput("o");
			editor.handleInput("l");
			assert.strictEqual(editor.getText(), "hello lolworld");

			// Undo should restore to "hello world" (before inserting "lol")
			// 撤销应当恢复到 "hello world"（插入 "lol" 之前）
			editor.handleInput("\x1b[45;5u"); // Ctrl+- (undo)
			// Ctrl+-（撤销）
			assert.strictEqual(editor.getText(), "hello world");

			editor.handleInput("|");
			assert.strictEqual(editor.getText(), "hello |world");
		});

		it("no-op delete operations do not push undo snapshots", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.handleInput("h");
			editor.handleInput("e");
			editor.handleInput("l");
			editor.handleInput("l");
			editor.handleInput("o");
			assert.strictEqual(editor.getText(), "hello");

			// Delete word on empty - multiple times (should be no-ops)
			// 在空内容上多次执行删除单词（应当均为空操作）
			editor.handleInput("\x17"); // Ctrl+W - deletes "hello"
			// Ctrl+W —— 删除 "hello"
			assert.strictEqual(editor.getText(), "");
			editor.handleInput("\x17"); // Ctrl+W - no-op (nothing to delete)
			// Ctrl+W —— 空操作（没有可删除的内容）
			editor.handleInput("\x17"); // Ctrl+W - no-op
			// Ctrl+W —— 空操作

			// Single undo should restore "hello"
			// 一次撤销应当恢复 "hello"
			editor.handleInput("\x1b[45;5u"); // Ctrl+- (undo)
			// Ctrl+-（撤销）
			assert.strictEqual(editor.getText(), "hello");
		});

		it("undoes autocomplete", async () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			// Create a mock autocomplete provider
			// 创建一个模拟（mock）自动补全提供器
			const mockProvider: AutocompleteProvider = {
				getSuggestions: async (lines, _cursorLine, cursorCol) => {
					const text = lines[0] || "";
					const prefix = text.slice(0, cursorCol);
					if (prefix === "di") {
						return {
							items: [{ value: "dist/", label: "dist/" }],
							prefix: "di",
						};
					}
					return null;
				},
				applyCompletion,
			};

			editor.setAutocompleteProvider(mockProvider);

			// Type "di"
			// 输入 "di"
			editor.handleInput("d");
			editor.handleInput("i");
			assert.strictEqual(editor.getText(), "di");

			// Press Tab to trigger autocomplete
			// 按 Tab 触发自动补全
			editor.handleInput("\t");
			await flushAutocomplete();
			assert.strictEqual(editor.getText(), "dist/");
			assert.strictEqual(editor.isShowingAutocomplete(), false);

			// Undo should restore to "di"
			// 撤销应当恢复到 "di"
			editor.handleInput("\x1b[45;5u"); // Ctrl+- (undo)
			// Ctrl+-（撤销）
			assert.strictEqual(editor.getText(), "di");
		});
	});

	describe("Autocomplete", () => {
		it("auto-applies single force-file suggestion without showing menu", async () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			const mockProvider: AutocompleteProvider = {
				getSuggestions: async (lines, _cursorLine, cursorCol, options) => {
					if (!options.force) {
						return null;
					}
					const text = lines[0] || "";
					const prefix = text.slice(0, cursorCol);
					if (prefix === "Work") {
						return {
							items: [{ value: "Workspace/", label: "Workspace/" }],
							prefix: "Work",
						};
					}
					return null;
				},
				applyCompletion,
			};

			editor.setAutocompleteProvider(mockProvider);

			// Type "Work"
			// 输入 "Work"
			editor.handleInput("W");
			editor.handleInput("o");
			editor.handleInput("r");
			editor.handleInput("k");
			assert.strictEqual(editor.getText(), "Work");

			// Press Tab - should auto-apply without showing menu
			// 按 Tab —— 应当直接自动套用而不显示菜单
			editor.handleInput("\t");
			await flushAutocomplete();
			assert.strictEqual(editor.getText(), "Workspace/");
			assert.strictEqual(editor.isShowingAutocomplete(), false);

			// Undo should restore to "Work"
			// 撤销应当恢复到 "Work"
			editor.handleInput("\x1b[45;5u"); // Ctrl+- (undo)
			// Ctrl+-（撤销）
			assert.strictEqual(editor.getText(), "Work");
		});

		it("shows menu when force-file has multiple suggestions", async () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			const mockProvider: AutocompleteProvider = {
				getSuggestions: async (lines, _cursorLine, cursorCol, options) => {
					if (!options.force) {
						return null;
					}
					const text = lines[0] || "";
					const prefix = text.slice(0, cursorCol);
					if (prefix === "src") {
						return {
							items: [
								{ value: "src/", label: "src/" },
								{ value: "src.txt", label: "src.txt" },
							],
							prefix: "src",
						};
					}
					return null;
				},
				applyCompletion,
			};

			editor.setAutocompleteProvider(mockProvider);

			// Type "src"
			// 输入 "src"
			editor.handleInput("s");
			editor.handleInput("r");
			editor.handleInput("c");
			assert.strictEqual(editor.getText(), "src");

			// Press Tab - should show menu because there are multiple suggestions
			// 按 Tab —— 由于存在多个建议项，应当显示菜单
			editor.handleInput("\t");
			await flushAutocomplete();
			assert.strictEqual(editor.getText(), "src");
			assert.strictEqual(editor.isShowingAutocomplete(), true);

			// Press Tab again to accept first suggestion
			// 再按一次 Tab 以接受第一个建议项
			editor.handleInput("\t");
			assert.strictEqual(editor.getText(), "src/");
			assert.strictEqual(editor.isShowingAutocomplete(), false);
		});

		it("keeps suggestions open when typing in force mode (Tab-triggered)", async () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			const allFiles = [
				{ value: "readme.md", label: "readme.md" },
				{ value: "package.json", label: "package.json" },
				{ value: "src/", label: "src/" },
				{ value: "dist/", label: "dist/" },
			];

			const mockProvider: AutocompleteProvider = {
				getSuggestions: async (lines, _cursorLine, cursorCol, options) => {
					const text = lines[0] || "";
					const prefix = text.slice(0, cursorCol);
					const shouldMatch = options.force || prefix.includes("/") || prefix.startsWith(".");
					if (!shouldMatch) {
						return null;
					}
					const filtered = allFiles.filter((f) => f.value.toLowerCase().startsWith(prefix.toLowerCase()));
					if (filtered.length > 0) {
						return { items: filtered, prefix };
					}
					return null;
				},
				applyCompletion,
			};

			editor.setAutocompleteProvider(mockProvider);

			// Press Tab on empty prompt - should show all files (force mode)
			// 在空提示上按 Tab —— 应当显示所有文件（强制模式）
			editor.handleInput("\t");
			await flushAutocomplete();
			assert.strictEqual(editor.isShowingAutocomplete(), true);

			// Type "r" - should narrow to "readme.md" (force mode keeps suggestions open)
			// 输入 "r" —— 应当收敛为 "readme.md"（强制模式下建议列表保持展开）
			editor.handleInput("r");
			await flushAutocomplete();
			assert.strictEqual(editor.getText(), "r");
			assert.strictEqual(editor.isShowingAutocomplete(), true);

			// Type "e" - should still show "readme.md"
			// 输入 "e" —— 应当仍然显示 "readme.md"
			editor.handleInput("e");
			await flushAutocomplete();
			assert.strictEqual(editor.getText(), "re");
			assert.strictEqual(editor.isShowingAutocomplete(), true);

			// Accept with Tab
			// 按 Tab 接受
			editor.handleInput("\t");
			assert.strictEqual(editor.getText(), "readme.md");
			assert.strictEqual(editor.isShowingAutocomplete(), false);
		});

		it("debounces @ autocomplete while typing", async () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);
			let suggestionCalls = 0;

			const mockProvider: AutocompleteProvider = {
				getSuggestions: async (lines, _cursorLine, cursorCol) => {
					suggestionCalls += 1;
					const text = (lines[0] || "").slice(0, cursorCol);
					return {
						items: [{ value: "@main.ts", label: "main.ts" }],
						prefix: text,
					};
				},
				applyCompletion,
			};

			editor.setAutocompleteProvider(mockProvider);

			editor.handleInput("@");
			editor.handleInput("m");
			editor.handleInput("a");
			editor.handleInput("i");

			assert.strictEqual(suggestionCalls, 0);
			assert.strictEqual(editor.isShowingAutocomplete(), false);

			await new Promise((resolve) => setTimeout(resolve, 50));
			await flushAutocomplete();

			assert.strictEqual(suggestionCalls, 1);
			assert.strictEqual(editor.isShowingAutocomplete(), true);
		});

		it("re-queries the autocomplete picker when the cursor moves back into the command name", async () => {
			// Regression for earendil-works/pi#5496: arrowing left out of a slash
			// 针对 earendil-works/pi#5496 的回归测试：当用左箭头退出斜杠
			// command's argument region must re-query the picker, not leave the
			// 命令的参数区域时，必须重新查询选择器（picker），
			// stale argument list showing. Before the fix, moveCursor() never
			// 而不是让陈旧的参数列表继续显示。修复之前，moveCursor() 从不
			// called updateAutocomplete(), so `/cmd ` (argument menu) + Left kept
			// 调用 updateAutocomplete()，因此 `/cmd `（参数菜单）+ 左箭头会一直
			// displaying the arguments against a `/cmd` prefix — and a Tab there
			// 在 `/cmd` 前缀下继续显示参数 —— 而此时按 Tab
			// would concatenate the stale suggestion onto the partial command name.
			// 会把陈旧的建议项拼接到不完整的命令名之后。
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			const mockProvider: AutocompleteProvider = {
				getSuggestions: async (lines, _cursorLine, cursorCol) => {
					const before = (lines[0] || "").slice(0, cursorCol);
					if (!before.startsWith("/")) return null;
					// Past the command name (a space before the cursor): offer arguments.
					// 已越过命令名（光标前有一个空格）：提供参数补全。
					if (before.includes(" ")) {
						return {
							items: [
								{ value: "repo", label: "repo" },
								{ value: "message", label: "message" },
								{ value: "help", label: "help" },
							],
							prefix: before.slice(before.indexOf(" ") + 1),
						};
					}
					// Inside the command name: offer the command name only.
					// 仍处于命令名内部：只提供命令名补全。
					return { items: [{ value: "cmd", label: "cmd" }], prefix: before };
				},
				applyCompletion,
			};

			editor.setAutocompleteProvider(mockProvider);

			// Type `/cmd ` so the picker ends up showing the argument list.
			// 输入 `/cmd `，使选择器（picker）最终显示参数列表。
			for (const ch of "/cmd ") {
				editor.handleInput(ch);
				await flushAutocomplete();
			}
			assert.strictEqual(editor.getText(), "/cmd ");
			assert.strictEqual(editor.isShowingAutocomplete(), true);
			const atArg = editor
				.render(80)
				.map((l) => stripVTControlCharacters(l))
				.join("\n");
			assert.ok(atArg.includes("repo"), "argument menu should be visible at `/cmd `");

			// Arrow Left back into the command name (`/cmd`).
			// 用左箭头退回到命令名内部（`/cmd`）。
			editor.handleInput("\x1b[D");
			await flushAutocomplete();

			// The picker must have re-queried: the stale argument items are gone
			// 选择器必须已重新查询：陈旧的参数条目已经消失
			// (replaced by the command-name suggestion, or the picker closed).
			// （被命令名建议项取代，或者选择器已关闭）。
			const afterMove = editor
				.render(80)
				.map((l) => stripVTControlCharacters(l))
				.join("\n");
			assert.ok(!afterMove.includes("repo"), "stale argument menu must not survive the cursor move");
			assert.ok(!afterMove.includes("message"), "stale argument menu must not survive the cursor move");
		});

		it("debounces # autocomplete while typing", async () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);
			let suggestionCalls = 0;

			const mockProvider: AutocompleteProvider = {
				getSuggestions: async (lines, _cursorLine, cursorCol) => {
					suggestionCalls += 1;
					const text = (lines[0] || "").slice(0, cursorCol);
					return {
						items: [{ value: "#2983", label: "#2983" }],
						prefix: text,
					};
				},
				applyCompletion,
			};

			editor.setAutocompleteProvider(mockProvider);

			editor.handleInput("#");
			editor.handleInput("2");
			editor.handleInput("9");
			editor.handleInput("8");

			assert.strictEqual(suggestionCalls, 0);
			assert.strictEqual(editor.isShowingAutocomplete(), false);

			await new Promise((resolve) => setTimeout(resolve, 50));
			await flushAutocomplete();

			assert.strictEqual(suggestionCalls, 1);
			assert.strictEqual(editor.isShowingAutocomplete(), true);
		});

		it("debounces custom triggerCharacters autocomplete while typing", async () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);
			let suggestionCalls = 0;

			editor.setAutocompleteProvider({
				triggerCharacters: ["$"],
				getSuggestions: async (lines, _cursorLine, cursorCol) => {
					suggestionCalls += 1;
					const prefix = (lines[0] || "").slice(0, cursorCol);
					return { items: [{ value: "$skill-name", label: "skill-name" }], prefix };
				},
				applyCompletion,
			});

			editor.handleInput("$");
			editor.handleInput("s");
			editor.handleInput("k");

			assert.strictEqual(suggestionCalls, 0);
			await new Promise((resolve) => setTimeout(resolve, 50));
			await flushAutocomplete();

			assert.strictEqual(suggestionCalls, 1);
			assert.strictEqual(editor.isShowingAutocomplete(), true);
		});

		it("resets custom triggerCharacters when provider changes", async () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);
			let suggestionCalls = 0;

			editor.setAutocompleteProvider({
				triggerCharacters: ["$"],
				getSuggestions: async () => ({ items: [{ value: "$skill-name", label: "skill-name" }], prefix: "$" }),
				applyCompletion,
			});
			editor.setAutocompleteProvider({
				getSuggestions: async () => {
					suggestionCalls += 1;
					return { items: [{ value: "$skill-name", label: "skill-name" }], prefix: "$" };
				},
				applyCompletion,
			});

			editor.handleInput("$");
			editor.handleInput("s");
			await new Promise((resolve) => setTimeout(resolve, 50));
			await flushAutocomplete();

			assert.strictEqual(suggestionCalls, 0);
			assert.strictEqual(editor.isShowingAutocomplete(), false);
		});

		it("aborts active @ autocomplete when typing continues", async () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);
			let aborts = 0;

			const mockProvider: AutocompleteProvider = {
				getSuggestions: async (_lines, _cursorLine, _cursorCol, options) => {
					return await new Promise((resolve) => {
						const timeout = setTimeout(() => {
							resolve({ items: [{ value: "@main.ts", label: "main.ts" }], prefix: "@main" });
						}, 500);
						options.signal.addEventListener(
							"abort",
							() => {
								aborts += 1;
								clearTimeout(timeout);
								resolve(null);
							},
							{ once: true },
						);
					});
				},
				applyCompletion,
			};

			editor.setAutocompleteProvider(mockProvider);

			editor.handleInput("@");
			editor.handleInput("m");
			editor.handleInput("a");
			editor.handleInput("i");
			await new Promise((resolve) => setTimeout(resolve, 250));
			editor.handleInput("n");
			await new Promise((resolve) => setTimeout(resolve, 50));

			assert.strictEqual(aborts, 1);
		});

		it("hides autocomplete when backspacing slash command to empty", async () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			// Mock provider with slash commands
			// 带有斜杠命令的模拟（mock）提供器
			const mockProvider: AutocompleteProvider = {
				getSuggestions: async (lines, _cursorLine, cursorCol) => {
					const text = lines[0] || "";
					const prefix = text.slice(0, cursorCol);
					// Only return slash command suggestions when line starts with /
					// 仅当该行以 / 开头时才返回斜杠命令建议
					if (prefix.startsWith("/")) {
						const commands = [
							{ value: "/model", label: "model", description: "Change model" },
							{ value: "/help", label: "help", description: "Show help" },
						];
						const query = prefix.slice(1); // Remove leading /
						// 去掉开头的 /
						const filtered = commands.filter((c) => c.value.startsWith(query));
						if (filtered.length > 0) {
							return { items: filtered, prefix };
						}
					}
					return null;
				},
				applyCompletion,
			};

			editor.setAutocompleteProvider(mockProvider);

			// Type "/" - should show slash command suggestions
			// 输入 "/" —— 应当显示斜杠命令建议
			editor.handleInput("/");
			await flushAutocomplete();
			assert.strictEqual(editor.getText(), "/");
			assert.strictEqual(editor.isShowingAutocomplete(), true);

			// Backspace to delete "/" - should hide autocomplete completely
			// 用退格删除 "/" —— 应当完全隐藏自动补全
			editor.handleInput("\x7f"); // Backspace
			// 退格键（Backspace）
			await flushAutocomplete();
			assert.strictEqual(editor.getText(), "");
			assert.strictEqual(editor.isShowingAutocomplete(), false);
		});

		it("applies exact typed slash-argument value on Enter even when first item is highlighted", async () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			// Mock provider for /argtest command with argument completions
			// 为 /argtest 命令提供参数补全的模拟（mock）提供器
			const mockProvider: AutocompleteProvider = {
				getSuggestions: async (lines, _cursorLine, cursorCol) => {
					const text = lines[0] || "";
					const beforeCursor = text.slice(0, cursorCol);

					// Check if we're in argument completion context: "/argtest <prefix>"
					// 检查是否处于参数补全上下文中："/argtest <prefix>"
					const argtestMatch = beforeCursor.match(/^\/argtest\s+(\S+)$/);
					if (argtestMatch) {
						const argumentText = argtestMatch[1]!;
						const allArguments = [
							{ value: "one", label: "one" },
							{ value: "two", label: "two" },
							{ value: "three", label: "three" },
						];
						// Return all arguments that start with the typed prefix
						// 返回所有以所输入前缀开头的参数
						const filtered = allArguments.filter((arg) => arg.value.startsWith(argumentText));
						if (filtered.length > 0) {
							return { items: filtered, prefix: argumentText };
						}
					}
					return null;
				},
				applyCompletion,
			};

			editor.setAutocompleteProvider(mockProvider);

			// Type "/argtest two"
			// 输入 "/argtest two"
			editor.handleInput("/");
			editor.handleInput("a");
			editor.handleInput("r");
			editor.handleInput("g");
			editor.handleInput("t");
			editor.handleInput("e");
			editor.handleInput("s");
			editor.handleInput("t");
			editor.handleInput(" ");
			editor.handleInput("t");
			editor.handleInput("w");
			editor.handleInput("o");

			assert.strictEqual(editor.getText(), "/argtest two");
			await flushAutocomplete();
			assert.strictEqual(editor.isShowingAutocomplete(), true);

			// Press Enter - should apply the exact typed value "two", not the first item
			// 按 Enter —— 应当套用所输入的确切值 "two"，而不是第一项
			editor.handleInput("\r");

			// The exact typed value "two" should be retained
			// 应当保留所输入的确切值 "two"
			assert.strictEqual(editor.getText(), "/argtest two");
		});

		it("selects first prefix match on Enter when typed arg is not exact match", async () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			// Mock provider for /argtest command with argument completions
			// 为 /argtest 命令提供参数补全的模拟（mock）提供器
			const mockProvider: AutocompleteProvider = {
				getSuggestions: async (lines, _cursorLine, cursorCol) => {
					const text = lines[0] || "";
					const beforeCursor = text.slice(0, cursorCol);

					// Check if we're in argument completion context
					// 检查是否处于参数补全上下文中
					const argtestMatch = beforeCursor.match(/^\/argtest\s+(\S+)$/);
					if (argtestMatch) {
						const argumentText = argtestMatch[1]!;
						const allArguments = [
							{ value: "two", label: "two" },
							{ value: "three", label: "three" },
							{ value: "twelve", label: "twelve" },
						];
						// Return all items that start with the typed prefix
						// 返回所有以所输入前缀开头的条目
						const filtered = allArguments.filter((arg) => arg.value.startsWith(argumentText));
						if (filtered.length > 0) {
							return { items: filtered, prefix: argumentText };
						}
					}
					return null;
				},
				applyCompletion,
			};

			editor.setAutocompleteProvider(mockProvider);

			// Type "/argtest t" - filtered to [two, three, twelve], prefix "t" matches "two" first
			// 输入 "/argtest t" —— 过滤后为 [two, three, twelve]，前缀 "t" 首先匹配 "two"
			editor.handleInput("/");
			editor.handleInput("a");
			editor.handleInput("r");
			editor.handleInput("g");
			editor.handleInput("t");
			editor.handleInput("e");
			editor.handleInput("s");
			editor.handleInput("t");
			editor.handleInput(" ");
			editor.handleInput("t");

			await flushAutocomplete();
			assert.strictEqual(editor.isShowingAutocomplete(), true);

			// Press Enter - "t" prefix matches "two" (first in list), so "two" is applied
			// 按 Enter —— 前缀 "t" 匹配到 "two"（列表中的第一项），因此套用 "two"
			editor.handleInput("\r");
			assert.strictEqual(editor.getText(), "/argtest two");
		});

		it("highlights unique prefix match as user types (before full exact match)", async () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			// Mock provider that returns all items unfiltered (like real extensions do)
			// 返回全部条目、不做过滤的模拟（mock）提供器（与真实扩展的行为一致）
			const mockProvider: AutocompleteProvider = {
				getSuggestions: async (lines, _cursorLine, cursorCol) => {
					const text = lines[0] || "";
					const beforeCursor = text.slice(0, cursorCol);

					const argtestMatch = beforeCursor.match(/^\/argtest\s+(\S+)$/);
					if (argtestMatch) {
						const argumentText = argtestMatch[1]!;
						// Return all items - provider does not filter
						// 返回全部条目 —— 提供器不做过滤
						const allArguments = [
							{ value: "one", label: "one" },
							{ value: "two", label: "two" },
							{ value: "three", label: "three" },
						];
						return { items: allArguments, prefix: argumentText };
					}
					return null;
				},
				applyCompletion,
			};

			editor.setAutocompleteProvider(mockProvider);

			// Type "/argtest tw" - "tw" is a prefix of only "two"
			// 输入 "/argtest tw" —— "tw" 只是 "two" 的前缀
			editor.handleInput("/");
			editor.handleInput("a");
			editor.handleInput("r");
			editor.handleInput("g");
			editor.handleInput("t");
			editor.handleInput("e");
			editor.handleInput("s");
			editor.handleInput("t");
			editor.handleInput(" ");
			editor.handleInput("t");
			editor.handleInput("w");

			assert.strictEqual(editor.getText(), "/argtest tw");
			await flushAutocomplete();
			assert.strictEqual(editor.isShowingAutocomplete(), true);

			// Press Enter - "tw" uniquely matches "two", so "two" should be applied
			// 按 Enter —— "tw" 唯一匹配 "two"，因此应当套用 "two"
			editor.handleInput("\r");
			assert.strictEqual(editor.getText(), "/argtest two");
		});

		it("selects first prefix match when multiple items match", async () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			// Mock provider that returns all items unfiltered
			// 返回全部条目、不做过滤的模拟（mock）提供器
			const mockProvider: AutocompleteProvider = {
				getSuggestions: async (lines, _cursorLine, cursorCol) => {
					const text = lines[0] || "";
					const beforeCursor = text.slice(0, cursorCol);

					const argtestMatch = beforeCursor.match(/^\/argtest\s+(\S+)$/);
					if (argtestMatch) {
						const argumentText = argtestMatch[1]!;
						const allArguments = [
							{ value: "one", label: "one" },
							{ value: "two", label: "two" },
							{ value: "three", label: "three" },
						];
						return { items: allArguments, prefix: argumentText };
					}
					return null;
				},
				applyCompletion,
			};

			editor.setAutocompleteProvider(mockProvider);

			// Type "/argtest t" - "t" is a prefix of both "two" and "three"
			// 输入 "/argtest t" —— "t" 同时是 "two" 和 "three" 的前缀
			editor.handleInput("/");
			editor.handleInput("a");
			editor.handleInput("r");
			editor.handleInput("g");
			editor.handleInput("t");
			editor.handleInput("e");
			editor.handleInput("s");
			editor.handleInput("t");
			editor.handleInput(" ");
			editor.handleInput("t");

			await flushAutocomplete();
			assert.strictEqual(editor.isShowingAutocomplete(), true);

			// Press Enter - "t" matches "two" first, so "two" is selected
			// 按 Enter —— "t" 首先匹配 "two"，因此选中 "two"
			editor.handleInput("\r");
			assert.strictEqual(editor.getText(), "/argtest two");
		});

		it("works for built-in-style command argument completion path (model-like)", async () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			// Mock provider for /model command with model completions
			// 为 /model 命令提供模型补全的模拟（mock）提供器
			const mockProvider: AutocompleteProvider = {
				getSuggestions: async (lines, _cursorLine, cursorCol) => {
					const text = lines[0] || "";
					const beforeCursor = text.slice(0, cursorCol);

					// Check if we're in /model argument completion context
					// 检查是否处于 /model 参数补全上下文中
					// Use [^ ]+ to match any non-space characters (including hyphens)
					// 使用 [^ ]+ 匹配任意非空格字符（包括连字符）
					const modelMatch = beforeCursor.match(/^\/model\s+(\S+)$/);
					if (modelMatch) {
						const modelText = modelMatch[1]!;
						const allModels = [
							{ value: "gpt-4o", label: "gpt-4o" },
							{ value: "gpt-4o-mini", label: "gpt-4o-mini" },
							{ value: "claude-sonnet", label: "claude-sonnet" },
						];
						// Return all models that start with the typed prefix
						// 返回所有以所输入前缀开头的模型
						const filtered = allModels.filter((m) => m.value.startsWith(modelText));
						if (filtered.length > 0) {
							return { items: filtered, prefix: modelText };
						}
					}
					return null;
				},
				applyCompletion,
			};

			editor.setAutocompleteProvider(mockProvider);

			// Type "/model gpt-4o-mini" - exact match for second item in list
			// 输入 "/model gpt-4o-mini" —— 与列表中第二项精确匹配
			editor.handleInput("/");
			editor.handleInput("m");
			editor.handleInput("o");
			editor.handleInput("d");
			editor.handleInput("e");
			editor.handleInput("l");
			editor.handleInput(" ");
			editor.handleInput("g");
			editor.handleInput("p");
			editor.handleInput("t");
			editor.handleInput("-");
			editor.handleInput("4");
			editor.handleInput("o");
			editor.handleInput("-");
			editor.handleInput("m");
			editor.handleInput("i");
			editor.handleInput("n");
			editor.handleInput("i");

			assert.strictEqual(editor.getText(), "/model gpt-4o-mini");
			await flushAutocomplete();
			assert.strictEqual(editor.isShowingAutocomplete(), true);

			// Press Enter - should retain exact typed value, not apply first highlighted item
			// 按 Enter —— 应当保留所输入的确切值，而不是套用第一个高亮项
			editor.handleInput("\r");

			// The exact typed value should be retained
			// 应当保留所输入的确切值
			assert.strictEqual(editor.getText(), "/model gpt-4o-mini");
		});

		it("awaits async slash command argument completions", async () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);
			const provider = new CombinedAutocompleteProvider(
				[
					{
						name: "load-skills",
						description: "Load skills",
						getArgumentCompletions: async (prefix) =>
							prefix.startsWith("s") ? [{ value: "skill-a", label: "skill-a" }] : null,
					},
				],
				process.cwd(),
			);
			editor.setAutocompleteProvider(provider);
			editor.setText("/load-skills ");

			editor.handleInput("s");
			await flushAutocomplete();
			assert.strictEqual(editor.isShowingAutocomplete(), true);

			editor.handleInput("\t");
			assert.strictEqual(editor.getText(), "/load-skills skill-a");
			assert.strictEqual(editor.isShowingAutocomplete(), false);
		});

		it("ignores invalid slash command argument completion results", async () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);
			const provider = new CombinedAutocompleteProvider(
				[
					{
						name: "load-skills",
						description: "Load skills",
						getArgumentCompletions: (() => "not-an-array") as unknown as (
							argumentPrefix: string,
						) => Promise<{ value: string; label: string }[] | null>,
					},
				],
				process.cwd(),
			);
			editor.setAutocompleteProvider(provider);
			editor.setText("/load-skills ");

			editor.handleInput("s");
			await flushAutocomplete();
			assert.strictEqual(editor.isShowingAutocomplete(), false);
			assert.strictEqual(editor.getText(), "/load-skills s");
		});

		it("does not show argument completions when command has no argument completer", async () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);
			const provider = new CombinedAutocompleteProvider(
				[
					{ name: "help", description: "Show help" },
					{
						name: "model",
						description: "Switch model",
						getArgumentCompletions: () => [{ value: "claude-opus", label: "claude-opus" }],
					},
				],
				process.cwd(),
			);
			editor.setAutocompleteProvider(provider);

			editor.handleInput("/");
			editor.handleInput("h");
			editor.handleInput("e");
			await flushAutocomplete();
			assert.strictEqual(editor.isShowingAutocomplete(), true);

			editor.handleInput("\t");
			assert.strictEqual(editor.getText(), "/help ");
			assert.strictEqual(editor.isShowingAutocomplete(), false);
		});
	});

	describe("Character jump (Ctrl+])", () => {
		it("jumps forward to first occurrence of character on same line", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("hello world");
			editor.handleInput("\x01"); // Ctrl+A - go to start
			// Ctrl+A —— 跳到开头
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 0 });

			editor.handleInput("\x1d"); // Ctrl+] (legacy sequence for ctrl+])
			// Ctrl+]（ctrl+] 的旧式转义序列）
			editor.handleInput("o"); // Jump to first 'o'
			// 跳转到第一个 'o'

			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 4 }); // 'o' in "hello"
			// "hello" 中的 'o'
		});

		it("jumps forward to next occurrence after cursor", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("hello world");
			editor.handleInput("\x01"); // Ctrl+A - go to start
			// Ctrl+A —— 跳到开头
			// Move cursor to the 'o' in "hello" (col 4)
			// 将光标移动到 "hello" 中的 'o' 上（第 4 列）
			for (let i = 0; i < 4; i++) editor.handleInput("\x1b[C");
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 4 });

			editor.handleInput("\x1d"); // Ctrl+]
			// Ctrl+]（跳转模式）
			editor.handleInput("o"); // Jump to next 'o' (in "world")
			// 跳转到下一个 'o'（位于 "world" 中）

			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 7 }); // 'o' in "world"
			// "world" 中的 'o'
		});

		it("jumps forward across multiple lines", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("abc\ndef\nghi");
			// Cursor is at end (line 2, col 3). Move to line 0 via up arrows, then Ctrl+A
			// 光标位于末尾（第 2 行第 3 列）。先用上箭头移动到第 0 行，再按 Ctrl+A
			editor.handleInput("\x1b[A"); // Up
			// 上箭头
			editor.handleInput("\x1b[A"); // Up - now on line 0
			// 上箭头 —— 现在位于第 0 行
			editor.handleInput("\x01"); // Ctrl+A - go to start of line
			// Ctrl+A —— 跳到行首
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 0 });

			editor.handleInput("\x1d"); // Ctrl+]
			// Ctrl+]（跳转模式）
			editor.handleInput("g"); // Jump to 'g' on line 3
			// 跳转到第 3 行上的 'g'

			assert.deepStrictEqual(editor.getCursor(), { line: 2, col: 0 });
		});

		it("jumps backward to first occurrence before cursor on same line", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("hello world");
			// Cursor at end (col 11)
			// 光标位于末尾（第 11 列）
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 11 });

			editor.handleInput("\x1b\x1d"); // Ctrl+Alt+] (ESC followed by Ctrl+])
			// Ctrl+Alt+]（ESC 后接 Ctrl+]）
			editor.handleInput("o"); // Jump to last 'o' before cursor
			// 跳转到光标之前最后一个 'o'

			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 7 }); // 'o' in "world"
			// "world" 中的 'o'
		});

		it("jumps backward across multiple lines", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("abc\ndef\nghi");
			// Cursor at end of line 3
			// 光标位于第 3 行末尾
			assert.deepStrictEqual(editor.getCursor(), { line: 2, col: 3 });

			editor.handleInput("\x1b\x1d"); // Ctrl+Alt+]
			// Ctrl+Alt+]（向后跳转模式）
			editor.handleInput("a"); // Jump to 'a' on line 1
			// 跳转到第 1 行上的 'a'

			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 0 });
		});

		it("does nothing when character is not found (forward)", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("hello world");
			editor.handleInput("\x01"); // Ctrl+A - go to start
			// Ctrl+A —— 跳到开头
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 0 });

			editor.handleInput("\x1d"); // Ctrl+]
			// Ctrl+]（跳转模式）
			editor.handleInput("z"); // 'z' doesn't exist
			// 'z' 不存在

			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 0 }); // Cursor unchanged
			// 光标位置不变
		});

		it("does nothing when character is not found (backward)", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("hello world");
			// Cursor at end
			// 光标位于末尾
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 11 });

			editor.handleInput("\x1b\x1d"); // Ctrl+Alt+]
			// Ctrl+Alt+]（向后跳转模式）
			editor.handleInput("z"); // 'z' doesn't exist
			// 'z' 不存在

			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 11 }); // Cursor unchanged
			// 光标位置不变
		});

		it("is case-sensitive", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("Hello World");
			editor.handleInput("\x01"); // Ctrl+A - go to start
			// Ctrl+A —— 跳到开头
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 0 });

			// Search for lowercase 'h' - should not find it (only 'H' exists)
			// 搜索小写的 'h' —— 应当找不到（只存在 'H'）
			editor.handleInput("\x1d"); // Ctrl+]
			// Ctrl+]（跳转模式）
			editor.handleInput("h");

			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 0 }); // Cursor unchanged
			// 光标位置不变

			// Search for uppercase 'W' - should find it
			// 搜索大写的 'W' —— 应当能找到
			editor.handleInput("\x1d"); // Ctrl+]
			// Ctrl+]（跳转模式）
			editor.handleInput("W");

			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 6 }); // 'W' in "World"
			// "World" 中的 'W'
		});

		it("cancels jump mode when Ctrl+] is pressed again", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("hello world");
			editor.handleInput("\x01"); // Ctrl+A - go to start
			// Ctrl+A —— 跳到开头
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 0 });

			editor.handleInput("\x1d"); // Ctrl+] - enter jump mode
			// Ctrl+] —— 进入跳转模式
			editor.handleInput("\x1d"); // Ctrl+] again - cancel
			// 再按一次 Ctrl+] —— 取消

			// Type 'o' normally - should insert, not jump
			// 正常输入 'o' —— 应当插入字符，而不是执行跳转
			editor.handleInput("o");
			assert.strictEqual(editor.getText(), "ohello world");
		});

		it("cancels jump mode on Escape and processes the Escape", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("hello world");
			editor.handleInput("\x01"); // Ctrl+A - go to start
			// Ctrl+A —— 跳到开头
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 0 });

			editor.handleInput("\x1d"); // Ctrl+] - enter jump mode
			// Ctrl+] —— 进入跳转模式
			editor.handleInput("\x1b"); // Escape - cancel jump mode
			// Escape —— 取消跳转模式

			// Cursor should be unchanged (Escape itself doesn't move cursor in editor)
			// 光标位置应当不变（Escape 本身不会移动编辑器中的光标）
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 0 });

			// Type 'o' normally - should insert, not jump
			// 正常输入 'o' —— 应当插入字符，而不是执行跳转
			editor.handleInput("o");
			assert.strictEqual(editor.getText(), "ohello world");
		});

		it("cancels backward jump mode when Ctrl+Alt+] is pressed again", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("hello world");
			// Cursor at end
			// 光标位于末尾
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 11 });

			editor.handleInput("\x1b\x1d"); // Ctrl+Alt+] - enter backward jump mode
			// Ctrl+Alt+] —— 进入向后跳转模式
			editor.handleInput("\x1b\x1d"); // Ctrl+Alt+] again - cancel
			// 再按一次 Ctrl+Alt+] —— 取消

			// Type 'o' normally - should insert, not jump
			// 正常输入 'o' —— 应当插入字符，而不是执行跳转
			editor.handleInput("o");
			assert.strictEqual(editor.getText(), "hello worldo");
		});

		it("searches for special characters", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("foo(bar) = baz;");
			editor.handleInput("\x01"); // Ctrl+A - go to start
			// Ctrl+A —— 跳到开头
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 0 });

			// Jump to '('
			// 跳转到 '('
			editor.handleInput("\x1d"); // Ctrl+]
			// Ctrl+]（跳转模式）
			editor.handleInput("(");

			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 3 });

			// Jump to '='
			// 跳转到 '='
			editor.handleInput("\x1d"); // Ctrl+]
			// Ctrl+]（跳转模式）
			editor.handleInput("=");

			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 9 });
		});

		it("handles empty text gracefully", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("");
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 0 });

			editor.handleInput("\x1d"); // Ctrl+]
			// Ctrl+]（跳转模式）
			editor.handleInput("x");

			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 0 }); // Cursor unchanged
			// 光标位置不变
		});

		it("resets lastAction when jumping", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("hello world");
			editor.handleInput("\x01"); // Ctrl+A - go to start
			// Ctrl+A —— 跳到开头

			// Type to set lastAction to "type-word"
			// 通过输入把 lastAction 设为 "type-word"
			editor.handleInput("x");
			assert.strictEqual(editor.getText(), "xhello world");

			// Jump forward
			// 向前跳转
			editor.handleInput("\x1d"); // Ctrl+]
			// Ctrl+]（跳转模式）
			editor.handleInput("o");

			// Type more - should start a new undo unit (lastAction was reset)
			// 继续输入 —— 应当开启一个新的撤销单元（lastAction 已被重置）
			editor.handleInput("Y");
			assert.strictEqual(editor.getText(), "xhellYo world");

			// Undo should only undo "Y", not "x" as well
			// 撤销应当只撤销 "Y"，而不应连 "x" 一起撤销
			editor.handleInput("\x1b[45;5u"); // Ctrl+- (undo)
			// Ctrl+-（撤销）
			assert.strictEqual(editor.getText(), "xhello world");
		});
	});

	describe("Sticky column", () => {
		// Helper: position cursor at a specific line and column
		// 辅助函数：将光标定位到指定的行和列
		function positionCursor(editor: Editor, line: number, col: number): void {
			// Go to line 0 first
			// 先跳到第 0 行
			for (let i = 0; i < 20; i++) editor.handleInput("\x1b[A");
			// Go to target line
			// 跳转到目标行
			for (let i = 0; i < line; i++) editor.handleInput("\x1b[B");
			// Go to target col
			// 跳转到目标列
			editor.handleInput("\x01"); // Ctrl+A
			// Ctrl+A（移动到开头）
			for (let i = 0; i < col; i++) editor.handleInput("\x1b[C");
		}

		it("preserves target column when moving up through a shorter line", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			// Line 0: "2222222222x222" (x at col 10)
			// 第 0 行："2222222222x222"（x 位于第 10 列）
			// Line 1: "" (empty)
			// 第 1 行："" （空行）
			// Line 2: "1111111111_111111111111" (_ at col 10)
			// 第 2 行："1111111111_111111111111"（_ 位于第 10 列）
			editor.setText("2222222222x222\n\n1111111111_111111111111");

			// Position cursor on _ (line 2, col 10)
			// 将光标定位到 _ 上（第 2 行第 10 列）
			assert.deepStrictEqual(editor.getCursor(), { line: 2, col: 23 }); // At end
			// 位于末尾
			editor.handleInput("\x01"); // Ctrl+A - go to start of line
			// Ctrl+A —— 跳到行首
			for (let i = 0; i < 10; i++) editor.handleInput("\x1b[C"); // Move right to col 10
			// 向右移动到第 10 列
			assert.deepStrictEqual(editor.getCursor(), { line: 2, col: 10 });

			// Press Up - should move to empty line (col clamped to 0)
			// 按上箭头 —— 应当移动到空行（列被钳制为 0）
			editor.handleInput("\x1b[A"); // Up arrow
			// 上箭头
			assert.deepStrictEqual(editor.getCursor(), { line: 1, col: 0 });

			// Press Up again - should move to line 0 at col 10 (on 'x')
			// 再按一次上箭头 —— 应当移动到第 0 行第 10 列（位于 'x' 上）
			editor.handleInput("\x1b[A"); // Up arrow
			// 上箭头
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 10 });
		});

		it("preserves target column when moving down through a shorter line", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("1111111111_111\n\n2222222222x222222222222");

			// Position cursor on _ (line 0, col 10)
			// 将光标定位到 _ 上（第 0 行第 10 列）
			editor.handleInput("\x1b[A"); // Up to line 1
			// 向上移动到第 1 行
			editor.handleInput("\x1b[A"); // Up to line 0
			// 向上移动到第 0 行
			editor.handleInput("\x01"); // Ctrl+A
			// Ctrl+A（移动到开头）
			for (let i = 0; i < 10; i++) editor.handleInput("\x1b[C");
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 10 });

			// Press Down - should move to empty line (col clamped to 0)
			// 按下箭头 —— 应当移动到空行（列被钳制为 0）
			editor.handleInput("\x1b[B"); // Down arrow
			// 下箭头
			assert.deepStrictEqual(editor.getCursor(), { line: 1, col: 0 });

			// Press Down again - should move to line 2 at col 10 (on 'x')
			// 再按一次下箭头 —— 应当移动到第 2 行第 10 列（位于 'x' 上）
			editor.handleInput("\x1b[B"); // Down arrow
			// 下箭头
			assert.deepStrictEqual(editor.getCursor(), { line: 2, col: 10 });
		});

		it("resets sticky column on horizontal movement (left arrow)", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("1234567890\n\n1234567890");

			// Start at line 2, col 5
			// 起始位置为第 2 行第 5 列
			editor.handleInput("\x01"); // Ctrl+A
			// Ctrl+A（移动到开头）
			for (let i = 0; i < 5; i++) editor.handleInput("\x1b[C");
			assert.deepStrictEqual(editor.getCursor(), { line: 2, col: 5 });

			// Move up through empty line
			// 向上移动并穿过空行
			editor.handleInput("\x1b[A"); // Up - line 1, col 0
			// 上箭头 —— 第 1 行，第 0 列
			editor.handleInput("\x1b[A"); // Up - line 0, col 5 (sticky)
			// 上箭头 —— 第 0 行，第 5 列（粘滞列）
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 5 });

			// Move left - resets sticky column
			// 向左移动 —— 重置粘滞列（sticky column）
			editor.handleInput("\x1b[D"); // Left
			// 左箭头
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 4 });

			// Move down twice
			// 向下移动两次
			editor.handleInput("\x1b[B"); // Down - line 1, col 0
			// 下箭头 —— 第 1 行，第 0 列
			editor.handleInput("\x1b[B"); // Down - line 2, col 4 (new sticky from col 4)
			// 下箭头 —— 第 2 行，第 4 列（以第 4 列作为新的粘滞列）
			assert.deepStrictEqual(editor.getCursor(), { line: 2, col: 4 });
		});

		it("resets sticky column on horizontal movement (right arrow)", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("1234567890\n\n1234567890");

			// Start at line 0, col 5
			// 起始位置为第 0 行第 5 列
			editor.handleInput("\x1b[A"); // Up to line 1
			// 向上移动到第 1 行
			editor.handleInput("\x1b[A"); // Up to line 0
			// 向上移动到第 0 行
			editor.handleInput("\x01"); // Ctrl+A
			// Ctrl+A（移动到开头）
			for (let i = 0; i < 5; i++) editor.handleInput("\x1b[C");
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 5 });

			// Move down through empty line
			// 向下移动并穿过空行
			editor.handleInput("\x1b[B"); // Down - line 1, col 0
			// 下箭头 —— 第 1 行，第 0 列
			editor.handleInput("\x1b[B"); // Down - line 2, col 5 (sticky)
			// 下箭头 —— 第 2 行，第 5 列（粘滞列）
			assert.deepStrictEqual(editor.getCursor(), { line: 2, col: 5 });

			// Move right - resets sticky column
			// 向右移动 —— 重置粘滞列（sticky column）
			editor.handleInput("\x1b[C"); // Right
			// 右箭头
			assert.deepStrictEqual(editor.getCursor(), { line: 2, col: 6 });

			// Move up twice
			// 向上移动两次
			editor.handleInput("\x1b[A"); // Up - line 1, col 0
			// 上箭头 —— 第 1 行，第 0 列
			editor.handleInput("\x1b[A"); // Up - line 0, col 6 (new sticky from col 6)
			// 上箭头 —— 第 0 行，第 6 列（以第 6 列作为新的粘滞列）
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 6 });
		});

		it("resets sticky column on typing", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("1234567890\n\n1234567890");

			// Start at line 2, col 8
			// 起始位置为第 2 行第 8 列
			editor.handleInput("\x01"); // Ctrl+A
			// Ctrl+A（移动到开头）
			for (let i = 0; i < 8; i++) editor.handleInput("\x1b[C");

			// Move up through empty line
			// 向上移动并穿过空行
			editor.handleInput("\x1b[A"); // Up
			// 上箭头
			editor.handleInput("\x1b[A"); // Up - line 0, col 8
			// 上箭头 —— 第 0 行，第 8 列
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 8 });

			// Type a character - resets sticky column
			// 输入一个字符 —— 重置粘滞列（sticky column）
			editor.handleInput("X");
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 9 });

			// Move down twice
			// 向下移动两次
			editor.handleInput("\x1b[B"); // Down - line 1, col 0
			// 下箭头 —— 第 1 行，第 0 列
			editor.handleInput("\x1b[B"); // Down - line 2, col 9 (new sticky from col 9)
			// 下箭头 —— 第 2 行，第 9 列（以第 9 列作为新的粘滞列）
			assert.deepStrictEqual(editor.getCursor(), { line: 2, col: 9 });
		});

		it("resets sticky column on backspace", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("1234567890\n\n1234567890");

			// Start at line 2, col 8
			// 起始位置为第 2 行第 8 列
			editor.handleInput("\x01"); // Ctrl+A
			// Ctrl+A（移动到开头）
			for (let i = 0; i < 8; i++) editor.handleInput("\x1b[C");

			// Move up through empty line
			// 向上移动并穿过空行
			editor.handleInput("\x1b[A"); // Up
			// 上箭头
			editor.handleInput("\x1b[A"); // Up - line 0, col 8
			// 上箭头 —— 第 0 行，第 8 列
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 8 });

			// Backspace - resets sticky column
			// 退格 —— 重置粘滞列（sticky column）
			editor.handleInput("\x7f"); // Backspace
			// 退格键（Backspace）
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 7 });

			// Move down twice
			// 向下移动两次
			editor.handleInput("\x1b[B"); // Down - line 1, col 0
			// 下箭头 —— 第 1 行，第 0 列
			editor.handleInput("\x1b[B"); // Down - line 2, col 7 (new sticky from col 7)
			// 下箭头 —— 第 2 行，第 7 列（以第 7 列作为新的粘滞列）
			assert.deepStrictEqual(editor.getCursor(), { line: 2, col: 7 });
		});

		it("resets sticky column on Ctrl+A (move to line start)", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("1234567890\n\n1234567890");

			// Start at line 2, col 8
			// 起始位置为第 2 行第 8 列
			editor.handleInput("\x01"); // Ctrl+A
			// Ctrl+A（移动到开头）
			for (let i = 0; i < 8; i++) editor.handleInput("\x1b[C");

			// Move up - establishes sticky col 8
			// 向上移动 —— 确立粘滞列 8
			editor.handleInput("\x1b[A"); // Up - line 1, col 0
			// 上箭头 —— 第 1 行，第 0 列

			// Ctrl+A - resets sticky column to 0
			// Ctrl+A —— 将粘滞列重置为 0
			editor.handleInput("\x01"); // Ctrl+A
			// Ctrl+A（移动到开头）
			assert.deepStrictEqual(editor.getCursor(), { line: 1, col: 0 });

			// Move up
			// 向上移动
			editor.handleInput("\x1b[A"); // Up - line 0, col 0 (new sticky from col 0)
			// 上箭头 —— 第 0 行，第 0 列（以第 0 列作为新的粘滞列）
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 0 });
		});

		it("resets sticky column on Ctrl+E (move to line end)", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("12345\n\n1234567890");

			// Start at line 2, col 3
			// 起始位置为第 2 行第 3 列
			editor.handleInput("\x01"); // Ctrl+A
			// Ctrl+A（移动到开头）
			for (let i = 0; i < 3; i++) editor.handleInput("\x1b[C");

			// Move up through empty line - establishes sticky col 3
			// 向上移动并穿过空行 —— 确立粘滞列 3
			editor.handleInput("\x1b[A"); // Up - line 1, col 0
			// 上箭头 —— 第 1 行，第 0 列
			editor.handleInput("\x1b[A"); // Up - line 0, col 3
			// 上箭头 —— 第 0 行，第 3 列
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 3 });

			// Ctrl+E - resets sticky column to end
			// Ctrl+E —— 将粘滞列重置到行末
			editor.handleInput("\x05"); // Ctrl+E
			// Ctrl+E（移动到行末）
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 5 });

			// Move down twice
			// 向下移动两次
			editor.handleInput("\x1b[B"); // Down - line 1, col 0
			// 下箭头 —— 第 1 行，第 0 列
			editor.handleInput("\x1b[B"); // Down - line 2, col 5 (new sticky from col 5)
			// 下箭头 —— 第 2 行，第 5 列（以第 5 列作为新的粘滞列）
			assert.deepStrictEqual(editor.getCursor(), { line: 2, col: 5 });
		});

		it("resets sticky column on word movement (Ctrl+Left)", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("hello world\n\nhello world");

			// Start at end of line 2 (col 11)
			// 起始位置为第 2 行末尾（第 11 列）
			assert.deepStrictEqual(editor.getCursor(), { line: 2, col: 11 });

			// Move up through empty line - establishes sticky col 11
			// 向上移动并穿过空行 —— 确立粘滞列 11
			editor.handleInput("\x1b[A"); // Up - line 1, col 0
			// 上箭头 —— 第 1 行，第 0 列
			editor.handleInput("\x1b[A"); // Up - line 0, col 11
			// 上箭头 —— 第 0 行，第 11 列
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 11 });

			// Ctrl+Left - word movement resets sticky column
			// Ctrl+Left —— 按单词移动会重置粘滞列（sticky column）
			editor.handleInput("\x1b[1;5D"); // Ctrl+Left
			// Ctrl+Left（按单词向左移动）
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 6 }); // Before "world"
			// 位于 "world" 之前

			// Move down twice
			// 向下移动两次
			editor.handleInput("\x1b[B"); // Down - line 1, col 0
			// 下箭头 —— 第 1 行，第 0 列
			editor.handleInput("\x1b[B"); // Down - line 2, col 6 (new sticky from col 6)
			// 下箭头 —— 第 2 行，第 6 列（以第 6 列作为新的粘滞列）
			assert.deepStrictEqual(editor.getCursor(), { line: 2, col: 6 });
		});

		it("resets sticky column on word movement (Ctrl+Right)", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("hello world\n\nhello world");

			// Start at line 0, col 0
			// 起始位置为第 0 行第 0 列
			editor.handleInput("\x1b[A"); // Up
			// 上箭头
			editor.handleInput("\x1b[A"); // Up
			// 上箭头
			editor.handleInput("\x01"); // Ctrl+A
			// Ctrl+A（移动到开头）
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 0 });

			// Move down through empty line - establishes sticky col 0
			// 向下移动并穿过空行 —— 确立粘滞列 0
			editor.handleInput("\x1b[B"); // Down - line 1, col 0
			// 下箭头 —— 第 1 行，第 0 列
			editor.handleInput("\x1b[B"); // Down - line 2, col 0
			// 下箭头 —— 第 2 行，第 0 列
			assert.deepStrictEqual(editor.getCursor(), { line: 2, col: 0 });

			// Ctrl+Right - word movement resets sticky column
			// Ctrl+Right —— 按单词移动会重置粘滞列（sticky column）
			editor.handleInput("\x1b[1;5C"); // Ctrl+Right
			// Ctrl+Right（按单词向右移动）
			assert.deepStrictEqual(editor.getCursor(), { line: 2, col: 5 }); // After "hello"
			// 位于 "hello" 之后

			// Move up twice
			// 向上移动两次
			editor.handleInput("\x1b[A"); // Up - line 1, col 0
			// 上箭头 —— 第 1 行，第 0 列
			editor.handleInput("\x1b[A"); // Up - line 0, col 5 (new sticky from col 5)
			// 上箭头 —— 第 0 行，第 5 列（以第 5 列作为新的粘滞列）
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 5 });
		});

		it("resets sticky column on undo", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("1234567890\n\n1234567890");

			// Go to line 0, col 8
			// 跳到第 0 行第 8 列
			editor.handleInput("\x1b[A"); // Up to line 1
			// 向上移动到第 1 行
			editor.handleInput("\x1b[A"); // Up to line 0
			// 向上移动到第 0 行
			editor.handleInput("\x01"); // Ctrl+A
			// Ctrl+A（移动到开头）
			for (let i = 0; i < 8; i++) editor.handleInput("\x1b[C");
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 8 });

			// Move down through empty line - establishes sticky col 8
			// 向下移动并穿过空行 —— 确立粘滞列 8
			editor.handleInput("\x1b[B"); // Down - line 1, col 0
			// 下箭头 —— 第 1 行，第 0 列
			editor.handleInput("\x1b[B"); // Down - line 2, col 8 (sticky)
			// 下箭头 —— 第 2 行，第 8 列（粘滞列）
			assert.deepStrictEqual(editor.getCursor(), { line: 2, col: 8 });

			// Type something to create undo state - this clears sticky and sets col to 9
			// 输入一些内容以生成撤销状态 —— 这会清除粘滞列并把列设为 9
			editor.handleInput("X");
			assert.strictEqual(editor.getText(), "1234567890\n\n12345678X90");
			assert.deepStrictEqual(editor.getCursor(), { line: 2, col: 9 });

			// Move up - establishes new sticky col 9
			// 向上移动 —— 确立新的粘滞列 9
			editor.handleInput("\x1b[A"); // Up - line 1, col 0
			// 上箭头 —— 第 1 行，第 0 列
			editor.handleInput("\x1b[A"); // Up - line 0, col 9
			// 上箭头 —— 第 0 行，第 9 列
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 9 });

			// Undo - resets sticky column and restores cursor to line 2, col 8
			// 撤销 —— 重置粘滞列，并把光标恢复到第 2 行第 8 列
			editor.handleInput("\x1b[45;5u"); // Ctrl+- (undo)
			// Ctrl+-（撤销）
			assert.strictEqual(editor.getText(), "1234567890\n\n1234567890");
			assert.deepStrictEqual(editor.getCursor(), { line: 2, col: 8 });

			// Move up - should capture new sticky from restored col 8, not old col 9
			// 向上移动 —— 应当以恢复后的第 8 列作为新的粘滞列，而不是旧的第 9 列
			editor.handleInput("\x1b[A"); // Up - line 1, col 0
			// 上箭头 —— 第 1 行，第 0 列
			editor.handleInput("\x1b[A"); // Up - line 0, col 8 (new sticky from restored position)
			// 上箭头 —— 第 0 行，第 8 列（以恢复后的位置作为新的粘滞列）
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 8 });
		});

		it("handles multiple consecutive up/down movements", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("1234567890\nab\ncd\nef\n1234567890");

			// Start at line 4, col 7
			// 起始位置为第 4 行第 7 列
			editor.handleInput("\x01"); // Ctrl+A
			// Ctrl+A（移动到开头）
			for (let i = 0; i < 7; i++) editor.handleInput("\x1b[C");
			assert.deepStrictEqual(editor.getCursor(), { line: 4, col: 7 });

			// Move up multiple times through short lines
			// 多次向上移动并穿过较短的行
			editor.handleInput("\x1b[A"); // Up - line 3, col 2 (clamped)
			// 上箭头 —— 第 3 行，第 2 列（被钳制）
			editor.handleInput("\x1b[A"); // Up - line 2, col 2 (clamped)
			// 上箭头 —— 第 2 行，第 2 列（被钳制）
			editor.handleInput("\x1b[A"); // Up - line 1, col 2 (clamped)
			// 上箭头 —— 第 1 行，第 2 列（被钳制）
			editor.handleInput("\x1b[A"); // Up - line 0, col 7 (restored)
			// 上箭头 —— 第 0 行，第 7 列（已恢复）
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 7 });

			// Move down multiple times - sticky should still be 7
			// 多次向下移动 —— 粘滞列应当仍为 7
			editor.handleInput("\x1b[B"); // Down - line 1, col 2
			// 下箭头 —— 第 1 行，第 2 列
			editor.handleInput("\x1b[B"); // Down - line 2, col 2
			// 下箭头 —— 第 2 行，第 2 列
			editor.handleInput("\x1b[B"); // Down - line 3, col 2
			// 下箭头 —— 第 3 行，第 2 列
			editor.handleInput("\x1b[B"); // Down - line 4, col 7 (restored)
			// 下箭头 —— 第 4 行，第 7 列（已恢复）
			assert.deepStrictEqual(editor.getCursor(), { line: 4, col: 7 });
		});

		it("moves correctly through wrapped visual lines without getting stuck", () => {
			const tui = createTestTUI(15, 24); // Narrow terminal
			// 窄终端
			const editor = new Editor(tui, defaultEditorTheme);

			// Line 0: short
			// 第 0 行：较短
			// Line 1: 30 chars = wraps to 3 visual lines at width 10 (after padding)
			// 第 1 行：30 个字符 = 在宽度 10 下（计入填充后）折为 3 个视觉行
			editor.setText("short\n123456789012345678901234567890");
			editor.render(15); // This gives 14 layout width
			// 这样得到的布局宽度为 14

			// Position at end of line 1 (col 30)
			// 定位到第 1 行末尾（第 30 列）
			assert.deepStrictEqual(editor.getCursor(), { line: 1, col: 30 });

			// Move up repeatedly - should traverse all visual lines of the wrapped text
			// 反复向上移动 —— 应当遍历折行文本的所有视觉行（visual line）
			// and eventually reach line 0
			// 并最终到达第 0 行
			editor.handleInput("\x1b[A"); // Up - to previous visual line within line 1
			// 上箭头 —— 移动到第 1 行内的上一个视觉行
			assert.strictEqual(editor.getCursor().line, 1);

			editor.handleInput("\x1b[A"); // Up - another visual line
			// 上箭头 —— 再上一个视觉行
			assert.strictEqual(editor.getCursor().line, 1);

			editor.handleInput("\x1b[A"); // Up - should reach line 0
			// 上箭头 —— 应当到达第 0 行
			assert.strictEqual(editor.getCursor().line, 0);
		});

		it("handles setText resetting sticky column", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			editor.setText("1234567890\n\n1234567890");

			// Establish sticky column
			// 确立粘滞列（sticky column）
			editor.handleInput("\x01"); // Ctrl+A
			// Ctrl+A（移动到开头）
			for (let i = 0; i < 8; i++) editor.handleInput("\x1b[C");
			editor.handleInput("\x1b[A"); // Up
			// 上箭头

			// setText should reset sticky column
			// setText 应当重置粘滞列（sticky column）
			editor.setText("abcdefghij\n\nabcdefghij");
			assert.deepStrictEqual(editor.getCursor(), { line: 2, col: 10 }); // At end
			// 位于末尾

			// Move up - should capture new sticky from current position (10)
			// 向上移动 —— 应当以当前位置（10）作为新的粘滞列
			editor.handleInput("\x1b[A"); // Up - line 1, col 0
			// 上箭头 —— 第 1 行，第 0 列
			editor.handleInput("\x1b[A"); // Up - line 0, col 10
			// 上箭头 —— 第 0 行，第 10 列
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 10 });
		});

		it("sets preferredVisualCol when pressing right at end of prompt (last line)", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			// Line 0: 20 chars with 'x' at col 10
			// 第 0 行：20 个字符，'x' 位于第 10 列
			// Line 1: empty
			// 第 1 行：空行
			// Line 2: 10 chars ending with '_'
			// 第 2 行：10 个字符，以 '_' 结尾
			editor.setText("111111111x1111111111\n\n333333333_");

			// Go to line 0, press Ctrl+E (end of line) - col 20
			// 跳到第 0 行，按 Ctrl+E（行末）—— 第 20 列
			editor.handleInput("\x1b[A"); // Up to line 1
			// 向上移动到第 1 行
			editor.handleInput("\x1b[A"); // Up to line 0
			// 向上移动到第 0 行
			editor.handleInput("\x05"); // Ctrl+E - move to end of line
			// Ctrl+E —— 移动到行末
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 20 });

			// Move down to line 2 - cursor clamped to col 10 (end of line)
			// 向下移动到第 2 行 —— 光标被钳制到第 10 列（行末）
			editor.handleInput("\x1b[B"); // Down to line 1, col 0
			// 向下移动到第 1 行第 0 列
			editor.handleInput("\x1b[B"); // Down to line 2, col 10 (clamped)
			// 向下移动到第 2 行第 10 列（被钳制）
			assert.deepStrictEqual(editor.getCursor(), { line: 2, col: 10 });

			// Press Right at end of prompt - nothing visible happens, but sets preferredVisualCol to 10
			// 在提示末尾按右箭头 —— 表面上没有变化，但会把 preferredVisualCol 设为 10
			editor.handleInput("\x1b[C"); // Right - can't move, but sets preferredVisualCol
			// 右箭头 —— 无法再移动，但会设置 preferredVisualCol
			assert.deepStrictEqual(editor.getCursor(), { line: 2, col: 10 }); // Still at same position
			// 仍处于同一位置

			// Move up twice to line 0 - should use preferredVisualCol (10) to land on 'x'
			// 向上移动两次到第 0 行 —— 应当使用 preferredVisualCol（10）落在 'x' 上
			editor.handleInput("\x1b[A"); // Up to line 1, col 0
			// 向上移动到第 1 行第 0 列
			editor.handleInput("\x1b[A"); // Up to line 0, col 10 (on 'x')
			// 向上移动到第 0 行第 10 列（位于 'x' 上）
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 10 });
		});

		it("handles editor resizes when preferredVisualCol is on the same line", () => {
			// Create editor with wider terminal
			// 使用更宽的终端创建编辑器
			const tui = createTestTUI(80, 24);
			const editor = new Editor(tui, defaultEditorTheme);

			editor.setText("12345678901234567890\n\n12345678901234567890");

			// Start at line 2, col 15
			// 起始位置为第 2 行第 15 列
			editor.handleInput("\x01"); // Ctrl+A
			// Ctrl+A（移动到开头）
			for (let i = 0; i < 15; i++) editor.handleInput("\x1b[C");

			// Move up through empty line - establishes sticky col 15
			// 向上移动并穿过空行 —— 确立粘滞列 15
			editor.handleInput("\x1b[A"); // Up
			// 上箭头
			editor.handleInput("\x1b[A"); // Up - line 0, col 15
			// 上箭头 —— 第 0 行，第 15 列
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 15 });

			// Render with narrower width to simulate resize
			// 以更窄的宽度渲染以模拟尺寸变化
			editor.render(12); // Width 12
			// 宽度为 12

			// Move down - sticky should be clamped to new width
			// 向下移动 —— 粘滞列应当被钳制到新的宽度内
			editor.handleInput("\x1b[B"); // Down - line 1
			// 下箭头 —— 第 1 行
			editor.handleInput("\x1b[B"); // Down - line 2, col should be clamped
			// 下箭头 —— 第 2 行，列应当被钳制
			assert.equal(editor.getCursor().col, 4);
		});

		it("handles editor resizes when preferredVisualCol is on a different line", () => {
			const tui = createTestTUI(80, 24);
			const editor = new Editor(tui, defaultEditorTheme);

			// Create a line that wraps into multiple visual lines at width 10
			// 构造一行在宽度 10 下会折成多个视觉行的文本
			// "12345678901234567890" = 20 chars, wraps to 2 visual lines at width 10
			// "12345678901234567890" = 20 个字符，在宽度 10 下折为 2 个视觉行
			editor.setText("short\n12345678901234567890");

			// Go to line 1, col 15
			// 跳到第 1 行第 15 列
			editor.handleInput("\x01"); // Ctrl+A
			// Ctrl+A（移动到开头）
			for (let i = 0; i < 15; i++) editor.handleInput("\x1b[C");
			assert.deepStrictEqual(editor.getCursor(), { line: 1, col: 15 });

			// Move up to establish sticky col 15
			// 向上移动以确立粘滞列（sticky column）15
			editor.handleInput("\x1b[A"); // Up to line 0
			// 向上移动到第 0 行
			// Line 0 has only 5 chars, so cursor at col 5
			// 第 0 行只有 5 个字符，因此光标位于第 5 列
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 5 });

			// Narrow the editor
			// 收窄编辑器
			editor.render(10);

			// Move down - preferredVisualCol was 15, but width is 10
			// 向下移动 —— preferredVisualCol 曾为 15，但宽度只有 10
			// Should land on line 1, clamped to width (visual col 9, which is logical col 9)
			// 应当落到第 1 行，并被钳制在宽度内（视觉列 9，对应逻辑列 9）
			editor.handleInput("\x1b[B"); // Down to line 1
			// 向下移动到第 1 行
			assert.deepStrictEqual(editor.getCursor(), { line: 1, col: 8 });

			// Move up
			// 向上移动
			editor.handleInput("\x1b[A"); // Up - should go to line 0
			// 上箭头 —— 应当跳到第 0 行
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 5 }); // Line 0 only has 5 chars
			// 第 0 行只有 5 个字符

			// Restore the original width
			// 恢复原来的宽度
			editor.render(80);

			// Move down - preferredVisualCol was kept at 15
			// 向下移动 —— preferredVisualCol 仍保持为 15
			editor.handleInput("\x1b[B"); // Down to line 1
			// 向下移动到第 1 行
			assert.deepStrictEqual(editor.getCursor(), { line: 1, col: 15 });
		});

		it("rewrapped lines: target fits current visual column", () => {
			const tui = createTestTUI(80, 24);
			const editor = new Editor(tui, defaultEditorTheme);
			editor.setText("abcdefghijklmnopqr\n123456789012345678");

			positionCursor(editor, 0, 18);
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 18 });

			// Narrow to width 10 (layoutWidth = 9).
			// 收窄到宽度 10（layoutWidth = 9）。
			// Line 0 last segment has visual col max 9, line 1 first segment max 8
			// 第 0 行最后一个片段的视觉列最大为 9，第 1 行第一个片段最大为 8
			editor.render(10);

			// Move down: cursor clamps to 8
			// 向下移动：光标被钳制为 8
			editor.handleInput("\x1b[B");
			assert.deepStrictEqual(editor.getCursor(), { line: 1, col: 8 });

			// Widen back. Move up, the current visual col wins
			// 重新加宽。向上移动时，以当前视觉列为准
			editor.render(80);
			editor.handleInput("\x1b[A");
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 8 });

			// Preferred was cleared by the rewrapped branch
			// preferred（首选列）已被重新折行分支清除
			editor.handleInput("\x1b[B");
			assert.deepStrictEqual(editor.getCursor(), { line: 1, col: 8 });
		});

		it("rewrapped lines: target shorter than current visual column", () => {
			const tui = createTestTUI(80, 24);
			const editor = new Editor(tui, defaultEditorTheme);
			editor.setText("abcdefghijklmnopqr\n123456789012345678\nab");

			positionCursor(editor, 0, 18);
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 18 });

			// Narrow to width 10 (layoutWidth = 9). Moving down clamps to col 8
			// 收窄到宽度 10（layoutWidth = 9）。向下移动时被钳制到第 8 列
			editor.render(10);
			editor.handleInput("\x1b[B");
			assert.deepStrictEqual(editor.getCursor(), { line: 1, col: 8 });

			// Widen the editor
			// 加宽编辑器
			editor.render(80);

			// Move down to short line "ab".
			// 向下移动到较短的行 "ab"。
			// preferredVisualCol is replaced with current visual col (8), cursor clamps to 2
			// preferredVisualCol 被替换为当前视觉列（8），光标被钳制为 2
			editor.handleInput("\x1b[B");
			assert.deepStrictEqual(editor.getCursor(), { line: 2, col: 2 });

			// Moving up restores to preferred col 8
			// 向上移动会恢复到首选列 8
			editor.handleInput("\x1b[A");
			assert.deepStrictEqual(editor.getCursor(), { line: 1, col: 8 });
		});
	});

	describe("Paste marker atomic behavior", () => {
		/** Helper: simulate a large paste that creates a marker */
		function pasteWithMarker(editor: Editor): string {
			const bigContent = "line\n".repeat(20).trimEnd(); // 20 lines
			// 20 行
			editor.handleInput(`\x1b[200~${bigContent}\x1b[201~`);
			// The editor replaces large pastes with a marker like "[paste #1 +20 lines]"
			// 编辑器会把大段粘贴内容替换为形如 "[paste #1 +20 lines]" 的标记
			return editor.getText();
		}

		/** Helper: 12-line paste content with a distinguishing tag */
		function bigPaste(tag: string): string {
			return Array.from({ length: 12 }, (_, i) => `${tag}${i}`).join("\n");
		}

		it("creates a paste marker for large pastes", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);
			const text = pasteWithMarker(editor);
			assert.match(text, /\[paste #\d+ \+\d+ lines\]/);
		});

		it("treats paste marker as single unit for right arrow", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);
			editor.handleInput("A");
			pasteWithMarker(editor);
			editor.handleInput("B");
			// Text: "A[paste #1 +20 lines]B", cursor at end
			// 文本："A[paste #1 +20 lines]B"，光标位于末尾

			// Go to start
			// 跳到开头
			editor.handleInput("\x01"); // Ctrl+A
			// Ctrl+A（移动到开头）
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 0 });

			// Right arrow: should move past "A"
			// 右箭头：应当越过 "A"
			editor.handleInput("\x1b[C");
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 1 });

			// Right arrow: should skip the entire marker
			// 右箭头：应当整体跳过标记
			editor.handleInput("\x1b[C");
			const marker = editor.getText().match(/\[paste #\d+ \+\d+ lines\]/)![0];
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 1 + marker.length });

			// Right arrow: should move past "B"
			// 右箭头：应当越过 "B"
			editor.handleInput("\x1b[C");
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 1 + marker.length + 1 });
		});

		it("treats paste marker as single unit for left arrow", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);
			editor.handleInput("A");
			pasteWithMarker(editor);
			editor.handleInput("B");
			// Cursor at end
			// 光标位于末尾

			// Left arrow: past "B"
			// 左箭头：越过 "B"
			editor.handleInput("\x1b[D");
			const text = editor.getText();
			const marker = text.match(/\[paste #\d+ \+\d+ lines\]/)![0];
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 1 + marker.length });

			// Left arrow: skip the entire marker
			// 左箭头：整体跳过标记
			editor.handleInput("\x1b[D");
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 1 });

			// Left arrow: past "A"
			// 左箭头：越过 "A"
			editor.handleInput("\x1b[D");
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 0 });
		});

		it("treats paste marker as single unit for backspace", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);
			editor.handleInput("A");
			pasteWithMarker(editor);
			editor.handleInput("B");

			const text = editor.getText();
			const marker = text.match(/\[paste #\d+ \+\d+ lines\]/)![0];

			// Position cursor right after the marker (before "B")
			// 将光标定位到标记正后方（"B" 之前）
			editor.handleInput("\x01"); // Ctrl+A
			// Ctrl+A（移动到开头）
			// Move past "A" and the marker
			// 越过 "A" 和标记
			editor.handleInput("\x1b[C"); // past "A"
			// 越过 "A"
			editor.handleInput("\x1b[C"); // past marker
			// 越过标记（marker）
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 1 + marker.length });

			// Backspace: should delete the entire marker at once
			// 退格：应当一次性删除整个标记
			editor.handleInput("\x7f");
			assert.strictEqual(editor.getText(), "AB");
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 1 });
		});

		it("treats paste marker as single unit for forward delete", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);
			editor.handleInput("A");
			pasteWithMarker(editor);
			editor.handleInput("B");

			// Position cursor on "A" (col 0) then move right once to be just before marker
			// 将光标定位到 "A" 上（第 0 列），再向右移动一次，使其恰好位于标记之前
			editor.handleInput("\x01"); // Ctrl+A
			// Ctrl+A（移动到开头）
			editor.handleInput("\x1b[C"); // past "A", now at col 1 (start of marker)
			// 越过 "A"，现在位于第 1 列（标记起始处）

			// Forward delete: should delete the entire marker at once
			// 向前删除：应当一次性删除整个标记
			editor.handleInput("\x1b[3~"); // Delete key
			// Delete 键
			assert.strictEqual(editor.getText(), "AB");
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 1 });
		});

		it("treats paste marker as single unit for word movement", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);
			editor.handleInput("X");
			editor.handleInput(" ");
			pasteWithMarker(editor);
			editor.handleInput(" ");
			editor.handleInput("Y");
			// Text: "X [paste #1 +20 lines] Y"
			// 文本："X [paste #1 +20 lines] Y"

			const text = editor.getText();
			const marker = text.match(/\[paste #\d+ \+\d+ lines\]/)![0];

			// Go to start
			// 跳到开头
			editor.handleInput("\x01"); // Ctrl+A
			// Ctrl+A（移动到开头）

			// Ctrl+Right: skip "X"
			// Ctrl+Right：跳过 "X"
			editor.handleInput("\x1b[1;5C");
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 1 });

			// Ctrl+Right: skip whitespace + marker (marker treated as single non-ws, non-punct unit)
			// Ctrl+Right：跳过空白字符 + 标记（标记被视为一个非空白、非标点的整体单元）
			editor.handleInput("\x1b[1;5C");
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 2 + marker.length });
		});

		it("undo restores marker after backspace deletion", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);
			editor.handleInput("A");
			pasteWithMarker(editor);
			editor.handleInput("B");

			const textBefore = editor.getText();

			// Position after marker
			// 定位到标记之后
			editor.handleInput("\x01");
			editor.handleInput("\x1b[C"); // past A
			// 越过 A
			editor.handleInput("\x1b[C"); // past marker
			// 越过标记（marker）

			// Delete marker
			// 删除标记
			editor.handleInput("\x7f");
			assert.strictEqual(editor.getText(), "AB");

			// Undo
			// 撤销
			editor.handleInput("\x1b[45;5u");
			assert.strictEqual(editor.getText(), textBefore);
		});

		it("undo after paste marker deletion restores the paste registry", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);
			let submitted = "";
			editor.onSubmit = (t) => {
				submitted = t;
			};

			const paste = bigPaste("alpha");
			editor.handleInput(`\x1b[200~${paste}\x1b[201~`);
			editor.handleInput("\x7f"); // delete the marker
			// 删除该标记
			editor.handleInput("\x1b[45;5u"); // undo: restores marker text and registry
			// 撤销：恢复标记文本及其注册表（registry）
			editor.handleInput("\r");
			assert.strictEqual(submitted, paste);
		});

		it("undo after deleting the first of two paste markers restores both registry entries", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);
			let submitted = "";
			editor.onSubmit = (t) => {
				submitted = t;
			};

			const pasteA = bigPaste("alpha");
			const pasteB = bigPaste("beta");
			editor.handleInput(`\x1b[200~${pasteA}\x1b[201~`); // #1 = A
			// #1 = A（第 1 个粘贴条目为 A）
			editor.handleInput(`\x1b[200~${pasteB}\x1b[201~`); // #2 = B, cursor at end
			// #2 = B，光标位于末尾
			editor.handleInput("\x01"); // Ctrl+A
			// Ctrl+A（移动到开头）
			editor.handleInput("\x1b[C"); // right over marker #1
			// 向右越过标记 #1
			editor.handleInput("\x7f"); // delete marker #1, renumbers #2 -> #1
			// 删除标记 #1，#2 重新编号为 #1
			editor.handleInput("\x1b[45;5u"); // undo
			// 撤销
			editor.handleInput("\r");
			assert.strictEqual(submitted, pasteA + pasteB);
		});

		it("renumbers the paste registry in ascending id order when markers are out of order in text", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);
			let submitted = "";
			editor.onSubmit = (t) => {
				submitted = t;
			};

			const pasteA = bigPaste("alpha");
			const pasteB = bigPaste("beta");
			const pasteC = bigPaste("gamma");
			editor.handleInput(`\x1b[200~${pasteA}\x1b[201~`); // #1 = A
			// #1 = A（第 1 个粘贴条目为 A）
			editor.handleInput("\x01"); // Ctrl+A
			// Ctrl+A（移动到开头）
			editor.handleInput(`\x1b[200~${pasteB}\x1b[201~`); // #2 = B, text: [#2][#1]
			// #2 = B，文本：[#2][#1]
			editor.handleInput("\x01"); // Ctrl+A
			// Ctrl+A（移动到开头）
			editor.handleInput(`\x1b[200~${pasteC}\x1b[201~`); // #3 = C, text: [#3][#2][#1]
			// #3 = C，文本：[#3][#2][#1]
			editor.handleInput("\x05"); // Ctrl+E
			// Ctrl+E（移动到行末）
			editor.handleInput("\x7f"); // delete marker #1, renumber #3 -> #2 and #2 -> #1
			// 删除标记 #1，#3 重新编号为 #2、#2 重新编号为 #1
			editor.handleInput("\r");
			assert.strictEqual(submitted, pasteC + pasteB);
		});

		it("undo after setText restores paste markers and registry", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);
			let submitted = "";
			editor.onSubmit = (t) => {
				submitted = t;
			};

			const paste = bigPaste("alpha");
			editor.handleInput(`\x1b[200~${paste}\x1b[201~`);
			editor.setText("replacement");
			editor.handleInput("\x1b[45;5u"); // undo
			// 撤销
			editor.handleInput("\r");
			assert.strictEqual(submitted, paste);
		});

		it("handles multiple paste markers in same line", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);
			pasteWithMarker(editor);
			editor.handleInput(" ");
			pasteWithMarker(editor);

			const text = editor.getText();
			const markers = [...text.matchAll(/\[paste #\d+ \+\d+ lines\]/g)];
			assert.strictEqual(markers.length, 2);

			// Go to start
			// 跳到开头
			editor.handleInput("\x01");

			// Right arrow: should skip first marker atomically
			// 右箭头：应当把第一个标记作为整体原子跳过
			editor.handleInput("\x1b[C");
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: markers[0]![0].length });

			// Right arrow: past space
			// 右箭头：越过空格
			editor.handleInput("\x1b[C");
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: markers[0]![0].length + 1 });

			// Right arrow: should skip second marker atomically
			// 右箭头：应当把第二个标记作为整体原子跳过
			editor.handleInput("\x1b[C");
			assert.deepStrictEqual(editor.getCursor(), {
				line: 0,
				col: markers[0]![0].length + 1 + markers[1]![0].length,
			});
		});

		it("does not treat manually typed marker-like text as atomic (no valid paste ID)", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);
			// Type text that matches the pattern but was typed manually (no paste entry)
			// 输入符合该模式但由手动键入的文本（不存在对应的粘贴记录）
			const fakeMarker = "[paste #99 +5 lines]";
			for (const ch of fakeMarker) editor.handleInput(ch);

			assert.strictEqual(editor.getText(), fakeMarker);

			// No paste with ID 99 exists, so the marker is NOT treated atomically.
			// 不存在 ID 为 99 的粘贴记录，因此该标记不会被作为原子单元处理。
			// Right arrow should move one grapheme at a time.
			// 右箭头每次应当移动一个字形（grapheme）。
			editor.handleInput("\x01"); // Ctrl+A
			// Ctrl+A（移动到开头）
			editor.handleInput("\x1b[C"); // Right
			// 右箭头
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 1 }); // Just past "["
			// 刚好越过 "["
		});

		it("does not crash when paste marker is wider than terminal width", () => {
			// Reproduce: terminal width 8, paste marker "[paste #1 +47 lines]" (21 chars)
			// 复现场景：终端宽度 8，粘贴标记 "[paste #1 +47 lines]"（21 个字符）
			const tui = createTestTUI();
			const editor = new Editor(tui, defaultEditorTheme);
			const bigContent = "line\n".repeat(47).trimEnd();
			editor.handleInput(`\x1b[200~${bigContent}\x1b[201~`);

			const text = editor.getText();
			const marker = text.match(/\[paste #\d+ \+\d+ lines\]/);
			assert.ok(marker, "paste marker should be created");
			assert.ok(visibleWidth(marker[0]) > 8, "marker should be wider than render width");

			// Render at very narrow width - should not throw
			// 以极窄的宽度渲染 —— 不应抛出异常
			const lines = editor.render(8);
			// Every rendered line must fit within the width (marker is split)
			// 每一渲染行都必须适配给定宽度（标记会被拆分）
			for (const line of lines) {
				assert.ok(
					visibleWidth(line) <= 8,
					`line exceeds width 8: visible=${visibleWidth(line)} text=${JSON.stringify(line)}`,
				);
			}
		});

		it("does not crash when text + paste marker exceeds terminal width with cursor on marker", () => {
			// Reproduce: terminal width 54, text "b".repeat(35) + "[paste #1 +27 lines]" + "bbbb"
			// 复现场景：终端宽度 54，文本为 "b".repeat(35) + "[paste #1 +27 lines]" + "bbbb"
			// Cursor lands on the paste marker after word-wrap, causing the rendered line
			// 按单词折行后光标落在粘贴标记上，导致渲染出的行
			// to be 55 visible chars (1 over the width).
			// 达到 55 个可见字符（超出宽度 1 个字符）。
			const tui = createTestTUI();
			const editor = new Editor(tui, defaultEditorTheme);

			// Type 35 'b' characters
			// 输入 35 个 'b' 字符
			for (let i = 0; i < 35; i++) editor.handleInput("b");

			// Paste 27 lines
			// 粘贴 27 行
			const bigContent = "line\n".repeat(27).trimEnd();
			editor.handleInput(`\x1b[200~${bigContent}\x1b[201~`);

			// Type a few more characters
			// 再输入若干字符
			for (let i = 0; i < 4; i++) editor.handleInput("b");

			// Move cursor left to land on the paste marker
			// 将光标向左移动，使其落在粘贴标记（paste marker）上
			editor.handleInput("\x1b[D"); // past last 'b'
			// 越过最后一个 'b'
			editor.handleInput("\x1b[D"); // past last 'b'
			// 越过最后一个 'b'
			editor.handleInput("\x1b[D"); // past last 'b'
			// 越过最后一个 'b'
			editor.handleInput("\x1b[D"); // past last 'b'
			// 越过最后一个 'b'
			editor.handleInput("\x1b[D"); // now on the paste marker
			// 现在位于粘贴标记上

			// Render at width 54 - should not throw
			// 以宽度 54 渲染 —— 不应抛出异常
			const renderWidth = 54;
			const lines = editor.render(renderWidth);
			for (const line of lines) {
				assert.ok(
					visibleWidth(line) <= renderWidth,
					`line exceeds width ${renderWidth}: visible=${visibleWidth(line)} text=${JSON.stringify(line)}`,
				);
			}
		});

		it("wordWrapLine re-checks overflow after backtracking to wrap opportunity", () => {
			// Reproduce crash #2: " " + "b".repeat(35) + atomic_marker(20 chars) + "bbbb"
			// 复现崩溃 #2：" " + "b".repeat(35) + 原子标记（20 个字符）+ "bbbb"
			// layoutWidth=53. After wrapping at the space, the remaining 35 b's + marker = 55
			// layoutWidth=53。在空格处折行后，剩余的 35 个 'b' + 标记 = 55
			// must trigger a second force-break instead of silently overflowing.
			// 必须触发第二次强制断行，而不是悄悄地溢出。
			const tui = createTestTUI();
			const editor = new Editor(tui, defaultEditorTheme);

			// Type a space, then 35 b's
			// 先输入一个空格，然后输入 35 个 'b'
			editor.handleInput(" ");
			for (let i = 0; i < 35; i++) editor.handleInput("b");

			// Paste 27 lines to create marker
			// 粘贴 27 行以生成标记
			const bigContent = "line\n".repeat(27).trimEnd();
			editor.handleInput(`\x1b[200~${bigContent}\x1b[201~`);

			// Type trailing chars
			// 输入尾部字符
			for (let i = 0; i < 4; i++) editor.handleInput("b");

			// Render at width 54 (contentWidth=54, layoutWidth=53 with paddingX=0)
			// 以宽度 54 渲染（contentWidth=54，paddingX=0 时 layoutWidth=53）
			const renderWidth = 54;
			const lines = editor.render(renderWidth);
			for (const line of lines) {
				assert.ok(
					visibleWidth(line) <= renderWidth,
					`line exceeds width ${renderWidth}: visible=${visibleWidth(line)} text=${JSON.stringify(line)}`,
				);
			}
		});

		it("expands large pasted content literally in getExpandedText", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);
			const pastedText = [
				"line 1",
				"line 2",
				"line 3",
				"line 4",
				"line 5",
				"line 6",
				"line 7",
				"line 8",
				"line 9",
				"line 10",
				"tokens $1 $2 $& $$ $` $' end",
			].join("\n");

			editor.handleInput(`\x1b[200~${pastedText}\x1b[201~`);

			assert.match(editor.getText(), /\[paste #\d+ \+\d+ lines\]/);
			assert.strictEqual(editor.getExpandedText(), pastedText);
		});

		it("snaps to the paste marker start when navigating down into it", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);

			// Line 0: long enough text to establish a sticky column
			// 第 0 行：足够长的文本，用于确立粘滞列
			editor.setText("12345678901234567890\n\nhello ");

			// Create a large paste to get a marker
			// 创建一次大段粘贴以生成标记
			const bigContent = "x".repeat(2000);
			editor.handleInput(`\x1b[200~${bigContent}\x1b[201~`);
			editor.render(80);

			const text = editor.getText();
			const _marker = text.match(/\[paste #\d+ \d+ chars\]/)![0];
			// Line 0: "12345678901234567890"
			// 第 0 行："12345678901234567890"
			// Line 1: "" (empty)
			// 第 1 行："" （空行）
			// Line 2: "hello [paste #1 2000 chars]"
			// 第 2 行："hello [paste #1 2000 chars]"
			//         marker starts at col 6
			// 标记从第 6 列开始

			// Navigate to line 0, col 10
			// 导航到第 0 行第 10 列
			editor.handleInput("\x1b[A"); // Up to line 1
			// 向上移动到第 1 行
			editor.handleInput("\x1b[A"); // Up to line 0
			// 向上移动到第 0 行
			editor.handleInput("\x01"); // Ctrl+A (start of line)
			// Ctrl+A（行首）
			for (let i = 0; i < 10; i++) editor.handleInput("\x1b[C"); // Right 10
			// 向右移动 10 次
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 10 });

			// Down to empty line
			// 向下移动到空行
			editor.handleInput("\x1b[B");
			assert.deepStrictEqual(editor.getCursor(), { line: 1, col: 0 });

			// Down to paste marker line - sticky col 10 falls inside marker (starts at col 6).
			// 向下移动到粘贴标记所在行 —— 粘滞列 10 落在标记内部（标记从第 6 列开始）。
			// Cursor should snap to start of marker (col 6), not end (col 6 + marker.length).
			// 光标应当吸附到标记的起始处（第 6 列），而不是末尾（第 6 列 + marker.length）。
			editor.handleInput("\x1b[B");
			assert.deepStrictEqual(editor.getCursor(), { line: 2, col: 6 });
		});

		it("preserves sticky column when navigating through paste marker line", () => {
			const tui = createTestTUI(30, 24);
			const editor = new Editor(tui, defaultEditorTheme);

			// Build:
			// 构造：
			// Line 0: "1234567890123456" (16 chars)
			// 第 0 行："1234567890123456"（16 个字符）
			// Line 1: "" (empty)
			// 第 1 行："" （空行）
			// Line 2: "[paste #1 2000 chars]" (22 chars, paste marker)
			// 第 2 行："[paste #1 2000 chars]"（22 个字符，粘贴标记）
			// Line 3: "" (empty)
			// 第 3 行："" （空行）
			// Line 4: "abcdefghijklmnop" (16 chars)
			// 第 4 行："abcdefghijklmnop"（16 个字符）
			for (const ch of "1234567890123456") editor.handleInput(ch);
			editor.handleInput("\n");
			editor.handleInput("\n");
			editor.handleInput(`\x1b[200~${"x".repeat(2000)}\x1b[201~`);
			editor.handleInput("\n");
			editor.handleInput("\n");
			for (const ch of "abcdefghijklmnop") editor.handleInput(ch);
			editor.render(30);

			// Navigate to line 0, col 10
			// 导航到第 0 行第 10 列
			for (let i = 0; i < 4; i++) editor.handleInput("\x1b[A"); // Up to line 0
			// 向上移动到第 0 行
			editor.handleInput("\x01"); // Ctrl+A
			// Ctrl+A（移动到开头）
			for (let i = 0; i < 10; i++) editor.handleInput("\x1b[C");
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 10 });

			// Down to empty line - sticky col 10 established
			// 向下移动到空行 —— 已确立粘滞列 10
			editor.handleInput("\x1b[B");
			assert.deepStrictEqual(editor.getCursor(), { line: 1, col: 0 });

			// Down to paste marker - cursor snapped to col 0 (start of marker)
			// 向下移动到粘贴标记 —— 光标吸附到第 0 列（标记起始处）
			editor.handleInput("\x1b[B");
			assert.deepStrictEqual(editor.getCursor(), { line: 2, col: 0 });

			// Down to empty line
			// 向下移动到空行
			editor.handleInput("\x1b[B");
			assert.deepStrictEqual(editor.getCursor(), { line: 3, col: 0 });

			// Down to last line - should restore sticky col 10
			// 向下移动到最后一行 —— 应当恢复粘滞列 10
			editor.handleInput("\x1b[B");
			assert.deepStrictEqual(editor.getCursor(), { line: 4, col: 10 });
		});

		it("does not get stuck moving down from a multi-visual-line paste marker", () => {
			const tui = createTestTUI(20, 24);
			const editor = new Editor(tui, defaultEditorTheme);

			// Build:
			// 构造：
			// Logical line 0: "abcdefgh" + marker(21 chars) + "ijklmnopqr"
			// 逻辑行 0："abcdefgh" + 标记（21 个字符）+ "ijklmnopqr"
			// Logical line 1: "123456789012345678"
			// 逻辑行 1："123456789012345678"
			//
			// Marker "[paste #1 +100 lines]" (21 chars) is wider than the
			// 标记 "[paste #1 +100 lines]"（21 个字符）宽于
			// terminal (20). Word-wrap splits at the space before "lines",
			// 终端宽度（20）。按单词折行会在 "lines" 之前的空格处拆分，
			// producing:
			// 产生：
			//   VL1: abcdefgh              (startCol 0,  len 8)
			// VL1：abcdefgh              （startCol 0，长度 8）
			//   VL2: [paste #1 +100        (startCol 8,  len 15) <- marker head
			// VL2：[paste #1 +100        （startCol 8，长度 15）<- 标记头部
			//   VL3: lines]ijklmnopqr      (startCol 23, len 16) <- marker tail + content
			// VL3：lines]ijklmnopqr      （startCol 23，长度 16）<- 标记尾部 + 内容
			//   VL4: 123456789012345678    (line 1)
			// VL4：123456789012345678    （第 1 行）
			//
			// On VL3 the marker tail "lines]" occupies visual cols 0-5.
			// 在 VL3 上，标记尾部 "lines]" 占据视觉列 0-5。
			// Content ("i") starts at visual col 6 = logical col 29.
			// 内容（"i"）从视觉列 6 开始 = 逻辑列 29。
			for (const ch of "abcdefgh") editor.handleInput(ch);
			const bigContent = "line\n".repeat(100).trimEnd();
			editor.handleInput(`\x1b[200~${bigContent}\x1b[201~`);
			for (const ch of "ijklmnopqr") editor.handleInput(ch);
			editor.handleInput("\n");
			for (const ch of "123456789012345678") editor.handleInput(ch);
			editor.render(20);

			const text = editor.getText();
			const markerMatch = text.match(/\[paste #\d+ \+\d+ lines]/);
			assert.ok(markerMatch, "paste marker should be created");
			const markerLen = markerMatch[0].length; // 21
			assert.ok(markerLen > 20, "marker should be wider than terminal");
			const markerStart = 8;
			const markerEnd = markerStart + markerLen; // 29

			// Navigate to line 0, col 6 (on "g"). Preferred col 6 is past the
			// 导航到第 0 行第 6 列（位于 "g" 上）。首选列 6 已越过
			// marker tail on VL3, so the cursor should land on content ("i" at
			// VL3 上的标记尾部，因此光标应当落在内容上（位于
			// col 29) without snapping back.
			// 第 29 列的 "i"），且不应回弹。
			editor.handleInput("\x1b[A"); // Up to line 0
			// 向上移动到第 0 行
			editor.handleInput("\x01"); // Ctrl+A (start of line)
			// Ctrl+A（行首）
			for (let i = 0; i < 6; i++) editor.handleInput("\x1b[C"); // Right to col 6
			// 向右移动到第 6 列
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 6 });

			// Down: cursor lands on paste marker start
			// 下箭头：光标落在粘贴标记的起始位置
			editor.handleInput("\x1b[B");
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: markerStart });

			// Down again: preferred col 6 lands at VL3 col 29 ("i"), which is
			// 再按下箭头：首选列 6 落到 VL3 的第 29 列（"i"），该位置
			// past the marker. Cursor stays on line 0.
			// 越过该标记。光标仍停留在第 0 行。
			editor.handleInput("\x1b[B");
			assert.strictEqual(editor.getCursor().line, 0);
			assert.strictEqual(editor.getCursor().col, markerEnd); // col 29 = "i"
			// 第 29 列 = "i"

			// Up: back to paste marker
			// 上箭头：回到粘贴标记
			editor.handleInput("\x1b[A");
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: markerStart });

			// Up again: back to col 6 ("g")
			// 再按上箭头：回到第 6 列（"g"）
			editor.handleInput("\x1b[A");
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 6 });
		});

		it("skips marker continuation VLs when preferred col falls in marker tail", () => {
			const tui = createTestTUI(20, 24);
			const editor = new Editor(tui, defaultEditorTheme);

			// Same layout. Start at col 3 ("d"). Preferred col 3 maps to VL3
			// 布局相同。起始位置为第 3 列（"d"）。首选列 3 映射到 VL3 的
			// visual col 3 which is inside the "lines]" marker tail.
			// 视觉列 3，它位于 "lines]" 标记尾部之内。
			// moveToVisualLine detects the continuation VL and skips to VL4
			// moveToVisualLine 会检测到延续的视觉行并跳到 VL4
			// (line 1).
			// （第 1 行）。
			//   VL1: abcdefgh              (startCol 0,  len 8)
			// VL1：abcdefgh              （startCol 0，长度 8）
			//   VL2: [paste #1 +100        (startCol 8,  len 15) <- marker head
			// VL2：[paste #1 +100        （startCol 8，长度 15）<- 标记头部
			//   VL3: lines]ijklmnopqr      (startCol 23, len 16) <- marker tail + content
			// VL3：lines]ijklmnopqr      （startCol 23，长度 16）<- 标记尾部 + 内容
			//   VL4: 123456789012345678    (line 1)
			// VL4：123456789012345678    （第 1 行）
			for (const ch of "abcdefgh") editor.handleInput(ch);
			const bigContent = "line\n".repeat(100).trimEnd();
			editor.handleInput(`\x1b[200~${bigContent}\x1b[201~`);
			for (const ch of "ijklmnopqr") editor.handleInput(ch);
			editor.handleInput("\n");
			for (const ch of "123456789012345678") editor.handleInput(ch);
			editor.render(20);

			// Navigate to line 0, col 3 (on "d")
			// 导航到第 0 行第 3 列（位于 "d" 上）
			editor.handleInput("\x1b[A"); // Up to line 0
			// 向上移动到第 0 行
			editor.handleInput("\x01"); // Ctrl+A
			// Ctrl+A（移动到开头）
			for (let i = 0; i < 3; i++) editor.handleInput("\x1b[C");
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 3 });

			// Down: marker
			// 下箭头：标记
			editor.handleInput("\x1b[B");
			assert.strictEqual(editor.getCursor().col, 8);

			// Down: skips VL3 (col 3 in marker tail) and lands on line 1
			// 下箭头：跳过 VL3（标记尾部的第 3 列）并落到第 1 行
			editor.handleInput("\x1b[B");
			assert.deepStrictEqual(editor.getCursor(), { line: 1, col: 3 });

			// Round-trip back
			// 往返回到原位
			editor.handleInput("\x1b[A");
			assert.strictEqual(editor.getCursor().col, 8); // marker
			// 标记
			editor.handleInput("\x1b[A");
			assert.deepStrictEqual(editor.getCursor(), { line: 0, col: 3 });
		});

		it("submits large pasted content literally", () => {
			const editor = new Editor(createTestTUI(), defaultEditorTheme);
			const pastedText = [
				"line 1",
				"line 2",
				"line 3",
				"line 4",
				"line 5",
				"line 6",
				"line 7",
				"line 8",
				"line 9",
				"line 10",
				"tokens $1 $2 $& $$ $` $' end",
			].join("\n");
			let submitted = "";
			editor.onSubmit = (text) => {
				submitted = text;
			};

			editor.handleInput(`\x1b[200~${pastedText}\x1b[201~`);
			editor.handleInput("\r");

			assert.strictEqual(submitted, pastedText);
		});
	});
});
