/**
 * Bug regression test for isImageLine() crash scenario
 * 针对 isImageLine() 崩溃场景的缺陷回归测试
 *
 * Bug: When isImageLine() used startsWith() and terminal doesn't support images,
 * it would return false for lines containing image escape sequences, causing TUI to
 * crash with "Rendered line exceeds terminal width" error.
 * 缺陷：当 isImageLine() 使用 startsWith() 且终端不支持图像时，
 * 对于包含图像转义序列的行它会返回 false，从而导致 TUI 抛出
 * "Rendered line exceeds terminal width" 错误并崩溃。
 *
 * Fix: Changed to use includes() to detect escape sequences anywhere in the line.
 * 修复：改用 includes()，以便检测出现在行内任意位置的转义序列。
 *
 * This test demonstrates:
 * 本测试演示了：
 * 1. The bug scenario with the old implementation
 * 1. 旧实现下的缺陷场景
 * 2. That the fix works correctly
 * 2. 修复方案能够正确工作
 */

import assert from "node:assert";
import { describe, it } from "node:test";

describe("Bug regression: isImageLine() crash with image escape sequences", () => {
	describe("Bug scenario: Terminal without image support", () => {
		it("old implementation would return false, causing crash", () => {
			/**
			 * OLD IMPLEMENTATION (buggy):
			 * 旧实现（有缺陷）：
			 * ```typescript
			 * export function isImageLine(line: string): boolean {
			 *   const prefix = getImageEscapePrefix();
			 *   return prefix !== null && line.startsWith(prefix);
			 * }
			 * ```
			 *
			 * When terminal doesn't support images:
			 * 当终端不支持图像时：
			 * - getImageEscapePrefix() returns null
			 * - getImageEscapePrefix() 返回 null
			 * - isImageLine() returns false even for lines containing image sequences
			 * - 即使行中包含图像序列，isImageLine() 也返回 false
			 * - TUI performs width check on line containing 300KB+ of base64 data
			 * - TUI 会对包含 300KB 以上 base64 数据的行执行宽度检查
			 * - Crash: "Rendered line exceeds terminal width (304401 > 115)"
			 * - 崩溃："Rendered line exceeds terminal width (304401 > 115)"
			 */

			// Simulate old implementation behavior
			// 模拟旧实现的行为
			const oldIsImageLine = (line: string, imageEscapePrefix: string | null): boolean => {
				return imageEscapePrefix !== null && line.startsWith(imageEscapePrefix);
			};

			// When terminal doesn't support images, prefix is null
			// 当终端不支持图像时，prefix 为 null
			const terminalWithoutImageSupport = null;

			// Line containing image escape sequence with text before it (common bug scenario)
			// 前面带有文本、且包含图像转义序列的行（常见的缺陷场景）
			const lineWithImageSequence =
				"Read image file [image/jpeg]\x1b]1337;File=size=800,600;inline=1:base64data...\x07";

			// Old implementation would return false (BUG!)
			// 旧实现会返回 false（这就是缺陷所在！）
			const oldResult = oldIsImageLine(lineWithImageSequence, terminalWithoutImageSupport);
			assert.strictEqual(
				oldResult,
				false,
				"Bug: old implementation returns false for line containing image sequence when terminal has no image support",
			);
		});

		it("new implementation returns true correctly", async () => {
			const { isImageLine } = await import("../src/terminal-image.ts");

			// Line containing image escape sequence with text before it
			// 前面带有文本、且包含图像转义序列的行
			const lineWithImageSequence =
				"Read image file [image/jpeg]\x1b]1337;File=size=800,600;inline=1:base64data...\x07";

			// New implementation should return true (FIX!)
			// 新实现应当返回 true（这就是修复效果！）
			const newResult = isImageLine(lineWithImageSequence);
			assert.strictEqual(newResult, true, "Fix: new implementation returns true for line containing image sequence");
		});

		it("new implementation detects Kitty sequences in any position", async () => {
			const { isImageLine } = await import("../src/terminal-image.ts");

			const scenarios = [
				"At start: \x1b_Ga=T,f=100,data...\x1b\\",
				"Prefix \x1b_Ga=T,data...\x1b\\",
				"Suffix text \x1b_Ga=T,data...\x1b\\ suffix",
				"Middle \x1b_Ga=T,data...\x1b\\ more text",
				// Very long line (simulating 300KB+ crash scenario)
				// 超长行（模拟 300KB 以上的崩溃场景）
				`Text before \x1b_Ga=T,f=100${"A".repeat(300000)} text after`,
			];

			for (const line of scenarios) {
				assert.strictEqual(isImageLine(line), true, `Should detect Kitty sequence in: ${line.slice(0, 50)}...`);
			}
		});

		it("new implementation detects iTerm2 sequences in any position", async () => {
			const { isImageLine } = await import("../src/terminal-image.ts");

			const scenarios = [
				"At start: \x1b]1337;File=size=100,100:base64...\x07",
				"Prefix \x1b]1337;File=inline=1:data==\x07",
				"Suffix text \x1b]1337;File=inline=1:data==\x07 suffix",
				"Middle \x1b]1337;File=inline=1:data==\x07 more text",
				// Very long line (simulating 304KB crash scenario)
				// 超长行（模拟 304KB 的崩溃场景）
				`Text before \x1b]1337;File=size=800,600;inline=1:${"B".repeat(300000)} text after`,
			];

			for (const line of scenarios) {
				assert.strictEqual(isImageLine(line), true, `Should detect iTerm2 sequence in: ${line.slice(0, 50)}...`);
			}
		});
	});

	describe("Integration: Tool execution scenario", () => {
		/**
		 * This simulates what happens when the `read` tool reads an image file.
		 * 这里模拟了 `read` 工具读取图像文件时发生的情况。
		 * The tool result contains both text and image content:
		 * 工具返回的结果同时包含文本内容和图像内容：
		 *
		 * ```typescript
		 * {
		 *   content: [
		 *     { type: "text", text: "Read image file [image/jpeg]\n800x600" },
		 *     { type: "image", data: "base64...", mimeType: "image/jpeg" }
		 *   ]
		 * }
		 * ```
		 *
		 * When this is rendered, the image component creates escape sequences.
		 * 渲染该结果时，图像组件会生成转义序列。
		 * If isImageLine() doesn't detect them, TUI crashes.
		 * 如果 isImageLine() 没有检测到这些序列，TUI 就会崩溃。
		 */

		it("detects image sequences in read tool output", async () => {
			const { isImageLine } = await import("../src/terminal-image.ts");

			// Simulate output when read tool processes an image
			// 模拟 read 工具处理图像时产生的输出
			// The line might have text from the read result plus the image escape sequence
			// 该行可能同时包含读取结果中的文本以及图像转义序列
			const toolOutputLine = "Read image file [image/jpeg]\x1b]1337;File=size=800,600;inline=1:base64image...\x07";

			assert.strictEqual(isImageLine(toolOutputLine), true, "Should detect image sequence in tool output line");
		});

		it("detects Kitty sequences from Image component", async () => {
			const { isImageLine } = await import("../src/terminal-image.ts");

			// Kitty image component creates multi-line output with escape sequences
			// Kitty 图像组件会生成带有转义序列的多行输出
			const kittyLine = "\x1b_Ga=T,f=100,t=f,d=base64data...\x1b\\\x1b_Gm=i=1;\x1b\\";

			assert.strictEqual(isImageLine(kittyLine), true, "Should detect Kitty image component output");
		});

		it("handles ANSI codes before image sequences", async () => {
			const { isImageLine } = await import("../src/terminal-image.ts");

			// Line might have styling (error, warning, etc.) before image data
			// 行内可能在图像数据之前带有样式（错误、警告等）
			const lines = [
				"\x1b[31mError\x1b[0m: \x1b]1337;File=inline=1:base64==\x07",
				"\x1b[33mWarning\x1b[0m: \x1b_Ga=T,data...\x1b\\",
				"\x1b[1mBold\x1b[0m \x1b]1337;File=:base64==\x07\x1b[0m",
			];

			for (const line of lines) {
				assert.strictEqual(
					isImageLine(line),
					true,
					`Should detect image sequence after ANSI codes: ${line.slice(0, 30)}...`,
				);
			}
		});
	});

	describe("Crash scenario simulation", () => {
		it("does NOT crash on very long lines with image sequences", async () => {
			const { isImageLine } = await import("../src/terminal-image.ts");

			/**
			 * Simulate the exact crash scenario:
			 * 精确模拟该崩溃场景：
			 * - Line is 304,401 characters (the crash log showed 58649 > 115)
			 * - 该行长度为 304,401 个字符（崩溃日志中显示 58649 > 115）
			 * - Contains image escape sequence somewhere in the middle
			 * - 在行中间某处包含图像转义序列
			 * - Old implementation would return false, causing TUI to do width check
			 * - 旧实现会返回 false，导致 TUI 执行宽度检查
			 * - New implementation returns true, skipping width check (preventing crash)
			 * - 新实现返回 true，从而跳过宽度检查（避免崩溃）
			 */

			const base64Char = "A".repeat(100);
			const iterm2Sequence = "\x1b]1337;File=size=800,600;inline=1:";

			// Build a line that would cause the crash
			// 构造一行会引发崩溃的内容
			const crashLine =
				"Output: " +
				iterm2Sequence +
				base64Char.repeat(3040) + // ~304,000 chars 约 304,000 个字符
				" end of output";

			// Verify line is very long
			// 验证该行确实非常长
			assert(crashLine.length > 300000, "Test line should be > 300KB");

			// New implementation should detect it (prevents crash)
			// 新实现应当能检测到它（从而避免崩溃）
			const detected = isImageLine(crashLine);
			assert.strictEqual(detected, true, "Should detect image sequence in very long line, preventing TUI crash");
		});

		it("handles lines exactly matching crash log dimensions", async () => {
			const { isImageLine } = await import("../src/terminal-image.ts");

			/**
			 * Crash log showed: line 58649 chars wide, terminal width 115
			 * 崩溃日志显示：行宽为 58649 个字符，而终端宽度为 115
			 * Let's create a line with similar characteristics
			 * 下面构造一行具有类似特征的内容
			 */

			const targetWidth = 58649;
			const prefix = "Text";
			const sequence = "\x1b_Ga=T,f=100";
			const suffix = "End";
			const padding = "A".repeat(targetWidth - prefix.length - sequence.length - suffix.length);
			const line = `${prefix}${sequence}${padding}${suffix}`;

			assert.strictEqual(line.length, 58649);
			assert.strictEqual(isImageLine(line), true, "Should detect image sequence in 58649-char line");
		});
	});

	describe("Negative cases: Don't false positive", () => {
		it("does not detect images in regular long text", async () => {
			const { isImageLine } = await import("../src/terminal-image.ts");

			// Very long line WITHOUT image sequences
			// 不含图像序列的超长行
			const longText = "A".repeat(100000);

			assert.strictEqual(isImageLine(longText), false, "Should not detect images in plain long text");
		});

		it("does not detect images in lines with file paths", async () => {
			const { isImageLine } = await import("../src/terminal-image.ts");

			const filePaths = [
				"/path/to/1337/image.jpg",
				"/usr/local/bin/File_converter",
				"~/Documents/1337File_backup.png",
				"./_G_test_file.txt",
			];

			for (const path of filePaths) {
				assert.strictEqual(isImageLine(path), false, `Should not falsely detect image sequence in path: ${path}`);
			}
		});
	});
});
