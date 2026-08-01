import type { Component } from "@earendil-works/pi-tui";
import { theme } from "../theme/theme.ts";

/**
 * Dynamic border component that adjusts to viewport width.
 * 可根据视口(viewport)宽度自适应调整的动态边框组件。
 *
 * Note: When used from extensions loaded via jiti, the global `theme` may be undefined
 * because jiti creates a separate module cache.
 * 注意：在通过 jiti 加载的扩展(extension)中使用时，全局的 `theme` 可能为 undefined，
 * 因为 jiti 会创建独立的模块缓存。
 * Always pass an explicit color
 * function when using DynamicBorder in components exported for extension use.
 * 因此，在供扩展使用而导出的组件中使用 DynamicBorder 时，请始终显式传入 color 函数。
 */
export class DynamicBorder implements Component {
	private color: (str: string) => string;

	constructor(color: (str: string) => string = (str) => theme.fg("border", str)) {
		this.color = color;
	}

	invalidate(): void {
		// No cached state to invalidate currently
		// 目前没有需要失效(invalidate)的缓存状态
	}

	render(width: number): string[] {
		return [this.color("─".repeat(Math.max(1, width)))];
	}
}
