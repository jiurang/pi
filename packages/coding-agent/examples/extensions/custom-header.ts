/**
 * Custom Header Extension
 * 自定义头部（Header）扩展
 *
 * Demonstrates ctx.ui.setHeader() for replacing the built-in header
 * (logo + keybinding hints) with a custom component showing the pi mascot.
 * 演示如何使用 ctx.ui.setHeader() 将内置头部（logo + 快捷键提示）替换为一个
 * 展示 pi 吉祥物的自定义组件。
 */

import type { ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";
import { VERSION } from "@earendil-works/pi-coding-agent";

// --- PI MASCOT ---
// --- PI 吉祥物 ---
// Based on pi_mascot.ts - the pi agent character
// 基于 pi_mascot.ts —— pi agent 的角色形象
function getPiMascot(theme: Theme): string[] {
	// --- COLORS ---
	// --- 颜色 ---
	// 3b1b Blue: R=80, G=180, B=230
	// 3b1b 蓝：R=80, G=180, B=230
	const piBlue = (text: string) => theme.fg("accent", text);
	const white = (text: string) => text; // Use plain white (or theme.fg("text", text)) | 使用纯白色（或 theme.fg("text", text)）
	const black = (text: string) => theme.fg("dim", text); // Use dim for contrast | 使用暗色（dim）以形成对比

	// --- GLYPHS ---
	// --- 字形 ---
	const BLOCK = "█";
	const PUPIL = "▌"; // Vertical half-block for the pupil | 用作瞳孔的竖向半方块

	// --- CONSTRUCTION ---
	// --- 构建 ---

	// 1. The Eye Unit: [White Full Block][Black Vertical Sliver]
	// 1. 眼睛单元：[白色实心方块][黑色竖向细条]
	// This creates the "looking sideways" effect
	// 由此营造出“侧目而视”的效果
	const eye = `${white(BLOCK)}${black(PUPIL)}`;

	// 2. Line 1: The Eyes
	// 2. 第 1 行：双眼
	// 5 spaces indent aligns them with the start of the legs
	// 缩进 5 个空格，使其与双腿的起始位置对齐
	const lineEyes = `     ${eye}  ${eye}`;

	// 3. Line 2: The Wide Top Bar (The "Overhang")
	// 3. 第 2 行：宽顶横杠（即“悬挑”部分）
	// 14 blocks wide for that serif-style roof
	// 宽 14 个方块，构成衬线风格的顶盖
	const lineBar = `  ${piBlue(BLOCK.repeat(14))}`;

	// 4. Lines 3-6: The Legs
	// 4. 第 3-6 行：双腿
	// Indented 5 spaces relative to the very left edge
	// 相对最左边缘缩进 5 个空格
	// Leg width: 2 blocks | Gap: 4 blocks
	// 腿宽：2 个方块 | 间隔：4 个方块
	const lineLeg = `     ${piBlue(BLOCK.repeat(2))}    ${piBlue(BLOCK.repeat(2))}`;

	// --- ASSEMBLY ---
	// --- 组装 ---
	return ["", lineEyes, lineBar, lineLeg, lineLeg, lineLeg, lineLeg, ""];
}

export default function (pi: ExtensionAPI) {
	// Set custom header immediately on load (if UI is available)
	// 加载时立即设置自定义头部（前提是 UI 可用）
	pi.on("session_start", async (_event, ctx) => {
		if (ctx.mode === "tui") {
			ctx.ui.setHeader((_tui, theme) => {
				return {
					render(_width: number): string[] {
						const mascotLines = getPiMascot(theme);
						// Add a subtitle with hint
						// 添加一行带提示信息的副标题
						const subtitle = `${theme.fg("muted", "   shitty coding agent")}${theme.fg("dim", ` v${VERSION}`)}`;
						return [...mascotLines, subtitle];
					},
					invalidate() {},
				};
			});
		}
	});

	// Command to restore built-in header
	// 用于恢复内置头部的命令
	pi.registerCommand("builtin-header", {
		description: "Restore built-in header with keybinding hints",
		handler: async (_args, ctx) => {
			ctx.ui.setHeader(undefined);
			ctx.ui.notify("Built-in header restored", "info");
		},
	});
}
