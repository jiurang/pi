/**
 * Shared utility for truncating text to visual lines (accounting for line wrapping).
 * 用于将文本按视觉行(考虑自动换行)进行截断的共享工具函数。
 * Used by both tool-execution.ts and bash-execution.ts for consistent behavior.
 * tool-execution.ts 与 bash-execution.ts 都会使用它，以保证行为一致。
 */

import { Text } from "@earendil-works/pi-tui";

export interface VisualTruncateResult {
	/** The visual lines to display 需要展示的视觉行 */
	visualLines: string[];
	/** Number of visual lines that were skipped (hidden) 被跳过(隐藏)的视觉行数量 */
	skippedCount: number;
}

/**
 * Truncate text to a maximum number of visual lines (from the end).
 * 将文本截断到最多指定数量的视觉行(从末尾开始保留)。
 * This accounts for line wrapping based on terminal width.
 * 该过程会考虑基于终端宽度的自动换行。
 *
 * @param text - The text content (may contain newlines)
 *               文本内容(可能包含换行符)
 * @param maxVisualLines - Maximum number of visual lines to show
 *                         最多展示的视觉行数量
 * @param width - Terminal/render width
 *                终端/渲染宽度
 * @param paddingX - Horizontal padding for Text component (default 0).
 *                   Text 组件的水平内边距(默认 0)。
 *                   Use 0 when result will be placed in a Box (Box adds its own padding).
 *                   当结果会被放入 Box 时使用 0(Box 会自行添加内边距)。
 *                   Use 1 when result will be placed in a plain Container.
 *                   当结果会被放入普通 Container 时使用 1。
 * @returns The truncated visual lines and count of skipped lines
 *          截断后的视觉行，以及被跳过的行数
 */
export function truncateToVisualLines(
	text: string,
	maxVisualLines: number,
	width: number,
	paddingX: number = 0,
): VisualTruncateResult {
	if (!text) {
		return { visualLines: [], skippedCount: 0 };
	}

	// Create a temporary Text component to render and get visual lines
	// 创建一个临时的 Text 组件用于渲染并获取视觉行
	const tempText = new Text(text, paddingX, 0);
	const allVisualLines = tempText.render(width);

	if (allVisualLines.length <= maxVisualLines) {
		return { visualLines: allVisualLines, skippedCount: 0 };
	}

	// Take the last N visual lines
	// 取最后 N 个视觉行
	const truncatedLines = allVisualLines.slice(-maxVisualLines);
	const skippedCount = allVisualLines.length - maxVisualLines;

	return { visualLines: truncatedLines, skippedCount };
}
