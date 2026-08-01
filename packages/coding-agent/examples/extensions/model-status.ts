/**
 * Model status extension - shows model changes in the status bar.
 * 模型状态扩展 —— 在状态栏中展示模型变更。
 *
 * Demonstrates the `model_select` hook which fires when the model changes
 * via /model command, Ctrl+P cycling, or session restore.
 * 演示 `model_select` 钩子（hook）的用法：当通过 /model 命令、Ctrl+P 循环切换
 * 或会话恢复导致模型变更时，该钩子会被触发。
 *
 * Usage: pi -e ./model-status.ts
 * 用法：pi -e ./model-status.ts
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	pi.on("model_select", async (event, ctx) => {
		const { model, previousModel, source } = event;

		// Format model identifiers
		// 格式化模型标识符
		const next = `${model.provider}/${model.id}`;
		const prev = previousModel ? `${previousModel.provider}/${previousModel.id}` : "none";

		// Show notification on change
		// 发生变更时显示通知
		if (source !== "restore") {
			ctx.ui.notify(`Model: ${next}`, "info");
		}

		// Update status bar with current model
		// 用当前模型更新状态栏
		ctx.ui.setStatus("model", `🤖 ${model.id}`);

		// Log change details (visible in debug output)
		// 记录变更详情（可在调试输出中查看）
		console.log(`[model_select] ${prev} → ${next} (${source})`);
	});
}
