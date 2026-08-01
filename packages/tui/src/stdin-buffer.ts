/**
 * StdinBuffer buffers input and emits complete sequences.
 * StdinBuffer 对输入进行缓冲，并在序列完整时将其发出。
 *
 * This is necessary because stdin data events can arrive in partial chunks,
 * especially for escape sequences like mouse events.
 * 之所以必须这样做，是因为 stdin 的 data 事件可能以不完整的分块形式到达，
 * 对于鼠标事件之类的转义序列而言尤其如此。
 * Without buffering,
 * partial sequences can be misinterpreted as regular keypresses.
 * 如果不做缓冲，不完整的序列就可能被误判为普通的按键输入。
 *
 * For example, the mouse SGR sequence `\x1b[<35;20;5m` might arrive as:
 * 例如，鼠标的 SGR 序列 `\x1b[<35;20;5m` 可能会以如下方式分批到达：
 * - Event 1: `\x1b`
 *   事件 1：`\x1b`
 * - Event 2: `[<35`
 *   事件 2：`[<35`
 * - Event 3: `;20;5m`
 *   事件 3：`;20;5m`
 *
 * The buffer accumulates these until a complete sequence is detected.
 * 缓冲区会不断累积这些数据，直到检测出一个完整的序列为止。
 * Call the `process()` method to feed input data.
 * 调用 `process()` 方法来喂入输入数据。
 *
 * Based on code from OpenTUI (https://github.com/anomalyco/opentui)
 * 基于 OpenTUI 的代码实现（https://github.com/anomalyco/opentui）
 * MIT License - Copyright (c) 2025 opentui
 * MIT 许可证 - 版权所有 (c) 2025 opentui
 */

import { EventEmitter } from "events";

const ESC = "\x1b";
const BRACKETED_PASTE_START = "\x1b[200~";
const BRACKETED_PASTE_END = "\x1b[201~";

/**
 * Check if a string is a complete escape sequence or needs more data
 * 检查一个字符串是完整的转义序列，还是仍需等待更多数据
 */
function isCompleteSequence(data: string): "complete" | "incomplete" | "not-escape" {
	if (!data.startsWith(ESC)) {
		return "not-escape";
	}

	if (data.length === 1) {
		return "incomplete";
	}

	const afterEsc = data.slice(1);

	// CSI sequences: ESC [
	// CSI 序列：ESC [
	if (afterEsc.startsWith("[")) {
		// Check for old-style mouse sequence: ESC[M + 3 bytes
		// 检查是否为旧式鼠标序列：ESC[M + 3 个字节
		if (afterEsc.startsWith("[M")) {
			// Old-style mouse needs ESC[M + 3 bytes = 6 total
			// 旧式鼠标序列需要 ESC[M 再加 3 个字节，总计 6 个字节
			return data.length >= 6 ? "complete" : "incomplete";
		}
		return isCompleteCsiSequence(data);
	}

	// OSC sequences: ESC ]
	// OSC 序列：ESC ]
	if (afterEsc.startsWith("]")) {
		return isCompleteOscSequence(data);
	}

	// DCS sequences: ESC P ... ESC \ (includes XTVersion responses)
	// DCS 序列：ESC P ... ESC \（包含 XTVersion 响应）
	if (afterEsc.startsWith("P")) {
		return isCompleteDcsSequence(data);
	}

	// APC sequences: ESC _ ... ESC \ (includes Kitty graphics responses)
	// APC 序列：ESC _ ... ESC \（包含 Kitty 图形协议响应）
	if (afterEsc.startsWith("_")) {
		return isCompleteApcSequence(data);
	}

	// SS3 sequences: ESC O
	// SS3 序列：ESC O
	if (afterEsc.startsWith("O")) {
		// ESC O followed by a single character
		// ESC O 后面紧跟一个字符
		return afterEsc.length >= 2 ? "complete" : "incomplete";
	}

	// Meta key sequences: ESC followed by a single character
	// Meta 键序列：ESC 后面紧跟一个字符
	if (afterEsc.length === 1) {
		return "complete";
	}

	// Unknown escape sequence - treat as complete
	// 未知的转义序列 —— 一律视为已完整
	return "complete";
}

/**
 * Check if CSI sequence is complete
 * 检查 CSI 序列是否已完整
 * CSI sequences: ESC [ ... followed by a final byte (0x40-0x7E)
 * CSI 序列的格式为：ESC [ ... 后接一个终止字节（0x40-0x7E）
 */
function isCompleteCsiSequence(data: string): "complete" | "incomplete" {
	if (!data.startsWith(`${ESC}[`)) {
		return "complete";
	}

	// Need at least ESC [ and one more character
	// 至少需要 ESC [ 再加一个字符
	if (data.length < 3) {
		return "incomplete";
	}

	const payload = data.slice(2);

	// CSI sequences end with a byte in the range 0x40-0x7E (@-~)
	// CSI 序列以取值范围在 0x40-0x7E（@-~）之间的字节结尾
	// This includes all letters and several special characters
	// 该范围涵盖全部字母以及若干特殊字符
	const lastChar = payload[payload.length - 1];
	const lastCharCode = lastChar.charCodeAt(0);

	if (lastCharCode >= 0x40 && lastCharCode <= 0x7e) {
		// Special handling for SGR mouse sequences
		// 针对 SGR 鼠标序列的特殊处理
		// Format: ESC[<B;X;Ym or ESC[<B;X;YM
		// 格式为：ESC[<B;X;Ym 或 ESC[<B;X;YM
		if (payload.startsWith("<")) {
			// Must have format: <digits;digits;digits[Mm]
			// 必须符合如下格式：<数字;数字;数字[Mm]
			const mouseMatch = /^<\d+;\d+;\d+[Mm]$/.test(payload);
			if (mouseMatch) {
				return "complete";
			}
			// If it ends with M or m but doesn't match the pattern, still incomplete
			// 如果它以 M 或 m 结尾但并不匹配该模式，则仍然视为不完整
			if (lastChar === "M" || lastChar === "m") {
				// Check if we have the right structure
				// 检查其结构是否正确
				const parts = payload.slice(1, -1).split(";");
				if (parts.length === 3 && parts.every((p) => /^\d+$/.test(p))) {
					return "complete";
				}
			}

			return "incomplete";
		}

		return "complete";
	}

	return "incomplete";
}

/**
 * Check if OSC sequence is complete
 * 检查 OSC 序列是否已完整
 * OSC sequences: ESC ] ... ST (where ST is ESC \ or BEL)
 * OSC 序列的格式为：ESC ] ... ST（其中 ST 为 ESC \ 或 BEL）
 */
function isCompleteOscSequence(data: string): "complete" | "incomplete" {
	if (!data.startsWith(`${ESC}]`)) {
		return "complete";
	}

	// OSC sequences end with ST (ESC \) or BEL (\x07)
	// OSC 序列以 ST（ESC \）或 BEL（\x07）结尾
	if (data.endsWith(`${ESC}\\`) || data.endsWith("\x07")) {
		return "complete";
	}

	return "incomplete";
}

/**
 * Check if DCS (Device Control String) sequence is complete
 * 检查 DCS（Device Control String，设备控制字符串）序列是否已完整
 * DCS sequences: ESC P ... ST (where ST is ESC \)
 * DCS 序列的格式为：ESC P ... ST（其中 ST 为 ESC \）
 * Used for XTVersion responses like ESC P >| ... ESC \
 * 用于诸如 ESC P >| ... ESC \ 这类 XTVersion 响应
 */
function isCompleteDcsSequence(data: string): "complete" | "incomplete" {
	if (!data.startsWith(`${ESC}P`)) {
		return "complete";
	}

	// DCS sequences end with ST (ESC \)
	// DCS 序列以 ST（ESC \）结尾
	if (data.endsWith(`${ESC}\\`)) {
		return "complete";
	}

	return "incomplete";
}

/**
 * Check if APC (Application Program Command) sequence is complete
 * 检查 APC（Application Program Command，应用程序命令）序列是否已完整
 * APC sequences: ESC _ ... ST (where ST is ESC \)
 * APC 序列的格式为：ESC _ ... ST（其中 ST 为 ESC \）
 * Used for Kitty graphics responses like ESC _ G ... ESC \
 * 用于诸如 ESC _ G ... ESC \ 这类 Kitty 图形协议响应
 */
function isCompleteApcSequence(data: string): "complete" | "incomplete" {
	if (!data.startsWith(`${ESC}_`)) {
		return "complete";
	}

	// APC sequences end with ST (ESC \)
	// APC 序列以 ST（ESC \）结尾
	if (data.endsWith(`${ESC}\\`)) {
		return "complete";
	}

	return "incomplete";
}

/**
 * Split accumulated buffer into complete sequences
 * 将累积的缓冲区内容切分为一个个完整的序列
 */
function parseUnmodifiedKittyPrintableCodepoint(sequence: string): number | undefined {
	const match = sequence.match(/^\x1b\[(\d+)(?::\d*)?(?::\d+)?u$/);
	if (!match) return undefined;

	const codepoint = parseInt(match[1]!, 10);
	return codepoint >= 32 ? codepoint : undefined;
}

function extractCompleteSequences(buffer: string): { sequences: string[]; remainder: string } {
	const sequences: string[] = [];
	let pos = 0;

	while (pos < buffer.length) {
		const remaining = buffer.slice(pos);

		// Try to extract a sequence starting at this position
		// 尝试从当前位置开始提取一个序列
		if (remaining.startsWith(ESC)) {
			// Find the end of this escape sequence
			// 查找该转义序列的结束位置
			let seqEnd = 1;
			while (seqEnd <= remaining.length) {
				const candidate = remaining.slice(0, seqEnd);
				const status = isCompleteSequence(candidate);

				if (status === "complete") {
					// WezTerm with enable_kitty_keyboard sends the Escape key press as a
					// raw '\x1b' byte (simple text path in encode_kitty, ignoring
					// DISAMBIGUATE_ESCAPE_CODES) and the release as a full Kitty CSI-u
					// sequence. These arrive concatenated as '\x1b\x1b[27;...u'.
					// 启用了 enable_kitty_keyboard 的 WezTerm 会把 Escape 键的按下事件
					// 发送为一个原始的 '\x1b' 字节（走的是 encode_kitty 中的简单文本分支，
					// 忽略了 DISAMBIGUATE_ESCAPE_CODES），而把释放事件发送为一个完整的
					// Kitty CSI-u 序列。二者会拼接成 '\x1b\x1b[27;...u' 一并到达。
					// The buffer would normally treat '\x1b\x1b' as a complete meta-key
					// sequence (ESC + single char), leaving '[27;...u' to be typed as
					// plain text.
					// 按照默认逻辑，缓冲区会把 '\x1b\x1b' 当作一个完整的 Meta 键序列
					// （ESC + 单个字符），从而导致 '[27;...u' 被当作纯文本输入。
					// If the character immediately following '\x1b\x1b'
					// would begin a new escape sequence, emit only the first ESC and
					// restart from the second.
					// 因此，如果紧跟在 '\x1b\x1b' 之后的字符会开启一个新的转义序列，
					// 则只发出第一个 ESC，并从第二个 ESC 处重新开始解析。
					if (candidate === "\x1b\x1b") {
						const nextChar = remaining[seqEnd];
						if (
							nextChar === "[" || // CSI CSI 序列
							nextChar === "]" || // OSC OSC 序列
							nextChar === "O" || // SS3 SS3 序列
							nextChar === "P" || // DCS DCS 序列
							nextChar === "_" // APC APC 序列
						) {
							sequences.push(ESC);
							pos += 1;
							break;
						}
					}
					sequences.push(candidate);
					pos += seqEnd;
					break;
				} else if (status === "incomplete") {
					seqEnd++;
				} else {
					// Should not happen when starting with ESC
					// 以 ESC 开头时不应出现这种情况
					sequences.push(candidate);
					pos += seqEnd;
					break;
				}
			}

			if (seqEnd > remaining.length) {
				return { sequences, remainder: remaining };
			}
		} else {
			// Not an escape sequence - take a single character
			// 并非转义序列 —— 取单个字符
			sequences.push(remaining[0]!);
			pos++;
		}
	}

	return { sequences, remainder: "" };
}

export type StdinBufferOptions = {
	/**
	 * Maximum time to wait for sequence completion (default: 10ms)
	 * 等待序列变为完整所允许的最长时间（默认值：10 毫秒）
	 * After this time, the buffer is flushed even if incomplete
	 * 超过该时间后，即使序列仍不完整，缓冲区也会被强制刷出
	 */
	timeout?: number;
};

export type StdinBufferEventMap = {
	data: [string];
	paste: [string];
};

/**
 * Buffers stdin input and emits complete sequences via the 'data' event.
 * 对 stdin 输入进行缓冲，并通过 'data' 事件发出完整的序列。
 * Handles partial escape sequences that arrive across multiple chunks.
 * 能够处理跨多个数据块分批到达的不完整转义序列。
 */
export class StdinBuffer extends EventEmitter<StdinBufferEventMap> {
	private buffer: string = "";
	private timeout: ReturnType<typeof setTimeout> | null = null;
	private readonly timeoutMs: number;
	private pasteMode: boolean = false;
	private pasteBuffer: string = "";
	private pendingKittyPrintableCodepoint: number | undefined;

	constructor(options: StdinBufferOptions = {}) {
		super();
		this.timeoutMs = options.timeout ?? 10;
	}

	public process(data: string | Buffer): void {
		// Clear any pending timeout
		// 清除所有处于等待中的定时器
		if (this.timeout) {
			clearTimeout(this.timeout);
			this.timeout = null;
		}

		// Handle high-byte conversion (for compatibility with parseKeypress)
		// 处理高位字节的转换（以兼容 parseKeypress）
		// If buffer has single byte > 127, convert to ESC + (byte - 128)
		// 如果缓冲区中只有一个大于 127 的字节，则将其转换为 ESC + (byte - 128)
		let str: string;
		if (Buffer.isBuffer(data)) {
			if (data.length === 1 && data[0]! > 127) {
				const byte = data[0]! - 128;
				str = `\x1b${String.fromCharCode(byte)}`;
			} else {
				str = data.toString();
			}
		} else {
			str = data;
		}

		if (str.length === 0 && this.buffer.length === 0) {
			this.emitDataSequence("");
			return;
		}

		this.buffer += str;

		if (this.pasteMode) {
			this.pasteBuffer += this.buffer;
			this.buffer = "";

			const endIndex = this.pasteBuffer.indexOf(BRACKETED_PASTE_END);
			if (endIndex !== -1) {
				const pastedContent = this.pasteBuffer.slice(0, endIndex);
				const remaining = this.pasteBuffer.slice(endIndex + BRACKETED_PASTE_END.length);

				this.pasteMode = false;
				this.pasteBuffer = "";
				this.pendingKittyPrintableCodepoint = undefined;

				this.emit("paste", pastedContent);

				if (remaining.length > 0) {
					this.process(remaining);
				}
			}
			return;
		}

		const startIndex = this.buffer.indexOf(BRACKETED_PASTE_START);
		if (startIndex !== -1) {
			if (startIndex > 0) {
				const beforePaste = this.buffer.slice(0, startIndex);
				const result = extractCompleteSequences(beforePaste);
				for (const sequence of result.sequences) {
					this.emitDataSequence(sequence);
				}
			}

			this.pendingKittyPrintableCodepoint = undefined;
			this.buffer = this.buffer.slice(startIndex + BRACKETED_PASTE_START.length);
			this.pasteMode = true;
			this.pasteBuffer = this.buffer;
			this.buffer = "";

			const endIndex = this.pasteBuffer.indexOf(BRACKETED_PASTE_END);
			if (endIndex !== -1) {
				const pastedContent = this.pasteBuffer.slice(0, endIndex);
				const remaining = this.pasteBuffer.slice(endIndex + BRACKETED_PASTE_END.length);

				this.pasteMode = false;
				this.pasteBuffer = "";
				this.pendingKittyPrintableCodepoint = undefined;

				this.emit("paste", pastedContent);

				if (remaining.length > 0) {
					this.process(remaining);
				}
			}
			return;
		}

		const result = extractCompleteSequences(this.buffer);
		this.buffer = result.remainder;

		for (const sequence of result.sequences) {
			this.emitDataSequence(sequence);
		}

		if (this.buffer.length > 0) {
			this.timeout = setTimeout(() => {
				const flushed = this.flush();

				for (const sequence of flushed) {
					this.emitDataSequence(sequence);
				}
			}, this.timeoutMs);
		}
	}

	private emitDataSequence(sequence: string): void {
		const rawCodepoint = sequence.length === 1 ? sequence.codePointAt(0) : undefined;
		if (rawCodepoint !== undefined && rawCodepoint === this.pendingKittyPrintableCodepoint) {
			this.pendingKittyPrintableCodepoint = undefined;
			return;
		}

		this.pendingKittyPrintableCodepoint = parseUnmodifiedKittyPrintableCodepoint(sequence);
		this.emit("data", sequence);
	}

	flush(): string[] {
		if (this.timeout) {
			clearTimeout(this.timeout);
			this.timeout = null;
		}

		if (this.buffer.length === 0) {
			return [];
		}

		const sequences = [this.buffer];
		this.buffer = "";
		this.pendingKittyPrintableCodepoint = undefined;
		return sequences;
	}

	clear(): void {
		if (this.timeout) {
			clearTimeout(this.timeout);
			this.timeout = null;
		}
		this.buffer = "";
		this.pasteMode = false;
		this.pasteBuffer = "";
		this.pendingKittyPrintableCodepoint = undefined;
	}

	getBuffer(): string {
		return this.buffer;
	}

	destroy(): void {
		this.clear();
	}
}
