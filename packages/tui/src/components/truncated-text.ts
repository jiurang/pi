import type { Component } from "../tui.ts";
import { truncateToWidth, visibleWidth } from "../utils.ts";

/**
 * Text component that truncates to fit viewport width
 * 文本组件 —— 通过截断文本使其适配视口（viewport）宽度
 */
export class TruncatedText implements Component {
	private text: string;
	private paddingX: number;
	private paddingY: number;

	constructor(text: string, paddingX: number = 0, paddingY: number = 0) {
		this.text = text;
		this.paddingX = paddingX;
		this.paddingY = paddingY;
	}

	invalidate(): void {
		// No cached state to invalidate currently
		// 当前没有需要失效处理的缓存状态
	}

	render(width: number): string[] {
		const result: string[] = [];

		// Empty line padded to width
		// 填充补齐到指定宽度的空行
		const emptyLine = " ".repeat(width);

		// Add vertical padding above
		// 添加上方的垂直内边距
		for (let i = 0; i < this.paddingY; i++) {
			result.push(emptyLine);
		}

		// Calculate available width after horizontal padding
		// 计算扣除水平内边距后的可用宽度
		const availableWidth = Math.max(1, width - this.paddingX * 2);

		// Take only the first line (stop at newline)
		// 只取第一行（遇到换行符即停止）
		let singleLineText = this.text;
		const newlineIndex = this.text.indexOf("\n");
		if (newlineIndex !== -1) {
			singleLineText = this.text.substring(0, newlineIndex);
		}

		// Truncate text if needed (accounting for ANSI codes)
		// 如有需要则截断文本（会正确处理 ANSI 转义码）
		const displayText = truncateToWidth(singleLineText, availableWidth);

		// Add horizontal padding
		// 添加水平内边距
		const leftPadding = " ".repeat(this.paddingX);
		const rightPadding = " ".repeat(this.paddingX);
		const lineWithPadding = leftPadding + displayText + rightPadding;

		// Pad line to exactly width characters
		// 将该行精确填充补齐到 width 个字符宽度
		const lineVisibleWidth = visibleWidth(lineWithPadding);
		const paddingNeeded = Math.max(0, width - lineVisibleWidth);
		const finalLine = lineWithPadding + " ".repeat(paddingNeeded);

		result.push(finalLine);

		// Add vertical padding below
		// 添加下方的垂直内边距
		for (let i = 0; i < this.paddingY; i++) {
			result.push(emptyLine);
		}

		return result;
	}
}
