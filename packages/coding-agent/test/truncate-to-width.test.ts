import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { describe, expect, it } from "vitest";

/**
 * Tests for truncateToWidth behavior with Unicode characters.
 * 针对 truncateToWidth 处理 Unicode 字符行为的测试。
 *
 * These tests verify that truncateToWidth properly handles text with
 * Unicode characters that have different byte vs display widths.
 * 这些测试验证 truncateToWidth 能正确处理包含 Unicode 字符的文本,
 * 这类字符的字节宽度与显示宽度并不一致。
 */
describe("truncateToWidth", () => {
	it("should truncate messages with Unicode characters correctly", () => {
		// This message contains a checkmark (✔) which may have display width > 1 byte
		// 这条消息包含一个对勾符号(✔),其显示宽度可能大于 1 字节
		const message = '✔ script to run › dev $ concurrently "vite" "node --import tsx ./';
		const width = 67;
		// Account for cursor
		// 为光标预留宽度
		const maxMsgWidth = width - 2;

		const truncated = truncateToWidth(message, maxMsgWidth);
		const truncatedWidth = visibleWidth(truncated);

		expect(truncatedWidth).toBeLessThanOrEqual(maxMsgWidth);
	});

	it("should handle emoji characters", () => {
		const message = "🎉 Celebration! 🚀 Launch 📦 Package ready for deployment now";
		const width = 40;
		const maxMsgWidth = width - 2;

		const truncated = truncateToWidth(message, maxMsgWidth);
		const truncatedWidth = visibleWidth(truncated);

		expect(truncatedWidth).toBeLessThanOrEqual(maxMsgWidth);
	});

	it("should handle mixed ASCII and wide characters", () => {
		const message = "Hello 世界 Test 你好 More text here that is long";
		const width = 30;
		const maxMsgWidth = width - 2;

		const truncated = truncateToWidth(message, maxMsgWidth);
		const truncatedWidth = visibleWidth(truncated);

		expect(truncatedWidth).toBeLessThanOrEqual(maxMsgWidth);
	});

	it("should not truncate messages that fit", () => {
		const message = "Short message";
		const width = 50;
		const maxMsgWidth = width - 2;

		const truncated = truncateToWidth(message, maxMsgWidth);

		expect(truncated).toBe(message);
		expect(visibleWidth(truncated)).toBeLessThanOrEqual(maxMsgWidth);
	});

	it("should add ellipsis when truncating", () => {
		const message = "This is a very long message that needs to be truncated";
		const width = 30;
		const maxMsgWidth = width - 2;

		const truncated = truncateToWidth(message, maxMsgWidth);

		expect(truncated).toContain("...");
		expect(visibleWidth(truncated)).toBeLessThanOrEqual(maxMsgWidth);
	});

	it("should handle the exact crash case from issue report", () => {
		// Terminal width was 67, line had visible width 68
		// 终端宽度为 67,而该行的可见宽度为 68
		// The problematic text contained "✔" and "›" characters
		// 出问题的文本中包含 "✔" 和 "›" 字符
		const message = '✔ script to run › dev $ concurrently "vite" "node --import tsx ./server.ts"';
		const terminalWidth = 67;
		// "› " or "  "
		// "› " 或 "  "
		const cursorWidth = 2;
		const maxMsgWidth = terminalWidth - cursorWidth;

		const truncated = truncateToWidth(message, maxMsgWidth);
		const finalWidth = visibleWidth(truncated);

		// The final line (cursor + message) must not exceed terminal width
		// 最终整行(光标 + 消息)的宽度不得超过终端宽度
		expect(finalWidth + cursorWidth).toBeLessThanOrEqual(terminalWidth);
	});
});
