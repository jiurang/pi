import { Editor, type EditorOptions, type EditorTheme, type TUI } from "@earendil-works/pi-tui";
import type { AppKeybinding, KeybindingsManager } from "../../../core/keybindings.ts";

/**
 * Custom editor that handles app-level keybindings for coding-agent.
 * 自定义编辑器，用于处理 coding-agent 的应用级快捷键绑定（keybinding）。
 */
export class CustomEditor extends Editor {
	private keybindings: KeybindingsManager;
	public actionHandlers: Map<AppKeybinding, () => void> = new Map();

	// Special handlers that can be dynamically replaced
	// 可以被动态替换的特殊处理器（handler）
	public onEscape?: () => void;
	public onCtrlD?: () => void;
	public onPasteImage?: () => void;
	/** Handler for extension-registered shortcuts. 用于处理由扩展注册的快捷键的处理器。 Returns true if handled. 若已处理则返回 true。 */
	public onExtensionShortcut?: (data: string) => boolean;

	constructor(tui: TUI, theme: EditorTheme, keybindings: KeybindingsManager, options?: EditorOptions) {
		super(tui, theme, options);
		this.keybindings = keybindings;
	}

	/**
	 * Register a handler for an app action.
	 * 为某个应用动作（app action）注册处理器。
	 */
	onAction(action: AppKeybinding, handler: () => void): void {
		this.actionHandlers.set(action, handler);
	}

	handleInput(data: string): void {
		// Check extension-registered shortcuts first
		// 先检查由扩展注册的快捷键
		if (this.onExtensionShortcut?.(data)) {
			return;
		}

		// Check for clipboard paste keybinding
		// 检查剪贴板粘贴的快捷键绑定
		if (this.keybindings.matches(data, "app.clipboard.pasteImage")) {
			this.onPasteImage?.();
			return;
		}

		// Check app keybindings first
		// 优先检查应用级快捷键绑定

		// Escape/interrupt - only if autocomplete is NOT active
		// Escape/中断 —— 仅在自动补全（autocomplete）未激活时生效
		if (this.keybindings.matches(data, "app.interrupt")) {
			if (!this.isShowingAutocomplete()) {
				// Use dynamic onEscape if set, otherwise registered handler
				// 若设置了动态的 onEscape 则使用它，否则使用已注册的处理器
				const handler = this.onEscape ?? this.actionHandlers.get("app.interrupt");
				if (handler) {
					handler();
					return;
				}
			}
			// Let parent handle escape for autocomplete cancellation
			// 交由父类处理 escape，以取消自动补全
			super.handleInput(data);
			return;
		}

		// Exit (Ctrl+D) - only when editor is empty
		// 退出（Ctrl+D）—— 仅在编辑器内容为空时生效
		if (this.keybindings.matches(data, "app.exit")) {
			if (this.getText().length === 0) {
				const handler = this.onCtrlD ?? this.actionHandlers.get("app.exit");
				if (handler) handler();
				return;
			}
			// Fall through to editor handling for delete-char-forward when not empty
			// 内容非空时，继续向下交由编辑器处理「向后删除字符」逻辑
		}

		// Check all other app actions
		// 检查其余所有的应用动作
		for (const [action, handler] of this.actionHandlers) {
			if (action !== "app.interrupt" && action !== "app.exit" && this.keybindings.matches(data, action)) {
				handler();
				return;
			}
		}

		// Pass to parent for editor handling
		// 传递给父类进行编辑器层面的处理
		super.handleInput(data);
	}
}
