# AgentHarness hooks design AgentHarness 钩子设计

<!-- Synced from jot 3utlzkxy. Edit this file in-repo going forward. -->

Final design.
最终设计方案。

## Core model 核心模型

Events carry their result type as a type-only phantom:
事件通过"仅存在于类型层面的幻影字段(phantom)"携带自身的结果类型:

```ts
declare const HookResult: unique symbol;

interface HookEvent<TType extends string, TResult = void> {
	type: TType;
	readonly [HookResult]?: TResult;
}

type ResultOf<E> = E extends { readonly [HookResult]?: infer R } ? R : void;

type HookHandler<E, Ctx> = (
	event: E,
	ctx: Ctx,
	signal?: AbortSignal,
) => ResultOf<E> | void | Promise<ResultOf<E> | void>;

type HookObserver<E, Ctx> = (
	event: E,
	ctx: Ctx,
	signal?: AbortSignal,
) => void | Promise<void>;
```

Example:
示例:

```ts
interface ContextEvent extends HookEvent<"context", { messages?: AgentMessage[] }> {
	type: "context";
	messages: AgentMessage[];
}

interface ToolCallEvent extends HookEvent<"tool_call", { block?: boolean; reason?: string }> {
	type: "tool_call";
	toolName: string;
	input: Record<string, unknown>;
}

interface MessageEndEvent extends HookEvent<"message_end"> {
	type: "message_end";
	message: AgentMessage;
}
```

No result map. No spec table. The event type defines its own result.
不需要结果映射表,也不需要规格表。事件类型自身定义其结果类型。

## Hooks interface 钩子接口

```ts
interface AgentHarnessHooks<E extends HookEvent<string, unknown>, Ctx> {
	context: Ctx;

	setContext(ctx: Ctx): void;

	observe(handler: HookObserver<E, Ctx>): () => void;

	on<TType extends E["type"]>(
		type: TType,
		handler: HookHandler<Extract<E, { type: TType }>, Ctx>,
	): () => void;

	emit<TEvent extends E>(
		event: TEvent,
		signal?: AbortSignal,
	): Promise<ResultOf<TEvent> | undefined>;

	addCleanup(cleanup: () => void | Promise<void>): () => void;

	clear(): Promise<void>;
	dispose(): Promise<void>;
}
```

Important split:
关键的职责划分:

- `observe()` sees all events, read-only, return ignored.
  `observe()` 可以看到所有事件,只读,返回值被忽略。
- `on(type, handler)` participates in that event’s semantics.
  `on(type, handler)` 参与该事件的语义处理。
- `emit(event)` is the only thing `AgentHarness` calls.
  `emit(event)` 是 `AgentHarness` 唯一会调用的方法。
- `clear()` removes observers/handlers and runs cleanups.
  `clear()` 移除观察者 / 处理器,并执行清理函数。

## Default implementation internals 默认实现的内部细节

```ts
class DefaultAgentHarnessHooks<E extends HookEvent<string, unknown>, Ctx>
	implements AgentHarnessHooks<E, Ctx> {
	context: Ctx;

	private observers = new Set<HookObserver<E, Ctx>>();
	private handlers = new Map<string, Set<HookHandler<any, Ctx>>>();
	private cleanups = new Set<() => void | Promise<void>>();

	constructor(ctx: Ctx) {
		this.context = ctx;
	}

	setContext(ctx: Ctx): void {
		this.context = ctx;
	}

	observe(handler: HookObserver<E, Ctx>): () => void {
		this.observers.add(handler);
		return () => this.observers.delete(handler);
	}

	on(type, handler): () => void {
		let handlers = this.handlers.get(type);
		if (!handlers) {
			handlers = new Set();
			this.handlers.set(type, handlers);
		}
		handlers.add(handler);
		return () => handlers.delete(handler);
	}

	async emit(event, signal?) {
		for (const observer of this.observers) {
			await observer(event, this.context, signal);
		}

		switch (event.type) {
			case "context":
				return this.emitContext(event, signal);
			case "before_provider_request":
				return this.emitBeforeProviderRequest(event, signal);
			case "before_provider_payload":
				return this.emitBeforeProviderPayload(event, signal);
			case "before_agent_start":
				return this.emitBeforeAgentStart(event, signal);
			case "tool_call":
				return this.emitToolCall(event, signal);
			case "tool_result":
				return this.emitToolResult(event, signal);
			case "session_before_compact":
			case "session_before_tree":
				return this.emitFirstCancelOrLast(event, signal);
			default:
				await this.emitObservationHandlers(event, signal);
				return undefined;
		}
	}
}
```

Internal casts are acceptable inside the implementation because `Map<string, ...>` loses specificity. Public API remains typed.
由于 `Map<string, ...>` 会丢失类型精度,实现内部使用类型断言是可以接受的。公开 API 仍保持完整的类型定义。

## Mutation semantics 变更语义

### Observation 观察

```ts
await hooks.emit({ type: "message_end", message }, signal);
```

Observers run. `message_end` handlers run. Return ignored unless that event later gets a result type.
观察者会被执行,`message_end` 处理器也会被执行。返回值被忽略,除非该事件之后被赋予了结果类型。

### Context transform 上下文变换

Handlers run in order. Each sees current messages.
处理器按顺序执行,每个处理器看到的都是当前的消息列表。

```ts
let current = event;

for (const handler of handlers("context")) {
	const result = await handler(current, ctx, signal);
	if (result?.messages) {
		current = { ...current, messages: result.messages };
	}
}

return current.messages === event.messages ? undefined : { messages: current.messages };
```

### Provider request / payload provider 请求 / 载荷

Sequential transform. Each handler sees previous output.
串行变换。每个处理器看到的是前一个处理器的输出。

```ts
let current = event;

for (const handler of handlers("before_provider_payload")) {
	const result = await handler(current, ctx, signal);
	if (result !== undefined) {
		current = { ...current, payload: result.payload };
	}
}

return changed ? { payload: current.payload } : undefined;
```

### Before agent start agent 启动前

Collect injected messages, chain system prompt.
收集注入的消息,并对系统提示词进行链式处理。

```ts
let systemPrompt = event.systemPrompt;
const messages = [];

for (const handler of handlers("before_agent_start")) {
	const result = await handler({ ...event, systemPrompt }, ctx, signal);
	if (result?.messages) messages.push(...result.messages);
	if (result?.systemPrompt !== undefined) systemPrompt = result.systemPrompt;
}

return messages.length || systemPrompt !== event.systemPrompt
	? { messages, systemPrompt }
	: undefined;
```

### Tool call 工具调用

Sequential, early exit on block.
串行执行,一旦被拦截(block)即提前退出。

```ts
for (const handler of handlers("tool_call")) {
	const result = await handler(event, ctx, signal);
	if (result?.block) return result;
}
```

### Tool result 工具结果

Sequential patch accumulation. Each handler sees current patched result.
串行地累积补丁。每个处理器看到的是当前已打过补丁的结果。

```ts
let current = event;
let modified = false;

for (const handler of handlers("tool_result")) {
	const result = await handler(current, ctx, signal);
	if (!result) continue;

	current = {
		...current,
		content: result.content ?? current.content,
		details: result.details ?? current.details,
		isError: result.isError ?? current.isError,
	};

	modified = true;
}

return modified
	? { content: current.content, details: current.details, isError: current.isError }
	: undefined;
```

### Session-before events session 前置事件

Sequential, early exit on cancel.
串行执行,一旦取消(cancel)即提前退出。

```ts
let last;

for (const handler of handlers(event.type)) {
	const result = await handler(event, ctx, signal);
	if (!result) continue;
	last = result;
	if (result.cancel) return result;
}

return last;
```

## Harness usage harness 的使用方式

Harness only does this:
harness 只做这件事:

```ts
await this.hooks.emit(event, signal);
```

or:
或者:

```ts
const result = await this.hooks.emit({ type: "context", messages }, signal);
return result?.messages ?? messages;
```

Harness does not store handlers, chain listeners, or know extension policy.
harness 不存储处理器,不串联监听器,也不了解扩展的策略。

## Context 上下文

Context is a normal object, not rebuilt per emit.
上下文就是一个普通对象,不会在每次 emit 时重建。

```ts
const hooks = new CodingAgentHooks({
	harness: harnessFacade,
	session: sessionFacade,
	ui: noUiFacade,
});
```

Later:
之后:

```ts
hooks.setContext({
	...hooks.context,
	ui: tuiFacade,
});
```

For dynamic state, prefer stable facades/methods over getter maze:
对于动态状态,应优先使用稳定的门面(facade)/ 方法,而不是层层嵌套的 getter:

```ts
interface CodingAgentHookContext {
	harness: HarnessFacade;
	session: SessionFacade;
	ui: UiFacade;
	models: ModelFacade;
}
```

Per-run `signal` is passed as the third handler arg.
每次运行的 `signal` 作为处理器的第三个参数传入。

## Extension loading later 后续的扩展加载

Extension loading can live next to harness and construct hooks:
扩展加载可以放在 harness 旁边,并负责构造 hooks:

```ts
const hooks = await loadExtensions({
	paths,
	context,
	hooks: new CodingAgentHooks(context),
});
const harness = new AgentHarness({ ..., hooks });
```

The loader registers into hooks:
加载器将内容注册到 hooks 中:

```ts
hooks.on("context", handler);
hooks.on("tool_call", handler);
hooks.addCleanup(cleanup);
```

For reload:
重新加载时:

```ts
await hooks.clear();
const nextHooks = await loadExtensions(...);
harness.setHooks(nextHooks); // idle-only if supported
```

## Poking holes 挑刺与查漏

### 1. Error policy must be explicit 1. 错误策略必须明确

Existing coding-agent catches extension errors, reports them, and continues. New hooks need the same policy, likely:
现有的 coding-agent 会捕获扩展错误、上报后继续执行。新的 hooks 需要同样的策略,大致如下:

```ts
errorMode: "continue" | "throw"
onError(error)
```

For coding-agent, default should be `"continue"`.
对 coding-agent 而言,默认值应为 `"continue"`。

### 2. Source metadata matters 2. 来源元数据很重要

Existing runner knows which extension produced an error/resource/tool. Plain `on()` loses that unless we add registration metadata or scopes.
现有的 runner 知道错误 / 资源 / 工具是由哪个扩展产生的。除非我们增加注册元数据或作用域(scope),否则单纯的 `on()` 会丢失这一信息。

Probably needed:
可能需要:

```ts
const scope = hooks.createScope({ sourceInfo });
scope.on("context", handler);
scope.addCleanup(...);
```

Or `on(type, handler, { sourceInfo })`.
或者写成 `on(type, handler, { sourceInfo })`。

### 3. Some extension capabilities are registries, not hooks 3. 部分扩展能力属于注册表而非钩子

These are not covered by `emit()` and should stay as registries on `CodingAgentHooks` or an extension host:
以下这些不在 `emit()` 的覆盖范围内,应作为注册表保留在 `CodingAgentHooks` 或扩展宿主上:

- tools
  工具
- commands
  命令
- shortcuts
  快捷键
- flags
  开关标志
- message renderers
  消息渲染器
- provider registrations
  provider 注册
- OAuth providers
  OAuth 提供方
- custom model providers
  自定义模型提供方

That is fine. They do not belong in `AgentHarness`.
这没有问题。它们本就不属于 `AgentHarness`。

### 4. Existing coding-agent events can be represented 4. 现有的 coding-agent 事件都能被表达

No blocker for:
以下事件都没有障碍:

- `context`
- `before_provider_request`
- `after_provider_response`
- `before_agent_start`
- `message_end`
- `tool_call`
- `tool_result`
- `input`
- `user_bash`
- `resources_discover`
- `session_before_*`
- `session_*`
- model/thinking selection events
  模型 / 思考等级选择事件
- agent/turn/message/tool lifecycle events
  agent / 回合 / 消息 / 工具的生命周期事件

They become additional event types handled by `CodingAgentHooks`.
它们会成为由 `CodingAgentHooks` 处理的额外事件类型。

### 5. Need to preserve exact old semantics 5. 必须精确保留旧有语义

When porting coding-agent, special cases must be copied:
在移植 coding-agent 时,必须原样复制这些特殊情况:

- `input`: transform chain, `handled` short-circuits.
  `input`:变换链,`handled` 会短路后续处理。
- `user_bash`: first meaningful result wins.
  `user_bash`:第一个有意义的结果生效。
- `message_end`: replacement must keep same role.
  `message_end`:替换后的消息必须保持相同的角色(role)。
- `before_agent_start`: `ctx.getSystemPrompt()` must reflect current chained prompt.
  `before_agent_start`:`ctx.getSystemPrompt()` 必须反映当前链式处理后的提示词。
- `resources_discover`: aggregate paths and keep extension source.
  `resources_discover`:聚合路径并保留扩展来源信息。
- `tool_call`: argument mutation remains visible to later handlers.
  `tool_call`:对参数的修改对后续处理器仍然可见。
- `tool_result`: later handlers see prior patches.
  `tool_result`:后续处理器能看到先前的补丁。

The design allows all of that, but the default/coding hooks implementation must encode it.
本设计允许上述所有行为,但需要在默认 hooks / coding hooks 的实现中把它们编码进去。

### 6. `emit()` switch can miss custom mutation events 6. `emit()` 的 switch 可能漏掉自定义的变更类事件

If a subclass adds a result-producing event but forgets to override `emit()`, it will behave observationally. Tests should catch this. Could add a protected strategy registry later if this becomes error-prone, but not initially.
如果子类新增了一个会产生结果的事件却忘记覆写 `emit()`,该事件就会退化为纯观察行为。测试应当能发现这类问题。若后续证明这一点容易出错,可以再增加一个受保护的策略注册表,但初期不必如此。

### 7. Observer semantics are intentionally limited 7. 观察者语义是有意受限的

Observers see the original emitted event once. They do not see every intermediate mutation. If something needs final transformed state, emit a separate final event or use an event-specific handler.
观察者只会看到最初发出的事件一次,看不到中间的每一次变更。如果某处需要最终变换后的状态,应发出一个独立的终态事件,或使用针对该事件的专用处理器。

## Verdict 结论

This design can implement a new coding-agent. It is simpler than the current runner, keeps harness clean, and preserves the important extension capabilities as long as `CodingAgentHooks` adds source-aware scopes, registries, cleanup, and the exact old event semantics.
该设计足以实现一个全新的 coding-agent。它比当前的 runner 更简单,能保持 harness 的整洁,并且只要 `CodingAgentHooks` 补上来源感知的作用域、注册表、清理机制以及完全一致的旧事件语义,就能保留那些重要的扩展能力。

--- Comments --- --- 评论 ---

Thread hn2xk0tzhj on "addCleanup(cleanup"
  [tmluyaub9v] Owner (2026-05-14T12:55:45.500Z): cleanup should be passed along optionally to on/observe
  [tmluyaub9v] Owner (2026-05-14T12:55:45.500Z):cleanup 应当可选地一并传给 on/observe。
