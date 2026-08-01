/**
 * ANSI escape code to HTML converter.
 * ANSI 转义码到 HTML 的转换器。
 *
 * Converts terminal ANSI color/style codes to HTML with inline styles.
 * 将终端的 ANSI 颜色/样式码转换为带内联样式（inline style）的 HTML。
 * Supports:
 * 支持：
 * - Standard foreground colors (30-37) and bright variants (90-97)
 *   标准前景色（30-37）及其高亮变体（90-97）
 * - Standard background colors (40-47) and bright variants (100-107)
 *   标准背景色（40-47）及其高亮变体（100-107）
 * - 256-color palette (38;5;N and 48;5;N)
 *   256 色调色板（38;5;N 与 48;5;N）
 * - RGB true color (38;2;R;G;B and 48;2;R;G;B)
 *   RGB 真彩色（38;2;R;G;B 与 48;2;R;G;B）
 * - Text styles: bold (1), dim (2), italic (3), underline (4)
 *   文本样式：加粗（1）、暗淡（2）、斜体（3）、下划线（4）
 * - Reset (0)
 *   重置（0）
 */

// Standard ANSI color palette (0-15)
// 标准 ANSI 调色板（0-15）
const ANSI_COLORS = [
	"#000000", // 0: black 黑色
	"#800000", // 1: red 红色
	"#008000", // 2: green 绿色
	"#808000", // 3: yellow 黄色
	"#000080", // 4: blue 蓝色
	"#800080", // 5: magenta 品红
	"#008080", // 6: cyan 青色
	"#c0c0c0", // 7: white 白色
	"#808080", // 8: bright black 亮黑
	"#ff0000", // 9: bright red 亮红
	"#00ff00", // 10: bright green 亮绿
	"#ffff00", // 11: bright yellow 亮黄
	"#0000ff", // 12: bright blue 亮蓝
	"#ff00ff", // 13: bright magenta 亮品红
	"#00ffff", // 14: bright cyan 亮青
	"#ffffff", // 15: bright white 亮白
];

/**
 * Convert 256-color index to hex.
 * 将 256 色索引转换为十六进制颜色值。
 */
function color256ToHex(index: number): string {
	// Standard colors (0-15)
	// 标准颜色（0-15）
	if (index < 16) {
		return ANSI_COLORS[index];
	}

	// Color cube (16-231): 6x6x6 = 216 colors
	// 色立方（16-231）：6x6x6 = 216 种颜色
	if (index < 232) {
		const cubeIndex = index - 16;
		const r = Math.floor(cubeIndex / 36);
		const g = Math.floor((cubeIndex % 36) / 6);
		const b = cubeIndex % 6;
		const toComponent = (n: number) => (n === 0 ? 0 : 55 + n * 40);
		const toHex = (n: number) => toComponent(n).toString(16).padStart(2, "0");
		return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
	}

	// Grayscale (232-255): 24 shades
	// 灰阶（232-255）：24 级灰度
	const gray = 8 + (index - 232) * 10;
	const grayHex = gray.toString(16).padStart(2, "0");
	return `#${grayHex}${grayHex}${grayHex}`;
}

/**
 * Escape HTML special characters.
 * 转义 HTML 特殊字符。
 */
function escapeHtml(text: string): string {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

interface TextStyle {
	fg: string | null;
	bg: string | null;
	bold: boolean;
	dim: boolean;
	italic: boolean;
	underline: boolean;
}

function createEmptyStyle(): TextStyle {
	return {
		fg: null,
		bg: null,
		bold: false,
		dim: false,
		italic: false,
		underline: false,
	};
}

function styleToInlineCSS(style: TextStyle): string {
	const parts: string[] = [];
	if (style.fg) parts.push(`color:${style.fg}`);
	if (style.bg) parts.push(`background-color:${style.bg}`);
	if (style.bold) parts.push("font-weight:bold");
	if (style.dim) parts.push("opacity:0.6");
	if (style.italic) parts.push("font-style:italic");
	if (style.underline) parts.push("text-decoration:underline");
	return parts.join(";");
}

function hasStyle(style: TextStyle): boolean {
	return style.fg !== null || style.bg !== null || style.bold || style.dim || style.italic || style.underline;
}

/**
 * Parse ANSI SGR (Select Graphic Rendition) codes and update style.
 * 解析 ANSI SGR（Select Graphic Rendition，选择图形再现）码并更新样式。
 */
function applySgrCode(params: number[], style: TextStyle): void {
	let i = 0;
	while (i < params.length) {
		const code = params[i];

		if (code === 0) {
			// Reset all
			// 重置全部样式
			style.fg = null;
			style.bg = null;
			style.bold = false;
			style.dim = false;
			style.italic = false;
			style.underline = false;
		} else if (code === 1) {
			style.bold = true;
		} else if (code === 2) {
			style.dim = true;
		} else if (code === 3) {
			style.italic = true;
		} else if (code === 4) {
			style.underline = true;
		} else if (code === 22) {
			// Reset bold/dim
			// 重置加粗/暗淡
			style.bold = false;
			style.dim = false;
		} else if (code === 23) {
			style.italic = false;
		} else if (code === 24) {
			style.underline = false;
		} else if (code >= 30 && code <= 37) {
			// Standard foreground colors
			// 标准前景色
			style.fg = ANSI_COLORS[code - 30];
		} else if (code === 38) {
			// Extended foreground color
			// 扩展前景色
			if (params[i + 1] === 5 && params.length > i + 2) {
				// 256-color: 38;5;N
				// 256 色：38;5;N
				style.fg = color256ToHex(params[i + 2]);
				i += 2;
			} else if (params[i + 1] === 2 && params.length > i + 4) {
				// RGB: 38;2;R;G;B
				// RGB 真彩色：38;2;R;G;B
				const r = params[i + 2];
				const g = params[i + 3];
				const b = params[i + 4];
				style.fg = `rgb(${r},${g},${b})`;
				i += 4;
			}
		} else if (code === 39) {
			// Default foreground
			// 默认前景色
			style.fg = null;
		} else if (code >= 40 && code <= 47) {
			// Standard background colors
			// 标准背景色
			style.bg = ANSI_COLORS[code - 40];
		} else if (code === 48) {
			// Extended background color
			// 扩展背景色
			if (params[i + 1] === 5 && params.length > i + 2) {
				// 256-color: 48;5;N
				// 256 色：48;5;N
				style.bg = color256ToHex(params[i + 2]);
				i += 2;
			} else if (params[i + 1] === 2 && params.length > i + 4) {
				// RGB: 48;2;R;G;B
				// RGB 真彩色：48;2;R;G;B
				const r = params[i + 2];
				const g = params[i + 3];
				const b = params[i + 4];
				style.bg = `rgb(${r},${g},${b})`;
				i += 4;
			}
		} else if (code === 49) {
			// Default background
			// 默认背景色
			style.bg = null;
		} else if (code >= 90 && code <= 97) {
			// Bright foreground colors
			// 高亮前景色
			style.fg = ANSI_COLORS[code - 90 + 8];
		} else if (code >= 100 && code <= 107) {
			// Bright background colors
			// 高亮背景色
			style.bg = ANSI_COLORS[code - 100 + 8];
		}
		// Ignore unrecognized codes
		// 忽略无法识别的控制码

		i++;
	}
}

// Match ANSI escape sequences: ESC[ followed by params and ending with 'm'
// 匹配 ANSI 转义序列：以 ESC[ 开头，后接参数，并以 'm' 结尾
const ANSI_REGEX = /\x1b\[([\d;]*)m/g;

/**
 * Convert ANSI-escaped text to HTML with inline styles.
 * 将带 ANSI 转义码的文本转换为带内联样式的 HTML。
 */
export function ansiToHtml(text: string): string {
	const style = createEmptyStyle();
	let result = "";
	let lastIndex = 0;
	let inSpan = false;

	// Reset regex state
	// 重置正则表达式（regex）状态
	ANSI_REGEX.lastIndex = 0;

	let match = ANSI_REGEX.exec(text);
	while (match !== null) {
		// Add text before this escape sequence
		// 追加位于该转义序列之前的文本
		const beforeText = text.slice(lastIndex, match.index);
		if (beforeText) {
			result += escapeHtml(beforeText);
		}

		// Parse SGR parameters
		// 解析 SGR 参数
		const paramStr = match[1];
		const params = paramStr ? paramStr.split(";").map((p) => parseInt(p, 10) || 0) : [0];

		// Close existing span if we have one
		// 如果当前已有 span，则先将其闭合
		if (inSpan) {
			result += "</span>";
			inSpan = false;
		}

		// Apply the codes
		// 应用这些控制码
		applySgrCode(params, style);

		// Open new span if we have any styling
		// 如果存在任何样式，则开启一个新的 span
		if (hasStyle(style)) {
			result += `<span style="${styleToInlineCSS(style)}">`;
			inSpan = true;
		}

		lastIndex = match.index + match[0].length;
		match = ANSI_REGEX.exec(text);
	}

	// Add remaining text
	// 追加剩余的文本
	const remainingText = text.slice(lastIndex);
	if (remainingText) {
		result += escapeHtml(remainingText);
	}

	// Close any open span
	// 闭合尚未关闭的 span
	if (inSpan) {
		result += "</span>";
	}

	return result;
}

/**
 * Convert array of ANSI-escaped lines to HTML.
 * 将带 ANSI 转义码的行数组转换为 HTML。
 * Each line is wrapped in a div element.
 * 每一行都会被包裹在一个 div 元素中。
 */
export function ansiLinesToHtml(lines: string[]): string {
	return lines.map((line) => `<div class="ansi-line">${ansiToHtml(line) || "&nbsp;"}</div>`).join("");
}
