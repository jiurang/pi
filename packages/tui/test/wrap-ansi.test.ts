import assert from "node:assert";
import { describe, it } from "node:test";
import { visibleWidth, wrapTextWithAnsi } from "../src/utils.ts";

describe("wrapTextWithAnsi", () => {
	describe("underline styling", () => {
		it("should not apply underline style before the styled text", () => {
			const underlineOn = "\x1b[4m";
			const underlineOff = "\x1b[24m";
			const url = "https://example.com/very/long/path/that/will/wrap";
			const text = `read this thread ${underlineOn}${url}${underlineOff}`;

			const wrapped = wrapTextWithAnsi(text, 40);

			// First line should NOT contain underline code - it's just "read this thread"
			// 第一行不应包含下划线转义码 —— 它只是 "read this thread"
			assert.strictEqual(wrapped[0], "read this thread");

			// Second line should start with underline, have URL content
			// 第二行应以下划线转义码开头，并包含 URL 内容
			assert.strictEqual(wrapped[1].startsWith(underlineOn), true);
			assert.ok(wrapped[1].includes("https://"));
		});

		it("should not have whitespace before underline reset code", () => {
			const underlineOn = "\x1b[4m";
			const underlineOff = "\x1b[24m";
			const textWithUnderlinedTrailingSpace = `${underlineOn}underlined text here ${underlineOff}more`;

			const wrapped = wrapTextWithAnsi(textWithUnderlinedTrailingSpace, 18);

			assert.ok(!wrapped[0].includes(` ${underlineOff}`));
		});

		it("should not bleed underline to padding - each line should end with reset for underline only", () => {
			const underlineOn = "\x1b[4m";
			const underlineOff = "\x1b[24m";
			const url = "https://example.com/very/long/path/that/will/definitely/wrap";
			const text = `prefix ${underlineOn}${url}${underlineOff} suffix`;

			const wrapped = wrapTextWithAnsi(text, 30);

			// Middle lines (with underlined content) should end with underline-off, not full reset
			// 中间各行（包含下划线内容）应以“关闭下划线”结尾，而不是完全重置（full reset）
			// Line 1 and 2 contain underlined URL parts
			// 第 1 行和第 2 行包含带下划线的 URL 片段
			for (let i = 1; i < wrapped.length - 1; i++) {
				const line = wrapped[i];
				if (line.includes(underlineOn)) {
					// Should end with underline off, NOT full reset
					// 应以“关闭下划线”结尾，而不是完全重置（full reset）
					assert.strictEqual(line.endsWith(underlineOff), true);
					assert.strictEqual(line.endsWith("\x1b[0m"), false);
				}
			}
		});
	});

	describe("background color preservation", () => {
		it("should preserve background color across wrapped lines without full reset", () => {
			const bgBlue = "\x1b[44m";
			const reset = "\x1b[0m";
			const text = `${bgBlue}hello world this is blue background text${reset}`;

			const wrapped = wrapTextWithAnsi(text, 15);

			// Each line should have background color
			// 每一行都应带有背景色
			for (const line of wrapped) {
				assert.ok(line.includes(bgBlue));
			}

			// Middle lines should NOT end with full reset (kills background for padding)
			// 中间各行不应以完全重置（full reset）结尾（那会使填充部分丢失背景色）
			for (let i = 0; i < wrapped.length - 1; i++) {
				assert.strictEqual(wrapped[i].endsWith("\x1b[0m"), false);
			}
		});

		it("should reset underline but preserve background when wrapping underlined text inside background", () => {
			const underlineOn = "\x1b[4m";
			const underlineOff = "\x1b[24m";
			const reset = "\x1b[0m";

			const text = `\x1b[41mprefix ${underlineOn}UNDERLINED_CONTENT_THAT_WRAPS${underlineOff} suffix${reset}`;

			const wrapped = wrapTextWithAnsi(text, 20);

			// All lines should have background color 41 (either as \x1b[41m or combined like \x1b[4;41m)
			// 所有行都应带有编号为 41 的背景色（形式可以是 \x1b[41m，也可以是合并写法如 \x1b[4;41m）
			for (const line of wrapped) {
				const hasBgColor = line.includes("[41m") || line.includes(";41m") || line.includes("[41;");
				assert.ok(hasBgColor);
			}

			// Lines with underlined content should use underline-off at end, not full reset
			// 含下划线内容的行应在结尾使用“关闭下划线”，而不是完全重置（full reset）
			for (let i = 0; i < wrapped.length - 1; i++) {
				const line = wrapped[i];
				// If this line has underline on, it should end with underline off (not full reset)
				// 如果该行开启了下划线，则应以“关闭下划线”结尾（而非完全重置）
				if (
					(line.includes("[4m") || line.includes("[4;") || line.includes(";4m")) &&
					!line.includes(underlineOff)
				) {
					assert.strictEqual(line.endsWith(underlineOff), true);
					assert.strictEqual(line.endsWith("\x1b[0m"), false);
				}
			}
		});
	});

	describe("basic wrapping", () => {
		it("should handle LF, CRLF, and CR line endings", () => {
			assert.deepStrictEqual(wrapTextWithAnsi("first\nsecond\r\nthird\rfourth", 80), [
				"first",
				"second",
				"third",
				"fourth",
			]);
		});

		it("should preserve ANSI state across CRLF and CR line endings", () => {
			const red = "\x1b[31m";
			const reset = "\x1b[0m";

			assert.deepStrictEqual(wrapTextWithAnsi(`${red}first\r\nsecond\rthird${reset}`, 80), [
				`${red}first`,
				`${red}second`,
				`${red}third${reset}`,
			]);
		});

		it("should wrap plain text correctly", () => {
			const text = "hello world this is a test";
			const wrapped = wrapTextWithAnsi(text, 10);

			assert.ok(wrapped.length > 1);
			for (const line of wrapped) {
				assert.ok(visibleWidth(line) <= 10);
			}
		});

		it("should break CJK runs at grapheme boundaries after Latin text", () => {
			const text = "This is an example 中文汉字测试段落内容中文汉字测试段落内容.";
			const wrapped = wrapTextWithAnsi(text, 40);

			assert.deepStrictEqual(wrapped, ["This is an example 中文汉字测试段落内容", "中文汉字测试段落内容."]);
			for (const line of wrapped) {
				assert.ok(visibleWidth(line) <= 40);
			}
		});

		it("should preserve color codes when wrapping CJK runs", () => {
			const red = "\x1b[31m";
			const reset = "\x1b[0m";
			const text = `${red}This is an example 中文汉字测试段落内容中文汉字测试段落内容.${reset}`;
			const wrapped = wrapTextWithAnsi(text, 40);

			assert.strictEqual(wrapped.length, 2);
			assert.strictEqual(wrapped[0], `${red}This is an example 中文汉字测试段落内容`);
			assert.strictEqual(wrapped[1], `${red}中文汉字测试段落内容.${reset}`);
			for (const line of wrapped) {
				assert.ok(visibleWidth(line) <= 40);
			}
		});

		it("should ignore OSC 133 semantic markers in visible width", () => {
			const text = "\x1b]133;A\x07hello\x1b]133;B\x07";
			assert.strictEqual(visibleWidth(text), 5);
		});

		it("should ignore OSC sequences terminated with ST in visible width", () => {
			const text = "\x1b]133;A\x1b\\hello\x1b]133;B\x1b\\";
			assert.strictEqual(visibleWidth(text), 5);
		});

		it("should treat isolated regional indicators as width 2", () => {
			assert.strictEqual(visibleWidth("🇨"), 2);
			assert.strictEqual(visibleWidth("🇨🇳"), 2);
		});

		it("should truncate trailing whitespace that exceeds width", () => {
			const twoSpacesWrappedToWidth1 = wrapTextWithAnsi("  ", 1);
			assert.ok(visibleWidth(twoSpacesWrappedToWidth1[0]) <= 1);
		});

		it("should preserve color codes across wraps", () => {
			const red = "\x1b[31m";
			const reset = "\x1b[0m";
			const text = `${red}hello world this is red${reset}`;

			const wrapped = wrapTextWithAnsi(text, 10);

			// Each continuation line should start with red code
			// 每个续行都应以红色转义码开头
			for (let i = 1; i < wrapped.length; i++) {
				assert.strictEqual(wrapped[i].startsWith(red), true);
			}

			// Middle lines should not end with full reset
			// 中间各行不应以完全重置（full reset）结尾
			for (let i = 0; i < wrapped.length - 1; i++) {
				assert.strictEqual(wrapped[i].endsWith("\x1b[0m"), false);
			}
		});
	});
});

describe("wrapTextWithAnsi with OSC 8 hyperlinks", () => {
	it("re-emits OSC 8 open at the start of continuation lines", () => {
		// A hyperlink whose text is long enough to wrap
		// 一个文本长度足以触发换行的超链接
		const url = "https://example.com";
		// OSC 8 open + text that is 10 visible chars + OSC 8 close
		// OSC 8 开启序列 + 10 个可见字符的文本 + OSC 8 关闭序列
		const input = `\x1b]8;;${url}\x1b\\0123456789\x1b]8;;\x1b\\`;
		const lines = wrapTextWithAnsi(input, 6);

		// Every line that contains visible text from inside the hyperlink
		// 凡是包含超链接内部可见文本的行，
		// should start with the OSC 8 open sequence (or be preceded by it).
		// 都应以 OSC 8 开启序列起始（或在其之前带有该序列）。
		for (const line of lines) {
			// If the line has visible content it must begin with the OSC 8 re-open
			// 如果该行含有可见内容，则必须以 OSC 8 的重新开启序列开头，
			// OR it is the line where the close appeared with no following content.
			// 或者它是关闭序列所在且其后没有内容的那一行。
			const stripped = line.replace(/\x1b\]8;;[^\x1b\x07]*\x1b\\/g, "").replace(/\x1b\[[0-9;]*m/g, "");
			if (stripped.trim().length > 0) {
				assert.ok(
					line.startsWith(`\x1b]8;;${url}\x1b\\`) || line.includes(`\x1b]8;;${url}\x1b\\`),
					`Line "${line}" has visible text but no OSC 8 re-open`,
				);
			}
		}
	});

	it("closes OSC 8 before each line break", () => {
		const url = "https://example.com";
		const input = `\x1b]8;;${url}\x1b\\0123456789\x1b]8;;\x1b\\`;
		const lines = wrapTextWithAnsi(input, 6);

		for (let i = 0; i < lines.length - 1; i++) {
			const line = lines[i];
			// Every non-final line that is inside a hyperlink should end with the close
			// 处于超链接内部的每个非末行都应以关闭序列结尾
			if (line.includes(`\x1b]8;;${url}\x1b\\`)) {
				assert.ok(
					line.endsWith("\x1b]8;;\x1b\\"),
					`Non-final line "${line}" is inside a hyperlink but does not close it`,
				);
			}
		}
	});

	it("preserves BEL terminators when wrapping OAuth-style hyperlinks", () => {
		const url = `https://example.com/oauth/${"a".repeat(32)}`;
		const input = `\x1b]8;;${url}\x07${url}\x1b]8;;\x07`;
		const lines = wrapTextWithAnsi(input, 20);

		assert.ok(lines.length > 1);
		for (const line of lines) {
			assert.ok(line.includes(`\x1b]8;;${url}\x07`), `Line "${line}" does not reopen the hyperlink with BEL`);
			assert.ok(!line.includes(`\x1b]8;;${url}\x1b\\`), `Line "${line}" reopens the hyperlink with ST`);
		}
		for (const line of lines.slice(0, -1)) {
			assert.ok(line.endsWith("\x1b]8;;\x07"), `Line "${line}" does not close the hyperlink with BEL`);
		}
	});

	it("does not emit OSC 8 sequences on lines that are outside the hyperlink", () => {
		const url = "https://example.com";
		const input = `before \x1b]8;;${url}\x1b\\link\x1b]8;;\x1b\\ after`;
		const lines = wrapTextWithAnsi(input, 80);

		// With width 80 everything fits on one line; there should be exactly one
		// 在宽度为 80 时全部内容可容纳于一行；此时应恰好有一个
		// OSC 8 open and one OSC 8 close.
		// OSC 8 开启序列和一个 OSC 8 关闭序列。
		assert.strictEqual(lines.length, 1);
		const openCount = (lines[0].match(/\x1b\]8;;https:[^\x1b]+\x1b\\/g) ?? []).length;
		const closeCount = (lines[0].match(/\x1b\]8;;\x1b\\/g) ?? []).length;
		assert.strictEqual(openCount, 1);
		assert.strictEqual(closeCount, 1);
	});
});
