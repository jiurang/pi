/**
 * Extension system for lifecycle events and custom tools.
 * 面向生命周期事件与自定义工具的扩展（Extension）系统。
 */

export type { SlashCommandInfo, SlashCommandSource } from "../slash-commands.ts";
export type { SourceInfo } from "../source-info.ts";
export {
	createExtensionRuntime,
	discoverAndLoadExtensions,
	loadExtensionFromFactory,
	loadExtensions,
} from "./loader.ts";
export type {
	ExtensionErrorListener,
	ForkHandler,
	NavigateTreeHandler,
	NewSessionHandler,
	ShutdownHandler,
	SwitchSessionHandler,
} from "./runner.ts";
export { ExtensionRunner } from "./runner.ts";
export type {
	AfterProviderResponseEvent,
	AgentEndEvent,
	AgentSettledEvent,
	AgentStartEvent,
	// Re-exports
	// 重新导出（Re-exports）
	AgentToolResult,
	AgentToolUpdateCallback,
	AppendEntryHandler,
	// App keybindings (for custom editors)
	// 应用快捷键绑定（供自定义编辑器使用）
	AppKeybinding,
	AutocompleteProviderFactory,
	// Events - Tool (ToolCallEvent types)
	// 事件 —— 工具（ToolCallEvent 相关类型）
	BashToolCallEvent,
	BashToolResultEvent,
	BeforeAgentStartEvent,
	BeforeAgentStartEventResult,
	BeforeProviderHeadersEvent,
	BeforeProviderRequestEvent,
	BeforeProviderRequestEventResult,
	BuildSystemPromptOptions,
	// Context
	// 上下文（Context）
	CompactOptions,
	// Events - Agent
	// 事件 —— Agent
	ContextEvent,
	// Event Results
	// 事件返回结果
	ContextEventResult,
	ContextUsage,
	CustomToolCallEvent,
	CustomToolResultEvent,
	EditorFactory,
	EditToolCallEvent,
	EditToolResultEvent,
	// Message and Entry Rendering
	// 消息与条目（Entry）渲染
	EntryRenderer,
	EntryRenderOptions,
	ExecOptions,
	ExecResult,
	Extension,
	ExtensionActions,
	// API
	// API 接口
	ExtensionAPI,
	ExtensionCommandContext,
	ExtensionCommandContextActions,
	ExtensionContext,
	ExtensionContextActions,
	// Errors
	// 错误
	ExtensionError,
	ExtensionEvent,
	ExtensionFactory,
	ExtensionFlag,
	ExtensionHandler,
	ExtensionMode,
	// Runtime
	// 运行时（Runtime）
	ExtensionRuntime,
	ExtensionShortcut,
	ExtensionUIContext,
	ExtensionUIDialogOptions,
	ExtensionWidgetOptions,
	FindToolCallEvent,
	FindToolResultEvent,
	GetActiveToolsHandler,
	GetAllToolsHandler,
	GetCommandsHandler,
	GetThinkingLevelHandler,
	GrepToolCallEvent,
	GrepToolResultEvent,
	InlineExtension,
	// Events - Input
	// 事件 —— 输入
	InputEvent,
	InputEventResult,
	InputSource,
	KeybindingsManager,
	LoadExtensionsResult,
	LsToolCallEvent,
	LsToolResultEvent,
	MarkdownTransformContext,
	MarkdownTransformer,
	// Events - Message
	// 事件 —— 消息
	MessageEndEvent,
	MessageRenderer,
	MessageRenderOptions,
	MessageStartEvent,
	MessageUpdateEvent,
	ModelSelectEvent,
	ModelSelectSource,
	ProjectTrustContext,
	ProjectTrustEvent,
	ProjectTrustEventDecision,
	ProjectTrustEventResult,
	ProjectTrustHandler,
	// Provider Registration
	// 服务提供方（Provider）注册
	ProviderConfig,
	ProviderModelConfig,
	ReadToolCallEvent,
	ReadToolResultEvent,
	// Commands
	// 命令
	RegisteredCommand,
	RegisteredTool,
	ReplacedSessionContext,
	ResolvedCommand,
	// Events - Resources
	// 事件 —— 资源
	ResourcesDiscoverEvent,
	ResourcesDiscoverResult,
	SendMessageHandler,
	SendUserMessageHandler,
	SessionBeforeCompactEvent,
	SessionBeforeCompactResult,
	SessionBeforeForkEvent,
	SessionBeforeForkResult,
	SessionBeforeSwitchEvent,
	SessionBeforeSwitchResult,
	SessionBeforeTreeEvent,
	SessionBeforeTreeResult,
	SessionCompactEvent,
	SessionEvent,
	SessionInfoChangedEvent,
	SessionShutdownEvent,
	// Events - Session
	// 事件 —— 会话
	SessionStartEvent,
	SessionTreeEvent,
	SetActiveToolsHandler,
	SetLabelHandler,
	SetModelHandler,
	SetThinkingLevelHandler,
	TerminalInputHandler,
	// Events - Tool
	// 事件 —— 工具
	ToolCallEvent,
	ToolCallEventResult,
	// Tools
	// 工具
	ToolDefinition,
	// Events - Tool Execution
	// 事件 —— 工具执行
	ToolExecutionEndEvent,
	// Tool execution mode
	// 工具执行模式
	ToolExecutionMode,
	ToolExecutionStartEvent,
	ToolExecutionUpdateEvent,
	ToolInfo,
	ToolRenderResultOptions,
	ToolResultEvent,
	ToolResultEventResult,
	TreePreparation,
	TurnEndEvent,
	TurnStartEvent,
	// Events - User Bash
	// 事件 —— 用户 Bash
	UserBashEvent,
	UserBashEventResult,
	WidgetPlacement,
	WorkingIndicatorOptions,
	WriteToolCallEvent,
	WriteToolResultEvent,
} from "./types.ts";
// Type guards
// 类型守卫（Type guards）
export {
	defineTool,
	isBashToolResult,
	isEditToolResult,
	isFindToolResult,
	isGrepToolResult,
	isLsToolResult,
	isReadToolResult,
	isToolCallEventType,
	isWriteToolResult,
} from "./types.ts";
export { wrapRegisteredTool, wrapRegisteredTools } from "./wrapper.ts";
