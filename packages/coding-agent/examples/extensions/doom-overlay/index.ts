/**
 * DOOM Overlay Demo - Play DOOM as an overlay
 * DOOM 浮层（overlay）演示 —— 以浮层方式游玩 DOOM。
 *
 * Usage: pi --extension ./examples/extensions/doom-overlay
 * 用法：pi --extension ./examples/extensions/doom-overlay
 *
 * Commands:
 * 命令：
 *   /doom-overlay - Play DOOM in an overlay (Q to pause/exit)
 *   /doom-overlay - 在浮层中游玩 DOOM（按 Q 暂停/退出）
 *
 * This demonstrates that overlays can handle real-time game rendering at 35 FPS.
 * 该示例演示了浮层能够以 35 FPS 承载实时游戏渲染。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { DoomOverlayComponent } from "./doom-component.ts";
import { DoomEngine } from "./doom-engine.ts";
import { ensureWadFile } from "./wad-finder.ts";

// Persistent engine instance - survives between invocations
// 持久化的引擎实例 —— 可跨多次调用保留状态
let activeEngine: DoomEngine | null = null;
let activeWadPath: string | null = null;

export default function (pi: ExtensionAPI) {
	pi.registerCommand("doom-overlay", {
		description: "Play DOOM as an overlay. Q to pause and exit.",

		handler: async (args, ctx) => {
			if (ctx.mode !== "tui") {
				ctx.ui.notify("DOOM requires interactive mode", "error");
				return;
			}

			// Auto-download WAD if not present
			// 若 WAD 文件不存在则自动下载
			ctx.ui.notify("Loading DOOM...", "info");
			const wad = args?.trim() ? args.trim() : await ensureWadFile();

			if (!wad) {
				ctx.ui.notify("Failed to download DOOM WAD file. Check your internet connection.", "error");
				return;
			}

			try {
				// Reuse existing engine if same WAD, otherwise create new
				// 若 WAD 相同则复用已有引擎，否则新建一个
				let isResume = false;
				if (activeEngine && activeWadPath === wad) {
					ctx.ui.notify("Resuming DOOM...", "info");
					isResume = true;
				} else {
					ctx.ui.notify(`Loading DOOM from ${wad}...`, "info");
					activeEngine = new DoomEngine(wad);
					await activeEngine.init();
					activeWadPath = wad;
				}

				await ctx.ui.custom(
					(tui, _theme, _keybindings, done) => {
						return new DoomOverlayComponent(tui, activeEngine!, () => done(undefined), isResume);
					},
					{
						overlay: true,
						overlayOptions: {
							width: "75%",
							maxHeight: "95%",
							anchor: "center",
							margin: { top: 1 },
						},
					},
				);
			} catch (error) {
				ctx.ui.notify(`Failed to load DOOM: ${error}`, "error");
				activeEngine = null;
				activeWadPath = null;
			}
		},
	});
}
