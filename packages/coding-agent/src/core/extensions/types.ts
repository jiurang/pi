/**
 * Extension system types.
 * 扩展（extension）系统类型定义。
 *
 * Extensions are TypeScript modules that can:
 * 扩展是 TypeScript 模块，它们可以：
 * - Subscribe to agent lifecycle events
 * - 订阅 agent 生命周期事件
 * - Register LLM-callable tools
 * - 注册可供 LLM 调用的工具（tool）
 * - Register commands, keyboard shortcuts, and CLI flags
 * - 注册命令、键盘快捷键和 CLI 命令行标志
 * - Interact with the user via UI primitives
 * - 通过 UI 原语与用户交互
 */

import type {
	AgentMessage,
	AgentToolResult,
	AgentToolUpdateCallback,
	ThinkingLevel,
	ToolExecutionMode,
} from "@earendil-works/pi-agent-core";
import type {
	Api,
	AssistantMessageEvent,
	AssistantMessageEventStream,
	ConstrainedSamplingConfig,
	Context,
	ImageContent,
	Model,
	OAuthCredentials,
	OAuthLoginCallbacks,
	Provider,
	ProviderHeaders,
	RefreshModelsContext,
	SimpleStreamOptions,
	TextContent,
	ToolResultMessage,
	Usage,
} from "@earendil-works/pi-ai";
import type {
	AutocompleteItem,
	AutocompleteProvider,
	Component,
	EditorComponent,
	EditorTheme,
	KeyId,
	OverlayHandle,
	OverlayOptions,
	TUI,
} from "@earendil-works/pi-tui";
import type { Static, TSchema } from "typebox";
import type { Theme } from "../../modes/interactive/theme/theme.ts";
import type { BashResult } from "../bash-executor.ts";
import type { CompactionPreparation, CompactionResult } from "../compaction/index.ts";
import type { EventBus } from "../event-bus.ts";
import type { ExecOptions, ExecResult } from "../exec.ts";
import type { ReadonlyFooterDataProvider } from "../footer-data-provider.ts";
import type { KeybindingsManager } from "../keybindings.ts";
import type { CustomMessage } from "../messages.ts";
import type { ModelRegistry } from "../model-registry.ts";
import type { ScopedModel } from "../model-resolver.ts";
import type {
	BranchSummaryEntry,
	CompactionEntry,
	CustomEntry,
	ReadonlySessionManager,
	SessionEntry,
	SessionManager,
} from "../session-manager.ts";
import type { SlashCommandInfo } from "../slash-commands.ts";
import type { SourceInfo } from "../source-info.ts";
import type { BuildSystemPromptOptions } from "../system-prompt.ts";
import type { BashOperations } from "../tools/bash.ts";
import type { EditToolDetails } from "../tools/edit.ts";
import type {
	BashToolDetails,
	BashToolInput,
	EditToolInput,
	FindToolDetails,
	FindToolInput,
	GrepToolDetails,
	GrepToolInput,
	LsToolDetails,
	LsToolInput,
	ReadToolDetails,
	ReadToolInput,
	WriteToolInput,
} from "../tools/index.ts";

export type { ExecOptions, ExecResult } from "../exec.ts";
export type { BuildSystemPromptOptions } from "../system-prompt.ts";
export type { AgentToolResult, AgentToolUpdateCallback, ToolExecutionMode };
export type { AppKeybinding, KeybindingsManager } from "../keybindings.ts";

// ============================================================================
// UI Context
// UI 上下文
// ============================================================================

/** Options for extension UI dialogs. */
/** 扩展 UI 对话框的选项。 */
export interface ExtensionUIDialogOptions {
	/** AbortSignal to programmatically dismiss the dialog. */
	/** 用于以编程方式关闭对话框的 AbortSignal。 */
	signal?: AbortSignal;
	/** Timeout in milliseconds. Dialog auto-dismisses with live countdown display. */
	/** 超时时间（毫秒）。对话框会自动关闭，并显示实时倒计时。 */
	timeout?: number;
}

/** Placement for extension widgets. */
/** 扩展挂件（widget）的放置位置。 */
export type WidgetPlacement = "aboveEditor" | "belowEditor";

/** Options for extension widgets. */
/** 扩展挂件（widget）的选项。 */
export interface ExtensionWidgetOptions {
	/** Where the widget is rendered. Defaults to "aboveEditor". */
	/** 挂件的渲染位置。默认为 "aboveEditor"。 */
	placement?: WidgetPlacement;
}

/** Raw terminal input listener for extensions. */
/** 供扩展使用的原始终端输入监听器。 */
export type TerminalInputHandler = (data: string) => { consume?: boolean; data?: string } | undefined;

/** Working indicator configuration for the interactive streaming loader. */
/** 交互式流式加载器的工作指示器配置。 */
export interface WorkingIndicatorOptions {
	/** Animation frames. Use an empty array to hide the indicator entirely. Custom frames are rendered verbatim. */
	/** 动画帧。传入空数组可完全隐藏指示器。自定义帧会原样渲染。 */
	frames?: string[];
	/** Frame interval in milliseconds for animated indicators. */
	/** 动画指示器的帧间隔（毫秒）。 */
	intervalMs?: number;
}

/** Wrap the current autocomplete provider with additional behavior. */
/** 为当前自动补全提供器（provider）包装额外行为。 */
export type AutocompleteProviderFactory = (current: AutocompleteProvider) => AutocompleteProvider;
export type EditorFactory = (tui: TUI, theme: EditorTheme, keybindings: KeybindingsManager) => EditorComponent;

/**
 * UI context for extensions to request interactive UI.
 * 供扩展请求交互式 UI 的 UI 上下文。
 * Each mode (interactive, RPC, print) provides its own implementation.
 * 每种模式（交互式、RPC、打印）都提供各自的实现。
 */
export interface ExtensionUIContext {
	/** Show a selector and return the user's choice. */
	/** 显示一个选择器并返回用户的选择。 */
	select(title: string, options: string[], opts?: ExtensionUIDialogOptions): Promise<string | undefined>;

	/** Show a confirmation dialog. */
	/** 显示一个确认对话框。 */
	confirm(title: string, message: string, opts?: ExtensionUIDialogOptions): Promise<boolean>;

	/** Show a text input dialog. */
	/** 显示一个文本输入对话框。 */
	input(title: string, placeholder?: string, opts?: ExtensionUIDialogOptions): Promise<string | undefined>;

	/** Show a notification to the user. */
	/** 向用户显示一条通知。 */
	notify(message: string, type?: "info" | "warning" | "error"): void;

	/** Listen to raw terminal input (interactive mode only). Returns an unsubscribe function. */
	/** 监听原始终端输入（仅交互式模式）。返回一个取消订阅函数。 */
	onTerminalInput(handler: TerminalInputHandler): () => void;

	/** Set status text in the footer/status bar. Pass undefined to clear. */
	/** 设置页脚/状态栏中的状态文本。传入 undefined 可清除。 */
	setStatus(key: string, text: string | undefined): void;

	/** Set the working/loading message shown during streaming. Call with no argument to restore default. */
	/** 设置流式输出期间显示的工作/加载提示信息。不带参数调用可恢复默认值。 */
	setWorkingMessage(message?: string): void;

	/** Show or hide the built-in interactive working loader row during streaming. */
	/** 在流式输出期间显示或隐藏内置的交互式工作加载行。 */
	setWorkingVisible(visible: boolean): void;

	/**
	 * Configure the interactive working indicator shown during streaming.
	 * 配置流式输出期间显示的交互式工作指示器。
	 *
	 * - Omit the argument to restore the default animated spinner.
	 * - 省略该参数可恢复默认的动画加载图标。
	 * - Use `frames: ["●"]` for a static indicator.
	 * - 使用 `frames: ["●"]` 可得到静态指示器。
	 * - Use `frames: []` to hide the indicator entirely.
	 * - 使用 `frames: []` 可完全隐藏指示器。
	 * - Custom frames are rendered as provided, so extensions must add their own colors.
	 * - 自定义帧会按原样渲染，因此扩展必须自行添加颜色。
	 */
	setWorkingIndicator(options?: WorkingIndicatorOptions): void;

	/** Set the label shown for hidden thinking blocks. Call with no argument to restore default. */
	/** 设置隐藏的思考（thinking）块所显示的标签。不带参数调用可恢复默认值。 */
	setHiddenThinkingLabel(label?: string): void;

	/** Set a widget to display above or below the editor. Accepts string array or component factory. */
	/** 设置在编辑器上方或下方显示的挂件（widget）。接受字符串数组或组件工厂函数。 */
	setWidget(key: string, content: string[] | undefined, options?: ExtensionWidgetOptions): void;
	setWidget(
		key: string,
		content: ((tui: TUI, theme: Theme) => Component & { dispose?(): void }) | undefined,
		options?: ExtensionWidgetOptions,
	): void;

	/** Set a custom footer component, or undefined to restore the built-in footer.
	 * 设置自定义页脚组件，传入 undefined 可恢复内置页脚。
	 *
	 * The factory receives a FooterDataProvider for data not otherwise accessible:
	 * 工厂函数会接收一个 FooterDataProvider，用于获取其他途径无法访问的数据：
	 * git branch and extension statuses from setStatus(). Token stats, model info,
	 * 即 git 分支以及来自 setStatus() 的扩展状态。token 统计、模型信息等
	 * etc. are available via ctx.sessionManager and ctx.model.
	 * 可通过 ctx.sessionManager 和 ctx.model 获取。
	 */
	setFooter(
		factory:
			| ((tui: TUI, theme: Theme, footerData: ReadonlyFooterDataProvider) => Component & { dispose?(): void })
			| undefined,
	): void;

	/** Set a custom header component (shown at startup, above chat), or undefined to restore the built-in header. */
	/** 设置自定义页眉组件（在启动时显示于聊天内容上方），传入 undefined 可恢复内置页眉。 */
	setHeader(factory: ((tui: TUI, theme: Theme) => Component & { dispose?(): void }) | undefined): void;

	/** Set the terminal window/tab title. */
	/** 设置终端窗口/标签页的标题。 */
	setTitle(title: string): void;

	/** Show a custom component with keyboard focus. */
	/** 显示一个带键盘焦点的自定义组件。 */
	custom<T>(
		factory: (
			tui: TUI,
			theme: Theme,
			keybindings: KeybindingsManager,
			done: (result: T) => void,
		) => (Component & { dispose?(): void }) | Promise<Component & { dispose?(): void }>,
		options?: {
			overlay?: boolean;
			/** Overlay positioning/sizing options. Can be static or a function for dynamic updates. */
			/** 浮层（overlay）的定位/尺寸选项。可以是静态值，也可以是用于动态更新的函数。 */
			overlayOptions?: OverlayOptions | (() => OverlayOptions);
			/** Called with the overlay handle after the overlay is shown. Use to control visibility. */
			/** 浮层显示后会以浮层句柄为参数调用。可用于控制可见性。 */
			onHandle?: (handle: OverlayHandle) => void;
		},
	): Promise<T>;

	/** Paste text into the editor, triggering paste handling (collapse for large content). */
	/** 将文本粘贴到编辑器中，并触发粘贴处理逻辑（大段内容会被折叠）。 */
	pasteToEditor(text: string): void;

	/** Set the text in the core input editor. */
	/** 设置核心输入编辑器中的文本。 */
	setEditorText(text: string): void;

	/** Get the current text from the core input editor. */
	/** 获取核心输入编辑器中的当前文本。 */
	getEditorText(): string;

	/** Show a multi-line editor for text editing. */
	/** 显示一个用于文本编辑的多行编辑器。 */
	editor(title: string, prefill?: string): Promise<string | undefined>;

	/** Stack additional autocomplete behavior on top of the built-in provider. */
	/** 在内置提供器（provider）之上叠加额外的自动补全行为。 */
	addAutocompleteProvider(factory: AutocompleteProviderFactory): void;

	/**
	 * Set a custom editor component via factory function.
	 * 通过工厂函数设置自定义编辑器组件。
	 * Pass undefined to restore the default editor.
	 * 传入 undefined 可恢复默认编辑器。
	 *
	 * The factory receives:
	 * 工厂函数接收：
	 * - `theme`: EditorTheme for styling borders and autocomplete
	 * - `theme`：用于设置边框和自动补全样式的 EditorTheme
	 * - `keybindings`: KeybindingsManager for app-level keybindings
	 * - `keybindings`：用于应用级快捷键绑定的 KeybindingsManager
	 *
	 * For full app keybinding support (escape, ctrl+d, model switching, etc.),
	 * 若需完整的应用快捷键支持（escape、ctrl+d、切换模型等），
	 * extend `CustomEditor` from `@earendil-works/pi-coding-agent` and call
	 * 请继承 `@earendil-works/pi-coding-agent` 中的 `CustomEditor`，并对你未处理的按键调用
	 * `super.handleInput(data)` for keys you don't handle.
	 * `super.handleInput(data)`。
	 *
	 * @example
	 * ```ts
	 * import { CustomEditor } from "@earendil-works/pi-coding-agent";
	 *
	 * class VimEditor extends CustomEditor {
	 *   private mode: "normal" | "insert" = "insert";
	 *
	 *   handleInput(data: string): void {
	 *     if (this.mode === "normal") {
	 *       // Handle vim normal mode keys...
	 *       if (data === "i") { this.mode = "insert"; return; }
	 *     }
	 *     super.handleInput(data);  // App keybindings + text editing
	 *   }
	 * }
	 *
	 * ctx.ui.setEditorComponent((tui, theme, keybindings) =>
	 *   new VimEditor(tui, theme, keybindings)
	 * );
	 * ```
	 */
	setEditorComponent(factory: EditorFactory | undefined): void;

	/** Get the currently configured custom editor factory, or undefined when using the default editor. */
	/** 获取当前配置的自定义编辑器工厂函数；使用默认编辑器时返回 undefined。 */
	getEditorComponent(): EditorFactory | undefined;

	/** Get the current theme for styling. */
	/** 获取当前用于样式设置的主题（theme）。 */
	readonly theme: Theme;

	/** Get all available themes with their names and file paths. */
	/** 获取所有可用主题及其名称和文件路径。 */
	getAllThemes(): { name: string; path: string | undefined }[];

	/** Load a theme by name without switching to it. Returns undefined if not found. */
	/** 按名称加载主题但不切换到该主题。若未找到则返回 undefined。 */
	getTheme(name: string): Theme | undefined;

	/** Set the current theme by name or Theme object. */
	/** 通过名称或 Theme 对象设置当前主题。 */
	setTheme(theme: string | Theme): { success: boolean; error?: string };

	/** Get current tool output expansion state. */
	/** 获取工具（tool）输出的当前展开状态。 */
	getToolsExpanded(): boolean;

	/** Set tool output expansion state. */
	/** 设置工具（tool）输出的展开状态。 */
	setToolsExpanded(expanded: boolean): void;
}

// ============================================================================
// Extension Context
// 扩展（extension）上下文
// ============================================================================

export interface ContextUsage {
	/** Estimated context tokens, or null if unknown (e.g. right after compaction, before next LLM response). */
	/** 估算的上下文 token 数；未知时为 null（例如刚完成压缩后、下一次 LLM 响应之前）。 */
	tokens: number | null;
	contextWindow: number;
	/** Context usage as percentage of context window, or null if tokens is unknown. */
	/** 上下文占用量相对于上下文窗口的百分比；若 token 数未知则为 null。 */
	percent: number | null;
}

export interface CompactOptions {
	customInstructions?: string;
	onComplete?: (result: CompactionResult) => void;
	onError?: (error: Error) => void;
}

/**
 * Context passed to extension event handlers.
 * 传递给扩展事件处理器的上下文。
 */
export type ExtensionMode = "tui" | "rpc" | "json" | "print";

export interface ExtensionContext {
	/** UI methods for user interaction */
	/** 用于用户交互的 UI 方法 */
	ui: ExtensionUIContext;
	/** Current run mode. Use "tui" to guard terminal-only UI such as custom components. */
	/** 当前运行模式。可用 "tui" 来判断是否启用仅限终端的 UI（例如自定义组件）。 */
	mode: ExtensionMode;
	/** Whether dialog-capable UI is available (true in TUI and RPC modes) */
	/** 是否具备可弹出对话框的 UI（在 TUI 与 RPC 模式下为 true） */
	hasUI: boolean;
	/** Current working directory */
	/** 当前工作目录 */
	cwd: string;
	/** Session manager (read-only) */
	/** 会话管理器（只读） */
	sessionManager: ReadonlySessionManager;
	/** Model registry for API key resolution */
	/** 用于解析 API key 的模型注册表 */
	modelRegistry: ModelRegistry;
	/** Current model (may be undefined) */
	/** 当前模型（可能为 undefined） */
	model: Model<any> | undefined;
	/** Models scoped to this session (resolved from `--models` /
	 *  限定于本会话的模型集合（根据 `--models` /
	 *  `enabledModels` settings against the available catalogue). Same set
	 *  `enabledModels` 设置在可用模型目录中解析得到）。与
	 *  the `/scoped-models` command shows. Empty when no scoping is
	 *  `/scoped-models` 命令展示的集合相同。未配置任何限定范围时
	 *  configured (all available models are usable). Read-only snapshot.
	 *  为空（即所有可用模型均可使用）。为只读快照。 */
	scopedModels: readonly ScopedModel[];
	/** Current thinking level, when provided by the session runtime. */
	/** 当前思考（thinking）级别，由会话运行时提供时可用。 */
	thinkingLevel?: ThinkingLevel;
	/** Whether the agent is idle (not streaming) */
	/** agent 是否处于空闲状态（未在流式输出） */
	isIdle(): boolean;
	/** Whether project-local trust is active for this context. */
	/** 当前上下文是否已启用项目本地信任。 */
	isProjectTrusted(): boolean;
	/** The current abort signal, or undefined when the agent is not streaming. */
	/** 当前的中止信号（abort signal）；agent 未在流式输出时为 undefined。 */
	signal: AbortSignal | undefined;
	/** Abort the current agent operation */
	/** 中止当前的 agent 操作 */
	abort(): void;
	/** Whether there are queued messages waiting */
	/** 是否存在排队等待的消息 */
	hasPendingMessages(): boolean;
	/** Gracefully shutdown pi and exit. Available in all contexts. */
	/** 优雅地关闭 pi 并退出。在所有上下文中均可用。 */
	shutdown(): void;
	/** Get current context usage for the active model. */
	/** 获取当前活动模型的上下文占用情况。 */
	getContextUsage(): ContextUsage | undefined;
	/** Trigger compaction without awaiting completion. */
	/** 触发上下文压缩（compaction），不等待其完成。 */
	compact(options?: CompactOptions): void;
	/** Get the current effective system prompt. */
	/** 获取当前生效的系统提示词（system prompt）。 */
	getSystemPrompt(): string;
}

/**
 * Extended context for command handlers.
 * 供命令处理器使用的扩展上下文。
 * Includes session control methods only safe in user-initiated commands.
 * 包含仅在用户主动触发的命令中才安全使用的会话控制方法。
 */
export interface ExtensionCommandContext extends ExtensionContext {
	/** Get the current base system-prompt construction options. */
	/** 获取当前用于构建基础系统提示词的选项。 */
	getSystemPromptOptions(): BuildSystemPromptOptions;

	/** Wait for the agent to finish streaming */
	/** 等待 agent 完成流式输出 */
	waitForIdle(): Promise<void>;

	/** Start a new session, optionally with initialization. */
	/** 开启一个新会话，可选择同时进行初始化。 */
	newSession(options?: {
		parentSession?: string;
		setup?: (sessionManager: SessionManager) => Promise<void>;
		withSession?: (ctx: ReplacedSessionContext) => Promise<void>;
	}): Promise<{ cancelled: boolean }>;

	/** Fork from a specific entry, creating a new session file. */
	/** 从指定条目分叉（fork），创建一个新的会话文件。 */
	fork(
		entryId: string,
		options?: { position?: "before" | "at"; withSession?: (ctx: ReplacedSessionContext) => Promise<void> },
	): Promise<{ cancelled: boolean }>;

	/** Navigate to a different point in the session tree. */
	/** 导航到会话树中的另一个节点。 */
	navigateTree(
		targetId: string,
		options?: { summarize?: boolean; customInstructions?: string; replaceInstructions?: boolean; label?: string },
	): Promise<{ cancelled: boolean }>;

	/** Switch to a different session file. */
	/** 切换到另一个会话文件。 */
	switchSession(
		sessionPath: string,
		options?: { withSession?: (ctx: ReplacedSessionContext) => Promise<void> },
	): Promise<{ cancelled: boolean }>;

	/** Reload extensions, skills, prompts, themes, and context files. */
	/** 重新加载扩展、技能（skill）、提示词、主题以及上下文文件。 */
	reload(): Promise<void>;
}

/**
 * Fresh command-capable context bound to the replacement session after a session switch.
 * 会话切换后绑定到新会话的、可执行命令的全新上下文。
 *
 * This is passed to `withSession()` callbacks on `newSession()`, `fork()`, and `switchSession()`.
 * 它会传递给 `newSession()`、`fork()` 和 `switchSession()` 的 `withSession()` 回调。
 */
export interface ReplacedSessionContext extends ExtensionCommandContext {
	sendMessage<T = unknown>(
		message: Pick<CustomMessage<T>, "customType" | "content" | "display" | "details">,
		options?: { triggerTurn?: boolean; deliverAs?: "steer" | "followUp" | "nextTurn" },
	): Promise<void>;

	sendUserMessage(
		content: string | (TextContent | ImageContent)[],
		options?: { deliverAs?: "steer" | "followUp" },
	): Promise<void>;
}

// ============================================================================
// Tool Types
// 工具（tool）类型
// ============================================================================

/** Rendering options for tool results */
/** 工具（tool）结果的渲染选项 */
export interface ToolRenderResultOptions {
	/** Whether the result view is expanded */
	/** 结果视图是否处于展开状态 */
	expanded: boolean;
	/** Whether this is a partial/streaming result */
	/** 是否为部分/流式结果 */
	isPartial: boolean;
}

/** Context passed to tool renderers. */
/** 传递给工具（tool）渲染器的上下文。 */
export interface ToolRenderContext<TState = any, TArgs = any> {
	/** Current tool call arguments. Shared across call/result renders for the same tool call. */
	/** 当前工具调用的参数。同一次工具调用的 call/result 渲染之间共享。 */
	args: TArgs;
	/** Unique id for this tool execution. Stable across call/result renders for the same tool call. */
	/** 本次工具执行的唯一 id。同一次工具调用的 call/result 渲染之间保持不变。 */
	toolCallId: string;
	/** Invalidate just this tool execution component for redraw. */
	/** 仅将本次工具执行的组件标记为失效以触发重绘。 */
	invalidate: () => void;
	/** Previously returned component for this render slot, if any. */
	/** 该渲染槽位上一次返回的组件（若有）。 */
	lastComponent: Component | undefined;
	/** Shared renderer state for this tool row. Initialized by tool-execution.ts. */
	/** 该工具行的共享渲染器状态。由 tool-execution.ts 初始化。 */
	state: TState;
	/** Working directory for this tool execution. */
	/** 本次工具执行的工作目录。 */
	cwd: string;
	/** Whether the tool execution has started. */
	/** 工具执行是否已开始。 */
	executionStarted: boolean;
	/** Whether the tool call arguments are complete. */
	/** 工具调用参数是否已完整。 */
	argsComplete: boolean;
	/** Whether the tool result is partial/streaming. */
	/** 工具结果是否为部分/流式内容。 */
	isPartial: boolean;
	/** Whether the result view is expanded. */
	/** 结果视图是否处于展开状态。 */
	expanded: boolean;
	/** Whether inline images are currently shown in the TUI. */
	/** TUI 中当前是否显示内联图片。 */
	showImages: boolean;
	/** Whether the current result is an error. */
	/** 当前结果是否为错误。 */
	isError: boolean;
}

/**
 * Tool definition for registerTool().
 * 供 registerTool() 使用的工具（tool）定义。
 */
export interface ToolDefinition<TParams extends TSchema = TSchema, TDetails = unknown, TState = any> {
	/** Tool name (used in LLM tool calls) */
	/** 工具名称（用于 LLM 的工具调用） */
	name: string;
	/** Human-readable label for UI */
	/** 供 UI 显示的可读标签 */
	label: string;
	/** Description for LLM */
	/** 提供给 LLM 的描述 */
	description: string;
	/** Optional one-line snippet for the Available tools section in the default system prompt. Custom tools are omitted from that section when this is not provided. */
	/** 可选的单行片段，用于默认系统提示词中的 Available tools（可用工具）章节。未提供时，自定义工具不会出现在该章节中。 */
	promptSnippet?: string;
	/** Optional guideline bullets appended to the default system prompt Guidelines section when this tool is active. */
	/** 可选的指引条目；当该工具处于启用状态时，会追加到默认系统提示词的 Guidelines 章节。 */
	promptGuidelines?: string[];
	/** Parameter schema (TypeBox) */
	/** 参数模式定义（TypeBox） */
	parameters: TParams;
	/** Optional provider-side constrained sampling request for this tool. Set false to explicitly disable it, equivalent to leaving it undefined. */
	/** 可选的、针对该工具的提供方侧约束采样请求。设为 false 表示显式禁用，等同于不设置。 */
	constrainedSampling?: false | ConstrainedSamplingConfig;
	/** Controls whether ToolExecutionComponent renders the standard colored shell or the tool renders its own framing. */
	/** 控制由 ToolExecutionComponent 渲染标准着色外框，还是由工具自行渲染外框。 */
	renderShell?: "default" | "self";

	/** Optional compatibility shim to prepare raw tool call arguments before schema validation. Must return an object conforming to TParams. */
	/** 可选的兼容层，用于在模式校验前预处理原始工具调用参数。必须返回符合 TParams 的对象。 */
	prepareArguments?: (args: unknown) => Static<TParams>;

	/**
	 * Per-tool execution mode override.
	 * 针对单个工具的执行模式覆盖设置。
	 * - "sequential": this tool must execute one at a time with other tool calls.
	 * - "sequential"：该工具必须与其他工具调用串行执行，一次只能执行一个。
	 * - "parallel": this tool can execute concurrently with other tool calls.
	 * - "parallel"：该工具可以与其他工具调用并发执行。
	 *
	 * If omitted, the default execution mode applies.
	 * 若省略，则采用默认执行模式。
	 */
	executionMode?: ToolExecutionMode;

	/** Execute the tool. */
	/** 执行该工具。 */
	execute(
		toolCallId: string,
		params: Static<TParams>,
		signal: AbortSignal | undefined,
		onUpdate: AgentToolUpdateCallback<TDetails> | undefined,
		ctx: ExtensionContext,
	): Promise<AgentToolResult<TDetails>>;

	/** Custom rendering for tool call display */
	/** 工具调用展示的自定义渲染 */
	renderCall?: (args: Static<TParams>, theme: Theme, context: ToolRenderContext<TState, Static<TParams>>) => Component;

	/** Custom rendering for tool result display */
	/** 工具结果展示的自定义渲染 */
	renderResult?: (
		result: AgentToolResult<TDetails>,
		options: ToolRenderResultOptions,
		theme: Theme,
		context: ToolRenderContext<TState, Static<TParams>>,
	) => Component;
}

type AnyToolDefinition = ToolDefinition<any, any, any>;

/**
 * Preserve parameter inference for standalone tool definitions.
 * 为独立的工具（tool）定义保留参数类型推断。
 *
 * Use this when assigning a tool to a variable or passing it through arrays such
 * 当把工具赋值给变量，或通过 `customTools` 之类的数组传递时使用本函数，
 * as `customTools`, where contextual typing would otherwise widen params to
 * 否则上下文类型推断会把参数类型放宽为
 * `unknown`.
 * `unknown`。
 */
export function defineTool<TParams extends TSchema, TDetails = unknown, TState = any>(
	tool: ToolDefinition<TParams, TDetails, TState>,
): ToolDefinition<TParams, TDetails, TState> & AnyToolDefinition {
	return tool as ToolDefinition<TParams, TDetails, TState> & AnyToolDefinition;
}

// ============================================================================
// Startup/Resource Events
// 启动/资源事件
// ============================================================================

export interface ProjectTrustEvent {
	type: "project_trust";
	cwd: string;
}

export type ProjectTrustEventDecision = "yes" | "no" | "undecided";

export interface ProjectTrustEventResult {
	trusted: ProjectTrustEventDecision;
	remember?: boolean;
}

export interface ProjectTrustContext {
	cwd: string;
	mode: ExtensionMode;
	hasUI: boolean;
	ui: Pick<ExtensionUIContext, "select" | "confirm" | "input" | "notify">;
}

export type ProjectTrustHandler = (
	event: ProjectTrustEvent,
	ctx: ProjectTrustContext,
) => Promise<ProjectTrustEventResult> | ProjectTrustEventResult;

/** Fired after session_start to allow extensions to provide additional resource paths. */
/** 在 session_start 之后触发，允许扩展提供额外的资源路径。 */
export interface ResourcesDiscoverEvent {
	type: "resources_discover";
	cwd: string;
	reason: "startup" | "reload";
}

/** Result from resources_discover event handler */
/** resources_discover 事件处理器的返回结果 */
export interface ResourcesDiscoverResult {
	skillPaths?: string[];
	promptPaths?: string[];
	themePaths?: string[];
}

// ============================================================================
// Session Events
// 会话事件
// ============================================================================

/** Fired when a session is started, loaded, or reloaded */
/** 在会话被启动、加载或重新加载时触发 */
export interface SessionStartEvent {
	type: "session_start";
	/** Why this session start happened. */
	/** 本次会话启动的原因。 */
	reason: "startup" | "reload" | "new" | "resume" | "fork";
	/** Previously active session file. Present for "new", "resume", and "fork". */
	/** 先前处于活动状态的会话文件。在 "new"、"resume" 和 "fork" 情况下存在。 */
	previousSessionFile?: string;
}

/** Fired when the current session metadata changes. */
/** 在当前会话的元数据发生变化时触发。 */
export interface SessionInfoChangedEvent {
	type: "session_info_changed";
	/** Current normalized session name. Undefined when the name is cleared. */
	/** 当前规范化后的会话名称。名称被清除时为 undefined。 */
	name: string | undefined;
}

/** Fired before switching to another session (can be cancelled) */
/** 在切换到另一个会话之前触发（可被取消） */
export interface SessionBeforeSwitchEvent {
	type: "session_before_switch";
	reason: "new" | "resume";
	targetSessionFile?: string;
}

/** Fired before forking a session (can be cancelled) */
/** 在分叉（fork）会话之前触发（可被取消） */
export interface SessionBeforeForkEvent {
	type: "session_before_fork";
	entryId: string;
	position: "before" | "at";
}

/** Fired before context compaction (can be cancelled or customized) */
/** 在上下文压缩（compaction）之前触发（可被取消或自定义） */
export interface SessionBeforeCompactEvent {
	type: "session_before_compact";
	preparation: CompactionPreparation;
	branchEntries: SessionEntry[];
	customInstructions?: string;
	/** What triggered the compaction: manual /compact, the context threshold, or context overflow recovery */
	/** 触发本次压缩的原因：手动执行 /compact、达到上下文阈值，或上下文溢出恢复 */
	reason: "manual" | "threshold" | "overflow";
	/** True when the aborted turn is retried after this compaction (overflow recovery) */
	/** 若本次压缩后会重试被中止的回合（溢出恢复），则为 true */
	willRetry: boolean;
	signal: AbortSignal;
}

/** Fired after context compaction */
/** 在上下文压缩（compaction）之后触发 */
export interface SessionCompactEvent {
	type: "session_compact";
	compactionEntry: CompactionEntry;
	fromExtension: boolean;
	/** What triggered the compaction: manual /compact, the context threshold, or context overflow recovery */
	/** 触发本次压缩的原因：手动执行 /compact、达到上下文阈值，或上下文溢出恢复 */
	reason: "manual" | "threshold" | "overflow";
	/** True when the aborted turn is retried after this compaction (overflow recovery) */
	/** 若本次压缩后会重试被中止的回合（溢出恢复），则为 true */
	willRetry: boolean;
}

/** Fired before an extension runtime is torn down due to quit, reload, or session replacement. */
/** 在扩展运行时因退出、重新加载或会话替换而被销毁之前触发。 */
export interface SessionShutdownEvent {
	type: "session_shutdown";
	reason: "quit" | "reload" | "new" | "resume" | "fork";
	/** Destination session file when shutting down due to session replacement. */
	/** 因会话替换而关闭时的目标会话文件。 */
	targetSessionFile?: string;
}

/** Preparation data for tree navigation */
/** 会话树导航所需的准备数据 */
export interface TreePreparation {
	targetId: string;
	oldLeafId: string | null;
	commonAncestorId: string | null;
	entriesToSummarize: SessionEntry[];
	userWantsSummary: boolean;
	/** Custom instructions for summarization */
	/** 用于生成摘要的自定义指令 */
	customInstructions?: string;
	/** If true, customInstructions replaces the default prompt instead of being appended */
	/** 若为 true，则 customInstructions 会替换默认提示词，而不是追加在其后 */
	replaceInstructions?: boolean;
	/** Label to attach to the branch summary entry */
	/** 要附加到分支摘要条目上的标签 */
	label?: string;
}

/** Fired before navigating in the session tree (can be cancelled) */
/** 在会话树中导航之前触发（可被取消） */
export interface SessionBeforeTreeEvent {
	type: "session_before_tree";
	preparation: TreePreparation;
	signal: AbortSignal;
}

/** Fired after navigating in the session tree */
/** 在会话树中导航之后触发 */
export interface SessionTreeEvent {
	type: "session_tree";
	newLeafId: string | null;
	oldLeafId: string | null;
	summaryEntry?: BranchSummaryEntry;
	fromExtension?: boolean;
}

export type SessionEvent =
	| SessionStartEvent
	| SessionInfoChangedEvent
	| SessionBeforeSwitchEvent
	| SessionBeforeForkEvent
	| SessionBeforeCompactEvent
	| SessionCompactEvent
	| SessionShutdownEvent
	| SessionBeforeTreeEvent
	| SessionTreeEvent;

// ============================================================================
// Agent Events
// agent 事件
// ============================================================================

/** Fired before each LLM call. Can modify messages. */
/** 在每次调用 LLM 之前触发。可以修改消息。 */
export interface ContextEvent {
	type: "context";
	messages: AgentMessage[];
}

/** Fired before a provider request is sent. Can replace the payload. */
/** 在向提供方（provider）发送请求之前触发。可以替换请求负载。 */
export interface BeforeProviderRequestEvent {
	type: "before_provider_request";
	payload: unknown;
}

/**
 * Fired after request headers are assembled, before the provider HTTP call.
 * 在请求头组装完成之后、发起提供方（provider）HTTP 调用之前触发。
 * Handlers mutate `headers` in place (e.g. to inject tracing/session headers);
 * 处理器应就地修改 `headers`（例如注入链路追踪/会话相关的请求头）；
 * the return value is ignored. A `null` value deletes that header.
 * 返回值会被忽略。将某个值设为 `null` 会删除对应的请求头。
 */
export interface BeforeProviderHeadersEvent {
	type: "before_provider_headers";
	headers: ProviderHeaders;
}

/** Fired after a provider response is received and before the response stream is consumed. */
/** 在收到提供方（provider）响应之后、消费响应流之前触发。 */
export interface AfterProviderResponseEvent {
	type: "after_provider_response";
	status: number;
	headers: Record<string, string>;
}

/** Fired after user submits prompt but before agent loop. */
/** 在用户提交提示词之后、进入 agent 循环之前触发。 */
export interface BeforeAgentStartEvent {
	type: "before_agent_start";
	/** The raw user prompt text (after expansion). */
	/** 用户提示词的原始文本（展开之后）。 */
	prompt: string;
	/** Images attached to the user prompt, if any. */
	/** 随用户提示词附带的图片（若有）。 */
	images?: ImageContent[];
	/** The fully assembled system prompt string. */
	/** 完整组装好的系统提示词字符串。 */
	systemPrompt: string;
	/** Structured options used to build the system prompt. Extensions can inspect this to understand what Pi loaded without re-discovering resources. */
	/** 用于构建系统提示词的结构化选项。扩展可据此了解 Pi 加载了哪些内容，而无需重新发现资源。 */
	systemPromptOptions: BuildSystemPromptOptions;
}

/** Fired when an agent loop starts */
/** 在 agent 循环开始时触发 */
export interface AgentStartEvent {
	type: "agent_start";
}

/** Fired when an agent loop ends */
/** 在 agent 循环结束时触发 */
export interface AgentEndEvent {
	type: "agent_end";
	messages: AgentMessage[];
}

/** Fired after an agent run has fully settled and no automatic retry, compaction, or queued continuation will run. */
/** 在一次 agent 运行完全结束、且不会再有自动重试、上下文压缩或排队续跑时触发。 */
export interface AgentSettledEvent {
	type: "agent_settled";
}

/** Fired at the start of each turn */
/** 在每个回合（turn）开始时触发 */
export interface TurnStartEvent {
	type: "turn_start";
	turnIndex: number;
	timestamp: number;
}

/** Fired at the end of each turn */
/** 在每个回合（turn）结束时触发 */
export interface TurnEndEvent {
	type: "turn_end";
	turnIndex: number;
	message: AgentMessage;
	toolResults: ToolResultMessage[];
}

/** Fired when a message starts (user, assistant, or toolResult) */
/** 在一条消息开始时触发（user、assistant 或 toolResult） */
export interface MessageStartEvent {
	type: "message_start";
	message: AgentMessage;
}

/** Fired during assistant message streaming with token-by-token updates */
/** 在助手消息流式输出期间触发，逐 token 更新 */
export interface MessageUpdateEvent {
	type: "message_update";
	message: AgentMessage;
	assistantMessageEvent: AssistantMessageEvent;
}

/** Fired when a message ends */
/** 在一条消息结束时触发 */
export interface MessageEndEvent {
	type: "message_end";
	message: AgentMessage;
}

/** Fired when a tool starts executing */
/** 在工具（tool）开始执行时触发 */
export interface ToolExecutionStartEvent {
	type: "tool_execution_start";
	toolCallId: string;
	toolName: string;
	args: any;
}

/** Fired during tool execution with partial/streaming output */
/** 在工具（tool）执行过程中触发，携带部分/流式输出 */
export interface ToolExecutionUpdateEvent {
	type: "tool_execution_update";
	toolCallId: string;
	toolName: string;
	args: any;
	partialResult: any;
}

/** Fired when a tool finishes executing */
/** 在工具（tool）执行完成时触发 */
export interface ToolExecutionEndEvent {
	type: "tool_execution_end";
	toolCallId: string;
	toolName: string;
	result: any;
	isError: boolean;
}

// ============================================================================
// Model Events
// 模型事件
// ============================================================================

export type ModelSelectSource = "set" | "cycle" | "restore";

/** Fired when a new model is selected */
/** 在选择了新模型时触发 */
export interface ModelSelectEvent {
	type: "model_select";
	model: Model<any>;
	previousModel: Model<any> | undefined;
	source: ModelSelectSource;
}

/** Fired when a new thinking level is selected */
/** 在选择了新的思考（thinking）级别时触发 */
export interface ThinkingLevelSelectEvent {
	type: "thinking_level_select";
	level: ThinkingLevel;
	previousLevel: ThinkingLevel;
}

// ============================================================================
// User Bash Events
// 用户 bash 事件
// ============================================================================

/** Fired when user executes a bash command via ! or !! prefix */
/** 在用户通过 ! 或 !! 前缀执行 bash 命令时触发 */
export interface UserBashEvent {
	type: "user_bash";
	/** The command to execute */
	/** 待执行的命令 */
	command: string;
	/** True if !! prefix was used (excluded from LLM context) */
	/** 使用了 !! 前缀时为 true（该内容不会进入 LLM 上下文） */
	excludeFromContext: boolean;
	/** Current working directory */
	/** 当前工作目录 */
	cwd: string;
}

// ============================================================================
// Input Events
// 输入事件
// ============================================================================

/** Source of user input */
/** 用户输入的来源 */
export type InputSource = "interactive" | "rpc" | "extension";

/** Fired when user input is received, before agent processing */
/** 在接收到用户输入之后、agent 处理之前触发 */
export interface InputEvent {
	type: "input";
	/** The input text */
	/** 输入的文本 */
	text: string;
	/** Attached images, if any */
	/** 附带的图片（若有） */
	images?: ImageContent[];
	/** Where the input came from */
	/** 输入的来源 */
	source: InputSource;
	/** How the input will be delivered during streaming, or undefined when idle */
	/** 流式输出期间该输入的投递方式；空闲时为 undefined */
	streamingBehavior?: "steer" | "followUp";
}

/** Result from input event handler */
/** input 事件处理器的返回结果 */
export type InputEventResult =
	| { action: "continue" }
	| { action: "transform"; text: string; images?: ImageContent[] }
	| { action: "handled" };

// ============================================================================
// Tool Events
// 工具（tool）事件
// ============================================================================

interface ToolCallEventBase {
	type: "tool_call";
	toolCallId: string;
}

export interface BashToolCallEvent extends ToolCallEventBase {
	toolName: "bash";
	input: BashToolInput;
}

export interface ReadToolCallEvent extends ToolCallEventBase {
	toolName: "read";
	input: ReadToolInput;
}

export interface EditToolCallEvent extends ToolCallEventBase {
	toolName: "edit";
	input: EditToolInput;
}

export interface WriteToolCallEvent extends ToolCallEventBase {
	toolName: "write";
	input: WriteToolInput;
}

export interface GrepToolCallEvent extends ToolCallEventBase {
	toolName: "grep";
	input: GrepToolInput;
}

export interface FindToolCallEvent extends ToolCallEventBase {
	toolName: "find";
	input: FindToolInput;
}

export interface LsToolCallEvent extends ToolCallEventBase {
	toolName: "ls";
	input: LsToolInput;
}

export interface CustomToolCallEvent extends ToolCallEventBase {
	toolName: string;
	input: Record<string, unknown>;
}

/**
 * Fired before a tool executes. Can block.
 * 在工具（tool）执行之前触发。可以阻止执行。
 *
 * `event.input` is mutable. Mutate it in place to patch tool arguments before execution.
 * `event.input` 是可变的。可就地修改它，以便在执行前调整工具参数。
 * Later `tool_call` handlers see earlier mutations. No re-validation is performed after mutation.
 * 后续的 `tool_call` 处理器会看到先前的修改。修改后不会重新执行校验。
 */
export type ToolCallEvent =
	| BashToolCallEvent
	| ReadToolCallEvent
	| EditToolCallEvent
	| WriteToolCallEvent
	| GrepToolCallEvent
	| FindToolCallEvent
	| LsToolCallEvent
	| CustomToolCallEvent;

interface ToolResultEventBase {
	type: "tool_result";
	toolCallId: string;
	input: Record<string, unknown>;
	content: (TextContent | ImageContent)[];
	isError: boolean;
	/** Usage from the tool execution itself, if available. */
	/** 工具执行自身产生的用量（usage）信息（若可用）。 */
	usage?: Usage;
}

export interface BashToolResultEvent extends ToolResultEventBase {
	toolName: "bash";
	details: BashToolDetails | undefined;
}

export interface ReadToolResultEvent extends ToolResultEventBase {
	toolName: "read";
	details: ReadToolDetails | undefined;
}

export interface EditToolResultEvent extends ToolResultEventBase {
	toolName: "edit";
	details: EditToolDetails | undefined;
}

export interface WriteToolResultEvent extends ToolResultEventBase {
	toolName: "write";
	details: undefined;
}

export interface GrepToolResultEvent extends ToolResultEventBase {
	toolName: "grep";
	details: GrepToolDetails | undefined;
}

export interface FindToolResultEvent extends ToolResultEventBase {
	toolName: "find";
	details: FindToolDetails | undefined;
}

export interface LsToolResultEvent extends ToolResultEventBase {
	toolName: "ls";
	details: LsToolDetails | undefined;
}

export interface CustomToolResultEvent extends ToolResultEventBase {
	toolName: string;
	details: unknown;
}

/** Fired after a tool executes. Can modify result. */
/** 在工具（tool）执行之后触发。可以修改结果。 */
export type ToolResultEvent =
	| BashToolResultEvent
	| ReadToolResultEvent
	| EditToolResultEvent
	| WriteToolResultEvent
	| GrepToolResultEvent
	| FindToolResultEvent
	| LsToolResultEvent
	| CustomToolResultEvent;

// Type guards for ToolResultEvent
// ToolResultEvent 的类型守卫（type guard）
export function isBashToolResult(e: ToolResultEvent): e is BashToolResultEvent {
	return e.toolName === "bash";
}
export function isReadToolResult(e: ToolResultEvent): e is ReadToolResultEvent {
	return e.toolName === "read";
}
export function isEditToolResult(e: ToolResultEvent): e is EditToolResultEvent {
	return e.toolName === "edit";
}
export function isWriteToolResult(e: ToolResultEvent): e is WriteToolResultEvent {
	return e.toolName === "write";
}
export function isGrepToolResult(e: ToolResultEvent): e is GrepToolResultEvent {
	return e.toolName === "grep";
}
export function isFindToolResult(e: ToolResultEvent): e is FindToolResultEvent {
	return e.toolName === "find";
}
export function isLsToolResult(e: ToolResultEvent): e is LsToolResultEvent {
	return e.toolName === "ls";
}

/**
 * Type guard for narrowing ToolCallEvent by tool name.
 * 按工具名称收窄 ToolCallEvent 类型的类型守卫（type guard）。
 *
 * Built-in tools narrow automatically (no type params needed):
 * 内置工具会自动完成类型收窄（无需类型参数）：
 * ```ts
 * if (isToolCallEventType("bash", event)) {
 *   event.input.command;  // string
 * }
 * ```
 *
 * Custom tools require explicit type parameters:
 * 自定义工具则需要显式提供类型参数：
 * ```ts
 * if (isToolCallEventType<"my_tool", MyToolInput>("my_tool", event)) {
 *   event.input.action;  // typed
 * }
 * ```
 *
 * Note: Direct narrowing via `event.toolName === "bash"` doesn't work because
 * 注意：直接使用 `event.toolName === "bash"` 收窄类型是无效的，因为
 * CustomToolCallEvent.toolName is `string` which overlaps with all literals.
 * CustomToolCallEvent.toolName 的类型是 `string`，会与所有字面量类型重叠。
 */
export function isToolCallEventType(toolName: "bash", event: ToolCallEvent): event is BashToolCallEvent;
export function isToolCallEventType(toolName: "read", event: ToolCallEvent): event is ReadToolCallEvent;
export function isToolCallEventType(toolName: "edit", event: ToolCallEvent): event is EditToolCallEvent;
export function isToolCallEventType(toolName: "write", event: ToolCallEvent): event is WriteToolCallEvent;
export function isToolCallEventType(toolName: "grep", event: ToolCallEvent): event is GrepToolCallEvent;
export function isToolCallEventType(toolName: "find", event: ToolCallEvent): event is FindToolCallEvent;
export function isToolCallEventType(toolName: "ls", event: ToolCallEvent): event is LsToolCallEvent;
export function isToolCallEventType<TName extends string, TInput extends Record<string, unknown>>(
	toolName: TName,
	event: ToolCallEvent,
): event is ToolCallEvent & { toolName: TName; input: TInput };
export function isToolCallEventType(toolName: string, event: ToolCallEvent): boolean {
	return event.toolName === toolName;
}

/** Union of all event types */
/** 所有事件类型的联合类型 */
export type ExtensionEvent =
	| ProjectTrustEvent
	| ResourcesDiscoverEvent
	| SessionEvent
	| ContextEvent
	| BeforeProviderRequestEvent
	| BeforeProviderHeadersEvent
	| AfterProviderResponseEvent
	| BeforeAgentStartEvent
	| AgentStartEvent
	| AgentEndEvent
	| AgentSettledEvent
	| TurnStartEvent
	| TurnEndEvent
	| MessageStartEvent
	| MessageUpdateEvent
	| MessageEndEvent
	| ToolExecutionStartEvent
	| ToolExecutionUpdateEvent
	| ToolExecutionEndEvent
	| ModelSelectEvent
	| ThinkingLevelSelectEvent
	| UserBashEvent
	| InputEvent
	| ToolCallEvent
	| ToolResultEvent;

// ============================================================================
// Event Results
// 事件返回结果
// ============================================================================

export interface ContextEventResult {
	messages?: AgentMessage[];
}

export type BeforeProviderRequestEventResult = unknown;

export interface ToolCallEventResult {
	/** Block tool execution. To modify arguments, mutate `event.input` in place instead. */
	/** 阻止工具执行。若要修改参数，请改为就地修改 `event.input`。 */
	block?: boolean;
	reason?: string;
}

/** Result from user_bash event handler */
/** user_bash 事件处理器的返回结果 */
export interface UserBashEventResult {
	/** Custom operations to use for execution */
	/** 执行时要使用的自定义操作实现 */
	operations?: BashOperations;
	/** Full replacement: extension handled execution, use this result */
	/** 完全替换：扩展已自行完成执行，直接使用该结果 */
	result?: BashResult;
}

export interface ToolResultEventResult {
	content?: (TextContent | ImageContent)[];
	details?: unknown;
	isError?: boolean;
	usage?: Usage;
}

export interface MessageEndEventResult {
	/** Replace the finalized message. The replacement must keep the original message role. */
	/** 替换已定稿的消息。替换后的消息必须保持原有的消息角色（role）。 */
	message?: AgentMessage;
}

export interface BeforeAgentStartEventResult {
	message?: Pick<CustomMessage, "customType" | "content" | "display" | "details">;
	/** Replace the system prompt for this turn. If multiple extensions return this, they are chained. */
	/** 替换本回合的系统提示词。若多个扩展都返回该字段，则会依次串联生效。 */
	systemPrompt?: string;
}

export interface SessionBeforeSwitchResult {
	cancel?: boolean;
}

export interface SessionBeforeForkResult {
	cancel?: boolean;
	skipConversationRestore?: boolean;
}

export interface SessionBeforeCompactResult {
	cancel?: boolean;
	compaction?: CompactionResult;
}

export interface SessionBeforeTreeResult {
	cancel?: boolean;
	summary?: {
		summary: string;
		details?: unknown;
		usage?: Usage;
	};
	/** Override custom instructions for summarization */
	/** 覆盖用于生成摘要的自定义指令 */
	customInstructions?: string;
	/** Override whether customInstructions replaces the default prompt */
	/** 覆盖 customInstructions 是否替换默认提示词的设置 */
	replaceInstructions?: boolean;
	/** Override label to attach to the branch summary entry */
	/** 覆盖要附加到分支摘要条目上的标签 */
	label?: string;
}

// ============================================================================
// Message and Entry Rendering
// 消息与条目渲染
// ============================================================================

export interface MessageRenderOptions {
	expanded: boolean;
	/** Horizontal padding configured by the outputPad setting. */
	/** 由 outputPad 设置项配置的水平内边距。 */
	outputPad: number;
}

export interface MarkdownTransformContext {
	messageType: "user" | "assistant" | "assistant-thinking";
	isStreaming: boolean;
	availableWidth: number;
}

export type MarkdownTransformer = (markdown: string, context: MarkdownTransformContext) => string;

export interface EntryRenderOptions {
	expanded: boolean;
}

export type MessageRenderer<T = unknown> = (
	message: CustomMessage<T>,
	options: MessageRenderOptions,
	theme: Theme,
) => Component | undefined;

export type EntryRenderer<T = unknown> = (
	entry: CustomEntry<T>,
	options: EntryRenderOptions,
	theme: Theme,
) => Component | undefined;

// ============================================================================
// Command Registration
// 命令注册
// ============================================================================

export interface RegisteredCommand {
	name: string;
	sourceInfo: SourceInfo;
	description?: string;
	getArgumentCompletions?: (argumentPrefix: string) => AutocompleteItem[] | null | Promise<AutocompleteItem[] | null>;
	handler: (args: string, ctx: ExtensionCommandContext) => Promise<void>;
}

export interface ResolvedCommand extends RegisteredCommand {
	invocationName: string;
}

// ============================================================================
// Extension API
// 扩展 API
// ============================================================================

/** Handler function type for events */
/** 事件处理器函数类型 */
// biome-ignore lint/suspicious/noConfusingVoidType: void allows bare return statements
export type ExtensionHandler<E, R = undefined> = (event: E, ctx: ExtensionContext) => Promise<R | void> | R | void;

/**
 * ExtensionAPI passed to extension factory functions.
 * 传递给扩展工厂函数的 ExtensionAPI。
 */
export interface ExtensionAPI {
	// =========================================================================
	// Event Subscription
	// 事件订阅
	// =========================================================================

	on(event: "project_trust", handler: ProjectTrustHandler): void;
	on(event: "resources_discover", handler: ExtensionHandler<ResourcesDiscoverEvent, ResourcesDiscoverResult>): void;
	on(event: "session_start", handler: ExtensionHandler<SessionStartEvent>): void;
	on(event: "session_info_changed", handler: ExtensionHandler<SessionInfoChangedEvent>): void;
	on(
		event: "session_before_switch",
		handler: ExtensionHandler<SessionBeforeSwitchEvent, SessionBeforeSwitchResult>,
	): void;
	on(event: "session_before_fork", handler: ExtensionHandler<SessionBeforeForkEvent, SessionBeforeForkResult>): void;
	on(
		event: "session_before_compact",
		handler: ExtensionHandler<SessionBeforeCompactEvent, SessionBeforeCompactResult>,
	): void;
	on(event: "session_compact", handler: ExtensionHandler<SessionCompactEvent>): void;
	on(event: "session_shutdown", handler: ExtensionHandler<SessionShutdownEvent>): void;
	on(event: "session_before_tree", handler: ExtensionHandler<SessionBeforeTreeEvent, SessionBeforeTreeResult>): void;
	on(event: "session_tree", handler: ExtensionHandler<SessionTreeEvent>): void;
	on(event: "context", handler: ExtensionHandler<ContextEvent, ContextEventResult>): void;
	on(
		event: "before_provider_request",
		handler: ExtensionHandler<BeforeProviderRequestEvent, BeforeProviderRequestEventResult>,
	): void;
	on(event: "before_provider_headers", handler: ExtensionHandler<BeforeProviderHeadersEvent>): void;
	on(event: "after_provider_response", handler: ExtensionHandler<AfterProviderResponseEvent>): void;
	on(event: "before_agent_start", handler: ExtensionHandler<BeforeAgentStartEvent, BeforeAgentStartEventResult>): void;
	on(event: "agent_start", handler: ExtensionHandler<AgentStartEvent>): void;
	on(event: "agent_end", handler: ExtensionHandler<AgentEndEvent>): void;
	on(event: "agent_settled", handler: ExtensionHandler<AgentSettledEvent>): void;
	on(event: "turn_start", handler: ExtensionHandler<TurnStartEvent>): void;
	on(event: "turn_end", handler: ExtensionHandler<TurnEndEvent>): void;
	on(event: "message_start", handler: ExtensionHandler<MessageStartEvent>): void;
	on(event: "message_update", handler: ExtensionHandler<MessageUpdateEvent>): void;
	on(event: "message_end", handler: ExtensionHandler<MessageEndEvent, MessageEndEventResult>): void;
	on(event: "tool_execution_start", handler: ExtensionHandler<ToolExecutionStartEvent>): void;
	on(event: "tool_execution_update", handler: ExtensionHandler<ToolExecutionUpdateEvent>): void;
	on(event: "tool_execution_end", handler: ExtensionHandler<ToolExecutionEndEvent>): void;
	on(event: "model_select", handler: ExtensionHandler<ModelSelectEvent>): void;
	on(event: "thinking_level_select", handler: ExtensionHandler<ThinkingLevelSelectEvent>): void;
	on(event: "tool_call", handler: ExtensionHandler<ToolCallEvent, ToolCallEventResult>): void;
	on(event: "tool_result", handler: ExtensionHandler<ToolResultEvent, ToolResultEventResult>): void;
	on(event: "user_bash", handler: ExtensionHandler<UserBashEvent, UserBashEventResult>): void;
	on(event: "input", handler: ExtensionHandler<InputEvent, InputEventResult>): void;

	// =========================================================================
	// Tool Registration
	// 工具（tool）注册
	// =========================================================================

	/** Register a tool that the LLM can call. */
	/** 注册一个可供 LLM 调用的工具。 */
	registerTool<TParams extends TSchema = TSchema, TDetails = unknown, TState = any>(
		tool: ToolDefinition<TParams, TDetails, TState>,
	): void;

	// =========================================================================
	// Command, Shortcut, Flag Registration
	// 命令、快捷键与命令行标志的注册
	// =========================================================================

	/** Register a custom command. */
	/** 注册一个自定义命令。 */
	registerCommand(name: string, options: Omit<RegisteredCommand, "name" | "sourceInfo">): void;

	/** Register a keyboard shortcut. */
	/** 注册一个键盘快捷键。 */
	registerShortcut(
		shortcut: KeyId,
		options: {
			description?: string;
			handler: (ctx: ExtensionContext) => Promise<void> | void;
		},
	): void;

	/** Register a CLI flag. */
	/** 注册一个 CLI 命令行标志。 */
	registerFlag(
		name: string,
		options: {
			description?: string;
			type: "boolean" | "string";
			default?: boolean | string;
		},
	): void;

	/** Get the value of a registered CLI flag. */
	/** 获取某个已注册 CLI 命令行标志的值。 */
	getFlag(name: string): boolean | string | undefined;

	// =========================================================================
	// Message Rendering
	// 消息渲染
	// =========================================================================

	/** Register a custom renderer for CustomMessageEntry. */
	/** 为 CustomMessageEntry 注册自定义渲染器。 */
	registerMessageRenderer<T = unknown>(customType: string, renderer: MessageRenderer<T>): void;

	/** Register a transformer for user and assistant Markdown before Pi renders it in the interactive transcript. */
	/** 注册一个转换器，在 Pi 于交互式对话记录中渲染用户与助手的 Markdown 之前对其进行处理。 */
	registerMarkdownTransformer(transformer: MarkdownTransformer): void;

	/** Register a custom renderer for CustomEntry. Custom entries do not participate in LLM context. */
	/** 为 CustomEntry 注册自定义渲染器。自定义条目不会参与 LLM 上下文。 */
	registerEntryRenderer<T = unknown>(customType: string, renderer: EntryRenderer<T>): void;

	// =========================================================================
	// Actions
	// 动作
	// =========================================================================

	/** Send a custom message to the session. */
	/** 向会话发送一条自定义消息。 */
	sendMessage<T = unknown>(
		message: Pick<CustomMessage<T>, "customType" | "content" | "display" | "details">,
		options?: { triggerTurn?: boolean; deliverAs?: "steer" | "followUp" | "nextTurn" },
	): void;

	/**
	 * Send a user message to the agent. Always triggers a turn.
	 * 向 agent 发送一条用户消息。总会触发一个回合（turn）。
	 * When the agent is streaming, use deliverAs to specify how to queue the message.
	 * 当 agent 正在流式输出时，可用 deliverAs 指定该消息的排队方式。
	 */
	sendUserMessage(
		content: string | (TextContent | ImageContent)[],
		options?: { deliverAs?: "steer" | "followUp" },
	): void;

	/** Append a custom entry to the session for state persistence (not sent to LLM). */
	/** 向会话追加一条自定义条目以持久化状态（不会发送给 LLM）。 */
	appendEntry<T = unknown>(customType: string, data?: T): void;

	// =========================================================================
	// Session Metadata
	// 会话元数据
	// =========================================================================

	/** Set the session display name (shown in session selector). */
	/** 设置会话的显示名称（在会话选择器中展示）。 */
	setSessionName(name: string): void;

	/** Get the current session name, if set. */
	/** 获取当前会话名称（若已设置）。 */
	getSessionName(): string | undefined;

	/** Set or clear a label on an entry. Labels are user-defined markers for bookmarking/navigation. */
	/** 为条目设置或清除标签。标签是用户自定义的标记，用于书签/导航。 */
	setLabel(entryId: string, label: string | undefined): void;

	/** Execute a shell command. */
	/** 执行一条 shell 命令。 */
	exec(command: string, args: string[], options?: ExecOptions): Promise<ExecResult>;

	/** Get the list of currently active tool names. */
	/** 获取当前处于启用状态的工具（tool）名称列表。 */
	getActiveTools(): string[];

	/** Get all configured tools with parameter schema, prompt guidelines, and source metadata. */
	/** 获取所有已配置的工具，包含参数模式、提示词指引和来源元数据。 */
	getAllTools(): ToolInfo[];

	/** Set the active tools by name. */
	/** 按名称设置处于启用状态的工具。 */
	setActiveTools(toolNames: string[]): void;

	/** Get available slash commands in the current session. */
	/** 获取当前会话中可用的斜杠命令。 */
	getCommands(): SlashCommandInfo[];

	// =========================================================================
	// Model and Thinking Level
	// 模型与思考（thinking）级别
	// =========================================================================

	/** Set the current model. Returns false if no API key available. */
	/** 设置当前模型。若没有可用的 API key 则返回 false。 */
	setModel(model: Model<any>): Promise<boolean>;

	/** Get current thinking level. */
	/** 获取当前的思考（thinking）级别。 */
	getThinkingLevel(): ThinkingLevel;

	/** Set thinking level (clamped to model capabilities). */
	/** 设置思考（thinking）级别（会被限制在模型能力范围内）。 */
	setThinkingLevel(level: ThinkingLevel): void;

	// =========================================================================
	// Provider Registration
	// 提供方（provider）注册
	// =========================================================================

	/**
	 * Register or override a model provider.
	 * 注册或覆盖一个模型提供方（provider）。
	 *
	 * If `models` is provided: replaces all existing models for this provider.
	 * 若提供了 `models`：将替换该提供方现有的全部模型。
	 * If only `baseUrl` is provided: overrides the URL for existing models.
	 * 若仅提供了 `baseUrl`：将覆盖现有模型使用的 URL。
	 * If `oauth` is provided: registers OAuth provider for /login support.
	 * 若提供了 `oauth`：将注册 OAuth 提供方以支持 /login。
	 * If `streamSimple` is provided: registers a custom API stream handler.
	 * 若提供了 `streamSimple`：将注册一个自定义 API 流处理器。
	 *
	 * During initial extension load this call is queued and applied once the
	 * 在扩展初次加载期间，该调用会被排队，待 runner 绑定其上下文后再应用。
	 * runner has bound its context. After that it takes effect immediately, so
	 * 此后调用会立即生效，因此可以安全地在命令处理器或事件回调中调用，
	 * it is safe to call from command handlers or event callbacks without
	 * 而无需执行
	 * requiring a `/reload`.
	 * `/reload`。
	 *
	 * @example
	 * // Register a new provider with custom models
	 * // 注册一个带自定义模型的新提供方（provider）
	 * pi.registerProvider("my-proxy", {
	 *   baseUrl: "https://proxy.example.com",
	 *   apiKey: "$PROXY_API_KEY",
	 *   api: "anthropic-messages",
	 *   models: [
	 *     {
	 *       id: "claude-sonnet-4-20250514",
	 *       name: "Claude 4 Sonnet (proxy)",
	 *       reasoning: false,
	 *       input: ["text", "image"],
	 *       cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	 *       contextWindow: 200000,
	 *       maxTokens: 16384
	 *     }
	 *   ]
	 * });
	 *
	 * @example
	 * // Override baseUrl for an existing provider
	 * // 覆盖某个现有提供方（provider）的 baseUrl
	 * pi.registerProvider("anthropic", {
	 *   baseUrl: "https://proxy.example.com"
	 * });
	 *
	 * @example
	 * // Register provider with OAuth support
	 * // 注册一个支持 OAuth 的提供方（provider）
	 * pi.registerProvider("corporate-ai", {
	 *   baseUrl: "https://ai.corp.com",
	 *   api: "openai-responses",
	 *   models: [...],
	 *   oauth: {
	 *     name: "Corporate AI (SSO)",
	 *     async login(callbacks) { ... },
	 *     async refreshToken(credentials) { ... },
	 *     getApiKey(credentials) { return credentials.access; }
	 *   }
	 * });
	 */
	registerProvider(provider: Provider): void;
	registerProvider(name: string, config: ProviderConfig): void;

	/**
	 * Unregister a previously registered provider.
	 * 注销先前注册的提供方（provider）。
	 *
	 * Removes all models belonging to the named provider and restores any
	 * 会移除属于该提供方的所有模型，并恢复此前被其覆盖的
	 * built-in models that were overridden by it. Has no effect if the provider
	 * 内置模型。若该提供方当前并未注册，则该调用无任何效果。
	 * is not currently registered.
	 *
	 * Like `registerProvider`, this takes effect immediately when called after
	 * 与 `registerProvider` 一样，在初始加载阶段之后调用时会立即生效。
	 * the initial load phase.
	 *
	 * @example
	 * pi.unregisterProvider("my-proxy");
	 */
	unregisterProvider(name: string): void;

	/** Shared event bus for extension communication. */
	/** 供扩展之间通信的共享事件总线。 */
	events: EventBus;
}

// ============================================================================
// Provider Registration Types
// 提供方（provider）注册相关类型
// ============================================================================

/** Configuration for registering a provider via pi.registerProvider(). */
/** 通过 pi.registerProvider() 注册提供方（provider）时使用的配置。 */
export interface ProviderConfig {
	/** Display name for the provider in UI. */
	/** 该提供方在 UI 中显示的名称。 */
	name?: string;
	/** Base URL for the API endpoint. Required when defining models. */
	/** API 端点的基础 URL。定义模型时必填。 */
	baseUrl?: string;
	/** API key literal, env interpolation ($ENV_VAR or ${ENV_VAR}), or leading !command. Required when defining models (unless oauth provided). */
	/** API key 字面量、环境变量插值（$ENV_VAR 或 ${ENV_VAR}），或以 ! 开头的命令。定义模型时必填（除非已提供 oauth）。 */
	apiKey?: string;
	/** API type. Required at provider or model level when defining models. */
	/** API 类型。定义模型时须在提供方或模型级别指定。 */
	api?: Api;
	/** Optional streamSimple handler for custom APIs. */
	/** 面向自定义 API 的可选 streamSimple 处理器。 */
	streamSimple?: (model: Model<Api>, context: Context, options?: SimpleStreamOptions) => AssistantMessageEventStream;
	/** Custom headers to include in requests. */
	/** 请求中要携带的自定义请求头。 */
	headers?: Record<string, string>;
	/** If true, adds Authorization: Bearer header with the resolved API key. */
	/** 若为 true，会使用解析出的 API key 添加 Authorization: Bearer 请求头。 */
	authHeader?: boolean;
	/** Models to register. If provided, replaces all existing models for this provider. */
	/** 要注册的模型。若提供，则会替换该提供方现有的全部模型。 */
	models?: ProviderModelConfig[];
	/**
	 * Refresh this provider's model list. The returned list replaces extension-provided models.
	 * 刷新该提供方的模型列表。返回的列表会替换由扩展提供的模型。
	 * Use context.store explicitly when the catalog should persist across sessions.
	 * 若希望模型目录跨会话持久化，请显式使用 context.store。
	 */
	refreshModels?(context: RefreshModelsContext): Promise<ProviderModelConfig[]>;
	/** OAuth provider for /login support. The `id` is set automatically from the provider name. */
	/** 用于支持 /login 的 OAuth 提供方。`id` 会依据提供方名称自动设置。 */
	oauth?: {
		/** Display name for the provider in login UI. */
		/** 该提供方在登录 UI 中显示的名称。 */
		name: string;
		/** @deprecated Retained for source compatibility; canonical auth flows ignore it. */
		/** @deprecated 仅为源码兼容性保留；标准认证流程会忽略该字段。 */
		usesCallbackServer?: boolean;
		/** Run the login flow, return credentials to persist. */
		/** 执行登录流程，返回需要持久化的凭据。 */
		login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials>;
		/** Refresh expired credentials, return updated credentials to persist. */
		/** 刷新已过期的凭据，返回需要持久化的新凭据。 */
		refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials>;
		/** Convert credentials to API key string for the provider. */
		/** 将凭据转换为该提供方所需的 API key 字符串。 */
		getApiKey(credentials: OAuthCredentials): string;
		/** Legacy synchronous credential-dependent model projection. */
		/** 遗留的同步式、依赖凭据的模型投影方法。 */
		modifyModels?(models: Model<Api>[], credentials: OAuthCredentials): Model<Api>[];
	};
}

/** Configuration for a model within a provider. */
/** 提供方（provider）内单个模型的配置。 */
export interface ProviderModelConfig {
	/** Model ID (e.g., "claude-sonnet-4-20250514"). */
	/** 模型 ID（例如 "claude-sonnet-4-20250514"）。 */
	id: string;
	/** Display name (e.g., "Claude 4 Sonnet"). */
	/** 显示名称（例如 "Claude 4 Sonnet"）。 */
	name: string;
	/** API type override for this model. */
	/** 针对该模型的 API 类型覆盖设置。 */
	api?: Api;
	/** API endpoint URL override for this model. */
	/** 针对该模型的 API 端点 URL 覆盖设置。 */
	baseUrl?: string;
	/** Whether the model supports extended thinking. */
	/** 该模型是否支持扩展思考（extended thinking）。 */
	reasoning: boolean;
	/** Maps pi thinking levels to provider/model-specific values; null marks a level unsupported. */
	/** 将 pi 的思考（thinking）级别映射为提供方/模型特定的取值；null 表示该级别不受支持。 */
	thinkingLevelMap?: Model<Api>["thinkingLevelMap"];
	/** Supported input types. */
	/** 支持的输入类型。 */
	input: ("text" | "image")[];
	/** Per-million-token cost rates and optional request-wide input pricing tiers. */
	/** 每百万 token 的费率，以及可选的请求级输入定价阶梯。 */
	cost: Model<Api>["cost"];
	/** Maximum context window size in tokens. */
	/** 上下文窗口的最大大小（以 token 计）。 */
	contextWindow: number;
	/** Maximum output tokens. */
	/** 最大输出 token 数。 */
	maxTokens: number;
	/** Custom headers for this model. */
	/** 该模型专用的自定义请求头。 */
	headers?: Record<string, string>;
	/** OpenAI compatibility settings. */
	/** OpenAI 兼容性设置。 */
	compat?: Model<Api>["compat"];
}

/** Extension factory function type. Supports both sync and async initialization. */
/** 扩展工厂函数类型。同时支持同步与异步初始化。 */
export type ExtensionFactory = (pi: ExtensionAPI) => void | Promise<void>;

export type InlineExtension =
	| ExtensionFactory
	| {
			/** Display name shown as `<inline:name>` in the startup Extensions list. */
			/** 在启动时的扩展列表中以 `<inline:name>` 形式显示的名称。 */
			name: string;
			factory: ExtensionFactory;
			/** Omit this extension from the startup Extensions list. */
			/** 在启动时的扩展列表中隐藏该扩展。 */
			hidden?: boolean;
	  };

// ============================================================================
// Loaded Extension Types
// 已加载扩展的相关类型
// ============================================================================

export interface RegisteredTool {
	definition: ToolDefinition;
	sourceInfo: SourceInfo;
}

export interface ExtensionFlag {
	name: string;
	description?: string;
	type: "boolean" | "string";
	default?: boolean | string;
	extensionPath: string;
}

export interface ExtensionShortcut {
	shortcut: KeyId;
	description?: string;
	handler: (ctx: ExtensionContext) => Promise<void> | void;
	extensionPath: string;
}

type HandlerFn = (...args: unknown[]) => Promise<unknown>;

export type SendMessageHandler = <T = unknown>(
	message: Pick<CustomMessage<T>, "customType" | "content" | "display" | "details">,
	options?: { triggerTurn?: boolean; deliverAs?: "steer" | "followUp" | "nextTurn" },
) => void;

export type SendUserMessageHandler = (
	content: string | (TextContent | ImageContent)[],
	options?: { deliverAs?: "steer" | "followUp" },
) => void;

export type AppendEntryHandler = <T = unknown>(customType: string, data?: T) => void;

export type SetSessionNameHandler = (name: string) => void;

export type GetSessionNameHandler = () => string | undefined;

export type GetActiveToolsHandler = () => string[];

/** Tool info with name, description, parameter schema, prompt guidelines, and source metadata. */
/** 工具（tool）信息，包含名称、描述、参数模式、提示词指引和来源元数据。 */
export type ToolInfo = Pick<ToolDefinition, "name" | "description" | "parameters" | "promptGuidelines"> & {
	sourceInfo: SourceInfo;
};

export type GetAllToolsHandler = () => ToolInfo[];

export type GetCommandsHandler = () => SlashCommandInfo[];

export type SetActiveToolsHandler = (toolNames: string[]) => void;

export type RefreshToolsHandler = () => void;

export type SetModelHandler = (model: Model<any>) => Promise<boolean>;

export type GetThinkingLevelHandler = () => ThinkingLevel;

export type SetThinkingLevelHandler = (level: ThinkingLevel) => void;

export type SetLabelHandler = (entryId: string, label: string | undefined) => void;

/**
 * Shared state created by loader, used during registration and runtime.
 * 由加载器（loader）创建的共享状态，在注册阶段与运行时均会使用。
 * Contains flag values (defaults set during registration, CLI values set after).
 * 其中包含命令行标志的取值（注册阶段设置默认值，之后再写入 CLI 传入的值）。
 */
export interface ExtensionRuntimeState {
	flagValues: Map<string, boolean | string>;
	/** Legacy provider-config registrations queued during extension loading, processed when runner binds. */
	/** 扩展加载期间排队的遗留 provider-config 注册项，在 runner 绑定时处理。 */
	pendingProviderRegistrations: Array<{ name: string; config: ProviderConfig; extensionPath: string }>;
	/** Native pi-ai provider registrations queued during extension loading, processed when runner binds. */
	/** 扩展加载期间排队的原生 pi-ai 提供方注册项，在 runner 绑定时处理。 */
	pendingNativeProviderRegistrations: Array<{ provider: Provider; extensionPath: string }>;
	/** Throws when this extension instance is stale after runtime replacement. */
	/** 当该扩展实例在运行时被替换后已失效时抛出异常。 */
	assertActive: () => void;
	/** Marks this extension instance as stale after runtime replacement or reload. */
	/** 在运行时被替换或重新加载后，将该扩展实例标记为已失效。 */
	invalidate: (message?: string) => void;
	/**
	 * Register or unregister a provider.
	 * 注册或注销一个提供方（provider）。
	 *
	 * Before bindCore(): queues registrations / removes from queue.
	 * 在 bindCore() 之前：将注册操作排队 / 从队列中移除。
	 * After bindCore(): calls ModelRegistry directly for immediate effect.
	 * 在 bindCore() 之后：直接调用 ModelRegistry，使其立即生效。
	 */
	registerProvider: (name: string, config: ProviderConfig, extensionPath?: string) => void;
	registerNativeProvider: (provider: Provider, extensionPath?: string) => void;
	unregisterProvider: (name: string, extensionPath?: string) => void;
}

/**
 * Action implementations for pi.* API methods.
 * pi.* API 方法的动作实现。
 * Provided to runner.initialize(), copied into the shared runtime.
 * 提供给 runner.initialize()，并被复制到共享运行时中。
 */
export interface ExtensionActions {
	sendMessage: SendMessageHandler;
	sendUserMessage: SendUserMessageHandler;
	appendEntry: AppendEntryHandler;
	setSessionName: SetSessionNameHandler;
	getSessionName: GetSessionNameHandler;
	setLabel: SetLabelHandler;
	getActiveTools: GetActiveToolsHandler;
	getAllTools: GetAllToolsHandler;
	setActiveTools: SetActiveToolsHandler;
	refreshTools: RefreshToolsHandler;
	getCommands: GetCommandsHandler;
	setModel: SetModelHandler;
	getThinkingLevel: GetThinkingLevelHandler;
	setThinkingLevel: SetThinkingLevelHandler;
}

/**
 * Actions for ExtensionContext (ctx.* in event handlers).
 * 供 ExtensionContext 使用的动作实现（即事件处理器中的 ctx.*）。
 * Required by all modes.
 * 所有模式都必须提供。
 */
export interface ExtensionContextActions {
	getModel: () => Model<any> | undefined;
	getScopedModels: () => readonly ScopedModel[];
	isIdle: () => boolean;
	isProjectTrusted: () => boolean;
	getSignal: () => AbortSignal | undefined;
	abort: () => void;
	hasPendingMessages: () => boolean;
	shutdown: () => void;
	getContextUsage: () => ContextUsage | undefined;
	compact: (options?: CompactOptions) => void;
	getSystemPrompt: () => string;
	getSystemPromptOptions?: () => BuildSystemPromptOptions;
}

/**
 * Actions for ExtensionCommandContext (ctx.* in command handlers).
 * 供 ExtensionCommandContext 使用的动作实现（即命令处理器中的 ctx.*）。
 * Only needed for interactive mode where extension commands are invokable.
 * 仅在可调用扩展命令的交互式模式下才需要。
 */
export interface ExtensionCommandContextActions {
	waitForIdle: () => Promise<void>;
	newSession: (options?: {
		parentSession?: string;
		setup?: (sessionManager: SessionManager) => Promise<void>;
		withSession?: (ctx: ReplacedSessionContext) => Promise<void>;
	}) => Promise<{ cancelled: boolean }>;
	fork: (
		entryId: string,
		options?: { position?: "before" | "at"; withSession?: (ctx: ReplacedSessionContext) => Promise<void> },
	) => Promise<{ cancelled: boolean }>;
	navigateTree: (
		targetId: string,
		options?: { summarize?: boolean; customInstructions?: string; replaceInstructions?: boolean; label?: string },
	) => Promise<{ cancelled: boolean }>;
	switchSession: (
		sessionPath: string,
		options?: { withSession?: (ctx: ReplacedSessionContext) => Promise<void> },
	) => Promise<{ cancelled: boolean }>;
	reload: () => Promise<void>;
}

/**
 * Full runtime = state + actions.
 * 完整运行时 = 状态 + 动作。
 * Created by loader with throwing action stubs, completed by runner.initialize().
 * 由加载器（loader）创建，初始动作为会抛异常的存根，随后由 runner.initialize() 补全。
 */
export interface ExtensionRuntime extends ExtensionRuntimeState, ExtensionActions {}

/** Loaded extension with all registered items. */
/** 已加载的扩展，包含其注册的全部项。 */
export interface Extension {
	path: string;
	resolvedPath: string;
	hidden?: boolean;
	sourceInfo: SourceInfo;
	handlers: Map<string, HandlerFn[]>;
	tools: Map<string, RegisteredTool>;
	messageRenderers: Map<string, MessageRenderer>;
	markdownTransformer?: MarkdownTransformer;
	entryRenderers?: Map<string, EntryRenderer>;
	commands: Map<string, RegisteredCommand>;
	flags: Map<string, ExtensionFlag>;
	shortcuts: Map<KeyId, ExtensionShortcut>;
}

/** Result of loading extensions. */
/** 加载扩展的结果。 */
export interface LoadExtensionsResult {
	extensions: Extension[];
	errors: Array<{ path: string; error: string }>;
	/** Shared runtime - actions are throwing stubs until runner.initialize() */
	/** 共享运行时——在 runner.initialize() 之前，其中的动作都是会抛异常的存根 */
	runtime: ExtensionRuntime;
}

// ============================================================================
// Extension Error
// 扩展错误
// ============================================================================

export interface ExtensionError {
	extensionPath: string;
	event: string;
	error: string;
	stack?: string;
}
