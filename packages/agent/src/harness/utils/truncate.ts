/**
 * Shared truncation utilities for tool outputs.
 * 供工具输出共用的截断(truncation)工具函数。
 *
 * Truncation is based on two independent limits - whichever is hit first wins:
 * 截断基于两个相互独立的上限,以先触发者为准:
 * - Line limit (default: 2000 lines)
 *   行数上限(默认:2000 行)
 * - Byte limit (default: 50KB)
 *   字节数上限(默认:50KB)
 *
 * Never returns partial lines (except bash tail truncation edge case).
 * 永远不会返回不完整的行(bash 尾部截断的边界情况除外)。
 */

export const DEFAULT_MAX_LINES = 2000;
export const DEFAULT_MAX_BYTES = 50 * 1024; // 50KB
export const GREP_MAX_LINE_LENGTH = 500; // Max chars per grep match line
// 每条 grep 匹配行的最大字符数

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
	 * 触发的是哪个上限:"lines"(行数)、"bytes"(字节数),未发生截断时为 null
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
	 * 最后一行是否被部分截断(仅出现在尾部截断的边界情况中)
	 */
	lastLinePartial: boolean;
	/**
	 * Whether the first line exceeded the byte limit (for head truncation)
	 * 第一行本身是否已超出字节上限(用于头部截断)
	 */
	firstLineExceedsLimit: boolean;
	/**
	 * The max lines limit that was applied
	 * 实际生效的最大行数上限
	 */
	maxLines: number;
	/**
	 * The max bytes limit that was applied
	 * 实际生效的最大字节数上限
	 */
	maxBytes: number;
}

export interface TruncationOptions {
	/**
	 * Maximum number of lines (default: 2000)
	 * 最大行数(默认:2000)
	 */
	maxLines?: number;
	/**
	 * Maximum number of bytes (default: 50KB)
	 * 最大字节数(默认:50KB)
	 */
	maxBytes?: number;
}

interface RuntimeBuffer {
	byteLength(content: string, encoding: "utf8"): number;
}

const runtimeBuffer = (globalThis as { Buffer?: RuntimeBuffer }).Buffer;
const nonAsciiPattern = /[^\x00-\x7f]/;

function utf8ByteLength(content: string): number {
	if (runtimeBuffer) return runtimeBuffer.byteLength(content, "utf8");

	const firstNonAscii = content.search(nonAsciiPattern);
	if (firstNonAscii === -1) return content.length;

	let bytes = firstNonAscii;
	for (let i = firstNonAscii; i < content.length; i++) {
		const code = content.charCodeAt(i);
		if (code <= 0x7f) {
			bytes += 1;
		} else if (code <= 0x7ff) {
			bytes += 2;
		} else if (code >= 0xd800 && code <= 0xdbff && i + 1 < content.length) {
			const next = content.charCodeAt(i + 1);
			if (next >= 0xdc00 && next <= 0xdfff) {
				bytes += 4;
				i++;
			} else {
				bytes += 3;
			}
		} else {
			bytes += 3;
		}
	}
	return bytes;
}

function splitLinesForCounting(content: string): string[] {
	if (content.length === 0) return [];
	const lines = content.split("\n");
	if (content.endsWith("\n")) lines.pop();
	return lines;
}

function replaceUnpairedSurrogates(content: string): string {
	let output = "";
	for (let i = 0; i < content.length; i++) {
		const code = content.charCodeAt(i);
		if (code >= 0xd800 && code <= 0xdbff) {
			if (i + 1 < content.length) {
				const next = content.charCodeAt(i + 1);
				if (next >= 0xdc00 && next <= 0xdfff) {
					output += content[i] + content[i + 1];
					i++;
					continue;
				}
			}
			output += "�";
		} else if (code >= 0xdc00 && code <= 0xdfff) {
			output += "�";
		} else {
			output += content[i];
		}
	}
	return output;
}

/**
 * Format bytes as human-readable size.
 * 将字节数格式化为便于人阅读的大小表示。
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
 * 从头部截断内容(保留前 N 行/前 N 字节)。
 * Suitable for file reads where you want to see the beginning.
 * 适用于希望查看文件开头部分的读取场景。
 *
 * Never returns partial lines. If first line exceeds byte limit,
 * returns empty content with firstLineExceedsLimit=true.
 * 永远不会返回不完整的行。如果第一行就超出了字节上限,
 * 则返回空内容,并将 firstLineExceedsLimit 置为 true。
 */
export function truncateHead(content: string, options: TruncationOptions = {}): TruncationResult {
	const maxLines = options.maxLines ?? DEFAULT_MAX_LINES;
	const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

	const totalBytes = utf8ByteLength(content);
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
	// 检查仅第一行是否就已超出字节上限
	const firstLineBytes = utf8ByteLength(lines[0]);
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
	// 收集能够放得下的完整行
	const outputLinesArr: string[] = [];
	let outputBytesCount = 0;
	let truncatedBy: "lines" | "bytes" = "lines";

	for (let i = 0; i < lines.length && i < maxLines; i++) {
		const line = lines[i];
		const lineBytes = utf8ByteLength(line) + (i > 0 ? 1 : 0); // +1 for newline
		// +1 是为换行符预留的字节

		if (outputBytesCount + lineBytes > maxBytes) {
			truncatedBy = "bytes";
			break;
		}

		outputLinesArr.push(line);
		outputBytesCount += lineBytes;
	}

	// If we exited due to line limit
	// 如果是因为行数上限而退出循环
	if (outputLinesArr.length >= maxLines && outputBytesCount <= maxBytes) {
		truncatedBy = "lines";
	}

	const outputContent = outputLinesArr.join("\n");
	const finalOutputBytes = utf8ByteLength(outputContent);

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
 * 从尾部截断内容(保留最后 N 行/最后 N 字节)。
 * Suitable for bash output where you want to see the end (errors, final results).
 * 适用于希望查看输出末尾(错误信息、最终结果)的 bash 输出场景。
 *
 * May return partial first line if the last line of original content exceeds byte limit.
 * 如果原始内容的最后一行超出了字节上限,返回结果的第一行可能是不完整的。
 */
export function truncateTail(content: string, options: TruncationOptions = {}): TruncationResult {
	const maxLines = options.maxLines ?? DEFAULT_MAX_LINES;
	const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

	const totalBytes = utf8ByteLength(content);
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
		const lineBytes = utf8ByteLength(line) + (outputLinesArr.length > 0 ? 1 : 0); // +1 for newline
		// +1 是为换行符预留的字节

		if (outputBytesCount + lineBytes > maxBytes) {
			truncatedBy = "bytes";
			// Edge case: if we haven't added ANY lines yet and this line exceeds maxBytes,
			// 边界情况:如果此时还没有加入任何一行,而这一行本身就超过了 maxBytes,
			// take the end of the line (partial)
			// 则只取该行的末尾部分(不完整的行)
			if (outputLinesArr.length === 0) {
				const truncatedLine = truncateStringToBytesFromEnd(line, maxBytes);
				outputLinesArr.unshift(truncatedLine);
				outputBytesCount = utf8ByteLength(truncatedLine);
				lastLinePartial = true;
			}
			break;
		}

		outputLinesArr.unshift(line);
		outputBytesCount += lineBytes;
	}

	// If we exited due to line limit
	// 如果是因为行数上限而退出循环
	if (outputLinesArr.length >= maxLines && outputBytesCount <= maxBytes) {
		truncatedBy = "lines";
	}

	const outputContent = outputLinesArr.join("\n");
	const finalOutputBytes = utf8ByteLength(outputContent);

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
 * 截断字符串以使其符合字节上限(从末尾开始保留)。
 * Handles multi-byte UTF-8 characters correctly.
 * 能够正确处理多字节的 UTF-8 字符。
 */
function truncateStringToBytesFromEnd(str: string, maxBytes: number): string {
	if (maxBytes <= 0) return "";

	let outputBytes = 0;
	let start = str.length;
	let needsReplacement = false;
	for (let i = str.length; i > 0; ) {
		let characterStart = i - 1;
		const code = str.charCodeAt(characterStart);
		let characterBytes: number;
		let unpairedSurrogate = false;
		if (code >= 0xdc00 && code <= 0xdfff && characterStart > 0) {
			const previous = str.charCodeAt(characterStart - 1);
			if (previous >= 0xd800 && previous <= 0xdbff) {
				characterStart--;
				characterBytes = 4;
			} else {
				characterBytes = 3;
				unpairedSurrogate = true;
			}
		} else if (code >= 0xd800 && code <= 0xdfff) {
			characterBytes = 3;
			unpairedSurrogate = true;
		} else {
			characterBytes = code <= 0x7f ? 1 : code <= 0x7ff ? 2 : 3;
		}
		if (outputBytes + characterBytes > maxBytes) break;
		outputBytes += characterBytes;
		start = characterStart;
		needsReplacement ||= unpairedSurrogate;
		i = characterStart;
	}

	const output = str.slice(start);
	return needsReplacement ? replaceUnpairedSurrogates(output) : output;
}

/**
 * Truncate a single line to max characters, adding [truncated] suffix.
 * 将单行截断到最大字符数,并追加 [truncated] 后缀。
 * Used for grep match lines.
 * 用于 grep 的匹配结果行。
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
