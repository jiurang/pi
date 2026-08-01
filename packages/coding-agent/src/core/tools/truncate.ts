/**
 * Shared truncation utilities for tool outputs.
 * 用于工具输出的通用截断（truncation）工具函数。
 *
 * Truncation is based on two independent limits - whichever is hit first wins:
 * 截断基于两个相互独立的上限 —— 先触及哪个就以哪个为准：
 * - Line limit (default: 2000 lines)
 *   行数上限（默认：2000 行）
 * - Byte limit (default: 50KB)
 *   字节数上限（默认：50KB）
 *
 * Never returns partial lines (except bash tail truncation edge case).
 * 永远不会返回不完整的行（bash 尾部截断的边界情况除外）。
 */

export const DEFAULT_MAX_LINES = 2000;
export const DEFAULT_MAX_BYTES = 50 * 1024; // 50KB
// Max chars per grep match line
// 每条 grep 匹配行的最大字符数
export const GREP_MAX_LINE_LENGTH = 500; // Max chars per grep match line

export interface TruncationResult {
	/**
	 * The truncated content
	 * 截断后的内容
	 */
	content: string;
	/**
	 * Whether truncation occurred
	 * 是否发生了截断
	 */
	truncated: boolean;
	/**
	 * Which limit was hit: "lines", "bytes", or null if not truncated
	 * 触及了哪个上限："lines"（行数）、"bytes"（字节数），未截断时为 null
	 */
	truncatedBy: "lines" | "bytes" | null;
	/**
	 * Total number of lines in the original content
	 * 原始内容的总行数
	 */
	totalLines: number;
	/**
	 * Total number of bytes in the original content
	 * 原始内容的总字节数
	 */
	totalBytes: number;
	/**
	 * Number of complete lines in the truncated output
	 * 截断后输出中完整行的数量
	 */
	outputLines: number;
	/**
	 * Number of bytes in the truncated output
	 * 截断后输出的字节数
	 */
	outputBytes: number;
	/**
	 * Whether the last line was partially truncated (only for tail truncation edge case)
	 * 最后一行是否被部分截断（仅出现在尾部截断的边界情况中）
	 */
	lastLinePartial: boolean;
	/**
	 * Whether the first line exceeded the byte limit (for head truncation)
	 * 第一行是否超出了字节上限（用于头部截断）
	 */
	firstLineExceedsLimit: boolean;
	/**
	 * The max lines limit that was applied
	 * 实际应用的最大行数上限
	 */
	maxLines: number;
	/**
	 * The max bytes limit that was applied
	 * 实际应用的最大字节数上限
	 */
	maxBytes: number;
}

export interface TruncationOptions {
	/**
	 * Maximum number of lines (default: 2000)
	 * 最大行数（默认：2000）
	 */
	maxLines?: number;
	/**
	 * Maximum number of bytes (default: 50KB)
	 * 最大字节数（默认：50KB）
	 */
	maxBytes?: number;
}

function splitLinesForCounting(content: string): string[] {
	if (content.length === 0) {
		return [];
	}
	const lines = content.split("\n");
	if (content.endsWith("\n")) {
		lines.pop();
	}
	return lines;
}

/**
 * Format bytes as human-readable size.
 * 将字节数格式化为便于阅读的大小表示。
 */
export function formatSize(bytes: number): string {
	if (bytes < 1024) {
		return `${bytes}B`;
	} else if (bytes < 1024 * 1024) {
		return `${(bytes / 1024).toFixed(1)}KB`;
	} else {
		return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
	}
}

/**
 * Truncate content from the head (keep first N lines/bytes).
 * 从头部截断内容（保留前 N 行/前 N 字节）。
 * Suitable for file reads where you want to see the beginning.
 * 适用于希望查看开头部分的文件读取场景。
 *
 * Never returns partial lines. If first line exceeds byte limit,
 * returns empty content with firstLineExceedsLimit=true.
 * 永远不会返回不完整的行。如果第一行就超出了字节上限，
 * 则返回空内容并将 firstLineExceedsLimit 置为 true。
 */
export function truncateHead(content: string, options: TruncationOptions = {}): TruncationResult {
	const maxLines = options.maxLines ?? DEFAULT_MAX_LINES;
	const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

	const totalBytes = Buffer.byteLength(content, "utf-8");
	const lines = splitLinesForCounting(content);
	const totalLines = lines.length;

	// Check if no truncation needed
	// 检查是否无需截断
	if (totalLines <= maxLines && totalBytes <= maxBytes) {
		return {
			content,
			truncated: false,
			truncatedBy: null,
			totalLines,
			totalBytes,
			outputLines: totalLines,
			outputBytes: totalBytes,
			lastLinePartial: false,
			firstLineExceedsLimit: false,
			maxLines,
			maxBytes,
		};
	}

	// Check if first line alone exceeds byte limit
	// 检查仅第一行是否就超出了字节上限
	const firstLineBytes = Buffer.byteLength(lines[0], "utf-8");
	if (firstLineBytes > maxBytes) {
		return {
			content: "",
			truncated: true,
			truncatedBy: "bytes",
			totalLines,
			totalBytes,
			outputLines: 0,
			outputBytes: 0,
			lastLinePartial: false,
			firstLineExceedsLimit: true,
			maxLines,
			maxBytes,
		};
	}

	// Collect complete lines that fit
	// 收集能够容纳下的完整行
	const outputLinesArr: string[] = [];
	let outputBytesCount = 0;
	let truncatedBy: "lines" | "bytes" = "lines";

	for (let i = 0; i < lines.length && i < maxLines; i++) {
		const line = lines[i];
		// +1 for newline
		// +1 是为换行符预留的
		const lineBytes = Buffer.byteLength(line, "utf-8") + (i > 0 ? 1 : 0); // +1 for newline

		if (outputBytesCount + lineBytes > maxBytes) {
			truncatedBy = "bytes";
			break;
		}

		outputLinesArr.push(line);
		outputBytesCount += lineBytes;
	}

	// If we exited due to line limit
	// 如果是因为触及行数上限而退出循环
	if (outputLinesArr.length >= maxLines && outputBytesCount <= maxBytes) {
		truncatedBy = "lines";
	}

	const outputContent = outputLinesArr.join("\n");
	const finalOutputBytes = Buffer.byteLength(outputContent, "utf-8");

	return {
		content: outputContent,
		truncated: true,
		truncatedBy,
		totalLines,
		totalBytes,
		outputLines: outputLinesArr.length,
		outputBytes: finalOutputBytes,
		lastLinePartial: false,
		firstLineExceedsLimit: false,
		maxLines,
		maxBytes,
	};
}

/**
 * Truncate content from the tail (keep last N lines/bytes).
 * 从尾部截断内容（保留最后 N 行/最后 N 字节）。
 * Suitable for bash output where you want to see the end (errors, final results).
 * 适用于希望查看结尾部分（错误信息、最终结果）的 bash 输出场景。
 *
 * May return partial first line if the last line of original content exceeds byte limit.
 * 如果原始内容的最后一行超出了字节上限，返回结果的第一行可能是不完整的。
 */
export function truncateTail(content: string, options: TruncationOptions = {}): TruncationResult {
	const maxLines = options.maxLines ?? DEFAULT_MAX_LINES;
	const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

	const totalBytes = Buffer.byteLength(content, "utf-8");
	const lines = splitLinesForCounting(content);
	const totalLines = lines.length;

	// Check if no truncation needed
	// 检查是否无需截断
	if (totalLines <= maxLines && totalBytes <= maxBytes) {
		return {
			content,
			truncated: false,
			truncatedBy: null,
			totalLines,
			totalBytes,
			outputLines: totalLines,
			outputBytes: totalBytes,
			lastLinePartial: false,
			firstLineExceedsLimit: false,
			maxLines,
			maxBytes,
		};
	}

	// Work backwards from the end
	// 从末尾开始向前处理
	const outputLinesArr: string[] = [];
	let outputBytesCount = 0;
	let truncatedBy: "lines" | "bytes" = "lines";
	let lastLinePartial = false;

	for (let i = lines.length - 1; i >= 0 && outputLinesArr.length < maxLines; i--) {
		const line = lines[i];
		// +1 for newline
		// +1 是为换行符预留的
		const lineBytes = Buffer.byteLength(line, "utf-8") + (outputLinesArr.length > 0 ? 1 : 0); // +1 for newline

		if (outputBytesCount + lineBytes > maxBytes) {
			truncatedBy = "bytes";
			// Edge case: if we haven't added ANY lines yet and this line exceeds maxBytes,
			// take the end of the line (partial)
			// 边界情况：如果尚未加入任何一行，而这一行本身就超出了 maxBytes，
			// 则取该行的末尾部分（不完整的行）
			if (outputLinesArr.length === 0) {
				const truncatedLine = truncateStringToBytesFromEnd(line, maxBytes);
				outputLinesArr.unshift(truncatedLine);
				outputBytesCount = Buffer.byteLength(truncatedLine, "utf-8");
				lastLinePartial = true;
			}
			break;
		}

		outputLinesArr.unshift(line);
		outputBytesCount += lineBytes;
	}

	// If we exited due to line limit
	// 如果是因为触及行数上限而退出循环
	if (outputLinesArr.length >= maxLines && outputBytesCount <= maxBytes) {
		truncatedBy = "lines";
	}

	const outputContent = outputLinesArr.join("\n");
	const finalOutputBytes = Buffer.byteLength(outputContent, "utf-8");

	return {
		content: outputContent,
		truncated: true,
		truncatedBy,
		totalLines,
		totalBytes,
		outputLines: outputLinesArr.length,
		outputBytes: finalOutputBytes,
		lastLinePartial,
		firstLineExceedsLimit: false,
		maxLines,
		maxBytes,
	};
}

/**
 * Truncate a string to fit within a byte limit (from the end).
 * 从末尾截取字符串，使其符合字节数上限。
 * Handles multi-byte UTF-8 characters correctly.
 * 能正确处理多字节的 UTF-8 字符。
 */
function truncateStringToBytesFromEnd(str: string, maxBytes: number): string {
	const buf = Buffer.from(str, "utf-8");
	if (buf.length <= maxBytes) {
		return str;
	}

	// Start from the end, skip maxBytes back
	// 从末尾出发，向前回退 maxBytes 个字节
	let start = buf.length - maxBytes;

	// Find a valid UTF-8 boundary (start of a character)
	// 找到一个有效的 UTF-8 边界（某个字符的起始位置）
	while (start < buf.length && (buf[start] & 0xc0) === 0x80) {
		start++;
	}

	return buf.slice(start).toString("utf-8");
}

/**
 * Truncate a single line to max characters, adding [truncated] suffix.
 * 将单行截断到最大字符数，并添加 [truncated] 后缀。
 * Used for grep match lines.
 * 用于 grep 的匹配行。
 */
export function truncateLine(
	line: string,
	maxChars: number = GREP_MAX_LINE_LENGTH,
): { text: string; wasTruncated: boolean } {
	if (line.length <= maxChars) {
		return { text: line, wasTruncated: false };
	}
	return { text: `${line.slice(0, maxChars)}... [truncated]`, wasTruncated: true };
}
