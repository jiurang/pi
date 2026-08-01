/**
 * Modal Editor - vim-like modal editing example
 * 模式化编辑器 —— 类 vim 的模式编辑示例
 *
 * Usage: pi --extension ./examples/extensions/modal-editor.ts
 * 用法：pi --extension ./examples/extensions/modal-editor.ts
 *
 * - Escape: insert → normal mode (in normal mode, aborts agent)
 *   Escape：从插入（insert）模式切换到普通（normal）模式（在普通模式下则中止 agent）
 * - i: normal → insert mode
 *   i：从普通模式切换到插入模式
 * - hjkl: navigation in normal mode
 *   hjkl：在普通模式下用于移动光标
 * - ctrl+c, ctrl+d, etc. work in both modes
 *   ctrl+c、ctrl+d 等组合键在两种模式下均可使用
 */

import { CustomEditor, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { matchesKey, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

// Normal mode key mappings: key -> escape sequence (or null for mode switch)
// 普通模式下的按键映射：按键 -> 转义序列（若为 null 则表示切换模式）
const NORMAL_KEYS: Record<string, string | null> = {
	h: "\x1b[D", // left 左移
	j: "\x1b[B", // down 下移
	k: "\x1b[A", // up 上移
	l: "\x1b[C", // right 右移
	"0": "\x01", // line start 行首
	$: "\x05", // line end 行尾
	x: "\x1b[3~", // delete char 删除字符
	i: null, // insert mode 进入插入模式
	a: null, // append (insert + right) 追加（进入插入模式并右移一位）
};

class ModalEditor extends CustomEditor {
	private mode: "normal" | "insert" = "insert";

	handleInput(data: string): void {
		// Escape toggles to normal mode, or passes through for app handling
		// Escape 用于切换到普通模式，或透传给应用层处理
		if (matchesKey(data, "escape")) {
			if (this.mode === "insert") {
				this.mode = "normal";
			} else {
				super.handleInput(data); // abort agent, etc. 中止 agent 等操作
			}
			return;
		}

		// Insert mode: pass everything through
		// 插入模式：所有输入原样透传
		if (this.mode === "insert") {
			super.handleInput(data);
			return;
		}

		// Normal mode: check mapped keys
		// 普通模式：检查是否命中已映射的按键
		if (data in NORMAL_KEYS) {
			const seq = NORMAL_KEYS[data];
			if (data === "i") {
				this.mode = "insert";
			} else if (data === "a") {
				this.mode = "insert";
				super.handleInput("\x1b[C"); // move right first 先向右移动一位
			} else if (seq) {
				super.handleInput(seq);
			}
			return;
		}

		// Pass control sequences (ctrl+c, etc.) to super, ignore printable chars
		// 将控制序列（ctrl+c 等）传给父类处理，忽略可打印字符
		if (data.length === 1 && data.charCodeAt(0) >= 32) return;
		super.handleInput(data);
	}

	render(width: number): string[] {
		const lines = super.render(width);
		if (lines.length === 0) return lines;

		// Add mode indicator to bottom border
		// 在底部边框上添加模式指示标签
		const label = this.mode === "normal" ? " NORMAL " : " INSERT ";
		const last = lines.length - 1;
		if (visibleWidth(lines[last]!) >= label.length) {
			lines[last] = truncateToWidth(lines[last]!, width - label.length, "") + label;
		}
		return lines;
	}
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (_event, ctx) => {
		ctx.ui.setEditorComponent((tui, theme, kb) => new ModalEditor(tui, theme, kb));
	});
}
