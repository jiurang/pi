/**
 * DOOM Component for overlay mode
 * 用于浮层（overlay）模式的 DOOM 组件
 *
 * Renders DOOM frames using half-block characters (▀) with 24-bit color.
 * 使用半块字符（▀）配合 24 位真彩色渲染 DOOM 画面帧。
 * Height is calculated from width to maintain DOOM's aspect ratio.
 * 高度由宽度换算得出，以保持 DOOM 原有的宽高比。
 */

import type { Component } from "@earendil-works/pi-tui";
import { isKeyRelease, type TUI } from "@earendil-works/pi-tui";
import type { DoomEngine } from "./doom-engine.ts";
import { DoomKeys, mapKeyToDoom } from "./doom-keys.ts";

function renderHalfBlock(
	rgba: Uint8Array,
	width: number,
	height: number,
	targetCols: number,
	targetRows: number,
): string[] {
	const lines: string[] = [];
	const scaleX = width / targetCols;
	const scaleY = height / (targetRows * 2);

	for (let row = 0; row < targetRows; row++) {
		let line = "";
		const srcY1 = Math.floor(row * 2 * scaleY);
		const srcY2 = Math.floor((row * 2 + 1) * scaleY);

		for (let col = 0; col < targetCols; col++) {
			const srcX = Math.floor(col * scaleX);
			const idx1 = (srcY1 * width + srcX) * 4;
			const idx2 = (srcY2 * width + srcX) * 4;
			const r1 = rgba[idx1] ?? 0,
				g1 = rgba[idx1 + 1] ?? 0,
				b1 = rgba[idx1 + 2] ?? 0;
			const r2 = rgba[idx2] ?? 0,
				g2 = rgba[idx2 + 1] ?? 0,
				b2 = rgba[idx2 + 2] ?? 0;
			line += `\x1b[38;2;${r1};${g1};${b1}m\x1b[48;2;${r2};${g2};${b2}m▀`;
		}
		line += "\x1b[0m";
		lines.push(line);
	}
	return lines;
}

export class DoomOverlayComponent implements Component {
	private engine: DoomEngine;
	private tui: TUI;
	private interval: ReturnType<typeof setInterval> | null = null;
	private onExit: () => void;

	// Opt-in to key release events for smooth movement
	// 主动开启按键释放（key release）事件，以获得更流畅的移动效果
	wantsKeyRelease = true;

	constructor(tui: TUI, engine: DoomEngine, onExit: () => void, resume = false) {
		this.tui = tui;
		this.engine = engine;
		this.onExit = onExit;

		// Unpause if resuming
		// 若为恢复游戏，则取消暂停
		if (resume) {
			this.engine.pushKey(true, DoomKeys.KEY_PAUSE);
			this.engine.pushKey(false, DoomKeys.KEY_PAUSE);
		}

		this.startGameLoop();
	}

	private startGameLoop(): void {
		this.interval = setInterval(() => {
			try {
				this.engine.tick();
				this.tui.requestRender();
			} catch {
				// WASM error (e.g., exit via DOOM menu) - treat as quit
				// WASM 错误（例如通过 DOOM 菜单退出）—— 按退出处理
				this.dispose();
				this.onExit();
			}
		}, 1000 / 35);
	}

	handleInput(data: string): void {
		// Q to pause and exit (but not on release)
		// 按 Q 暂停并退出（按键释放时不触发）
		if (!isKeyRelease(data) && (data === "q" || data === "Q")) {
			// Send DOOM's pause key before exiting
			// 退出前先发送 DOOM 的暂停键
			this.engine.pushKey(true, DoomKeys.KEY_PAUSE);
			this.engine.pushKey(false, DoomKeys.KEY_PAUSE);
			this.dispose();
			this.onExit();
			return;
		}

		const doomKeys = mapKeyToDoom(data);
		if (doomKeys.length === 0) return;

		const released = isKeyRelease(data);

		for (const key of doomKeys) {
			this.engine.pushKey(!released, key);
		}
	}

	render(width: number): string[] {
		// DOOM renders at 640x400 (1.6:1 ratio)
		// DOOM 以 640x400 分辨率渲染（宽高比 1.6:1）
		// With half-block characters, each terminal row = 2 pixels
		// 使用半块字符时，终端的每一行相当于 2 个像素
		// So effective ratio is 640:200 = 3.2:1 (width:height in terminal cells)
		// 因此实际比例为 640:200 = 3.2:1（以终端字符单元计的宽:高）
		// Add 1 row for footer
		// 额外增加 1 行用于显示底部信息栏
		const ASPECT_RATIO = 3.2;
		const MIN_HEIGHT = 10;
		const height = Math.max(MIN_HEIGHT, Math.floor(width / ASPECT_RATIO));

		const rgba = this.engine.getFrameRGBA();
		const lines = renderHalfBlock(rgba, this.engine.width, this.engine.height, width, height);

		// Footer
		// 底部信息栏
		const footer = " DOOM | Q=Pause | WASD=Move | Shift+WASD=Run | Space=Use | F=Fire | 1-7=Weapons";
		const truncatedFooter = footer.length > width ? footer.slice(0, width) : footer;
		lines.push(`\x1b[2m${truncatedFooter}\x1b[0m`);

		return lines;
	}

	invalidate(): void {}

	dispose(): void {
		if (this.interval) {
			clearInterval(this.interval);
			this.interval = null;
		}
	}
}
