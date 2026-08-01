/**
 * Tests for StdinBuffer
 * StdinBuffer 的测试
 *
 * Based on code from OpenTUI (https://github.com/anomalyco/opentui)
 * 基于 OpenTUI 的代码实现（https://github.com/anomalyco/opentui）
 * MIT License - Copyright (c) 2025 opentui
 * MIT 许可证 - 版权所有 (c) 2025 opentui
 */

import assert from "node:assert";
import { beforeEach, describe, it } from "node:test";
import { StdinBuffer } from "../src/stdin-buffer.ts";

describe("StdinBuffer", () => {
	let buffer: StdinBuffer;
	let emittedSequences: string[];

	beforeEach(() => {
		buffer = new StdinBuffer({ timeout: 10 });

		// Collect emitted sequences
		// 收集已发出的序列
		emittedSequences = [];
		buffer.on("data", (sequence) => {
			emittedSequences.push(sequence);
		});
	});

	// Helper to process data through the buffer
	// 用于将数据送入缓冲区处理的辅助函数
	function processInput(data: string | Buffer): void {
		buffer.process(data);
	}

	// Helper to wait for async operations
	// 用于等待异步操作的辅助函数
	async function wait(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	describe("Regular Characters", () => {
		it("should pass through regular characters immediately", () => {
			processInput("a");
			assert.deepStrictEqual(emittedSequences, ["a"]);
		});

		it("should pass through multiple regular characters", () => {
			processInput("abc");
			assert.deepStrictEqual(emittedSequences, ["a", "b", "c"]);
		});

		it("should handle unicode characters", () => {
			processInput("hello 世界");
			assert.deepStrictEqual(emittedSequences, ["h", "e", "l", "l", "o", " ", "世", "界"]);
		});
	});

	describe("Complete Escape Sequences", () => {
		it("should pass through complete mouse SGR sequences", () => {
			const mouseSeq = "\x1b[<35;20;5m";
			processInput(mouseSeq);
			assert.deepStrictEqual(emittedSequences, [mouseSeq]);
		});

		it("should pass through complete arrow key sequences", () => {
			const upArrow = "\x1b[A";
			processInput(upArrow);
			assert.deepStrictEqual(emittedSequences, [upArrow]);
		});

		it("should pass through complete function key sequences", () => {
			const f1 = "\x1b[11~";
			processInput(f1);
			assert.deepStrictEqual(emittedSequences, [f1]);
		});

		it("should pass through meta key sequences", () => {
			const metaA = "\x1ba";
			processInput(metaA);
			assert.deepStrictEqual(emittedSequences, [metaA]);
		});

		it("should pass through SS3 sequences", () => {
			const ss3 = "\x1bOA";
			processInput(ss3);
			assert.deepStrictEqual(emittedSequences, [ss3]);
		});
	});

	describe("Partial Escape Sequences", () => {
		it("should buffer incomplete mouse SGR sequence", async () => {
			processInput("\x1b");
			assert.deepStrictEqual(emittedSequences, []);
			assert.strictEqual(buffer.getBuffer(), "\x1b");

			processInput("[<35");
			assert.deepStrictEqual(emittedSequences, []);
			assert.strictEqual(buffer.getBuffer(), "\x1b[<35");

			processInput(";20;5m");
			assert.deepStrictEqual(emittedSequences, ["\x1b[<35;20;5m"]);
			assert.strictEqual(buffer.getBuffer(), "");
		});

		it("should buffer incomplete CSI sequence", () => {
			processInput("\x1b[");
			assert.deepStrictEqual(emittedSequences, []);

			processInput("1;");
			assert.deepStrictEqual(emittedSequences, []);

			processInput("5H");
			assert.deepStrictEqual(emittedSequences, ["\x1b[1;5H"]);
		});

		it("should buffer split across many chunks", () => {
			processInput("\x1b");
			processInput("[");
			processInput("<");
			processInput("3");
			processInput("5");
			processInput(";");
			processInput("2");
			processInput("0");
			processInput(";");
			processInput("5");
			processInput("m");

			assert.deepStrictEqual(emittedSequences, ["\x1b[<35;20;5m"]);
		});

		it("should flush incomplete sequence after timeout", async () => {
			processInput("\x1b[<35");
			assert.deepStrictEqual(emittedSequences, []);

			// Wait for timeout
			// 等待超时触发
			await wait(15);

			assert.deepStrictEqual(emittedSequences, ["\x1b[<35"]);
		});
	});

	describe("Mixed Content", () => {
		it("should handle characters followed by escape sequence", () => {
			processInput("abc\x1b[A");
			assert.deepStrictEqual(emittedSequences, ["a", "b", "c", "\x1b[A"]);
		});

		it("should handle escape sequence followed by characters", () => {
			processInput("\x1b[Aabc");
			assert.deepStrictEqual(emittedSequences, ["\x1b[A", "a", "b", "c"]);
		});

		it("should handle multiple complete sequences", () => {
			processInput("\x1b[A\x1b[B\x1b[C");
			assert.deepStrictEqual(emittedSequences, ["\x1b[A", "\x1b[B", "\x1b[C"]);
		});

		it("should handle partial sequence with preceding characters", () => {
			processInput("abc\x1b[<35");
			assert.deepStrictEqual(emittedSequences, ["a", "b", "c"]);
			assert.strictEqual(buffer.getBuffer(), "\x1b[<35");

			processInput(";20;5m");
			assert.deepStrictEqual(emittedSequences, ["a", "b", "c", "\x1b[<35;20;5m"]);
		});
	});

	describe("Kitty Keyboard Protocol", () => {
		it("should handle Kitty CSI u press events", () => {
			// Press 'a' in Kitty protocol
			// 在 Kitty 协议下按下 'a'
			processInput("\x1b[97u");
			assert.deepStrictEqual(emittedSequences, ["\x1b[97u"]);
		});

		it("should handle Kitty CSI u release events", () => {
			// Release 'a' in Kitty protocol
			// 在 Kitty 协议下释放 'a'
			processInput("\x1b[97;1:3u");
			assert.deepStrictEqual(emittedSequences, ["\x1b[97;1:3u"]);
		});

		it("should handle batched Kitty press and release", () => {
			// Press 'a', release 'a' batched together (common over SSH)
			// 按下 'a' 与释放 'a' 被合并成一批发送（在 SSH 环境中较常见）
			processInput("\x1b[97u\x1b[97;1:3u");
			assert.deepStrictEqual(emittedSequences, ["\x1b[97u", "\x1b[97;1:3u"]);
		});

		it("should handle multiple batched Kitty events", () => {
			// Press 'a', release 'a', press 'b', release 'b'
			// 按下 'a'、释放 'a'、按下 'b'、释放 'b'
			processInput("\x1b[97u\x1b[97;1:3u\x1b[98u\x1b[98;1:3u");
			assert.deepStrictEqual(emittedSequences, ["\x1b[97u", "\x1b[97;1:3u", "\x1b[98u", "\x1b[98;1:3u"]);
		});

		it("should handle Kitty arrow keys with event type", () => {
			// Up arrow press with event type
			// 带事件类型的上方向键按下
			processInput("\x1b[1;1:1A");
			assert.deepStrictEqual(emittedSequences, ["\x1b[1;1:1A"]);
		});

		it("should handle Kitty functional keys with event type", () => {
			// Delete key release
			// Delete 键释放
			processInput("\x1b[3;1:3~");
			assert.deepStrictEqual(emittedSequences, ["\x1b[3;1:3~"]);
		});

		it("should split ESC+ESC+CSI into standalone ESC and the CSI sequence (WezTerm Escape key regression)", () => {
			// WezTerm with enable_kitty_keyboard sends Escape key press as raw \x1b
			// 启用 enable_kitty_keyboard 的 WezTerm 会将 Escape 按下事件以原始 \x1b 发送，
			// and the release as a full Kitty CSI-u sequence, concatenated.
			// 而释放事件则以完整的 Kitty CSI-u 序列发送，两者拼接在一起。
			// The buffer must not treat \x1b\x1b as a complete meta-key when the
			// 当后续字节开始一个新的转义序列时，缓冲区不得将 \x1b\x1b
			// following byte starts a new escape sequence.
			// 当作一个完整的 meta 组合键处理。
			processInput("\x1b\x1b[27;129:3u");
			assert.deepStrictEqual(emittedSequences, ["\x1b", "\x1b[27;129:3u"]);
		});

		it("should split ESC+ESC+CSI with no modifier (no num_lock)", () => {
			processInput("\x1b\x1b[27;1:3u");
			assert.deepStrictEqual(emittedSequences, ["\x1b", "\x1b[27;1:3u"]);
		});

		it("should still emit ESC+ESC as a single sequence when not followed by a new escape", () => {
			// \x1b\x1b alone (no following CSI) stays as-is — e.g. ctrl+alt+[
			// 单独的 \x1b\x1b（后面没有跟 CSI）保持原样 —— 例如 ctrl+alt+[
			processInput("\x1b\x1b");
			assert.deepStrictEqual(emittedSequences, ["\x1b\x1b"]);
		});

		it("should handle plain characters mixed with Kitty sequences", () => {
			// Plain 'a' followed by Kitty release
			// 普通字符 'a' 后跟一个 Kitty 释放事件
			processInput("a\x1b[97;1:3u");
			assert.deepStrictEqual(emittedSequences, ["a", "\x1b[97;1:3u"]);
		});

		it("should drop raw duplicate character after matching Kitty printable sequence", () => {
			processInput("\x1b[224uà");
			assert.deepStrictEqual(emittedSequences, ["\x1b[224u"]);
		});

		it("should drop raw duplicate character after matching Kitty printable sequence across chunks", () => {
			processInput("\x1b[64u");
			processInput("@");
			assert.deepStrictEqual(emittedSequences, ["\x1b[64u"]);
		});

		it("should keep non-matching plain character after Kitty printable sequence", () => {
			processInput("\x1b[97ub");
			assert.deepStrictEqual(emittedSequences, ["\x1b[97u", "b"]);
		});

		it("should keep raw character after modified Kitty printable sequence", () => {
			processInput("\x1b[64;3u@");
			assert.deepStrictEqual(emittedSequences, ["\x1b[64;3u", "@"]);
		});

		it("should handle rapid typing simulation with Kitty protocol", () => {
			// Simulates typing "hi" quickly with releases interleaved
			// 模拟快速输入 "hi"，并夹杂按键释放事件
			processInput("\x1b[104u\x1b[104;1:3u\x1b[105u\x1b[105;1:3u");
			assert.deepStrictEqual(emittedSequences, ["\x1b[104u", "\x1b[104;1:3u", "\x1b[105u", "\x1b[105;1:3u"]);
		});
	});

	describe("Mouse Events", () => {
		it("should handle mouse press event", () => {
			processInput("\x1b[<0;10;5M");
			assert.deepStrictEqual(emittedSequences, ["\x1b[<0;10;5M"]);
		});

		it("should handle mouse release event", () => {
			processInput("\x1b[<0;10;5m");
			assert.deepStrictEqual(emittedSequences, ["\x1b[<0;10;5m"]);
		});

		it("should handle mouse move event", () => {
			processInput("\x1b[<35;20;5m");
			assert.deepStrictEqual(emittedSequences, ["\x1b[<35;20;5m"]);
		});

		it("should handle split mouse events", () => {
			processInput("\x1b[<3");
			processInput("5;1");
			processInput("5;");
			processInput("10m");
			assert.deepStrictEqual(emittedSequences, ["\x1b[<35;15;10m"]);
		});

		it("should handle multiple mouse events", () => {
			processInput("\x1b[<35;1;1m\x1b[<35;2;2m\x1b[<35;3;3m");
			assert.deepStrictEqual(emittedSequences, ["\x1b[<35;1;1m", "\x1b[<35;2;2m", "\x1b[<35;3;3m"]);
		});

		it("should handle old-style mouse sequence (ESC[M + 3 bytes)", () => {
			processInput("\x1b[M abc");
			assert.deepStrictEqual(emittedSequences, ["\x1b[M ab", "c"]);
		});

		it("should buffer incomplete old-style mouse sequence", () => {
			processInput("\x1b[M");
			assert.strictEqual(buffer.getBuffer(), "\x1b[M");

			processInput(" a");
			assert.strictEqual(buffer.getBuffer(), "\x1b[M a");

			processInput("b");
			assert.deepStrictEqual(emittedSequences, ["\x1b[M ab"]);
		});
	});

	describe("Edge Cases", () => {
		it("should handle empty input", () => {
			processInput("");
			// Empty string emits an empty data event
			// 空字符串会发出一个空的 data 事件
			assert.deepStrictEqual(emittedSequences, [""]);
		});

		it("should handle lone escape character with timeout", async () => {
			processInput("\x1b");
			assert.deepStrictEqual(emittedSequences, []);

			// After timeout, should emit
			// 超时之后应当发出该序列
			await wait(15);
			assert.deepStrictEqual(emittedSequences, ["\x1b"]);
		});

		it("should handle lone escape character with explicit flush", () => {
			processInput("\x1b");
			assert.deepStrictEqual(emittedSequences, []);

			const flushed = buffer.flush();
			assert.deepStrictEqual(flushed, ["\x1b"]);
		});

		it("should handle buffer input", () => {
			processInput(Buffer.from("\x1b[A"));
			assert.deepStrictEqual(emittedSequences, ["\x1b[A"]);
		});

		it("should handle very long sequences", () => {
			const longSeq = `\x1b[${"1;".repeat(50)}H`;
			processInput(longSeq);
			assert.deepStrictEqual(emittedSequences, [longSeq]);
		});
	});

	describe("Flush", () => {
		it("should flush incomplete sequences", () => {
			processInput("\x1b[<35");
			const flushed = buffer.flush();
			assert.deepStrictEqual(flushed, ["\x1b[<35"]);
			assert.strictEqual(buffer.getBuffer(), "");
		});

		it("should return empty array if nothing to flush", () => {
			const flushed = buffer.flush();
			assert.deepStrictEqual(flushed, []);
		});

		it("should emit flushed data via timeout", async () => {
			processInput("\x1b[<35");
			assert.deepStrictEqual(emittedSequences, []);

			// Wait for timeout to flush
			// 等待超时以触发刷新（flush）
			await wait(15);

			assert.deepStrictEqual(emittedSequences, ["\x1b[<35"]);
		});
	});

	describe("Clear", () => {
		it("should clear buffered content without emitting", () => {
			processInput("\x1b[<35");
			assert.strictEqual(buffer.getBuffer(), "\x1b[<35");

			buffer.clear();
			assert.strictEqual(buffer.getBuffer(), "");
			assert.deepStrictEqual(emittedSequences, []);
		});
	});

	describe("Bracketed Paste", () => {
		let emittedPaste: string[] = [];

		beforeEach(() => {
			buffer = new StdinBuffer({ timeout: 10 });

			// Collect emitted sequences
			// 收集已发出的序列
			emittedSequences = [];
			buffer.on("data", (sequence) => {
				emittedSequences.push(sequence);
			});

			// Collect paste events
			// 收集粘贴（paste）事件
			emittedPaste = [];
			buffer.on("paste", (data) => {
				emittedPaste.push(data);
			});
		});

		it("should emit paste event for complete bracketed paste", () => {
			const pasteStart = "\x1b[200~";
			const pasteEnd = "\x1b[201~";
			const content = "hello world";

			processInput(pasteStart + content + pasteEnd);

			assert.deepStrictEqual(emittedPaste, ["hello world"]);
			assert.deepStrictEqual(emittedSequences, []); // No data events during paste | 粘贴过程中不产生 data 事件
		});

		it("should handle paste arriving in chunks", () => {
			processInput("\x1b[200~");
			assert.deepStrictEqual(emittedPaste, []);

			processInput("hello ");
			assert.deepStrictEqual(emittedPaste, []);

			processInput("world\x1b[201~");
			assert.deepStrictEqual(emittedPaste, ["hello world"]);
			assert.deepStrictEqual(emittedSequences, []);
		});

		it("should handle paste with input before and after", () => {
			processInput("a");
			processInput("\x1b[200~pasted\x1b[201~");
			processInput("b");

			assert.deepStrictEqual(emittedSequences, ["a", "b"]);
			assert.deepStrictEqual(emittedPaste, ["pasted"]);
		});

		it("should handle paste with newlines", () => {
			processInput("\x1b[200~line1\nline2\nline3\x1b[201~");

			assert.deepStrictEqual(emittedPaste, ["line1\nline2\nline3"]);
			assert.deepStrictEqual(emittedSequences, []);
		});

		it("should handle paste with unicode", () => {
			processInput("\x1b[200~Hello 世界 🎉\x1b[201~");

			assert.deepStrictEqual(emittedPaste, ["Hello 世界 🎉"]);
			assert.deepStrictEqual(emittedSequences, []);
		});
	});

	describe("Destroy", () => {
		it("should clear buffer on destroy", () => {
			processInput("\x1b[<35");
			assert.strictEqual(buffer.getBuffer(), "\x1b[<35");

			buffer.destroy();
			assert.strictEqual(buffer.getBuffer(), "");
		});

		it("should clear pending timeouts on destroy", async () => {
			processInput("\x1b[<35");
			buffer.destroy();

			// Wait longer than timeout
			// 等待超过超时时长
			await wait(15);

			// Should not have emitted anything
			// 不应发出任何内容
			assert.deepStrictEqual(emittedSequences, []);
		});
	});
});
