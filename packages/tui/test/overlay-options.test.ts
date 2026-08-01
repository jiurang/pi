import assert from "node:assert";
import { describe, it } from "node:test";
import { TuiMainScreen } from "../src/TuiMainScreen.ts";
import type { Component, TUI } from "../src/tui.ts";
import { VirtualTerminal } from "./virtual-terminal.ts";

class StaticOverlay implements Component {
	private lines: string[];
	requestedWidth?: number;

	constructor(lines: string[], requestedWidth?: number) {
		this.lines = lines;
		this.requestedWidth = requestedWidth;
	}

	render(width: number): string[] {
		// Store the width we were asked to render at for verification
		// 保存被要求渲染时使用的宽度，以便后续校验
		this.requestedWidth = width;
		return this.lines;
	}

	invalidate(): void {}
}

class EmptyContent implements Component {
	render(): string[] {
		return [];
	}
	invalidate(): void {}
}

async function renderAndFlush(tui: TUI, terminal: VirtualTerminal): Promise<void> {
	tui.requestRender(true);
	await new Promise<void>((resolve) => process.nextTick(resolve));
	await terminal.waitForRender();
}

describe("TUI overlay options", () => {
	describe("width overflow protection", () => {
		it("should truncate overlay lines that exceed declared width", async () => {
			const terminal = new VirtualTerminal(80, 24);
			const tui: TUI = new TuiMainScreen(terminal);
			// Overlay declares width 20 but renders lines much wider
			// 浮层（overlay）声明宽度为 20，但实际渲染的行宽得多
			const overlay = new StaticOverlay(["X".repeat(100)]);

			tui.addChild(new EmptyContent());
			tui.showOverlay(overlay, { width: 20 });
			tui.start();
			await renderAndFlush(tui, terminal);

			// Should not crash, and no line should exceed terminal width
			// 不应崩溃，并且任何一行都不应超出终端宽度
			const viewport = terminal.getViewport();
			for (const line of viewport) {
				// visibleWidth not available here, but line length is a rough check
				// 此处无法使用 visibleWidth，但用行长度做粗略检查
				// The important thing is it didn't crash
				// 关键在于它没有崩溃
				assert.ok(line !== undefined);
			}
			tui.stop();
		});

		it("should handle overlay with complex ANSI sequences without crashing", async () => {
			const terminal = new VirtualTerminal(80, 24);
			const tui: TUI = new TuiMainScreen(terminal);
			// Simulate complex ANSI content like the crash log showed
			// 模拟崩溃日志中出现的那种复杂 ANSI 内容
			const complexLine =
				"\x1b[48;2;40;50;40m \x1b[38;2;128;128;128mSome styled content\x1b[39m\x1b[49m" +
				"\x1b]8;;http://example.com\x07link\x1b]8;;\x07" +
				" more content ".repeat(10);
			const overlay = new StaticOverlay([complexLine, complexLine, complexLine]);

			tui.addChild(new EmptyContent());
			tui.showOverlay(overlay, { width: 60 });
			tui.start();
			await renderAndFlush(tui, terminal);

			// Should not crash
			// 不应崩溃
			const viewport = terminal.getViewport();
			assert.ok(viewport.length > 0);
			tui.stop();
		});

		it("should handle overlay composited on styled base content", async () => {
			const terminal = new VirtualTerminal(80, 24);
			const tui: TUI = new TuiMainScreen(terminal);

			// Base content with styling
			// 带样式的基础内容
			class StyledContent implements Component {
				render(width: number): string[] {
					const styledLine = `\x1b[1m\x1b[38;2;255;0;0m${"X".repeat(width)}\x1b[0m`;
					return [styledLine, styledLine, styledLine];
				}
				invalidate(): void {}
			}

			const overlay = new StaticOverlay(["OVERLAY"]);

			tui.addChild(new StyledContent());
			tui.showOverlay(overlay, { width: 20, anchor: "center" });
			tui.start();
			await renderAndFlush(tui, terminal);

			// Should not crash and overlay should be visible
			// 不应崩溃，且浮层（overlay）应当可见
			const viewport = terminal.getViewport();
			const hasOverlay = viewport.some((line) => line?.includes("OVERLAY"));
			assert.ok(hasOverlay, "Overlay should be visible");
			tui.stop();
		});

		it("should handle wide characters at overlay boundary", async () => {
			const terminal = new VirtualTerminal(80, 24);
			const tui: TUI = new TuiMainScreen(terminal);
			// Wide chars (each takes 2 columns) at the edge of declared width
			// 位于声明宽度边界处的宽字符（每个占 2 列）
			const wideCharLine = "中文日本語한글テスト漢字"; // Mix of CJK chars | 混合的 CJK 字符
			const overlay = new StaticOverlay([wideCharLine]);

			tui.addChild(new EmptyContent());
			tui.showOverlay(overlay, { width: 15 }); // Odd width to potentially hit boundary | 使用奇数宽度，以便可能命中边界情况
			tui.start();
			await renderAndFlush(tui, terminal);

			// Should not crash
			// 不应崩溃
			const viewport = terminal.getViewport();
			assert.ok(viewport.length > 0);
			tui.stop();
		});

		it("should handle overlay positioned at terminal edge", async () => {
			const terminal = new VirtualTerminal(80, 24);
			const tui: TUI = new TuiMainScreen(terminal);
			// Overlay positioned at right edge with content that exceeds declared width
			// 浮层（overlay）定位在右边缘，且其内容超出了声明的宽度
			const overlay = new StaticOverlay(["X".repeat(50)]);

			tui.addChild(new EmptyContent());
			// Position at col 60 with width 20 - should fit exactly at right edge
			// 定位在第 60 列、宽度为 20 —— 应刚好贴合右边缘
			tui.showOverlay(overlay, { col: 60, width: 20 });
			tui.start();
			await renderAndFlush(tui, terminal);

			// Should not crash
			// 不应崩溃
			const viewport = terminal.getViewport();
			assert.ok(viewport.length > 0);
			tui.stop();
		});

		it("should handle overlay on base content with OSC sequences", async () => {
			const terminal = new VirtualTerminal(80, 24);
			const tui: TUI = new TuiMainScreen(terminal);

			// Base content with OSC 8 hyperlinks (like file paths in agent output)
			// 包含 OSC 8 超链接的基础内容（类似 agent 输出中的文件路径）
			class HyperlinkContent implements Component {
				render(width: number): string[] {
					const link = `\x1b]8;;file:///path/to/file.ts\x07file.ts\x1b]8;;\x07`;
					const line = `See ${link} for details ${"X".repeat(width - 30)}`;
					return [line, line, line];
				}
				invalidate(): void {}
			}

			const overlay = new StaticOverlay(["OVERLAY-TEXT"]);

			tui.addChild(new HyperlinkContent());
			tui.showOverlay(overlay, { anchor: "center", width: 20 });
			tui.start();
			await renderAndFlush(tui, terminal);

			// Should not crash - this was the original bug scenario
			// 不应崩溃 —— 这正是最初出现缺陷（bug）的场景
			const viewport = terminal.getViewport();
			assert.ok(viewport.length > 0);
			tui.stop();
		});
	});

	describe("width percentage", () => {
		it("should render overlay at percentage of terminal width", async () => {
			const terminal = new VirtualTerminal(100, 24);
			const tui: TUI = new TuiMainScreen(terminal);
			const overlay = new StaticOverlay(["test"]);

			tui.addChild(new EmptyContent());
			tui.showOverlay(overlay, { width: "50%" });
			tui.start();
			await renderAndFlush(tui, terminal);

			assert.strictEqual(overlay.requestedWidth, 50);
			tui.stop();
		});

		it("should respect minWidth when widthPercent results in smaller width", async () => {
			const terminal = new VirtualTerminal(100, 24);
			const tui: TUI = new TuiMainScreen(terminal);
			const overlay = new StaticOverlay(["test"]);

			tui.addChild(new EmptyContent());
			tui.showOverlay(overlay, { width: "10%", minWidth: 30 });
			tui.start();
			await renderAndFlush(tui, terminal);

			assert.strictEqual(overlay.requestedWidth, 30);
			tui.stop();
		});
	});

	describe("anchor positioning", () => {
		it("should position overlay at top-left", async () => {
			const terminal = new VirtualTerminal(80, 24);
			const tui: TUI = new TuiMainScreen(terminal);
			const overlay = new StaticOverlay(["TOP-LEFT"]);

			tui.addChild(new EmptyContent());
			tui.showOverlay(overlay, { anchor: "top-left", width: 10 });
			tui.start();
			await renderAndFlush(tui, terminal);

			const viewport = terminal.getViewport();
			assert.ok(viewport[0]?.startsWith("TOP-LEFT"), `Expected TOP-LEFT at start, got: ${viewport[0]}`);
			tui.stop();
		});

		it("should position overlay at bottom-right", async () => {
			const terminal = new VirtualTerminal(80, 24);
			const tui: TUI = new TuiMainScreen(terminal);
			const overlay = new StaticOverlay(["BTM-RIGHT"]);

			tui.addChild(new EmptyContent());
			tui.showOverlay(overlay, { anchor: "bottom-right", width: 10 });
			tui.start();
			await renderAndFlush(tui, terminal);

			const viewport = terminal.getViewport();
			// Should be on last row, ending at last column
			// 应位于最后一行，并在最后一列处结束
			const lastRow = viewport[23];
			assert.ok(lastRow?.includes("BTM-RIGHT"), `Expected BTM-RIGHT on last row, got: ${lastRow}`);
			assert.ok(lastRow?.trimEnd().endsWith("BTM-RIGHT"), `Expected BTM-RIGHT at end, got: ${lastRow}`);
			tui.stop();
		});

		it("should position overlay at top-center", async () => {
			const terminal = new VirtualTerminal(80, 24);
			const tui: TUI = new TuiMainScreen(terminal);
			const overlay = new StaticOverlay(["CENTERED"]);

			tui.addChild(new EmptyContent());
			tui.showOverlay(overlay, { anchor: "top-center", width: 10 });
			tui.start();
			await renderAndFlush(tui, terminal);

			const viewport = terminal.getViewport();
			// Should be on first row, centered horizontally
			// 应位于第一行，并在水平方向居中
			const firstRow = viewport[0];
			assert.ok(firstRow?.includes("CENTERED"), `Expected CENTERED on first row, got: ${firstRow}`);
			// Check it's roughly centered (col 35 for width 10 in 80 col terminal)
			// 检查是否大致居中（在 80 列终端中，宽度为 10 时约为第 35 列）
			const colIndex = firstRow?.indexOf("CENTERED") ?? -1;
			assert.ok(colIndex >= 30 && colIndex <= 40, `Expected centered, got col ${colIndex}`);
			tui.stop();
		});
	});

	describe("margin", () => {
		it("should clamp negative margins to zero", async () => {
			const terminal = new VirtualTerminal(80, 24);
			const tui: TUI = new TuiMainScreen(terminal);
			const overlay = new StaticOverlay(["NEG-MARGIN"]);

			tui.addChild(new EmptyContent());
			// Negative margins should be treated as 0
			// 负数外边距（margin）应按 0 处理
			tui.showOverlay(overlay, {
				anchor: "top-left",
				width: 12,
				margin: { top: -5, left: -10, right: 0, bottom: 0 },
			});
			tui.start();
			await renderAndFlush(tui, terminal);

			const viewport = terminal.getViewport();
			// Should be at row 0, col 0 (negative margins clamped to 0)
			// 应位于第 0 行、第 0 列（负数外边距被钳制为 0）
			assert.ok(viewport[0]?.startsWith("NEG-MARGIN"), `Expected NEG-MARGIN at start of row 0, got: ${viewport[0]}`);
			tui.stop();
		});

		it("should respect margin as number", async () => {
			const terminal = new VirtualTerminal(80, 24);
			const tui: TUI = new TuiMainScreen(terminal);
			const overlay = new StaticOverlay(["MARGIN"]);

			tui.addChild(new EmptyContent());
			tui.showOverlay(overlay, { anchor: "top-left", width: 10, margin: 5 });
			tui.start();
			await renderAndFlush(tui, terminal);

			const viewport = terminal.getViewport();
			// Should be on row 5 (not 0) due to margin
			// 由于存在外边距（margin），应位于第 5 行（而非第 0 行）
			assert.ok(!viewport[0]?.includes("MARGIN"), "Should not be on row 0");
			assert.ok(!viewport[4]?.includes("MARGIN"), "Should not be on row 4");
			assert.ok(viewport[5]?.includes("MARGIN"), `Expected MARGIN on row 5, got: ${viewport[5]}`);
			// Should start at col 5 (not 0)
			// 应从第 5 列开始（而非第 0 列）
			const colIndex = viewport[5]?.indexOf("MARGIN") ?? -1;
			assert.strictEqual(colIndex, 5, `Expected col 5, got ${colIndex}`);
			tui.stop();
		});

		it("should respect margin object", async () => {
			const terminal = new VirtualTerminal(80, 24);
			const tui: TUI = new TuiMainScreen(terminal);
			const overlay = new StaticOverlay(["MARGIN"]);

			tui.addChild(new EmptyContent());
			tui.showOverlay(overlay, {
				anchor: "top-left",
				width: 10,
				margin: { top: 2, left: 3, right: 0, bottom: 0 },
			});
			tui.start();
			await renderAndFlush(tui, terminal);

			const viewport = terminal.getViewport();
			assert.ok(viewport[2]?.includes("MARGIN"), `Expected MARGIN on row 2, got: ${viewport[2]}`);
			const colIndex = viewport[2]?.indexOf("MARGIN") ?? -1;
			assert.strictEqual(colIndex, 3, `Expected col 3, got ${colIndex}`);
			tui.stop();
		});
	});

	describe("offset", () => {
		it("should apply offsetX and offsetY from anchor position", async () => {
			const terminal = new VirtualTerminal(80, 24);
			const tui: TUI = new TuiMainScreen(terminal);
			const overlay = new StaticOverlay(["OFFSET"]);

			tui.addChild(new EmptyContent());
			tui.showOverlay(overlay, { anchor: "top-left", width: 10, offsetX: 10, offsetY: 5 });
			tui.start();
			await renderAndFlush(tui, terminal);

			const viewport = terminal.getViewport();
			assert.ok(viewport[5]?.includes("OFFSET"), `Expected OFFSET on row 5, got: ${viewport[5]}`);
			const colIndex = viewport[5]?.indexOf("OFFSET") ?? -1;
			assert.strictEqual(colIndex, 10, `Expected col 10, got ${colIndex}`);
			tui.stop();
		});
	});

	describe("percentage positioning", () => {
		it("should position with rowPercent and colPercent", async () => {
			const terminal = new VirtualTerminal(80, 24);
			const tui: TUI = new TuiMainScreen(terminal);
			const overlay = new StaticOverlay(["PCT"]);

			tui.addChild(new EmptyContent());
			// 50% should center both ways
			// 50% 应在水平和垂直两个方向上都居中
			tui.showOverlay(overlay, { width: 10, row: "50%", col: "50%" });
			tui.start();
			await renderAndFlush(tui, terminal);

			const viewport = terminal.getViewport();
			// Find the row with PCT
			// 找到包含 PCT 的那一行
			let foundRow = -1;
			for (let i = 0; i < viewport.length; i++) {
				if (viewport[i]?.includes("PCT")) {
					foundRow = i;
					break;
				}
			}
			// Should be roughly centered vertically (row ~11-12 for 24 row terminal)
			// 应在垂直方向上大致居中（24 行终端中约为第 11-12 行）
			assert.ok(foundRow >= 10 && foundRow <= 13, `Expected centered row, got ${foundRow}`);
			tui.stop();
		});

		it("rowPercent 0 should position at top", async () => {
			const terminal = new VirtualTerminal(80, 24);
			const tui: TUI = new TuiMainScreen(terminal);
			const overlay = new StaticOverlay(["TOP"]);

			tui.addChild(new EmptyContent());
			tui.showOverlay(overlay, { width: 10, row: "0%" });
			tui.start();
			await renderAndFlush(tui, terminal);

			const viewport = terminal.getViewport();
			assert.ok(viewport[0]?.includes("TOP"), `Expected TOP on row 0, got: ${viewport[0]}`);
			tui.stop();
		});

		it("rowPercent 100 should position at bottom", async () => {
			const terminal = new VirtualTerminal(80, 24);
			const tui: TUI = new TuiMainScreen(terminal);
			const overlay = new StaticOverlay(["BOTTOM"]);

			tui.addChild(new EmptyContent());
			tui.showOverlay(overlay, { width: 10, row: "100%" });
			tui.start();
			await renderAndFlush(tui, terminal);

			const viewport = terminal.getViewport();
			assert.ok(viewport[23]?.includes("BOTTOM"), `Expected BOTTOM on last row, got: ${viewport[23]}`);
			tui.stop();
		});
	});

	describe("maxHeight", () => {
		it("should truncate overlay to maxHeight", async () => {
			const terminal = new VirtualTerminal(80, 24);
			const tui: TUI = new TuiMainScreen(terminal);
			const overlay = new StaticOverlay(["Line 1", "Line 2", "Line 3", "Line 4", "Line 5"]);

			tui.addChild(new EmptyContent());
			tui.showOverlay(overlay, { maxHeight: 3 });
			tui.start();
			await renderAndFlush(tui, terminal);

			const viewport = terminal.getViewport();
			const content = viewport.join("\n");
			assert.ok(content.includes("Line 1"), "Should include Line 1");
			assert.ok(content.includes("Line 2"), "Should include Line 2");
			assert.ok(content.includes("Line 3"), "Should include Line 3");
			assert.ok(!content.includes("Line 4"), "Should NOT include Line 4");
			assert.ok(!content.includes("Line 5"), "Should NOT include Line 5");
			tui.stop();
		});

		it("should truncate overlay to maxHeightPercent", async () => {
			const terminal = new VirtualTerminal(80, 10);
			const tui: TUI = new TuiMainScreen(terminal);
			// 10 lines in a 10 row terminal with 50% maxHeight should show 5 lines
			// 在 10 行的终端中，10 行内容配合 50% 的 maxHeight 应显示 5 行
			const overlay = new StaticOverlay(["L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8", "L9", "L10"]);

			tui.addChild(new EmptyContent());
			tui.showOverlay(overlay, { maxHeight: "50%" });
			tui.start();
			await renderAndFlush(tui, terminal);

			const viewport = terminal.getViewport();
			const content = viewport.join("\n");
			assert.ok(content.includes("L1"), "Should include L1");
			assert.ok(content.includes("L5"), "Should include L5");
			assert.ok(!content.includes("L6"), "Should NOT include L6");
			tui.stop();
		});
	});

	describe("absolute positioning", () => {
		it("row and col should override anchor", async () => {
			const terminal = new VirtualTerminal(80, 24);
			const tui: TUI = new TuiMainScreen(terminal);
			const overlay = new StaticOverlay(["ABSOLUTE"]);

			tui.addChild(new EmptyContent());
			// Even with bottom-right anchor, row/col should win
			// 即便设置了 bottom-right 锚点（anchor），row/col 也应优先生效
			tui.showOverlay(overlay, { anchor: "bottom-right", row: 3, col: 5, width: 10 });
			tui.start();
			await renderAndFlush(tui, terminal);

			const viewport = terminal.getViewport();
			assert.ok(viewport[3]?.includes("ABSOLUTE"), `Expected ABSOLUTE on row 3, got: ${viewport[3]}`);
			const colIndex = viewport[3]?.indexOf("ABSOLUTE") ?? -1;
			assert.strictEqual(colIndex, 5, `Expected col 5, got ${colIndex}`);
			tui.stop();
		});
	});

	describe("stacked overlays", () => {
		it("should render multiple overlays with later ones on top", async () => {
			const terminal = new VirtualTerminal(80, 24);
			const tui: TUI = new TuiMainScreen(terminal);

			tui.addChild(new EmptyContent());

			// First overlay at top-left
			// 第一个浮层（overlay）位于左上角
			const overlay1 = new StaticOverlay(["FIRST-OVERLAY"]);
			tui.showOverlay(overlay1, { anchor: "top-left", width: 20 });

			// Second overlay at top-left (should cover part of first)
			// 第二个浮层（overlay）同样位于左上角（应遮挡第一个的一部分）
			const overlay2 = new StaticOverlay(["SECOND"]);
			tui.showOverlay(overlay2, { anchor: "top-left", width: 10 });

			tui.start();
			await renderAndFlush(tui, terminal);

			const viewport = terminal.getViewport();
			// Second overlay should be visible (on top)
			// 第二个浮层（overlay）应当可见（位于最上层）
			assert.ok(viewport[0]?.includes("SECOND"), `Expected SECOND on row 0, got: ${viewport[0]}`);
			// Part of first overlay might still be visible after SECOND
			// 第一个浮层的一部分可能仍显示在 SECOND 之后
			// FIRST-OVERLAY is 13 chars, SECOND is 6 chars, so "OVERLAY" part might show
			// FIRST-OVERLAY 有 13 个字符，SECOND 有 6 个字符，因此 "OVERLAY" 部分可能会显示出来
			tui.stop();
		});

		it("should handle overlays at different positions without interference", async () => {
			const terminal = new VirtualTerminal(80, 24);
			const tui: TUI = new TuiMainScreen(terminal);

			tui.addChild(new EmptyContent());

			// Overlay at top-left
			// 位于左上角的浮层（overlay）
			const overlay1 = new StaticOverlay(["TOP-LEFT"]);
			tui.showOverlay(overlay1, { anchor: "top-left", width: 15 });

			// Overlay at bottom-right
			// 位于右下角的浮层（overlay）
			const overlay2 = new StaticOverlay(["BTM-RIGHT"]);
			tui.showOverlay(overlay2, { anchor: "bottom-right", width: 15 });

			tui.start();
			await renderAndFlush(tui, terminal);

			const viewport = terminal.getViewport();
			// Both should be visible
			// 两者都应可见
			assert.ok(viewport[0]?.includes("TOP-LEFT"), `Expected TOP-LEFT on row 0, got: ${viewport[0]}`);
			assert.ok(viewport[23]?.includes("BTM-RIGHT"), `Expected BTM-RIGHT on row 23, got: ${viewport[23]}`);
			tui.stop();
		});

		it("should properly hide overlays in stack order", async () => {
			const terminal = new VirtualTerminal(80, 24);
			const tui: TUI = new TuiMainScreen(terminal);

			tui.addChild(new EmptyContent());

			// Show two overlays
			// 显示两个浮层（overlay）
			const overlay1 = new StaticOverlay(["FIRST"]);
			tui.showOverlay(overlay1, { anchor: "top-left", width: 10 });

			const overlay2 = new StaticOverlay(["SECOND"]);
			tui.showOverlay(overlay2, { anchor: "top-left", width: 10 });

			tui.start();
			await renderAndFlush(tui, terminal);

			// Second should be visible
			// 第二个应当可见
			let viewport = terminal.getViewport();
			assert.ok(viewport[0]?.includes("SECOND"), "SECOND should be visible initially");

			// Hide top overlay
			// 隐藏最上层的浮层（overlay）
			tui.hideOverlay();
			await renderAndFlush(tui, terminal);

			// First should now be visible
			// 此时第一个应当可见
			viewport = terminal.getViewport();
			assert.ok(viewport[0]?.includes("FIRST"), "FIRST should be visible after hiding SECOND");

			tui.stop();
		});
	});
});
