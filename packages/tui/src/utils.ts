import { eastAsianWidth } from "get-east-asian-width";

// segmenters (shared instance)
// 分段器（共享实例）
const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
const wordSegmenter = new Intl.Segmenter(undefined, { granularity: "word" });

/**
 * Get the shared grapheme segmenter instance.
 * 获取共享的字素簇（grapheme）分段器实例。
 */
export function getGraphemeSegmenter(): Intl.Segmenter {
	return graphemeSegmenter;
}

/**
 * Get the shared word segmenter instance.
 * 获取共享的单词（word）分段器实例。
 */
export function getWordSegmenter(): Intl.Segmenter {
	return wordSegmenter;
}

/**
 * Check if a grapheme cluster (after segmentation) could possibly be an RGI emoji.
 * 检查一个字素簇（分段之后）是否可能是 RGI emoji。
 * This is a fast heuristic to avoid the expensive rgiEmojiRegex test.
 * 这是一种快速启发式判断，用于避免执行开销较大的 rgiEmojiRegex 测试。
 * The tested Unicode blocks are deliberately broad to account for future
 * Unicode additions.
 * 所测试的 Unicode 区块特意设置得比较宽泛，以便兼容未来新增的 Unicode 字符。
 */
function couldBeEmoji(segment: string): boolean {
	const cp = segment.codePointAt(0)!;
	return (
		(cp >= 0x1f000 && cp <= 0x1fbff) || // Emoji and Pictograph \u8868\u60C5\u7B26\u53F7\u4E0E\u8C61\u5F62\u7B26\u53F7
		(cp >= 0x2300 && cp <= 0x23ff) || // Misc technical \u6742\u9879\u6280\u672F\u7B26\u53F7
		(cp >= 0x2600 && cp <= 0x27bf) || // Misc symbols, dingbats \u6742\u9879\u7B26\u53F7\u4E0E\u88C5\u9970\u7B26\u53F7
		(cp >= 0x2b50 && cp <= 0x2b55) || // Specific stars/circles \u7279\u5B9A\u7684\u661F\u5F62/\u5706\u5F62\u7B26\u53F7
		segment.includes("\uFE0F") || // Contains VS16 (emoji presentation selector) \u5305\u542B VS16\uFF08emoji \u5448\u73B0\u9009\u62E9\u7B26\uFF09
		segment.length > 2 // Multi-codepoint sequences (ZWJ, skin tones, etc.) \u591A\u7801\u70B9\u5E8F\u5217\uFF08ZWJ\u3001\u80A4\u8272\u4FEE\u9970\u7B26\u7B49\uFF09
	);
}

// Regexes for character classification (same as string-width library)
// 用于字符分类的正则表达式（与 string-width 库保持一致）
const zeroWidthRegex = /^(?:\p{Default_Ignorable_Code_Point}|\p{Control}|\p{Mark}|\p{Surrogate})+$/v;
const leadingNonPrintingRegex = /^[\p{Default_Ignorable_Code_Point}\p{Control}\p{Format}\p{Mark}\p{Surrogate}]+/v;
const nonPrintingCharRegex = /^(?:\p{Default_Ignorable_Code_Point}|\p{Control}|\p{Format}|\p{Mark}|\p{Surrogate})$/v;
const markCharRegex = /^\p{Mark}$/v;
// Marks that terminals allocate cells for when attached to a base character.
// 当附加到基字符上时，终端会为其分配单元格（cell）的组合记号（mark）。
// This includes Unicode spacing marks and non-spacing exceptions in legacy wcwidth tables.
// 其中包括 Unicode 间距记号（spacing mark），以及旧版 wcwidth 表中的非间距例外字符。
const terminalSpacingMarkRegex =
	/^(?:[\p{Spacing_Mark}--[\u1734\u302E\u302F]]|[\u065F\u0F7F\u102B\u102C\u1031\u1033-\u1035\u1038\u103A-\u103E])+$/v;
const rgiEmojiRegex = /^\p{RGI_Emoji}$/v;

// Cache for non-ASCII strings
// 针对非 ASCII 字符串的缓存
const WIDTH_CACHE_SIZE = 512;
const widthCache = new Map<string, number>();

export const cjkBreakRegex =
	/[\p{Script_Extensions=Han}\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}\p{Script_Extensions=Hangul}\p{Script_Extensions=Bopomofo}]/u;

function isPrintableAscii(str: string): boolean {
	for (let i = 0; i < str.length; i++) {
		const code = str.charCodeAt(i);
		if (code < 0x20 || code > 0x7e) {
			return false;
		}
	}
	return true;
}

function truncateFragmentToWidth(text: string, maxWidth: number): { text: string; width: number } {
	if (maxWidth <= 0 || text.length === 0) {
		return { text: "", width: 0 };
	}

	if (isPrintableAscii(text)) {
		const clipped = text.slice(0, maxWidth);
		return { text: clipped, width: clipped.length };
	}

	const hasAnsi = text.includes("\x1b");
	const hasTabs = text.includes("\t");
	if (!hasAnsi && !hasTabs) {
		let result = "";
		let width = 0;
		for (const { segment } of graphemeSegmenter.segment(text)) {
			const w = graphemeWidth(segment);
			if (width + w > maxWidth) {
				break;
			}
			result += segment;
			width += w;
		}
		return { text: result, width };
	}

	let result = "";
	let width = 0;
	let i = 0;
	let pendingAnsi = "";

	while (i < text.length) {
		const ansi = extractAnsiCode(text, i);
		if (ansi) {
			pendingAnsi += ansi.code;
			i += ansi.length;
			continue;
		}

		if (text[i] === "\t") {
			if (width + 3 > maxWidth) {
				break;
			}
			if (pendingAnsi) {
				result += pendingAnsi;
				pendingAnsi = "";
			}
			result += "\t";
			width += 3;
			i++;
			continue;
		}

		let end = i;
		while (end < text.length && text[end] !== "\t") {
			const nextAnsi = extractAnsiCode(text, end);
			if (nextAnsi) {
				break;
			}
			end++;
		}

		for (const { segment } of graphemeSegmenter.segment(text.slice(i, end))) {
			const w = graphemeWidth(segment);
			if (width + w > maxWidth) {
				return { text: result, width };
			}
			if (pendingAnsi) {
				result += pendingAnsi;
				pendingAnsi = "";
			}
			result += segment;
			width += w;
		}
		i = end;
	}

	return { text: result, width };
}

function finalizeTruncatedResult(
	prefix: string,
	prefixWidth: number,
	ellipsis: string,
	ellipsisWidth: number,
	maxWidth: number,
	pad: boolean,
): string {
	const reset = "\x1b[0m";
	const visibleWidth = prefixWidth + ellipsisWidth;
	let result: string;

	if (ellipsis.length > 0) {
		result = `${prefix}${reset}${ellipsis}${reset}`;
	} else {
		result = `${prefix}${reset}`;
	}

	return pad ? result + " ".repeat(Math.max(0, maxWidth - visibleWidth)) : result;
}

/**
 * Calculate the terminal width of a single grapheme cluster.
 * 计算单个字素簇在终端中占用的宽度。
 * Based on code from the string-width library, but includes a possible-emoji
 * check to avoid running the RGI_Emoji regex unnecessarily.
 * 基于 string-width 库的代码实现，但增加了「是否可能为 emoji」的预检查，
 * 以避免不必要地执行 RGI_Emoji 正则匹配。
 */
function graphemeWidth(segment: string): number {
	if (segment === "\t") {
		return 3;
	}

	// Some marks occupy cells even without a base character.
	// 某些组合记号即使没有基字符也会占据单元格。
	if (terminalSpacingMarkRegex.test(segment)) {
		return [...segment].length;
	}

	// Zero-width clusters
	// 零宽度字素簇
	if (zeroWidthRegex.test(segment)) {
		return 0;
	}

	// Emoji check with pre-filter
	// 带预过滤的 emoji 检查
	if (couldBeEmoji(segment) && rgiEmojiRegex.test(segment)) {
		return 2;
	}

	// Get base visible codepoint
	// 获取基础可见码点
	const base = segment.replace(leadingNonPrintingRegex, "");
	const cp = base.codePointAt(0);
	if (cp === undefined) {
		return 0;
	}

	// Regional indicator symbols (U+1F1E6..U+1F1FF) are often rendered as
	// full-width emoji in terminals, even when isolated during streaming.
	// 区域指示符号（U+1F1E6..U+1F1FF）在终端中通常被渲染为全宽 emoji，
	// 即使在流式输出过程中它们是单独出现的也是如此。
	// Keep width conservative (2) to avoid terminal auto-wrap drift artifacts.
	// 保守地将宽度取为 2，以避免终端自动换行造成的错位显示问题。
	if (cp >= 0x1f1e6 && cp <= 0x1f1ff) {
		return 2;
	}

	let width = eastAsianWidth(cp);

	// Intl.Segmenter can group multiple terminal-spacing code points into one
	// grapheme. Count trailing visible code points that terminals may allocate
	// cells for: Indic consonants after marks, halfwidth/fullwidth forms, and
	// Thai/Lao AM vowels.
	// Intl.Segmenter 可能会把多个在终端中占据间距的码点归并到同一个字素簇中。
	// 因此需要统计后续那些终端可能为其分配单元格的可见码点：
	// 位于组合记号之后的印度语系辅音、半角/全角形式，以及泰语/老挝语的 AM 元音。
	let followsMark = false;
	const chars = [...base];
	for (const char of chars.slice(1)) {
		if (terminalSpacingMarkRegex.test(char)) {
			width += 1;
			followsMark = false;
		} else if (markCharRegex.test(char)) {
			followsMark = true;
		} else if (!nonPrintingCharRegex.test(char)) {
			const c = char.codePointAt(0)!;
			if (followsMark || (c >= 0xff00 && c <= 0xffef)) {
				// halfwidth + fullwidth forms
				// 半角与全角形式
				width += eastAsianWidth(c);
			} else if (c === 0x0e33 || c === 0x0eb3) {
				width += 1;
			}
			followsMark = false;
		}
	}

	return width;
}

/**
 * Calculate the visible width of a string in terminal columns.
 * 按终端列数计算字符串的可见宽度。
 */
export function visibleWidth(str: string): number {
	if (str.length === 0) {
		return 0;
	}

	// Fast path: pure ASCII printable
	// 快速路径：纯 ASCII 可打印字符
	if (isPrintableAscii(str)) {
		return str.length;
	}

	// Check cache
	// 检查缓存
	const cached = widthCache.get(str);
	if (cached !== undefined) {
		return cached;
	}

	// Normalize: tabs to 3 spaces, strip ANSI escape codes
	// 归一化处理：将制表符转换为 3 个空格，并剥离 ANSI 转义码
	let clean = str;
	if (str.includes("\t")) {
		clean = clean.replace(/\t/g, "   ");
	}
	if (clean.includes("\x1b")) {
		// Strip supported ANSI/OSC/APC escape sequences in one pass.
		// 一次遍历即剥离所有受支持的 ANSI/OSC/APC 转义序列。
		// This covers CSI styling/cursor codes, OSC hyperlinks and prompt markers,
		// and APC sequences like CURSOR_MARKER.
		// 涵盖 CSI 样式/光标控制码、OSC 超链接与提示符标记，
		// 以及诸如 CURSOR_MARKER 之类的 APC 序列。
		let stripped = "";
		let i = 0;
		while (i < clean.length) {
			const ansi = extractAnsiCode(clean, i);
			if (ansi) {
				i += ansi.length;
				continue;
			}
			stripped += clean[i];
			i++;
		}
		clean = stripped;
	}

	// Calculate width
	// 计算宽度
	let width = 0;
	for (const { segment } of graphemeSegmenter.segment(clean)) {
		width += graphemeWidth(segment);
	}

	// Cache result
	// 缓存结果
	if (widthCache.size >= WIDTH_CACHE_SIZE) {
		const firstKey = widthCache.keys().next().value;
		if (firstKey !== undefined) {
			widthCache.delete(firstKey);
		}
	}
	widthCache.set(str, width);

	return width;
}

/**
 * Remove ANSI, OSC, and APC control sequences while preserving visible text.
 * 移除 ANSI、OSC 与 APC 控制序列，同时保留可见文本。
 */
export function stripTerminalSequences(str: string): string {
	if (!str.includes("\x1b")) return str;
	let result = "";
	let i = 0;
	while (i < str.length) {
		const ansi = extractAnsiCode(str, i);
		if (ansi) {
			i += ansi.length;
			continue;
		}
		result += str[i];
		i++;
	}
	return result;
}

interface GraphemeCellRange {
	start: number;
	end: number;
}

/**
 * Return the terminal-cell range occupied by the grapheme at a visible column.
 * 返回位于指定可见列上的字素簇所占据的终端单元格范围。
 */
export function getGraphemeCellRange(line: string, column: number): GraphemeCellRange | undefined {
	let currentCol = 0;
	let i = 0;
	while (i < line.length) {
		const ansi = extractAnsiCode(line, i);
		if (ansi) {
			i += ansi.length;
			continue;
		}
		let textEnd = i;
		while (textEnd < line.length && !extractAnsiCode(line, textEnd)) textEnd++;
		for (const { segment } of graphemeSegmenter.segment(line.slice(i, textEnd))) {
			const width = graphemeWidth(segment);
			if (width > 0 && column >= currentCol && column < currentCol + width) {
				return { start: currentCol, end: currentCol + width };
			}
			currentCol += width;
		}
		i = textEnd;
	}
	return undefined;
}

/**
 * Return the OSC 8 hyperlink covering a visible terminal column.
 * 返回覆盖指定终端可见列的 OSC 8 超链接。
 */
export function getOsc8LinkAtColumn(line: string, column: number): string | undefined {
	let activeUrl: string | undefined;
	let currentCol = 0;
	let i = 0;
	while (i < line.length) {
		const ansi = extractAnsiCode(line, i);
		if (ansi) {
			const hyperlink = /^\x1b\]8;[^;]*;([^\x07\x1b]*)(?:\x07|\x1b\\)$/.exec(ansi.code);
			if (hyperlink) activeUrl = hyperlink[1] || undefined;
			i += ansi.length;
			continue;
		}
		let textEnd = i;
		while (textEnd < line.length && !extractAnsiCode(line, textEnd)) textEnd++;
		for (const { segment } of graphemeSegmenter.segment(line.slice(i, textEnd))) {
			const width = segment === "\t" ? 3 : graphemeWidth(segment);
			if (column >= currentCol && column < currentCol + width) return activeUrl;
			currentCol += width;
		}
		i = textEnd;
	}
	return undefined;
}

/**
 * Normalize text for terminal output without changing logical editor content.
 * 对文本进行面向终端输出的归一化处理，同时不改变编辑器中的逻辑内容。
 * Some terminals render precomposed Thai/Lao AM vowels inconsistently during
 * differential repaint.
 * 某些终端在执行差量重绘（differential repaint）时，对预组合的泰语/老挝语 AM 元音渲染并不一致。
 * Their compatibility decompositions have the same cell
 * width but avoid stale-cell artifacts in terminal renderers.
 * 它们的兼容分解形式占用相同的单元格宽度，但可以避免终端渲染器中出现残留单元格的显示异常。
 * Visible tabs are
 * expanded to the fixed width used by layout so terminal tab stops cannot wrap
 * a logical line, while tabs inside terminal string sequences stay untouched.
 * 可见的制表符会被展开为布局所使用的固定宽度，从而使终端的制表位不会导致逻辑行被换行；
 * 而位于终端字符串序列内部的制表符则保持原样不变。
 */
const THAI_LAO_AM_REGEX = /[\u0e33\u0eb3]/;
const THAI_LAO_AM_GLOBAL_REGEX = /[\u0e33\u0eb3]/g;

export function normalizeTerminalOutput(str: string): string {
	let normalized = str;
	if (THAI_LAO_AM_REGEX.test(normalized)) {
		normalized = normalized.replace(THAI_LAO_AM_GLOBAL_REGEX, (char) =>
			char === "\u0e33" ? "\u0e4d\u0e32" : "\u0ecd\u0eb2",
		);
	}
	if (!normalized.includes("\t")) return normalized;

	let result = "";
	let i = 0;
	while (i < normalized.length) {
		const ansi = extractAnsiCode(normalized, i);
		if (ansi) {
			result += ansi.code;
			i += ansi.length;
			continue;
		}
		result += normalized[i] === "\t" ? "   " : normalized[i];
		i++;
	}
	return result;
}

/**
 * Extract ANSI escape sequences from a string at the given position.
 * 从字符串的指定位置提取 ANSI 转义序列。
 */
export function extractAnsiCode(str: string, pos: number): { code: string; length: number } | null {
	if (pos >= str.length || str[pos] !== "\x1b") return null;

	const next = str[pos + 1];

	// CSI sequence: ESC [ ... m/G/K/H/J
	// CSI 序列：ESC [ ... m/G/K/H/J
	if (next === "[") {
		let j = pos + 2;
		while (j < str.length && !/[mGKHJ]/.test(str[j]!)) j++;
		if (j < str.length) return { code: str.substring(pos, j + 1), length: j + 1 - pos };
		return null;
	}

	// OSC sequence: ESC ] ... BEL or ESC ] ... ST (ESC \)
	// OSC 序列：ESC ] ... BEL 或 ESC ] ... ST（即 ESC \）
	// Used for hyperlinks (OSC 8), window titles, etc.
	// 用于超链接（OSC 8）、窗口标题等场景。
	if (next === "]") {
		let j = pos + 2;
		while (j < str.length) {
			if (str[j] === "\x07") return { code: str.substring(pos, j + 1), length: j + 1 - pos };
			if (str[j] === "\x1b" && str[j + 1] === "\\") return { code: str.substring(pos, j + 2), length: j + 2 - pos };
			j++;
		}
		return null;
	}

	// APC sequence: ESC _ ... BEL or ESC _ ... ST (ESC \)
	// APC 序列：ESC _ ... BEL 或 ESC _ ... ST（即 ESC \）
	// Used for cursor marker and application-specific commands
	// 用于光标标记以及应用程序自定义命令
	if (next === "_") {
		let j = pos + 2;
		while (j < str.length) {
			if (str[j] === "\x07") return { code: str.substring(pos, j + 1), length: j + 1 - pos };
			if (str[j] === "\x1b" && str[j + 1] === "\\") return { code: str.substring(pos, j + 2), length: j + 2 - pos };
			j++;
		}
		return null;
	}

	return null;
}

type Osc8Terminator = "\x07" | "\x1b\\";

interface ActiveHyperlink {
	params: string;
	url: string;
	terminator: Osc8Terminator;
}

function parseOsc8Hyperlink(ansiCode: string): ActiveHyperlink | null | undefined {
	if (!ansiCode.startsWith("\x1b]8;")) {
		return undefined;
	}

	const terminator: Osc8Terminator = ansiCode.endsWith("\x07") ? "\x07" : "\x1b\\";
	const body = ansiCode.slice(4, terminator === "\x07" ? -1 : -2);
	const separatorIndex = body.indexOf(";");
	if (separatorIndex === -1) {
		return undefined;
	}

	const params = body.slice(0, separatorIndex);
	const url = body.slice(separatorIndex + 1);
	if (!url) {
		return null;
	}
	return { params, url, terminator };
}

function formatOsc8Hyperlink(hyperlink: ActiveHyperlink): string {
	return `\x1b]8;${hyperlink.params};${hyperlink.url}${hyperlink.terminator}`;
}

function formatOsc8Close(terminator: Osc8Terminator): string {
	return `\x1b]8;;${terminator}`;
}

/**
 * Track active ANSI SGR codes to preserve styling across line breaks.
 * 跟踪当前生效的 ANSI SGR 控制码，以便在换行后仍能保留样式。
 */
class AnsiCodeTracker {
	// Track individual attributes separately so we can reset them specifically
	// 分别跟踪各个样式属性，以便能够有针对性地单独重置它们
	private bold = false;
	private dim = false;
	private italic = false;
	private underline = false;
	private blink = false;
	private inverse = false;
	private hidden = false;
	private strikethrough = false;
	private fgColor: string | null = null; // Stores the full code like "31" or "38;5;240" 保存完整的控制码，例如 "31" 或 "38;5;240"
	private bgColor: string | null = null; // Stores the full code like "41" or "48;5;240" 保存完整的控制码，例如 "41" 或 "48;5;240"
	private activeHyperlink: ActiveHyperlink | null = null;

	process(ansiCode: string): void {
		// OSC 8 hyperlink: \x1b]8;;<url>\x1b\\ (open) or \x1b]8;;\x1b\\ (close).
		// OSC 8 超链接：\x1b]8;;<url>\x1b\\（开启）或 \x1b]8;;\x1b\\（关闭）。
		// Preserve the original terminator because some terminals only make BEL-terminated
		// links clickable.
		// 需要保留原始的终止符，因为某些终端只会让以 BEL 结尾的链接可点击。
		// OAuth login URLs use BEL, so reopening wrapped lines with ST
		// made only the first physical line clickable in those terminals.
		// OAuth 登录 URL 使用的是 BEL，因此如果在换行后改用 ST 重新开启链接，
		// 在这些终端中就只有第一行物理行可以点击。
		const hyperlink = parseOsc8Hyperlink(ansiCode);
		if (hyperlink !== undefined) {
			this.activeHyperlink = hyperlink;
			return;
		}

		if (!ansiCode.endsWith("m")) {
			return;
		}

		// Extract the parameters between \x1b[ and m
		// 提取位于 \x1b[ 与 m 之间的参数
		const match = ansiCode.match(/\x1b\[([\d;]*)m/);
		if (!match) return;

		const params = match[1];
		if (params === "" || params === "0") {
			// Full reset
			// 完全重置
			this.reset();
			return;
		}

		// Parse parameters (can be semicolon-separated)
		// 解析参数（参数之间可以用分号分隔）
		const parts = params.split(";");
		let i = 0;
		while (i < parts.length) {
			const code = Number.parseInt(parts[i], 10);

			// Handle 256-color and RGB codes which consume multiple parameters
			// 处理会占用多个参数的 256 色与 RGB 颜色控制码
			if (code === 38 || code === 48) {
				// 38;5;N (256 color fg) or 38;2;R;G;B (RGB fg)
				// 38;5;N（256 色前景色）或 38;2;R;G;B（RGB 前景色）
				// 48;5;N (256 color bg) or 48;2;R;G;B (RGB bg)
				// 48;5;N（256 色背景色）或 48;2;R;G;B（RGB 背景色）
				if (parts[i + 1] === "5" && parts[i + 2] !== undefined) {
					// 256 color: 38;5;N or 48;5;N
					// 256 色：38;5;N 或 48;5;N
					const colorCode = `${parts[i]};${parts[i + 1]};${parts[i + 2]}`;
					if (code === 38) {
						this.fgColor = colorCode;
					} else {
						this.bgColor = colorCode;
					}
					i += 3;
					continue;
				} else if (parts[i + 1] === "2" && parts[i + 4] !== undefined) {
					// RGB color: 38;2;R;G;B or 48;2;R;G;B
					// RGB 颜色：38;2;R;G;B 或 48;2;R;G;B
					const colorCode = `${parts[i]};${parts[i + 1]};${parts[i + 2]};${parts[i + 3]};${parts[i + 4]}`;
					if (code === 38) {
						this.fgColor = colorCode;
					} else {
						this.bgColor = colorCode;
					}
					i += 5;
					continue;
				}
			}

			// Standard SGR codes
			// 标准 SGR 控制码
			switch (code) {
				case 0:
					this.reset();
					break;
				case 1:
					this.bold = true;
					break;
				case 2:
					this.dim = true;
					break;
				case 3:
					this.italic = true;
					break;
				case 4:
					this.underline = true;
					break;
				case 5:
					this.blink = true;
					break;
				case 7:
					this.inverse = true;
					break;
				case 8:
					this.hidden = true;
					break;
				case 9:
					this.strikethrough = true;
					break;
				case 21:
					this.bold = false;
					break; // Some terminals 部分终端支持
				case 22:
					this.bold = false;
					this.dim = false;
					break;
				case 23:
					this.italic = false;
					break;
				case 24:
					this.underline = false;
					break;
				case 25:
					this.blink = false;
					break;
				case 27:
					this.inverse = false;
					break;
				case 28:
					this.hidden = false;
					break;
				case 29:
					this.strikethrough = false;
					break;
				case 39:
					this.fgColor = null;
					break; // Default fg 默认前景色
				case 49:
					this.bgColor = null;
					break; // Default bg 默认背景色
				default:
					// Standard foreground colors 30-37, 90-97
					// 标准前景色 30-37、90-97
					if ((code >= 30 && code <= 37) || (code >= 90 && code <= 97)) {
						this.fgColor = String(code);
					}
					// Standard background colors 40-47, 100-107
					// 标准背景色 40-47、100-107
					else if ((code >= 40 && code <= 47) || (code >= 100 && code <= 107)) {
						this.bgColor = String(code);
					}
					break;
			}
			i++;
		}
	}

	private reset(): void {
		this.bold = false;
		this.dim = false;
		this.italic = false;
		this.underline = false;
		this.blink = false;
		this.inverse = false;
		this.hidden = false;
		this.strikethrough = false;
		this.fgColor = null;
		this.bgColor = null;
		// SGR reset does not affect OSC 8 hyperlink state
		// SGR 重置不会影响 OSC 8 超链接的状态
	}

	/**
	 * Clear all state for reuse.
	 * 清空全部状态，以便实例复用。
	 */
	clear(): void {
		this.reset();
		this.activeHyperlink = null;
	}

	getActiveCodes(): string {
		const codes: string[] = [];
		if (this.bold) codes.push("1");
		if (this.dim) codes.push("2");
		if (this.italic) codes.push("3");
		if (this.underline) codes.push("4");
		if (this.blink) codes.push("5");
		if (this.inverse) codes.push("7");
		if (this.hidden) codes.push("8");
		if (this.strikethrough) codes.push("9");
		if (this.fgColor) codes.push(this.fgColor);
		if (this.bgColor) codes.push(this.bgColor);

		let result = codes.length > 0 ? `\x1b[${codes.join(";")}m` : "";
		if (this.activeHyperlink) {
			result += formatOsc8Hyperlink(this.activeHyperlink);
		}
		return result;
	}

	hasActiveCodes(): boolean {
		return (
			this.bold ||
			this.dim ||
			this.italic ||
			this.underline ||
			this.blink ||
			this.inverse ||
			this.hidden ||
			this.strikethrough ||
			this.fgColor !== null ||
			this.bgColor !== null ||
			this.activeHyperlink !== null
		);
	}

	/**
	 * Get reset codes for attributes that need to be turned off at line end.
	 * 获取需要在行尾关闭的样式属性所对应的重置控制码。
	 * Underline must be closed to prevent bleeding into padding.
	 * 必须关闭下划线，以防止其蔓延到填充空白区域。
	 * Active OSC 8 hyperlinks must be closed and re-opened on the next line.
	 * 处于激活状态的 OSC 8 超链接必须先关闭，并在下一行重新开启。
	 * Returns empty string if no attributes need closing.
	 * 如果没有需要关闭的属性，则返回空字符串。
	 */
	getLineEndReset(): string {
		let result = "";
		if (this.underline) {
			result += "\x1b[24m"; // Underline off only 仅关闭下划线
		}
		if (this.activeHyperlink) {
			result += formatOsc8Close(this.activeHyperlink.terminator); // Re-opened at line start via getActiveCodes() 会在下一行行首通过 getActiveCodes() 重新开启
		}
		return result;
	}
}

function updateTrackerFromText(text: string, tracker: AnsiCodeTracker): void {
	let i = 0;
	while (i < text.length) {
		const ansiResult = extractAnsiCode(text, i);
		if (ansiResult) {
			tracker.process(ansiResult.code);
			i += ansiResult.length;
		} else {
			i++;
		}
	}
}

/**
 * Split text into words while keeping ANSI codes attached.
 * 将文本切分为单词，同时保持 ANSI 控制码与对应内容附着在一起。
 */
function splitIntoTokensWithAnsi(text: string): string[] {
	const tokens: string[] = [];
	let current = "";
	let pendingAnsi = ""; // ANSI codes waiting to be attached to next visible content 等待附着到下一段可见内容上的 ANSI 控制码
	let currentKind: "space" | "word" | null = null;
	let i = 0;

	const flushCurrent = (): void => {
		if (!current) {
			return;
		}
		tokens.push(current);
		current = "";
		currentKind = null;
	};

	while (i < text.length) {
		const ansiResult = extractAnsiCode(text, i);
		if (ansiResult) {
			// Hold ANSI codes separately - they'll be attached to the next visible char
			// 单独暂存 ANSI 控制码 —— 它们将被附着到下一个可见字符上
			pendingAnsi += ansiResult.code;
			i += ansiResult.length;
			continue;
		}

		let end = i;
		while (end < text.length && !extractAnsiCode(text, end)) {
			end++;
		}

		for (const { segment } of graphemeSegmenter.segment(text.slice(i, end))) {
			const segmentIsSpace = segment === " ";
			if (!segmentIsSpace && cjkBreakRegex.test(segment)) {
				flushCurrent();
				const token = pendingAnsi + segment;
				pendingAnsi = "";
				tokens.push(token);
				continue;
			}

			const segmentKind = segmentIsSpace ? "space" : "word";
			if (current && currentKind !== segmentKind) {
				flushCurrent();
			}

			// Attach any pending ANSI codes to this visible character
			// 将所有暂存的 ANSI 控制码附着到该可见字符上
			if (pendingAnsi) {
				current += pendingAnsi;
				pendingAnsi = "";
			}

			currentKind = segmentKind;
			current += segment;
		}

		i = end;
	}

	// Handle any remaining pending ANSI codes (attach to last token)
	// 处理剩余的暂存 ANSI 控制码（附着到最后一个 token 上）
	if (pendingAnsi) {
		if (current) {
			current += pendingAnsi;
		} else if (tokens.length > 0) {
			tokens[tokens.length - 1] += pendingAnsi;
		} else {
			current = pendingAnsi;
		}
	}

	if (current) {
		tokens.push(current);
	}

	return tokens;
}

/**
 * Wrap text with ANSI codes preserved.
 * 在保留 ANSI 控制码的前提下对文本进行换行处理。
 *
 * ONLY does word wrapping - NO padding, NO background colors.
 * 仅执行按单词换行 —— 不做任何填充，也不应用背景色。
 * Returns lines where each line is <= width visible chars.
 * 返回的每一行其可见字符宽度都不超过 width。
 * Active ANSI codes are preserved across line breaks.
 * 处于生效状态的 ANSI 控制码会在换行处得到保留。
 *
 * @param text - Text to wrap (may contain ANSI codes and newlines)
 *               待换行的文本（可能包含 ANSI 控制码与换行符）
 * @param width - Maximum visible width per line
 *                每行允许的最大可见宽度
 * @returns Array of wrapped lines (NOT padded to width)
 *          换行后的行数组（不会填充至 width 宽度）
 */
export function wrapTextWithAnsi(text: string, width: number): string[] {
	if (!text) {
		return [""];
	}

	// Handle newlines by processing each line separately
	// 通过逐行单独处理的方式来应对换行符
	// Track ANSI state across lines so styles carry over after literal newlines
	// 跨行跟踪 ANSI 状态，使样式能够延续到字面换行符之后
	const inputLines = text.split(/\r\n|\r|\n/);
	const result: string[] = [];
	const tracker = new AnsiCodeTracker();

	for (const inputLine of inputLines) {
		// Prepend active ANSI codes from previous lines (except for first line)
		// 在行首补上前面各行中仍然生效的 ANSI 控制码（第一行除外）
		const prefix = result.length > 0 ? tracker.getActiveCodes() : "";
		const wrappedLines = wrapSingleLine(prefix + inputLine, width);
		for (const wrappedLine of wrappedLines) {
			result.push(wrappedLine);
		}
		// Update tracker with codes from this line for next iteration
		// 用当前行中的控制码更新跟踪器，供下一轮迭代使用
		updateTrackerFromText(inputLine, tracker);
	}

	return result.length > 0 ? result : [""];
}

function wrapSingleLine(line: string, width: number): string[] {
	if (!line) {
		return [""];
	}

	const visibleLength = visibleWidth(line);
	if (visibleLength <= width) {
		return [line];
	}

	const wrapped: string[] = [];
	const tracker = new AnsiCodeTracker();
	const tokens = splitIntoTokensWithAnsi(line);

	let currentLine = "";
	let currentVisibleLength = 0;

	for (const token of tokens) {
		const tokenVisibleLength = visibleWidth(token);
		const isWhitespace = token.trim() === "";

		// Token itself is too long - break it character by character
		// token 本身过长 —— 按字符逐个进行断行
		if (tokenVisibleLength > width && !isWhitespace) {
			if (currentLine) {
				// Add specific reset for underline only (preserves background)
				// 仅针对下划线追加专门的重置控制码（从而保留背景色）
				const lineEndReset = tracker.getLineEndReset();
				if (lineEndReset) {
					currentLine += lineEndReset;
				}
				wrapped.push(currentLine);
				currentLine = "";
				currentVisibleLength = 0;
			}

			// Break long token - breakLongWord handles its own resets
			// 对超长 token 进行断行 —— breakLongWord 会自行处理其内部的重置逻辑
			const broken = breakLongWord(token, width, tracker);
			for (let i = 0; i < broken.length - 1; i++) {
				wrapped.push(broken[i]!);
			}
			currentLine = broken[broken.length - 1];
			currentVisibleLength = visibleWidth(currentLine);
			continue;
		}

		// Check if adding this token would exceed width
		// 检查加入该 token 后是否会超出宽度限制
		const totalNeeded = currentVisibleLength + tokenVisibleLength;

		if (totalNeeded > width && currentVisibleLength > 0) {
			// Trim trailing whitespace, then add underline reset (not full reset, to preserve background)
			// 先去除行尾空白，再追加下划线重置码（而非完全重置，以便保留背景色）
			let lineToWrap = currentLine.trimEnd();
			const lineEndReset = tracker.getLineEndReset();
			if (lineEndReset) {
				lineToWrap += lineEndReset;
			}
			wrapped.push(lineToWrap);
			if (isWhitespace) {
				// Don't start new line with whitespace
				// 新行不要以空白字符开头
				currentLine = tracker.getActiveCodes();
				currentVisibleLength = 0;
			} else {
				currentLine = tracker.getActiveCodes() + token;
				currentVisibleLength = tokenVisibleLength;
			}
		} else {
			// Add to current line
			// 追加到当前行
			currentLine += token;
			currentVisibleLength += tokenVisibleLength;
		}

		updateTrackerFromText(token, tracker);
	}

	if (currentLine) {
		// No reset at end of final line - let caller handle it
		// 最后一行末尾不追加重置码 —— 交由调用方自行处理
		wrapped.push(currentLine);
	}

	// Trailing whitespace can cause lines to exceed the requested width
	// 行尾空白可能导致行宽超出所要求的宽度
	return wrapped.length > 0 ? wrapped.map((line) => line.trimEnd()) : [""];
}

export const PUNCTUATION_REGEX = /[(){}[\]<>.,;:'"!?+\-=*/\\|&%^$#@~`]/;

/**
 * Check if a character is whitespace.
 * 检查字符是否为空白字符。
 */
export function isWhitespaceChar(char: string): boolean {
	return /\s/.test(char);
}

/**
 * Check if a character is punctuation.
 * 检查字符是否为标点符号。
 */
export function isPunctuationChar(char: string): boolean {
	return PUNCTUATION_REGEX.test(char);
}

function breakLongWord(word: string, width: number, tracker: AnsiCodeTracker): string[] {
	const lines: string[] = [];
	let currentLine = tracker.getActiveCodes();
	let currentWidth = 0;

	// First, separate ANSI codes from visible content
	// 首先，将 ANSI 控制码与可见内容分离开
	// We need to handle ANSI codes specially since they're not graphemes
	// ANSI 控制码并不是字素簇，因此需要对其做特殊处理
	let i = 0;
	const segments: Array<{ type: "ansi" | "grapheme"; value: string }> = [];

	while (i < word.length) {
		const ansiResult = extractAnsiCode(word, i);
		if (ansiResult) {
			segments.push({ type: "ansi", value: ansiResult.code });
			i += ansiResult.length;
		} else {
			// Find the next ANSI code or end of string
			// 查找下一个 ANSI 控制码或字符串末尾
			let end = i;
			while (end < word.length) {
				const nextAnsi = extractAnsiCode(word, end);
				if (nextAnsi) break;
				end++;
			}
			// Segment this non-ANSI portion into graphemes
			// 将这段非 ANSI 内容切分为字素簇
			const textPortion = word.slice(i, end);
			for (const seg of graphemeSegmenter.segment(textPortion)) {
				segments.push({ type: "grapheme", value: seg.segment });
			}
			i = end;
		}
	}

	// Now process segments
	// 接下来处理各个片段
	for (const seg of segments) {
		if (seg.type === "ansi") {
			currentLine += seg.value;
			tracker.process(seg.value);
			continue;
		}

		const grapheme = seg.value;
		// Skip empty graphemes to avoid issues with string-width calculation
		// 跳过空的字素簇，以免影响字符串宽度的计算
		if (!grapheme) continue;

		const graphemeWidth = visibleWidth(grapheme);

		if (currentWidth + graphemeWidth > width) {
			// Add specific reset for underline only (preserves background)
			// 仅针对下划线追加专门的重置控制码（从而保留背景色）
			const lineEndReset = tracker.getLineEndReset();
			if (lineEndReset) {
				currentLine += lineEndReset;
			}
			lines.push(currentLine);
			currentLine = tracker.getActiveCodes();
			currentWidth = 0;
		}

		currentLine += grapheme;
		currentWidth += graphemeWidth;
	}

	if (currentLine) {
		// No reset at end of final segment - caller handles continuation
		// 最后一个片段末尾不追加重置码 —— 后续衔接由调用方处理
		lines.push(currentLine);
	}

	return lines.length > 0 ? lines : [""];
}

/**
 * Apply background color to a line, padding to full width.
 * 为整行应用背景色，并填充至完整宽度。
 *
 * @param line - Line of text (may contain ANSI codes)
 *               文本行（可能包含 ANSI 控制码）
 * @param width - Total width to pad to
 *                需要填充到的总宽度
 * @param bgFn - Background color function
 *               背景色处理函数
 * @returns Line with background applied and padded to width
 *          已应用背景色并填充至指定宽度的行
 */
export function applyBackgroundToLine(line: string, width: number, bgFn: (text: string) => string): string {
	// Calculate padding needed
	// 计算所需的填充量
	const visibleLen = visibleWidth(line);
	const paddingNeeded = Math.max(0, width - visibleLen);
	const padding = " ".repeat(paddingNeeded);

	// Apply background to content + padding
	// 为内容与填充部分统一应用背景色
	const withPadding = line + padding;
	return bgFn(withPadding);
}

/**
 * Truncate text to fit within a maximum visible width, adding ellipsis if needed.
 * 将文本截断以适配最大可见宽度，并在需要时追加省略号。
 * Optionally pad with spaces to reach exactly maxWidth.
 * 可选地使用空格填充，使结果宽度恰好等于 maxWidth。
 * Properly handles ANSI escape codes (they don't count toward width).
 * 能够正确处理 ANSI 转义码（它们不计入宽度）。
 *
 * @param text - Text to truncate (may contain ANSI codes)
 *               待截断的文本（可能包含 ANSI 控制码）
 * @param maxWidth - Maximum visible width
 *                   最大可见宽度
 * @param ellipsis - Ellipsis string to append when truncating (default: "...")
 *                   截断时追加的省略号字符串（默认值："..."）
 * @param pad - If true, pad result with spaces to exactly maxWidth (default: false)
 *              若为 true，则用空格将结果填充至恰好 maxWidth 宽度（默认值：false）
 * @returns Truncated text, optionally padded to exactly maxWidth
 *          截断后的文本，可选地被填充至恰好 maxWidth 宽度
 */
export function truncateToWidth(
	text: string,
	maxWidth: number,
	ellipsis: string = "...",
	pad: boolean = false,
): string {
	if (maxWidth <= 0) {
		return "";
	}

	if (text.length === 0) {
		return pad ? " ".repeat(maxWidth) : "";
	}

	const ellipsisWidth = visibleWidth(ellipsis);
	if (ellipsisWidth >= maxWidth) {
		const textWidth = visibleWidth(text);
		if (textWidth <= maxWidth) {
			return pad ? text + " ".repeat(maxWidth - textWidth) : text;
		}

		const clippedEllipsis = truncateFragmentToWidth(ellipsis, maxWidth);
		if (clippedEllipsis.width === 0) {
			return pad ? " ".repeat(maxWidth) : "";
		}
		return finalizeTruncatedResult("", 0, clippedEllipsis.text, clippedEllipsis.width, maxWidth, pad);
	}

	if (isPrintableAscii(text)) {
		if (text.length <= maxWidth) {
			return pad ? text + " ".repeat(maxWidth - text.length) : text;
		}
		const targetWidth = maxWidth - ellipsisWidth;
		return finalizeTruncatedResult(text.slice(0, targetWidth), targetWidth, ellipsis, ellipsisWidth, maxWidth, pad);
	}

	const targetWidth = maxWidth - ellipsisWidth;
	let result = "";
	let pendingAnsi = "";
	let visibleSoFar = 0;
	let keptWidth = 0;
	let keepContiguousPrefix = true;
	let overflowed = false;
	let exhaustedInput = false;
	const hasAnsi = text.includes("\x1b");
	const hasTabs = text.includes("\t");

	if (!hasAnsi && !hasTabs) {
		for (const { segment } of graphemeSegmenter.segment(text)) {
			const width = graphemeWidth(segment);
			if (keepContiguousPrefix && keptWidth + width <= targetWidth) {
				result += segment;
				keptWidth += width;
			} else {
				keepContiguousPrefix = false;
			}
			visibleSoFar += width;
			if (visibleSoFar > maxWidth) {
				overflowed = true;
				break;
			}
		}
		exhaustedInput = !overflowed;
	} else {
		let i = 0;
		while (i < text.length) {
			const ansi = extractAnsiCode(text, i);
			if (ansi) {
				pendingAnsi += ansi.code;
				i += ansi.length;
				continue;
			}

			if (text[i] === "\t") {
				if (keepContiguousPrefix && keptWidth + 3 <= targetWidth) {
					if (pendingAnsi) {
						result += pendingAnsi;
						pendingAnsi = "";
					}
					result += "\t";
					keptWidth += 3;
				} else {
					keepContiguousPrefix = false;
					pendingAnsi = "";
				}
				visibleSoFar += 3;
				if (visibleSoFar > maxWidth) {
					overflowed = true;
					break;
				}
				i++;
				continue;
			}

			let end = i;
			while (end < text.length && text[end] !== "\t") {
				const nextAnsi = extractAnsiCode(text, end);
				if (nextAnsi) {
					break;
				}
				end++;
			}

			for (const { segment } of graphemeSegmenter.segment(text.slice(i, end))) {
				const width = graphemeWidth(segment);
				if (keepContiguousPrefix && keptWidth + width <= targetWidth) {
					if (pendingAnsi) {
						result += pendingAnsi;
						pendingAnsi = "";
					}
					result += segment;
					keptWidth += width;
				} else {
					keepContiguousPrefix = false;
					pendingAnsi = "";
				}

				visibleSoFar += width;
				if (visibleSoFar > maxWidth) {
					overflowed = true;
					break;
				}
			}
			if (overflowed) {
				break;
			}
			i = end;
		}
		exhaustedInput = i >= text.length;
	}

	if (!overflowed && exhaustedInput) {
		return pad ? text + " ".repeat(Math.max(0, maxWidth - visibleSoFar)) : text;
	}

	return finalizeTruncatedResult(result, keptWidth, ellipsis, ellipsisWidth, maxWidth, pad);
}

/**
 * Extract a range of visible columns from a line. Handles ANSI codes and wide chars.
 * 从一行中提取指定可见列范围的内容。可正确处理 ANSI 控制码与宽字符。
 * @param strict - If true, exclude wide chars at boundary that would extend past the range
 *                 若为 true，则排除位于边界处、会超出该范围的宽字符
 */
export function sliceByColumn(line: string, startCol: number, length: number, strict = false): string {
	return sliceWithWidth(line, startCol, length, strict).text;
}

/**
 * Like sliceByColumn but also returns the actual visible width of the result.
 * 与 sliceByColumn 类似，但同时会返回结果的实际可见宽度。
 */
export function sliceWithWidth(
	line: string,
	startCol: number,
	length: number,
	strict = false,
): { text: string; width: number } {
	if (length <= 0) return { text: "", width: 0 };
	const endCol = startCol + length;
	let result = "",
		resultWidth = 0,
		currentCol = 0,
		i = 0,
		pendingAnsi = "";

	while (i < line.length) {
		const ansi = extractAnsiCode(line, i);
		if (ansi) {
			if (currentCol >= startCol && currentCol < endCol) result += ansi.code;
			else if (currentCol < startCol) pendingAnsi += ansi.code;
			i += ansi.length;
			continue;
		}

		let textEnd = i;
		while (textEnd < line.length && !extractAnsiCode(line, textEnd)) textEnd++;

		for (const { segment } of graphemeSegmenter.segment(line.slice(i, textEnd))) {
			const w = graphemeWidth(segment);
			const inRange = currentCol >= startCol && currentCol < endCol;
			const fits = !strict || currentCol + w <= endCol;
			if (inRange && fits) {
				if (pendingAnsi) {
					result += pendingAnsi;
					pendingAnsi = "";
				}
				result += segment;
				resultWidth += w;
			}
			currentCol += w;
			if (currentCol >= endCol) break;
		}
		i = textEnd;
		if (currentCol >= endCol) break;
	}
	return { text: result, width: resultWidth };
}

// Pooled tracker instance for extractSegments (avoids allocation per call)
// 供 extractSegments 复用的池化跟踪器实例（避免每次调用都重新分配对象）
const pooledStyleTracker = new AnsiCodeTracker();

/**
 * Extract "before" and "after" segments from a line in a single pass.
 * 一次遍历即可从一行中提取「前段（before）」与「后段（after）」两部分内容。
 * Used for overlay compositing where we need content before and after the overlay region.
 * 用于叠加层（overlay）合成场景，此时需要获取叠加区域前后两侧的内容。
 * Preserves styling from before the overlay that should affect content after it.
 * 会保留叠加区域之前的样式，使其能够继续作用于其后的内容。
 */
export function extractSegments(
	line: string,
	beforeEnd: number,
	afterStart: number,
	afterLen: number,
	strictAfter = false,
): { before: string; beforeWidth: number; after: string; afterWidth: number } {
	let before = "",
		beforeWidth = 0,
		after = "",
		afterWidth = 0;
	let currentCol = 0,
		i = 0;
	let pendingAnsiBefore = "";
	let afterStarted = false;
	const afterEnd = afterStart + afterLen;

	// Track styling state so "after" inherits styling from before the overlay
	// 跟踪样式状态，使「后段」能够继承叠加区域之前的样式
	pooledStyleTracker.clear();

	while (i < line.length) {
		const ansi = extractAnsiCode(line, i);
		if (ansi) {
			// Track all SGR codes to know styling state at afterStart
			// 跟踪全部 SGR 控制码，以便得知 afterStart 位置处的样式状态
			pooledStyleTracker.process(ansi.code);
			// Include ANSI codes in their respective segments
			// 将 ANSI 控制码分别归入各自所属的片段中
			if (currentCol < beforeEnd) {
				pendingAnsiBefore += ansi.code;
			} else if (currentCol >= afterStart && currentCol < afterEnd && afterStarted) {
				// Only include after we've started "after" (styling already prepended)
				// 仅在「后段」已经开始之后才纳入这些控制码（此时样式已被前置补上）
				after += ansi.code;
			}
			i += ansi.length;
			continue;
		}

		let textEnd = i;
		while (textEnd < line.length && !extractAnsiCode(line, textEnd)) textEnd++;

		for (const { segment } of graphemeSegmenter.segment(line.slice(i, textEnd))) {
			const w = graphemeWidth(segment);

			if (currentCol < beforeEnd && currentCol + w <= beforeEnd) {
				if (pendingAnsiBefore) {
					before += pendingAnsiBefore;
					pendingAnsiBefore = "";
				}
				before += segment;
				beforeWidth += w;
			} else if (currentCol >= afterStart && currentCol < afterEnd) {
				const fits = !strictAfter || currentCol + w <= afterEnd;
				if (fits) {
					// On first "after" grapheme, prepend inherited styling from before overlay
					// 在「后段」的首个字素簇处，前置补上从叠加区域之前继承而来的样式
					if (!afterStarted) {
						after += pooledStyleTracker.getActiveCodes();
						afterStarted = true;
					}
					after += segment;
					afterWidth += w;
				}
			}

			currentCol += w;
			// Early exit: done with "before" only, or done with both segments
			// 提前退出：仅需处理「前段」且已完成，或者两个片段均已处理完成
			if (afterLen <= 0 ? currentCol >= beforeEnd : currentCol >= afterEnd) break;
		}
		i = textEnd;
		if (afterLen <= 0 ? currentCol >= beforeEnd : currentCol >= afterEnd) break;
	}

	return { before, beforeWidth, after, afterWidth };
}
