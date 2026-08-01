/**
 * Streaming-Aware Input Gate
 * 感知流式状态的输入闸门（Streaming-Aware Input Gate）
 *
 * Demonstrates `event.streamingBehavior` to skip expensive pre-processing
 * during mid-stream steering, where low latency matters.
 * 演示如何利用 `event.streamingBehavior`，在流式输出中途进行引导（steering）时
 * 跳过开销较大的预处理，因为此时低延迟至关重要。
 *
 * This extension prepends `git diff --stat` output when the user mentions
 * file changes, giving the model immediate context. During steering the
 * exec call is skipped so the correction reaches the model without delay.
 * 当用户提及文件改动时，该扩展会在输入前面附加 `git diff --stat` 的输出，
 * 从而立即为模型提供上下文。而在引导过程中会跳过该 exec 调用，
 * 使得纠正内容能够无延迟地送达模型。
 *
 * Start pi with this extension:
 * 使用该扩展启动 pi：
 *   pi -e ./examples/extensions/input-transform-streaming.ts
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const TRIGGER = /\b(changes?|diff|modified)\b/i;

export default function (pi: ExtensionAPI) {
	pi.on("input", async (event) => {
		// During steering, skip the exec call — corrections should be fast
		// 在引导（steering）期间跳过 exec 调用 —— 纠正操作应当足够快
		if (event.streamingBehavior === "steer") {
			return { action: "continue" };
		}

		if (!TRIGGER.test(event.text)) {
			return { action: "continue" };
		}

		const { stdout, code } = await pi.exec("git", ["diff", "--stat"]);
		if (code !== 0 || !stdout.trim()) {
			return { action: "continue" };
		}

		return {
			action: "transform",
			text: `${event.text}\n\nCurrent uncommitted changes:\n\`\`\`\n${stdout.trim()}\n\`\`\``,
		};
	});
}
