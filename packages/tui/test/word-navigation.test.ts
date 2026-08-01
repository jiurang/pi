import assert from "node:assert";
import { describe, it } from "node:test";
import { findWordBackward, findWordForward } from "../src/word-navigation.ts";

describe("findWordBackward", () => {
	it("basic words: hello world", () => {
		const text = "hello world";
		assert.strictEqual(findWordBackward(text, 11), 6);
		assert.strictEqual(findWordBackward(text, 6), 0);
	});

	it("dotted: foo.bar", () => {
		const text = "foo.bar";
		assert.strictEqual(findWordBackward(text, 7), 4);
		assert.strictEqual(findWordBackward(text, 4), 3);
		assert.strictEqual(findWordBackward(text, 3), 0);
	});

	it("colon: foo:bar", () => {
		const text = "foo:bar";
		assert.strictEqual(findWordBackward(text, 7), 4);
		assert.strictEqual(findWordBackward(text, 4), 3);
		assert.strictEqual(findWordBackward(text, 3), 0);
	});

	it("path: path/to/file", () => {
		const text = "path/to/file";
		assert.strictEqual(findWordBackward(text, 12), 8);
		assert.strictEqual(findWordBackward(text, 8), 7);
		// "/to" is one word-like segment with "/" as punctuation boundary
		// "/to" 属于一个类词（word-like）片段，其中 "/" 作为标点边界
		assert.strictEqual(findWordBackward(text, 7), 5);
		assert.strictEqual(findWordBackward(text, 5), 4);
		assert.strictEqual(findWordBackward(text, 4), 0);
	});

	it("CJK mixed", () => {
		const text = "你好世界 test";
		assert.strictEqual(findWordBackward(text, text.length), 5);
		// Intl.Segmenter treats each CJK char as a separate word-like segment
		// Intl.Segmenter 会把每个 CJK 字符视为一个独立的类词（word-like）片段
		assert.strictEqual(findWordBackward(text, 5), 2);
		assert.strictEqual(findWordBackward(text, 2), 0);
	});

	it("whitespace at boundaries", () => {
		const text = "  hello  ";
		assert.strictEqual(findWordBackward(text, 9), 2);
		assert.strictEqual(findWordBackward(text, 2), 0);
	});

	it("punctuation run: foo...bar", () => {
		const text = "foo...bar";
		assert.strictEqual(findWordBackward(text, 9), 6);
		assert.strictEqual(findWordBackward(text, 6), 3);
		assert.strictEqual(findWordBackward(text, 3), 0);
	});

	it("cursor at 0 returns 0", () => {
		assert.strictEqual(findWordBackward("hello", 0), 0);
	});
});

describe("findWordForward", () => {
	it("basic words: hello world", () => {
		const text = "hello world";
		assert.strictEqual(findWordForward(text, 0), 5);
		assert.strictEqual(findWordForward(text, 5), 11);
	});

	it("dotted: foo.bar", () => {
		const text = "foo.bar";
		assert.strictEqual(findWordForward(text, 0), 3);
		assert.strictEqual(findWordForward(text, 3), 4);
		assert.strictEqual(findWordForward(text, 4), 7);
	});

	it("colon: foo:bar", () => {
		const text = "foo:bar";
		assert.strictEqual(findWordForward(text, 0), 3);
		assert.strictEqual(findWordForward(text, 3), 4);
		assert.strictEqual(findWordForward(text, 4), 7);
	});

	it("path: path/to/file", () => {
		const text = "path/to/file";
		assert.strictEqual(findWordForward(text, 0), 4);
		assert.strictEqual(findWordForward(text, 4), 5);
		assert.strictEqual(findWordForward(text, 5), 7);
		assert.strictEqual(findWordForward(text, 7), 8);
		assert.strictEqual(findWordForward(text, 8), 12);
	});

	it("CJK mixed", () => {
		const text = "你好世界 test";
		const firstEnd = findWordForward(text, 0);
		assert.ok(firstEnd > 0);
		assert.ok(firstEnd <= 4);
		// Walk to end
		// 逐步遍历至末尾
		let pos = 0;
		while (pos < text.length) {
			const next = findWordForward(text, pos);
			if (next === pos) break;
			pos = next;
		}
		assert.strictEqual(pos, text.length);
	});

	it("whitespace at boundaries", () => {
		const text = "  hello  ";
		assert.strictEqual(findWordForward(text, 0), 7);
		assert.strictEqual(findWordForward(text, 7), 9);
	});

	it("punctuation run: foo...bar", () => {
		const text = "foo...bar";
		assert.strictEqual(findWordForward(text, 0), 3);
		assert.strictEqual(findWordForward(text, 3), 6);
		assert.strictEqual(findWordForward(text, 6), 9);
	});

	it("cursor at end returns end", () => {
		assert.strictEqual(findWordForward("hello", 5), 5);
	});
});

describe("atomic segments", () => {
	const marker = "[paste #1 +5 lines]";
	const text = `hello ${marker} world`;
	const isAtomic = (s: string) => s === marker;

	// The functions slice text before calling segment(), so we map each expected
	// 这些函数会在调用 segment() 之前先对文本做切片，因此我们将每个预期的
	// substring to its pre-split segments.
	// 子串映射到其预先切分好的片段列表。
	const segmentMap = new Map<string, Intl.SegmentData[]>([
		[
			text, // full text (not used but for clarity) | 完整文本（此处未实际使用，仅为清晰起见）
			[
				{ segment: "hello", index: 0, input: text, isWordLike: true },
				{ segment: " ", index: 5, input: text, isWordLike: false },
				{ segment: marker, index: 6, input: text, isWordLike: true },
				{ segment: " ", index: 25, input: text, isWordLike: false },
				{ segment: "world", index: 26, input: text, isWordLike: true },
			],
		],
		[
			// backward from end: slice(0, 31) = full text
			// 从末尾向前：slice(0, 31) 即完整文本
			text.slice(0, text.length),
			[
				{ segment: "hello", index: 0, input: text, isWordLike: true },
				{ segment: " ", index: 5, input: text, isWordLike: false },
				{ segment: marker, index: 6, input: text, isWordLike: true },
				{ segment: " ", index: 25, input: text, isWordLike: false },
				{ segment: "world", index: 26, input: text, isWordLike: true },
			],
		],
		[
			// backward from 26: slice(0, 26) = "hello [paste #1 +5 lines] "
			// 从位置 26 向前：slice(0, 26) 即 "hello [paste #1 +5 lines] "
			text.slice(0, 26),
			[
				{ segment: "hello", index: 0, input: text, isWordLike: true },
				{ segment: " ", index: 5, input: text, isWordLike: false },
				{ segment: marker, index: 6, input: text, isWordLike: true },
				{ segment: " ", index: 25, input: text, isWordLike: false },
			],
		],
		[
			// forward from 6: slice(6) = "[paste #1 +5 lines] world"
			// 从位置 6 向后：slice(6) 即 "[paste #1 +5 lines] world"
			text.slice(6),
			[
				{ segment: marker, index: 0, input: text, isWordLike: true },
				{ segment: " ", index: 19, input: text, isWordLike: false },
				{ segment: "world", index: 20, input: text, isWordLike: true },
			],
		],
	]);

	const opts = {
		segment: (input: string) => segmentMap.get(input) ?? [],
		isAtomicSegment: isAtomic,
	};

	it("backward skips word then stops before atomic marker", () => {
		assert.strictEqual(findWordBackward(text, text.length, opts), 26);
	});

	it("backward skips whitespace then atomic marker as one unit", () => {
		assert.strictEqual(findWordBackward(text, 26, opts), 6);
	});

	it("forward skips atomic marker as one unit", () => {
		assert.strictEqual(findWordForward(text, 6, opts), 6 + marker.length);
	});
});
