/**
 * Rainbow Editor - highlights "ultrathink" with animated shine effect
 * 彩虹编辑器 —— 以动态高光效果突出显示 "ultrathink"
 *
 * Usage: pi --extension ./examples/extensions/rainbow-editor.ts
 * 用法: pi --extension ./examples/extensions/rainbow-editor.ts
 */

import { CustomEditor, type ExtensionAPI } from "@earendil-works/pi-coding-agent";

// Base colors (coral → yellow → green → teal → blue → purple → pink)
// 基础色板(珊瑚色 → 黄色 → 绿色 → 青色 → 蓝色 → 紫色 → 粉色)
const COLORS: [number, number, number][] = [
	// coral 珊瑚色
	[233, 137, 115],
	// yellow 黄色
	[228, 186, 103],
	// green 绿色
	[141, 192, 122],
	// teal 青色
	[102, 194, 179],
	// blue 蓝色
	[121, 157, 207],
	// purple 紫色
	[157, 134, 195],
	// pink 粉色
	[206, 130, 172],
];
const RESET = "\x1b[0m";

function brighten(rgb: [number, number, number], factor: number): string {
	const [r, g, b] = rgb.map((c) => Math.round(c + (255 - c) * factor));
	return `\x1b[38;2;${r};${g};${b}m`;
}

function colorize(text: string, shinePos: number): string {
	return (
		[...text]
			.map((c, i) => {
				const baseColor = COLORS[i % COLORS.length]!;
				// 3-letter shine: center bright, adjacent dimmer
				// 三字符高光:中间最亮,相邻字符稍暗
				let factor = 0;
				if (shinePos >= 0) {
					const dist = Math.abs(i - shinePos);
					if (dist === 0) factor = 0.7;
					else if (dist === 1) factor = 0.35;
				}
				return `${brighten(baseColor, factor)}${c}`;
			})
			.join("") + RESET
	);
}

class RainbowEditor extends CustomEditor {
	private animationTimer?: ReturnType<typeof setInterval>;
	private frame = 0;

	private hasUltrathink(): boolean {
		return /ultrathink/i.test(this.getText());
	}

	private startAnimation(): void {
		if (this.animationTimer) return;
		this.animationTimer = setInterval(() => {
			this.frame++;
			this.tui.requestRender();
		}, 60);
	}

	private stopAnimation(): void {
		if (this.animationTimer) {
			clearInterval(this.animationTimer);
			this.animationTimer = undefined;
		}
	}

	handleInput(data: string): void {
		super.handleInput(data);
		if (this.hasUltrathink()) {
			this.startAnimation();
		} else {
			this.stopAnimation();
		}
	}

	render(width: number): string[] {
		// Cycle: 10 shine positions + 10 pause frames
		// 一个周期:10 个高光位置 + 10 帧停顿
		const cycle = this.frame % 20;
		// -1 means no shine (pause)
		// -1 表示无高光(处于停顿阶段)
		const shinePos = cycle < 10 ? cycle : -1;
		return super.render(width).map((line) => line.replace(/ultrathink/gi, (m) => colorize(m, shinePos)));
	}
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		ctx.ui.setEditorComponent((tui, theme, kb) => new RainbowEditor(tui, theme, kb));
	});
}
