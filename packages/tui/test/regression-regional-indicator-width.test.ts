import assert from "node:assert";
import { describe, it } from "node:test";
import { visibleWidth, wrapTextWithAnsi } from "../src/utils.ts";

describe("regional indicator width regression", () => {
	it("treats partial flag grapheme as full-width to avoid streaming render drift", () => {
		// Repro context:
		// 复现场景说明：
		// During streaming, "🇨🇳" often appears as an intermediate "🇨" first.
		// 在流式输出（streaming）过程中，"🇨🇳" 通常会先以中间态 "🇨" 的形式出现。
		// If "🇨" is measured as width 1 while terminal renders it as width 2,
		// 如果 "🇨" 被测量为宽度 1，而终端却按宽度 2 渲染，
		// differential rendering can drift and leave stale characters on screen.
		// 差量渲染（differential rendering）就会发生偏移，并在屏幕上残留过期字符。
		const partialFlag = "🇨";
		const listLine = "      - 🇨";

		assert.strictEqual(visibleWidth(partialFlag), 2);
		assert.strictEqual(visibleWidth(listLine), 10);
	});

	it("wraps intermediate partial-flag list line before overflow", () => {
		// Width 9 cannot fit "      - 🇨" if 🇨 is width 2 (8 + 2 = 10).
		// 若 🇨 的宽度为 2（8 + 2 = 10），则宽度 9 无法容纳 "      - 🇨"。
		// This must wrap to avoid terminal auto-wrap mismatch.
		// 因此必须进行换行，以避免与终端自动换行（auto-wrap）行为不一致。
		const wrapped = wrapTextWithAnsi("      - 🇨", 9);

		assert.strictEqual(wrapped.length, 2);
		assert.strictEqual(visibleWidth(wrapped[0] || ""), 7);
		assert.strictEqual(visibleWidth(wrapped[1] || ""), 2);
	});

	it("treats all regional-indicator singleton graphemes as width 2", () => {
		for (let cp = 0x1f1e6; cp <= 0x1f1ff; cp++) {
			const regionalIndicator = String.fromCodePoint(cp);
			assert.strictEqual(
				visibleWidth(regionalIndicator),
				2,
				`Expected ${regionalIndicator} (U+${cp.toString(16).toUpperCase()}) to be width 2`,
			);
		}
	});

	it("keeps full flag pairs at width 2", () => {
		const samples = ["🇯🇵", "🇺🇸", "🇬🇧", "🇨🇳", "🇩🇪", "🇫🇷"];
		for (const flag of samples) {
			assert.strictEqual(visibleWidth(flag), 2, `Expected ${flag} to be width 2`);
		}
	});

	it("keeps common streaming emoji intermediates at stable width", () => {
		const samples = ["👍", "👍🏻", "✅", "⚡", "⚡️", "👨", "👨‍💻", "🏳️‍🌈"];
		for (const sample of samples) {
			assert.strictEqual(visibleWidth(sample), 2, `Expected ${sample} to be width 2`);
		}
	});
});
