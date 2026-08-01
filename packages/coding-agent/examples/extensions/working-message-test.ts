/**
 * Working Message Persistence Test
 * 工作提示消息（working message）持久化测试。
 *
 * Sets a custom working message and indicator on session start so you can
 * verify they survive across loader recreations (e.g. between agent turns).
 * 在会话开始时设置自定义的工作提示消息和指示器，以便验证它们能在
 * 加载指示器（loader）被重建时（例如 agent 两轮对话之间）保持不变。
 *
 * Usage:
 * 用法：
 *   pi --extension examples/extensions/working-message-test.ts
 *
 * Then send a few messages in interactive mode. The working message should
 * stay "Working... (custom)" with a brown dot indicator every time the
 * loader appears, not revert to the default gray "Working...".
 * 然后在交互模式下发送几条消息。每次加载指示器出现时，工作提示消息都应
 * 保持为 "Working... (custom)" 并带有棕色圆点指示器，而不应回退为默认的
 * 灰色 "Working..."。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const CUSTOM_MESSAGE = "\x1b[38;2;155;86;63mWorking... (custom)\x1b[39m";
const CUSTOM_INDICATOR = { frames: ["\x1b[38;2;155;86;63m●\x1b[39m"] };

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		ctx.ui.setWorkingMessage(CUSTOM_MESSAGE);
		ctx.ui.setWorkingIndicator(CUSTOM_INDICATOR);
	});
}
