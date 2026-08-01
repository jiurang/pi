/**
 * Hidden Thinking Label Extension
 * 隐藏思考标签(Hidden Thinking Label)扩展
 *
 * Demonstrates `ctx.ui.setHiddenThinkingLabel()` for customizing the label shown
 * when thinking blocks are hidden.
 * 演示如何使用 `ctx.ui.setHiddenThinkingLabel()` 自定义思考块(thinking block)被隐藏时
 * 所显示的标签。
 *
 * Usage:
 * 用法:
 *   pi --extension examples/extensions/hidden-thinking-label.ts
 *
 * Test:
 * 测试:
 *   1. Load this extension
 *      加载本扩展
 *   2. Hide thinking blocks with Ctrl+T
 *      使用 Ctrl+T 隐藏思考块
 *   3. Ask for something that produces reasoning output
 *      提问一个会产生推理(reasoning)输出的问题
 *   4. The collapsed thinking block label will show the custom text
 *      折叠后的思考块标签会显示自定义文本
 *
 * Commands:
 * 命令:
 *   /thinking-label <text>   Set a custom hidden thinking label
 *                            设置自定义的隐藏思考标签
 *   /thinking-label          Reset to the default label
 *                            重置为默认标签
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const DEFAULT_LABEL = "Pondering...";

export default function (pi: ExtensionAPI) {
	let label = DEFAULT_LABEL;

	const applyLabel = (ctx: ExtensionContext) => {
		ctx.ui.setHiddenThinkingLabel(label);
	};

	pi.on("session_start", async (_event, ctx) => {
		applyLabel(ctx);
	});

	pi.registerCommand("thinking-label", {
		description: "Set the hidden thinking label. Use without args to reset.",
		handler: async (args, ctx) => {
			const nextLabel = args.trim();

			if (!nextLabel) {
				label = DEFAULT_LABEL;
				ctx.ui.setHiddenThinkingLabel();
				ctx.ui.notify(`Hidden thinking label reset to: ${DEFAULT_LABEL}`);
				return;
			}

			label = nextLabel;
			ctx.ui.setHiddenThinkingLabel(label);
			ctx.ui.notify(`Hidden thinking label set to: ${label}`);
		},
	});
}
