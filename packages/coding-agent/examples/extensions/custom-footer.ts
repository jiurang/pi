/**
 * Custom Footer Extension - demonstrates ctx.ui.setFooter()
 * 自定义页脚（footer）扩展 —— 演示 ctx.ui.setFooter() 的用法。
 *
 * footerData exposes data not otherwise accessible:
 * footerData 会暴露一些其他途径无法获取的数据：
 * - getGitBranch(): current git branch
 * - getGitBranch()：当前的 git 分支
 * - getExtensionStatuses(): texts from ctx.ui.setStatus()
 * - getExtensionStatuses()：通过 ctx.ui.setStatus() 设置的文本
 *
 * Token stats come from ctx.sessionManager/ctx.model (already accessible).
 * Token 统计数据来自 ctx.sessionManager/ctx.model（这些本就可以访问）。
 */

import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

export default function (pi: ExtensionAPI) {
	let enabled = false;

	pi.registerCommand("footer", {
		description: "Toggle custom footer",
		handler: async (_args, ctx) => {
			enabled = !enabled;

			if (enabled) {
				ctx.ui.setFooter((tui, theme, footerData) => {
					const unsub = footerData.onBranchChange(() => tui.requestRender());

					return {
						dispose: unsub,
						invalidate() {},
						render(width: number): string[] {
							// Compute tokens from ctx (already accessible to extensions)
							// 基于 ctx 计算 token 数（扩展本就可以访问这些数据）
							let input = 0,
								output = 0,
								cost = 0;
							for (const e of ctx.sessionManager.getBranch()) {
								if (e.type === "message" && e.message.role === "assistant") {
									const m = e.message as AssistantMessage;
									input += m.usage.input;
									output += m.usage.output;
									cost += m.usage.cost.total;
								}
							}

							// Get git branch (not otherwise accessible)
							// 获取 git 分支（其他途径无法获取）
							const branch = footerData.getGitBranch();
							const fmt = (n: number) => (n < 1000 ? `${n}` : `${(n / 1000).toFixed(1)}k`);

							const left = theme.fg("dim", `↑${fmt(input)} ↓${fmt(output)} $${cost.toFixed(3)}`);
							const branchStr = branch ? ` (${branch})` : "";
							const right = theme.fg("dim", `${ctx.model?.id || "no-model"}${branchStr}`);

							const pad = " ".repeat(Math.max(1, width - visibleWidth(left) - visibleWidth(right)));
							return [truncateToWidth(left + pad + right, width)];
						},
					};
				});
				ctx.ui.notify("Custom footer enabled", "info");
			} else {
				ctx.ui.setFooter(undefined);
				ctx.ui.notify("Default footer restored", "info");
			}
		},
	});
}
