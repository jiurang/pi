import type {
	Api,
	AssistantMessage,
	AssistantMessageEvent,
	AssistantMessageEventStream,
	Context,
	ImageContent,
	Message,
	Model,
	SimpleStreamOptions,
	TextContent,
	Tool,
	ToolResultMessage,
	Usage,
} from "@earendil-works/pi-ai";
import type { Static, TSchema } from "typebox";

/**
 * Stream function used by the agent loop. `Models.streamSimple` satisfies
 * this shape.
 * 智能体（agent）循环所使用的流式函数。`Models.streamSimple` 符合该形态。
 *
 * Contract:
 * 契约：
 * - Must not throw or return a rejected promise for request/model/runtime failures.
 * - 对于请求/模型/运行时故障，不得抛出异常或返回被拒绝的 promise。
 * - Must return an AssistantMessageEventStream.
 * - 必须返回一个 AssistantMessageEventStream。
 * - Failures must be encoded in the returned stream via protocol events and a
 *   final AssistantMessage with stopReason "error" or "aborted" and errorMessage.
 * - 故障必须通过协议事件编码在返回的流中，并以一条 stopReason 为 "error" 或 "aborted"
 *   且带有 errorMessage 的最终 AssistantMessage 结束。
 */
export type StreamFn = (
	model: Model<Api>,
	context: Context,
	options?: SimpleStreamOptions,
) => AssistantMessageEventStream | Promise<AssistantMessageEventStream>;

/**
 * Configuration for how tool calls from a single assistant message are executed.
 * 用于配置单条助手（assistant）消息中的工具调用（tool call）如何执行。
 *
 * - "sequential": each tool call is prepared, executed, and finalized before the next one starts.
 * - "sequential"（串行）：每个工具调用都会先完成准备、执行与收尾，然后才开始下一个。
 * - "parallel": tool calls are prepared sequentially, then allowed tools execute concurrently.
 *   `tool_execution_end` is emitted in tool completion order after each tool is finalized,
 *   while tool-result message artifacts are emitted later in assistant source order.
 * - "parallel"（并行）：工具调用按顺序依次准备，然后被允许的工具并发执行。
 *   每个工具收尾后按工具完成顺序发出 `tool_execution_end`，
 *   而工具结果消息产物则稍后按助手消息中的源顺序发出。
 */
export type ToolExecutionMode = "sequential" | "parallel";

/**
 * Controls how many queued user messages are injected when the agent loop reaches a queue drain point.
 * 控制当智能体（agent）循环到达队列排空点时，注入多少条排队中的用户消息。
 *
 * - "all": drain and inject every queued message at that point.
 * - "all"（全部）：在该点排空并注入所有排队中的消息。
 * - "one-at-a-time": drain and inject only the oldest queued message, leaving the rest queued for later drain points.
 * - "one-at-a-time"（逐条）：仅排空并注入最早的一条排队消息，其余消息继续排队等待后续的排空点。
 */
export type QueueMode = "all" | "one-at-a-time";

/**
 * A single tool call content block emitted by an assistant message.
 * 由助手（assistant）消息发出的单个工具调用（tool call）内容块。
 */
export type AgentToolCall = Extract<AssistantMessage["content"][number], { type: "toolCall" }>;

/**
 * Result returned from `beforeToolCall`.
 * `beforeToolCall` 返回的结果。
 *
 * Returning `{ block: true }` prevents the tool from executing. The loop emits an error tool result instead.
 * 返回 `{ block: true }` 会阻止该工具执行，循环转而发出一个错误的工具结果。
 * `reason` becomes the text shown in that error result. If omitted, a default blocked message is used.
 * `reason` 将作为该错误结果中显示的文本。若省略，则使用默认的拦截提示信息。
 */
export interface BeforeToolCallResult {
	block?: boolean;
	reason?: string;
}

/**
 * Partial override returned from `afterToolCall`.
 * `afterToolCall` 返回的部分覆盖值。
 *
 * Merge semantics are field-by-field:
 * 合并语义是逐字段进行的：
 * - `content`: if provided, replaces the tool result content array in full
 * - `content`：若提供，则整体替换工具结果的内容数组
 * - `details`: if provided, replaces the tool result details value in full
 * - `details`：若提供，则整体替换工具结果的详情值
 * - `isError`: if provided, replaces the tool result error flag
 * - `isError`：若提供，则替换工具结果的错误标志
 * - `usage`: if provided, replaces the tool result usage
 * - `usage`：若提供，则替换工具结果的用量（usage）
 * - `terminate`: if provided, replaces the early-termination hint
 * - `terminate`：若提供，则替换提前终止提示
 *
 * Omitted fields keep the original executed tool result values.
 * 未提供的字段保留原始工具执行结果中的值。
 * There is no deep merge for `content`, `details`, or `usage`.
 * `content`、`details` 和 `usage` 不会进行深度合并。
 */
export interface AfterToolCallResult {
	content?: (TextContent | ImageContent)[];
	details?: unknown;
	isError?: boolean;
	/**
	 * Usage from the final tool execution itself, if available. Not used for main LLM context accounting.
	 * 最终工具执行自身的用量（usage）（若可用）。不用于主 LLM 上下文的用量统计。
	 */
	usage?: Usage;
	/**
	 * Hint that the agent should stop after the current tool batch.
	 * 提示智能体（agent）应在当前这批工具执行完毕后停止。
	 * Early termination only happens when every finalized tool result in the batch sets this to true.
	 * 只有当该批次中所有已收尾的工具结果都将其设为 true 时，才会提前终止。
	 */
	terminate?: boolean;
}

/**
 * Context passed to `beforeToolCall`.
 * 传递给 `beforeToolCall` 的上下文。
 */
export interface BeforeToolCallContext {
	/**
	 * The assistant message that requested the tool call.
	 * 发起该工具调用（tool call）的助手（assistant）消息。
	 */
	assistantMessage: AssistantMessage;
	/**
	 * The raw tool call block from `assistantMessage.content`.
	 * 来自 `assistantMessage.content` 的原始工具调用块。
	 */
	toolCall: AgentToolCall;
	/**
	 * Validated tool arguments for the target tool schema.
	 * 针对目标工具 schema 校验通过的工具参数。
	 */
	args: unknown;
	/**
	 * Current agent context at the time the tool call is prepared.
	 * 准备该工具调用时的当前智能体（agent）上下文。
	 */
	context: AgentContext;
}

/**
 * Context passed to `afterToolCall`.
 * 传递给 `afterToolCall` 的上下文。
 */
export interface AfterToolCallContext {
	/**
	 * The assistant message that requested the tool call.
	 * 发起该工具调用（tool call）的助手（assistant）消息。
	 */
	assistantMessage: AssistantMessage;
	/**
	 * The raw tool call block from `assistantMessage.content`.
	 * 来自 `assistantMessage.content` 的原始工具调用块。
	 */
	toolCall: AgentToolCall;
	/**
	 * Validated tool arguments for the target tool schema.
	 * 针对目标工具 schema 校验通过的工具参数。
	 */
	args: unknown;
	/**
	 * The executed tool result before any `afterToolCall` overrides are applied.
	 * 在应用任何 `afterToolCall` 覆盖之前，工具执行得到的结果。
	 */
	result: AgentToolResult<any>;
	/**
	 * Whether the executed tool result is currently treated as an error.
	 * 当前是否将该工具执行结果视为错误。
	 */
	isError: boolean;
	/**
	 * Current agent context at the time the tool call is finalized.
	 * 该工具调用收尾时的当前智能体（agent）上下文。
	 */
	context: AgentContext;
}

/**
 * Context passed to `shouldStopAfterTurn`.
 * 传递给 `shouldStopAfterTurn` 的上下文。
 */
export interface ShouldStopAfterTurnContext {
	/**
	 * The assistant message that completed the turn.
	 * 完成本轮（turn）的助手（assistant）消息。
	 */
	message: AssistantMessage;
	/**
	 * Tool result messages passed to the preceding `turn_end` event.
	 * 传递给前一个 `turn_end` 事件的工具结果消息。
	 */
	toolResults: ToolResultMessage[];
	/**
	 * Current agent context after the turn's assistant message and tool results have been appended.
	 * 在本轮的助手消息与工具结果被追加之后的当前智能体（agent）上下文。
	 */
	context: AgentContext;
	/**
	 * Messages that this loop invocation will return if it exits at this point. Prompt runs include the initial prompt messages; continuation runs do not include pre-existing context messages.
	 * 若循环在此处退出，本次循环调用将返回的消息。提示（prompt）运行包含初始的提示消息；续跑（continuation）运行不包含已有的上下文消息。
	 */
	newMessages: AgentMessage[];
}

/**
 * Replacement runtime state used by the agent loop before starting another provider request.
 * 智能体（agent）循环在发起下一次服务商（provider）请求之前所使用的替换运行时状态。
 */
export interface AgentLoopTurnUpdate {
	/**
	 * Context for the next provider request.
	 * 下一次服务商（provider）请求所用的上下文。
	 */
	context?: AgentContext;
	/**
	 * Model for the next provider request.
	 * 下一次服务商（provider）请求所用的模型。
	 */
	model?: Model<any>;
	/**
	 * Thinking level for the next provider request.
	 * 下一次服务商（provider）请求所用的思考（thinking）级别。
	 */
	thinkingLevel?: ThinkingLevel;
}

export interface PrepareNextTurnContext extends ShouldStopAfterTurnContext {}

export interface AgentLoopConfig extends SimpleStreamOptions {
	model: Model<any>;

	/**
	 * Converts AgentMessage[] to LLM-compatible Message[] before each LLM call.
	 * 在每次 LLM 调用之前，将 AgentMessage[] 转换为与 LLM 兼容的 Message[]。
	 *
	 * Each AgentMessage must be converted to a UserMessage, AssistantMessage, or ToolResultMessage
	 * that the LLM can understand. AgentMessages that cannot be converted (e.g., UI-only notifications,
	 * status messages) should be filtered out.
	 * 每条 AgentMessage 都必须被转换为 LLM 能够理解的 UserMessage、AssistantMessage 或 ToolResultMessage。
	 * 无法转换的 AgentMessage（例如仅用于界面的通知、状态消息）应当被过滤掉。
	 *
	 * Contract: must not throw or reject. Return a safe fallback value instead.
	 * Throwing interrupts the low-level agent loop without producing a normal event sequence.
	 * 契约：不得抛出异常或返回被拒绝的 promise，应改为返回一个安全的回退值。
	 * 抛出异常会中断底层智能体（agent）循环，且不会产生正常的事件序列。
	 *
	 * @example
	 * ```typescript
	 * convertToLlm: (messages) => messages.flatMap(m => {
	 *   if (m.role === "custom") {
	 *     // Convert custom message to user message
	 *     return [{ role: "user", content: m.content, timestamp: m.timestamp }];
	 *   }
	 *   if (m.role === "notification") {
	 *     // Filter out UI-only messages
	 *     return [];
	 *   }
	 *   // Pass through standard LLM messages
	 *   return [m];
	 * })
	 * ```
	 */
	convertToLlm: (messages: AgentMessage[]) => Message[] | Promise<Message[]>;

	/**
	 * Optional transform applied to the context before `convertToLlm`.
	 * 在 `convertToLlm` 之前对上下文应用的可选变换。
	 *
	 * Use this for operations that work at the AgentMessage level:
	 * 用于在 AgentMessage 层面进行的操作：
	 * - Context window management (pruning old messages)
	 * - 上下文窗口管理（裁剪旧消息）
	 * - Injecting context from external sources
	 * - 从外部来源注入上下文
	 *
	 * Contract: must not throw or reject. Return the original messages or another
	 * safe fallback value instead.
	 * 契约：不得抛出异常或返回被拒绝的 promise，应改为返回原始消息或其他安全的回退值。
	 *
	 * @example
	 * ```typescript
	 * transformContext: async (messages) => {
	 *   if (estimateTokens(messages) > MAX_TOKENS) {
	 *     return pruneOldMessages(messages);
	 *   }
	 *   return messages;
	 * }
	 * ```
	 */
	transformContext?: (messages: AgentMessage[], signal?: AbortSignal) => Promise<AgentMessage[]>;

	/**
	 * Resolves an API key dynamically for each LLM call.
	 * 为每次 LLM 调用动态解析 API 密钥。
	 *
	 * Useful for short-lived OAuth tokens (e.g., GitHub Copilot) that may expire
	 * during long-running tool execution phases.
	 * 适用于短期有效的 OAuth 令牌（token）（例如 GitHub Copilot），这类令牌可能在
	 * 长时间运行的工具执行阶段中过期。
	 *
	 * Contract: must not throw or reject. Return undefined when no key is available.
	 * 契约：不得抛出异常或返回被拒绝的 promise。当没有可用密钥时返回 undefined。
	 */
	getApiKey?: (provider: string) => Promise<string | undefined> | string | undefined;

	/**
	 * Called after each turn fully completes and `turn_end` has been emitted.
	 * 在每一轮（turn）完全结束且 `turn_end` 已发出之后调用。
	 *
	 * If it returns true, the loop emits `agent_end` and exits before polling steering or follow-up queues,
	 * without starting another LLM call. The current assistant response and any tool executions finish normally.
	 * 若返回 true，循环会发出 `agent_end` 并在轮询引导（steering）或后续（follow-up）队列之前退出，
	 * 不会再发起新的 LLM 调用。当前的助手（assistant）响应及所有工具执行会正常结束。
	 *
	 * Use this to request a graceful stop after the current turn, e.g. before context gets too full.
	 * 用它在当前轮结束后请求优雅停止，例如在上下文即将占满之前。
	 *
	 * Contract: must not throw or reject. Throwing interrupts the low-level agent loop without producing a normal event sequence.
	 * 契约：不得抛出异常或返回被拒绝的 promise。抛出异常会中断底层智能体（agent）循环，且不会产生正常的事件序列。
	 */
	shouldStopAfterTurn?: (context: ShouldStopAfterTurnContext) => boolean | Promise<boolean>;

	/**
	 * Called after `turn_end` and before the loop decides whether another provider request should start.
	 * 在 `turn_end` 之后、循环决定是否发起下一次服务商（provider）请求之前调用。
	 * Return replacement context/model/thinking state to affect the next turn in this run.
	 * 返回替换用的上下文/模型/思考（thinking）状态，以影响本次运行中的下一轮（turn）。
	 * Return undefined to keep using the current context/config.
	 * 返回 undefined 则继续沿用当前的上下文/配置。
	 */
	prepareNextTurn?: (
		context: PrepareNextTurnContext,
	) => AgentLoopTurnUpdate | undefined | Promise<AgentLoopTurnUpdate | undefined>;

	/**
	 * Returns steering messages to inject into the conversation mid-run.
	 * 返回在运行途中注入对话的引导（steering）消息。
	 *
	 * Called after the current assistant turn finishes executing its tool calls, unless `shouldStopAfterTurn` exits first.
	 * If messages are returned, they are added to the context before the next LLM call.
	 * Tool calls from the current assistant message are not skipped.
	 * 在当前助手（assistant）轮次执行完其工具调用之后调用，除非 `shouldStopAfterTurn` 先行退出。
	 * 若返回了消息，它们会在下一次 LLM 调用之前被加入上下文。
	 * 当前助手消息中的工具调用不会被跳过。
	 *
	 * Use this for "steering" the agent while it's working.
	 * 用它在智能体（agent）工作过程中对其进行“引导”。
	 *
	 * Contract: must not throw or reject. Return [] when no steering messages are available.
	 * 契约：不得抛出异常或返回被拒绝的 promise。当没有可用的引导消息时返回 []。
	 */
	getSteeringMessages?: () => Promise<AgentMessage[]>;

	/**
	 * Returns follow-up messages to process after the agent would otherwise stop.
	 * 返回在智能体（agent）本应停止之后仍需处理的后续（follow-up）消息。
	 *
	 * Called when the agent has no more tool calls and no steering messages.
	 * If messages are returned, they're added to the context and the agent
	 * continues with another turn.
	 * 当智能体不再有工具调用且没有引导（steering）消息时调用。
	 * 若返回了消息，它们会被加入上下文，智能体继续进行下一轮（turn）。
	 *
	 * Use this for follow-up messages that should wait until the agent finishes.
	 * 用它处理那些应当等到智能体完成后再发出的后续消息。
	 *
	 * Contract: must not throw or reject. Return [] when no follow-up messages are available.
	 * 契约：不得抛出异常或返回被拒绝的 promise。当没有可用的后续消息时返回 []。
	 */
	getFollowUpMessages?: () => Promise<AgentMessage[]>;

	/**
	 * Tool execution mode.
	 * 工具执行模式。
	 * - "sequential": execute tool calls one by one
	 * - "sequential"（串行）：逐个执行工具调用
	 * - "parallel": preflight tool calls sequentially, then execute allowed tools concurrently;
	 *   emit `tool_execution_end` in tool completion order after each tool is finalized,
	 *   then emit tool-result message artifacts later in assistant source order
	 * - "parallel"（并行）：先按顺序对工具调用做预检，然后并发执行被允许的工具；
	 *   每个工具收尾后按工具完成顺序发出 `tool_execution_end`，
	 *   随后再按助手消息中的源顺序发出工具结果消息产物
	 *
	 * Default: "parallel"
	 * 默认值："parallel"
	 */
	toolExecution?: ToolExecutionMode;

	/**
	 * Called before a tool is executed, after arguments have been validated.
	 * 在参数校验完成之后、工具执行之前调用。
	 *
	 * Return `{ block: true }` to prevent execution. The loop emits an error tool result instead.
	 * 返回 `{ block: true }` 可阻止执行，循环转而发出一个错误的工具结果。
	 * The hook receives the agent abort signal and is responsible for honoring it.
	 * 该钩子（hook）会接收到智能体（agent）的中止信号（abort signal），并有责任遵守它。
	 */
	beforeToolCall?: (context: BeforeToolCallContext, signal?: AbortSignal) => Promise<BeforeToolCallResult | undefined>;

	/**
	 * Called after a tool finishes executing, before `tool_execution_end` and tool-result message events are emitted.
	 * 在工具执行完毕之后、发出 `tool_execution_end` 与工具结果消息事件之前调用。
	 *
	 * Return an `AfterToolCallResult` to override parts of the executed tool result:
	 * 返回一个 `AfterToolCallResult` 以覆盖工具执行结果的部分内容：
	 * - `content` replaces the full content array
	 * - `content` 替换整个内容数组
	 * - `details` replaces the full details payload
	 * - `details` 替换整个详情载荷
	 * - `isError` replaces the error flag
	 * - `isError` 替换错误标志
	 * - `usage` replaces the tool result usage
	 * - `usage` 替换工具结果的用量（usage）
	 * - `terminate` replaces the early-termination hint
	 * - `terminate` 替换提前终止提示
	 *
	 * Any omitted fields keep their original values. No deep merge is performed.
	 * 任何未提供的字段都保留其原始值，不会执行深度合并。
	 * The hook receives the agent abort signal and is responsible for honoring it.
	 * 该钩子（hook）会接收到智能体（agent）的中止信号（abort signal），并有责任遵守它。
	 */
	afterToolCall?: (context: AfterToolCallContext, signal?: AbortSignal) => Promise<AfterToolCallResult | undefined>;
}

/**
 * Thinking/reasoning level for models that support it.
 * 适用于支持该特性的模型的思考/推理（thinking/reasoning）级别。
 * Note: "xhigh" and "max" are only supported by selected model families. Use model
 * thinking-level metadata from @earendil-works/pi-ai to detect support for a concrete model.
 * 注意："xhigh" 与 "max" 仅被部分模型系列支持。请使用来自 @earendil-works/pi-ai 的
 * 模型思考级别元数据，来检测某个具体模型是否支持。
 */
export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

/**
 * Extensible interface for custom app messages.
 * 用于自定义应用消息的可扩展接口。
 * Apps can extend via declaration merging:
 * 应用可通过声明合并（declaration merging）进行扩展：
 *
 * @example
 * ```typescript
 * declare module "@mariozechner/agent" {
 *   interface CustomAgentMessages {
 *     artifact: ArtifactMessage;
 *     notification: NotificationMessage;
 *   }
 * }
 * ```
 */
export interface CustomAgentMessages {
	// Empty by default - apps extend via declaration merging
	// 默认为空 —— 应用通过声明合并（declaration merging）进行扩展
}

/**
 * AgentMessage: Union of LLM messages + custom messages.
 * AgentMessage：LLM 消息与自定义消息的联合类型。
 * This abstraction allows apps to add custom message types while maintaining
 * type safety and compatibility with the base LLM messages.
 * 该抽象使应用能够添加自定义消息类型，同时保持类型安全以及与基础 LLM 消息的兼容性。
 */
export type AgentMessage = Message | CustomAgentMessages[keyof CustomAgentMessages];

/**
 * Public agent state.
 * 公开的智能体（agent）状态。
 *
 * `tools` and `messages` use accessor properties so implementations can copy
 * assigned arrays before storing them.
 * `tools` 与 `messages` 使用访问器属性，以便实现方在存储之前可以复制被赋值的数组。
 */
export interface AgentState {
	/**
	 * System prompt sent with each model request.
	 * 随每次模型请求一同发送的系统提示词（system prompt）。
	 */
	systemPrompt: string;
	/**
	 * Active model used for future turns.
	 * 后续轮次（turn）所使用的当前活动模型。
	 */
	model: Model<any>;
	/**
	 * Requested reasoning level for future turns.
	 * 后续轮次（turn）所请求的推理（reasoning）级别。
	 */
	thinkingLevel: ThinkingLevel;
	/**
	 * Available tools. Assigning a new array copies the top-level array.
	 * 可用的工具。赋值一个新数组时会复制其顶层数组。
	 */
	set tools(tools: AgentTool<any>[]);
	get tools(): AgentTool<any>[];
	/**
	 * Conversation transcript. Assigning a new array copies the top-level array.
	 * 对话记录（transcript）。赋值一个新数组时会复制其顶层数组。
	 */
	set messages(messages: AgentMessage[]);
	get messages(): AgentMessage[];
	/**
	 * True while the agent is processing a prompt or continuation.
	 * 当智能体（agent）正在处理提示（prompt）或续跑（continuation）时为 true。
	 *
	 * This remains true until awaited `agent_end` listeners settle.
	 * 该值会一直保持为 true，直到被 await 的 `agent_end` 监听器全部完成。
	 */
	readonly isStreaming: boolean;
	/**
	 * Partial assistant message for the current streamed response, if any.
	 * 当前流式响应对应的部分助手（assistant）消息（若存在）。
	 */
	readonly streamingMessage?: AgentMessage;
	/**
	 * Tool call ids currently executing.
	 * 当前正在执行的工具调用（tool call）id。
	 */
	readonly pendingToolCalls: ReadonlySet<string>;
	/**
	 * Error message from the most recent failed or aborted assistant turn, if any.
	 * 最近一次失败或被中止的助手（assistant）轮次的错误信息（若存在）。
	 */
	readonly errorMessage?: string;
}

/**
 * Final or partial result produced by a tool.
 * 工具产生的最终结果或部分结果。
 */
export interface AgentToolResult<T> {
	/**
	 * Text or image content returned to the model.
	 * 返回给模型的文本或图像内容。
	 */
	content: (TextContent | ImageContent)[];
	/**
	 * Arbitrary structured details for logs or UI rendering.
	 * 供日志或界面渲染使用的任意结构化详情。
	 */
	details: T;
	/**
	 * Usage from the final tool execution itself, if available. Not used for main LLM context accounting.
	 * 最终工具执行自身的用量（usage）（若可用）。不用于主 LLM 上下文的用量统计。
	 */
	usage?: Usage;
	/**
	 * Names of tools introduced by this result and available from this transcript point onward.
	 * 由该结果引入的工具名称，自对话记录（transcript）的此位置起可用。
	 */
	addedToolNames?: string[];
	/**
	 * Hint that the agent should stop after the current tool batch.
	 * 提示智能体（agent）应在当前这批工具执行完毕后停止。
	 * Early termination only happens when every finalized tool result in the batch sets this to true.
	 * 只有当该批次中所有已收尾的工具结果都将其设为 true 时，才会提前终止。
	 */
	terminate?: boolean;
}

/**
 * Callback used by tools to stream partial execution updates.
 * 供工具流式推送部分执行进度更新的回调。
 *
 * The callback is scoped to the current `execute()` invocation. Calls made after
 * the tool promise settles are ignored.
 * 该回调的作用域限定于当前这次 `execute()` 调用。在工具的 promise 完成之后发生的调用会被忽略。
 */
export type AgentToolUpdateCallback<T = any> = (partialResult: AgentToolResult<T>) => void;

/**
 * Tool definition used by the agent runtime.
 * 智能体（agent）运行时所使用的工具定义。
 */
export interface AgentTool<TParameters extends TSchema = TSchema, TDetails = any> extends Tool<TParameters> {
	/**
	 * Human-readable label for UI display.
	 * 用于界面展示的可读标签。
	 */
	label: string;
	/**
	 * Optional compatibility shim for raw tool-call arguments before schema validation.
	 * 可选的兼容性垫片（shim），用于在 schema 校验之前处理原始的工具调用参数。
	 * Must return an object that matches `TParameters`.
	 * 必须返回一个符合 `TParameters` 的对象。
	 */
	prepareArguments?: (args: unknown) => Static<TParameters>;
	/**
	 * Execute the tool call. Throw on failure instead of encoding errors in `content`.
	 * 执行该工具调用。失败时应抛出异常，而不是把错误编码进 `content` 中。
	 */
	execute: (
		toolCallId: string,
		params: Static<TParameters>,
		signal?: AbortSignal,
		onUpdate?: AgentToolUpdateCallback<TDetails>,
	) => Promise<AgentToolResult<TDetails>>;
	/**
	 * Per-tool execution mode override.
	 * 针对单个工具的执行模式覆盖设置。
	 * - "sequential": this tool must execute one at a time with other tool calls.
	 * - "sequential"（串行）：该工具必须与其他工具调用逐个依次执行。
	 * - "parallel": this tool can execute concurrently with other tool calls.
	 * - "parallel"（并行）：该工具可以与其他工具调用并发执行。
	 *
	 * If omitted, the default execution mode applies.
	 * 若省略，则采用默认的执行模式。
	 */
	executionMode?: ToolExecutionMode;
}

/**
 * Context snapshot passed into the low-level agent loop.
 * 传入底层智能体（agent）循环的上下文快照。
 */
export interface AgentContext {
	/**
	 * System prompt included with the request.
	 * 随请求一同包含的系统提示词（system prompt）。
	 */
	systemPrompt: string;
	/**
	 * Transcript visible to the model.
	 * 模型可见的对话记录（transcript）。
	 */
	messages: AgentMessage[];
	/**
	 * Tools available for this run.
	 * 本次运行中可用的工具。
	 */
	tools?: AgentTool<any>[];
}

/**
 * Events emitted by the Agent for UI updates.
 * 由 Agent 发出、用于界面更新的事件。
 *
 * `agent_end` is the last event emitted for a run, but awaited `Agent.subscribe()`
 * listeners for that event are still part of run settlement. The agent becomes
 * idle only after those listeners finish.
 * `agent_end` 是一次运行中发出的最后一个事件，但该事件被 await 的 `Agent.subscribe()`
 * 监听器仍属于本次运行的收尾过程。只有在这些监听器结束之后，智能体（agent）才会进入空闲状态。
 */
export type AgentEvent =
	// Agent lifecycle
	// 智能体（agent）生命周期
	| { type: "agent_start" }
	| { type: "agent_end"; messages: AgentMessage[] }
	// Turn lifecycle - a turn is one assistant response + any tool calls/results
	// 轮次（turn）生命周期 —— 一轮 = 一次助手（assistant）响应 + 相应的工具调用/结果
	| { type: "turn_start" }
	| { type: "turn_end"; message: AgentMessage; toolResults: ToolResultMessage[] }
	// Message lifecycle - emitted for user, assistant, and toolResult messages
	// 消息生命周期 —— 针对 user、assistant 和 toolResult 消息发出
	| { type: "message_start"; message: AgentMessage }
	// Only emitted for assistant messages during streaming
	// 仅在流式传输期间针对助手（assistant）消息发出
	| { type: "message_update"; message: AgentMessage; assistantMessageEvent: AssistantMessageEvent }
	| { type: "message_end"; message: AgentMessage }
	// Tool execution lifecycle
	// 工具执行生命周期
	| { type: "tool_execution_start"; toolCallId: string; toolName: string; args: any }
	| { type: "tool_execution_update"; toolCallId: string; toolName: string; args: any; partialResult: any }
	| { type: "tool_execution_end"; toolCallId: string; toolName: string; result: any; isError: boolean };
