<!-- Synced from jot qe0ikdqs. Edit this file in-repo going forward. -->

# Pi Observability Design Notes Pi 可观测性设计笔记

## Goal 目标

Make `packages/ai` and `packages/agent`/harness observable without depending on OpenTelemetry, Sentry, or any APM vendor.
在不依赖 OpenTelemetry、Sentry 或任何 APM 厂商的前提下,让 `packages/ai` 与 `packages/agent`/harness 具备可观测性。

Pi should emit stable, structured lifecycle events. External listeners can convert those events into OTel spans, Sentry spans, logs, metrics, or custom telemetry.
Pi 应当发出稳定、结构化的生命周期事件。外部监听器可以把这些事件转换为 OTel span、Sentry span、日志、指标或自定义遥测数据。

## Mental model 心智模型

A trace is one causal tree of work, e.g. one user turn.
一条追踪(trace)是一棵因果关系上的工作树,例如一次用户回合(turn)。

A span is one timed operation in that tree. It is normally represented by IDs, not object pointers:
一个 span 是该树中的一次计时操作。它通常以 ID 表示,而非对象指针:

```ts
interface SpanRecord {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  attributes: Record<string, unknown>;
  status: "ok" | "error";
}
```

Example tree:
示例树:

```text
traceId=t1 spanId=s1 parent=-  name=pi.agent.prompt
traceId=t1 spanId=s2 parent=s1 name=pi.agent.turn
traceId=t1 spanId=s3 parent=s2 name=pi.ai.provider.request
traceId=t1 spanId=s4 parent=s2 name=pi.agent.tool_call
traceId=t1 spanId=s5 parent=s4 name=pi.session.append_entry
```

## Async context 异步上下文

JavaScript has one event loop but multiple async chains can interleave. A single global `currentContext` breaks under concurrency.
JavaScript 只有一个事件循环,但多条异步链可以交错执行。单个全局的 `currentContext` 在并发场景下会失效。

`AsyncLocalStorage` is the Node equivalent of `ThreadLocal` for async continuations. It lets concurrent operations keep distinct current contexts:
`AsyncLocalStorage` 是 Node 中面向异步续体(async continuation)的 `ThreadLocal` 等价物。它让并发操作各自保持独立的当前上下文:

```ts
await Promise.all([
  runWithPiContext({ userId: "alice" }, () => harness.prompt("A")),
  runWithPiContext({ userId: "bob" }, () => harness.prompt("B")),
]);
```

Deep code can then read the correct current context for the active async chain.
这样,深层代码就能读取到当前活动异步链所对应的正确上下文。

Pi must run in Node, Bun, browser, workers, and other JS runtimes, so ALS cannot be the core abstraction. It should be a runtime adapter.
Pi 必须能运行在 Node、Bun、浏览器、worker 以及其他 JS 运行时中,因此 ALS 不能作为核心抽象,而应作为一个运行时适配器。

## Core design 核心设计

Pi owns a small runtime-agnostic observability abstraction:
Pi 自身拥有一层小巧的、与运行时无关的可观测性抽象:

```ts
export interface PiObservabilityContext {
  traceId?: string;
  currentSpanId?: string;
  userContext?: Record<string, unknown>;
}

export interface PiObservabilityEvent {
  type: "start" | "end" | "error" | "event";
  name: string;
  traceId: string;
  spanId?: string;
  parentSpanId?: string;
  timestamp: number;
  durationMs?: number;
  context?: Record<string, unknown>;
  payload?: Record<string, unknown>;
  error?: { name: string; message: string };
}

export interface PiObservability {
  getContext(): PiObservabilityContext | undefined;
  runWithContext<T>(context: PiObservabilityContext, fn: () => T): T;
  emit(event: PiObservabilityEvent): void;
  hasSubscribers(): boolean;
}
```

Public API:
公开 API:

```ts
export function configurePiObservability(observability: PiObservability): void;
export function subscribePiObservability(listener: (event: PiObservabilityEvent) => void): () => void;
export function runWithPiContext<T>(userContext: Record<string, unknown>, fn: () => T): T;
export function traceOperation<T>(name: string, payload: Record<string, unknown>, fn: () => T): T;
```

`traceOperation()`:
`traceOperation()` 的执行流程:

1. reads the current context
   读取当前上下文
2. creates `traceId` if missing
   若缺失则创建 `traceId`
3. creates a new `spanId`
   创建新的 `spanId`
4. uses current span as `parentSpanId`
   将当前 span 作为 `parentSpanId`
5. emits `start`
   发出 `start` 事件
6. runs callback under child context
   在子上下文中执行回调
7. emits `end` or `error`
   发出 `end` 或 `error` 事件
8. rethrows on error
   出错时重新抛出异常

Pseudo-code:
伪代码:

```ts
function traceOperation<T>(name: string, payload: Record<string, unknown>, fn: () => T): T {
  const parent = getContext();
  const traceId = parent?.traceId ?? createId();
  const spanId = createId();
  const parentSpanId = parent?.currentSpanId;

  const child = { ...parent, traceId, currentSpanId: spanId };

  emit({ type: "start", name, traceId, spanId, parentSpanId, timestamp: Date.now(), context: parent?.userContext, payload });

  return runWithContext(child, () => {
    try {
      const result = fn();
      // Promise-aware implementation emits end/error after settlement.
      emit({ type: "end", name, traceId, spanId, parentSpanId, timestamp: Date.now(), context: child.userContext, payload });
      return result;
    } catch (error) {
      emit({ type: "error", name, traceId, spanId, parentSpanId, timestamp: Date.now(), context: child.userContext, payload, error: serializeError(error) });
      throw error;
    }
  });
}
```

## Runtime adapters 运行时适配器

Core packages should not import Node-only APIs.
核心包不应引入仅 Node 可用的 API。

Possible implementations:
可能的实现方式:

- Node adapter: `AsyncLocalStorage` for context, optional `diagnostics_channel` publishing.
  Node 适配器:使用 `AsyncLocalStorage` 维护上下文,并可选地通过 `diagnostics_channel` 发布事件。
- Browser/workers fallback: local subscriber set and limited/manual context propagation.
  浏览器 / worker 回退方案:使用本地订阅者集合,并采用受限的 / 手动的上下文传播。
- Bun/Deno adapters: use runtime-specific async context if available.
  Bun / Deno 适配器:在可用时使用各运行时特有的异步上下文机制。

For Node, diagnostics channels can be used as a passive event bus:
在 Node 中,diagnostics channel 可以作为被动的事件总线使用:

```ts
import { channel } from "diagnostics_channel";
channel("pi.observability").publish(event);
```

Subscribers can create OTel/Sentry spans without monkey-patching pi.
订阅者无需对 pi 打猴子补丁(monkey-patch)即可创建 OTel / Sentry span。

## What pi emits pi 发出什么事件

Pi emits what happened. It does not create OTel/Sentry spans directly.
Pi 只描述发生了什么,不直接创建 OTel / Sentry span。

Initial minimal event names:
初始的最小事件名集合:

```text
pi.agent.prompt
pi.agent.skill
pi.agent.prompt_template
pi.agent.compaction
pi.agent.branch_navigation
pi.agent.session.append_entry
pi.ai.provider.request
```

Each operation emits:
每个操作都会发出:

```text
start
end
error
```

Later additions:
后续可增加:

```text
pi.agent.turn
pi.agent.tool_call
pi.agent.queue_update
pi.ai.provider.retry
pi.ai.provider.first_token
pi.ai.provider.usage
pi.session.read
pi.session.write
```

## Minimal instrumentation points 最小埋点集合

### packages/agent

Wrap:
需要包装的方法:

- `AgentHarness.prompt()`
- `AgentHarness.skill()`
- `AgentHarness.promptFromTemplate()`
- `AgentHarness.compact()`
- `AgentHarness.navigateTree()`
- `Session.appendTypedEntry()` or storage append facade
  `Session.appendTypedEntry()` 或存储层的追加门面(facade)

Example:
示例:

```ts
return traceOperation(
  "pi.agent.prompt",
  {
    sessionId: turnState.sessionId,
    provider: turnState.model.provider,
    model: turnState.model.id,
    promptLength: text.length,
    imageCount: options?.images?.length ?? 0,
  },
  () => this.executeTurn(turnState, text, options),
);
```

Session write:
session 写入:

```ts
return traceOperation(
  "pi.agent.session.append_entry",
  { entryType: entry.type },
  async () => {
    await this.unwrap(this.storage.appendEntry(entry));
    return entry.id;
  },
);
```

### packages/ai

Wrap common provider boundaries:
包装通用的 provider 边界:

- `streamSimple()`
- `completeSimple()`

Example:
示例:

```ts
return traceOperation(
  "pi.ai.provider.request",
  {
    api: model.api,
    provider: model.provider,
    model: model.id,
    sessionId: options.sessionId,
    reasoning: options.reasoning,
  },
  () => actualStreamSimple(model, context, options),
);
```

End/error payloads can include safe metadata:
end / error 事件的载荷中可以包含安全的元数据:

- stop reason
  停止原因
- status code
  状态码
- retry count
  重试次数
- input/output/total tokens
  输入 / 输出 / 总计 token 数
- cost total
  总花费
- aborted/timeout flag
  中止 / 超时标记

## Safety and redaction 安全与脱敏

Default payloads must be safe.
默认载荷必须是安全的。

Safe by default:
默认安全的字段:

- provider
  provider(提供方)
- model
  模型
- API identifier
  API 标识符
- session id
  session ID
- entry type
  条目类型
- tool name
  工具名称
- status code
  状态码
- stop reason
  停止原因
- token counts
  token 计数
- costs
  花费
- durations
  耗时

Unsafe by default:
默认不安全的字段:

- prompts
  提示词
- completions
  补全内容
- tool args
  工具参数
- tool results
  工具结果
- shell output
  shell 输出
- file contents
  文件内容
- provider request payloads
  provider 请求载荷
- provider response bodies
  provider 响应体
- API keys
  API 密钥
- headers
  请求头

Content capture can be opt-in later with explicit redaction hooks.
内容捕获可以在后续通过显式的脱敏钩子以选择性开启(opt-in)的方式支持。

## Listener behavior 监听器行为

Observability must never affect pi execution.
可观测性绝不能影响 pi 的执行。

Subscriber errors should be swallowed or isolated. Harness hooks are control-plane and may affect execution; observability subscribers are passive and must not.
订阅者的错误应被吞掉或隔离。harness 钩子属于控制面(control plane),可以影响执行;而可观测性订阅者是被动的,绝不能影响执行。

## User context 用户上下文

Users can associate arbitrary context with a turn:
用户可以为某个回合关联任意上下文:

```ts
await runWithPiContext(
  {
    userId: "u123",
    orgId: "acme",
    region: "eu",
  },
  () => harness.prompt("fix this"),
);
```

Every emitted event inside that async chain includes the context:
该异步链内发出的每个事件都会带上这份上下文:

```ts
{
  type: "start",
  name: "pi.ai.provider.request",
  traceId: "t1",
  spanId: "s3",
  parentSpanId: "s1",
  context: {
    userId: "u123",
    orgId: "acme",
    region: "eu",
  },
  payload: {
    provider: "anthropic",
    model: "claude-sonnet-4",
  },
}
```

An OTel adapter can map this to span attributes. A Sentry adapter can map it to Sentry context/spans. A custom user can log JSON.
OTel 适配器可以把它映射为 span 属性,Sentry 适配器可以映射为 Sentry 的 context / span,自定义使用者则可以直接输出 JSON 日志。

## Package story 包结构规划

Minimal initial package:
最初的最小包:

```text
packages/observability
  runtime-agnostic context + traceOperation + subscribe
```

Then:
然后:

```text
packages/ai
  emits pi.ai.* events

packages/agent
  emits pi.agent.* / pi.session.* events
```

Optional later:
后续可选:

```text
packages/observability-node
  AsyncLocalStorage + diagnostics_channel bridge

packages/otel
  subscribes to pi events and creates OpenTelemetry spans
```

## Thesis 核心论点

Pi defines a stable, safe event contract. Adapters define where events go.
Pi 定义稳定、安全的事件契约,适配器决定事件的去向。

This makes ai/harness observable without binding core packages to OTel, Sentry, Node-only APIs, or monkey-patching.
这使得 ai / harness 具备可观测性,同时无需把核心包绑定到 OTel、Sentry、仅 Node 可用的 API,也无需依赖猴子补丁。
