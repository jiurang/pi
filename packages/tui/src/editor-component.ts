import type { AutocompleteProvider } from "./autocomplete.ts";
import type { Component } from "./tui.ts";

/**
 * Interface for custom editor components.
 * 自定义编辑器组件的接口。
 *
 * This allows extensions to provide their own editor implementation
 * (e.g., vim mode, emacs mode, custom keybindings) while maintaining
 * compatibility with the core application.
 * 它允许扩展提供自己的编辑器实现（例如 vim 模式、emacs 模式、自定义快捷键绑定），
 * 同时保持与核心应用的兼容性。
 */
export interface EditorComponent extends Component {
	// =========================================================================
	// Core text access (required)
	// 核心文本访问（必需）
	// =========================================================================

	/** Get the current text content 获取当前文本内容 */
	getText(): string;

	/** Set the text content 设置文本内容 */
	setText(text: string): void;

	/** Handle raw terminal input (key presses, paste sequences, etc.) 处理原始终端输入（按键、粘贴序列等） */
	handleInput(data: string): void;

	// =========================================================================
	// Callbacks (required)
	// 回调（必需）
	// =========================================================================

	/** Called when user submits (e.g., Enter key) 用户提交时调用（例如按下 Enter 键） */
	onSubmit?: (text: string) => void;

	/** Called when text changes 文本变化时调用 */
	onChange?: (text: string) => void;

	// =========================================================================
	// History support (optional)
	// 历史记录支持（可选）
	// =========================================================================

	/** Add text to history for up/down navigation 将文本加入历史记录，供上/下键导航使用 */
	addToHistory?(text: string): void;

	// =========================================================================
	// Advanced text manipulation (optional)
	// 高级文本操作（可选）
	// =========================================================================

	/** Insert text at current cursor position 在当前光标位置插入文本 */
	insertTextAtCursor?(text: string): void;

	/**
	 * Get text with any markers expanded (e.g., paste markers).
	 * 获取已展开所有标记（marker）的文本（例如粘贴标记）。
	 * Falls back to getText() if not implemented.
	 * 若未实现则回退到 getText()。
	 */
	getExpandedText?(): string;

	// =========================================================================
	// Autocomplete support (optional)
	// 自动补全支持（可选）
	// =========================================================================

	/** Set the autocomplete provider 设置自动补全提供者（provider） */
	setAutocompleteProvider?(provider: AutocompleteProvider): void;

	// =========================================================================
	// Appearance (optional)
	// 外观（可选）
	// =========================================================================

	/** Border color function 边框颜色函数 */
	borderColor?: (str: string) => string;

	/** Set horizontal padding 设置水平内边距 */
	setPaddingX?(padding: number): void;

	/** Set max visible items in autocomplete dropdown 设置自动补全下拉框中最多可见的条目数 */
	setAutocompleteMaxVisible?(maxVisible: number): void;
}
