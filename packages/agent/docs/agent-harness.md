# AgentHarness lifecycle AgentHarness 生命周期

`AgentHarness` is the orchestration layer above the low-level agent loop. It owns session persistence, runtime configuration, resource resolution, operation locking, and extension-facing mutation semantics.

`AgentHarness` 是位于底层 agent 循环之上的编排层。它负责会话持久化、运行时配置、资源解析、操作锁定，以及面向扩展的变更（mutation）语义。

This document describes the current direction and implemented behavior. Some extension/session-facade details are planned and called out explicitly.

本文档描述当前的设计方向与已实现的行为。部分扩展/会话门面（session facade）的细节仍处于计划阶段，文中会明确指出。

## Ultimate lifecycle goal 终极生命周期目标

Harness listeners and hooks should be able to close over the `AgentHarness` instance and call public harness APIs from any event where those APIs are documented as allowed. Those calls must not corrupt in-flight turn snapshots, reorder persisted transcript entries, lose pending writes, deadlock settlement, or leave the harness in the wrong phase.

宿主（harness）的监听器与钩子（hooks）应当能够闭包捕获 `AgentHarness` 实例，并在任何文档允许的事件中调用宿主的公开 API。这些调用不得破坏进行中的回合快照（turn snapshot）、打乱已持久化的转录条目顺序、丢失待写入数据、造成结算（settlement）死锁，或使宿主停留在错误的阶段（phase）。

The intended rule is:

预期规则如下：

- structural operations remain rejected while busy
- 结构性操作在忙碌期间仍会被拒绝
- queue operations are accepted at documented turn-safe points
- 队列操作在文档所述的回合安全点（turn-safe point）被接受
- runtime config setters update future snapshots without mutating the current provider request
- 运行时配置的 setter 只更新后续快照，不会修改当前正在进行的 provider 请求
- session writes made while busy are durably queued and flushed in deterministic order
- 忙碌期间发起的会话写入会被持久化排队，并以确定的顺序刷新落盘
- getters return latest harness config, not in-flight snapshots
- getter 返回最新的宿主配置，而不是进行中的快照
- listeners/hooks currently receive no facade; if they close over the raw harness and call settlement APIs such as `waitForIdle()` during the active run, they can deadlock. A future facade should expose `runWhenIdle()` instead.
- 监听器/钩子目前不会收到任何门面对象；如果它们闭包捕获原始 harness，并在运行期间调用诸如 `waitForIdle()` 之类的结算 API，就可能死锁。未来的门面应改为暴露 `runWhenIdle()`。

`AssistantMessageStream` already decouples provider transport streaming, such as SSE or websocket reads, from downstream event consumption. The harness can therefore await listeners, extension hooks, persistence, and save-point work without blocking the provider transport reader or reintroducing ad hoc event queues. Lifecycle code should prefer explicit awaited sequencing at harness boundaries over fire-and-forget hook/event settlement.

`AssistantMessageStream` 已经将 provider 的传输层流式读取（如 SSE 或 websocket 读取）与下游事件消费解耦。因此宿主可以 await 监听器、扩展钩子、持久化以及保存点（save point）工作，而不会阻塞 provider 传输读取器，也无需重新引入临时的事件队列。生命周期代码应优先在宿主边界处采用显式的 await 顺序编排，而不是「发射后不管」（fire-and-forget）式的钩子/事件结算。

A final lifecycle hardening pass should prove these guarantees with a broad listener/hook reentrancy test suite.

最终的生命周期加固工作应通过一套覆盖面广的监听器/钩子重入性（reentrancy）测试套件来验证这些保证。

## Error handling 错误处理

The current split is:

当前的职责划分如下：

- low-level capabilities and helpers use `Result<TValue, TError>` where expected failures are contained and must not throw, such as `ExecutionEnv`, filesystem/shell operations, shell-output capture, resource loading, and compaction helpers
- 底层能力与辅助函数使用 `Result<TValue, TError>`，将预期内的失败包含在返回值中且不得抛出异常，例如 `ExecutionEnv`、文件系统/shell 操作、shell 输出捕获、资源加载以及压缩（compaction）辅助函数
- high-level mutation/orchestration APIs such as `Session` and `AgentHarness` reject/throw instead of returning bare results that can be ignored
- 高层的变更/编排 API（如 `Session` 与 `AgentHarness`）采用 reject/throw，而不是返回可能被忽略的裸结果对象
- public `AgentHarness` failures are normalized to `AgentHarnessError` where practical; subsystem errors are preserved as `cause`
- `AgentHarness` 的公开失败在可行的情况下统一归一化为 `AgentHarnessError`；子系统错误则保留在 `cause` 中

Harness events observe committed state. Public mutators validate required input and persistence before committing when practical, then await notifications. If a hook or subscriber fails after commit, the state change is not rolled back and the public method rejects with `AgentHarnessError` code `"hook"`.

宿主事件观察到的是已提交（committed）的状态。公开的变更方法在可行的情况下会先校验必需输入并完成持久化，然后再提交，最后 await 通知。如果钩子或订阅者在提交之后失败，状态变更不会回滚，公开方法会以 `AgentHarnessError` 的 `"hook"` 错误码 reject。

## State model 状态模型

The harness separates state into four categories.

宿主将状态划分为四类。

### Harness config 宿主配置

Harness config is the latest runtime configuration set by the application or extensions:

宿主配置是由应用或扩展设置的最新运行时配置：

- model
- 模型（model）
- thinking level
- 思考等级（thinking level）
- tools
- 工具集（tools）
- active tool names
- 激活工具名称（active tool names）
- tool context source
- 工具上下文来源（tool context source）
- resources
- 资源（resources）
- stream options
- 流式选项（stream options）
- system prompt or system prompt provider
- 系统提示词，或系统提示词提供器（system prompt provider）

Getters return harness config. They do not return the snapshot used by an in-flight provider request.

getter 返回的是宿主配置，而不是进行中的 provider 请求所使用的快照。

Setters update harness config immediately, including while a turn is in flight. Changes affect the next turn snapshot, not the currently running provider request.

setter 会立即更新宿主配置，即使某个回合正在进行中也是如此。变更影响的是下一个回合快照，而非当前正在运行的 provider 请求。

`setResources()` accepts concrete resources and emits `resources_update` on every call with shallow-copied current and previous resources. Applications own loading/reloading resources from disk or other sources and should call `setResources()` with new values.

`setResources()` 接受具体的资源对象，并在每次调用时发出 `resources_update` 事件，携带浅拷贝的当前资源与先前资源。应用自身负责从磁盘或其他来源加载/重新加载资源，并应以新值调用 `setResources()`。

`getResources()` returns shallow-copied current resources. It is a live config read, not the last turn snapshot.

`getResources()` 返回浅拷贝的当前资源。它是一次实时的配置读取，而不是上一个回合快照。

### Turn snapshot 回合快照

A turn snapshot is the concrete state used for one LLM turn. It is created by `createTurnState()` and contains:

回合快照是某一次 LLM 回合所使用的具体状态。它由 `createTurnState()` 创建，包含：

- persisted session messages
- 已持久化的会话消息
- resolved resources
- 已解析的资源
- resolved system prompt
- 已解析的系统提示词
- model
- 模型
- thinking level
- 思考等级
- all tools
- 全部工具
- active tools
- 激活工具
- resolved tool context
- 已解析的工具上下文
- stream options
- 流式选项
- derived session id
- 派生出的会话 id

Static option values are used directly. System-prompt provider callbacks are invoked once per `createTurnState()` call. All logic for that turn uses the same snapshot.

静态选项值会被直接使用。系统提示词提供器回调在每次 `createTurnState()` 调用时被执行一次。该回合中的所有逻辑都使用同一个快照。

Resource arrays are shallow-copied when a snapshot is created. Individual skill and prompt-template objects are not deep-copied.

创建快照时会对资源数组做浅拷贝。单个 skill 与 prompt-template 对象不会被深拷贝。

`toolContext` is application-defined and required when the configured tools require a non-`undefined` context. A static value is reused, while a zero-argument sync or async provider is resolved once for each turn snapshot. Harness tools receive that resolved value when they execute. Individual tools can structurally require only the context fields they use.

`toolContext` 由应用自行定义；当所配置的工具需要一个非 `undefined` 的上下文时，它是必需的。静态值会被复用，而无参的同步或异步提供器会在每个回合快照中被解析一次。宿主工具在执行时会收到这个解析后的值。各个工具在结构上只需声明自己实际使用的上下文字段。

Stream options are shallow-copied when a snapshot is created. `headers` and `metadata` maps are shallow-copied; their values are not deep-copied. Credentials from `getApiKeyAndHeaders()` are resolved per provider request so expiring tokens can refresh, but the configured stream options and derived session id come from the current turn snapshot.

创建快照时会对流式选项做浅拷贝。`headers` 与 `metadata` 映射同样是浅拷贝，其内部的值不会被深拷贝。来自 `getApiKeyAndHeaders()` 的凭据会在每次 provider 请求时解析，以便即将过期的令牌可以刷新；但已配置的流式选项与派生的会话 id 来自当前回合快照。

### Built-in tools 内置工具

The package exports `createReadTool()`, `createWriteTool()`, `createEditTool()`, and `createBashTool()`. They perform filesystem and shell operations exclusively through the `ExecutionEnv` supplied in their tool context. Each tool structurally requires the shared `ExecutionToolContext`, containing `env: ExecutionEnv`; applications may provide additional fields. `createReadTool()` accepts an optional image processor for host-provided conversion and resizing without imposing an image-processing dependency on the agent package. `createBashTool()` accepts an async `prepare` hook that can mutate the command, working directory, environment, and environment-inheritance policy using the current tool context.

本包导出 `createReadTool()`、`createWriteTool()`、`createEditTool()` 与 `createBashTool()`。它们只通过工具上下文中提供的 `ExecutionEnv` 执行文件系统与 shell 操作。每个工具在结构上都要求共享的 `ExecutionToolContext`（其中包含 `env: ExecutionEnv`）；应用可以提供额外字段。`createReadTool()` 接受一个可选的图像处理器，用于由宿主提供的图像转换与缩放，从而避免为 agent 包引入图像处理依赖。`createBashTool()` 接受一个异步的 `prepare` 钩子，可基于当前工具上下文修改命令、工作目录、环境变量以及环境继承策略。

### Session 会话

The session contains persisted entries only. Session reads return persisted state and do not include queued writes.

会话只包含已持久化的条目。会话读取返回的是已持久化状态，不包含排队中的写入。

`Session.buildContextEntries()` returns the compaction-aware entry sequence used for model context construction. `Session.buildContext()` derives runtime state from the full active branch, then projects those context entries to `AgentMessage[]`. Custom entries are omitted from model context by default; applications can pass `entryProjectors` to the `Session` constructor or `buildContext()` to project selected custom entries into messages. Applications can also pass stacked `entryTransforms`, which run after the default compaction transform, to filter or reorder context entries before projection.

`Session.buildContextEntries()` 返回用于构建模型上下文的、感知压缩（compaction）的条目序列。`Session.buildContext()` 先从完整的活动分支中推导运行时状态，再将这些上下文条目投影为 `AgentMessage[]`。自定义条目默认不会进入模型上下文；应用可以向 `Session` 构造函数或 `buildContext()` 传入 `entryProjectors`，以便将选定的自定义条目投影为消息。应用还可以传入可叠加的 `entryTransforms`，它们在默认的压缩转换之后运行，用于在投影前过滤或重排上下文条目。

Session storage implementations must persist leaf changes as `leaf` entries. `setLeafId()` is not an in-memory-only cursor update; it appends a durable entry whose `targetId` is the active tree leaf or `null` for root. Reopening storage must reconstruct the current leaf from the latest persisted leaf-affecting entry.

会话存储实现必须将叶节点（leaf）变更持久化为 `leaf` 条目。`setLeafId()` 并非仅在内存中更新游标；它会追加一条持久条目，其 `targetId` 为当前活动的树叶节点，若为根节点则为 `null`。重新打开存储时，必须依据最近一条持久化的、影响叶节点的条目来重建当前叶节点。

### Pending session writes 待处理会话写入

Session writes requested while an operation is active are queued as pending session writes. Pending writes are based on session-entry shapes without generated fields (`id`, `parentId`, `timestamp`).

在某个操作进行期间请求的会话写入会被排入待处理会话写入队列。待处理写入基于会话条目的结构，但不包含自动生成的字段（`id`、`parentId`、`timestamp`）。

Pending session writes are always persisted. They are flushed at save points, at operation settlement, and in failure cleanup.

待处理会话写入始终会被持久化。它们会在保存点、操作结算时以及失败清理过程中被刷新落盘。

A public pending-writes/session-facade API is planned but not implemented yet.

面向公开的待处理写入 / 会话门面 API 已在规划中，但尚未实现。

## Operation phases 操作阶段

The harness has an explicit phase:

宿主拥有一个显式的阶段（phase）：

```ts
type AgentHarnessPhase = "idle" | "turn" | "compaction" | "branch_summary" | "retry";
```

Structural operations require `phase === "idle"` and synchronously set the phase before the first `await`:

结构性操作要求 `phase === "idle"`，并且会在第一个 `await` 之前同步地设置该阶段：

- `prompt`
- `skill`
- `promptFromTemplate`
- `compact`
- `navigateTree`

Starting another structural operation while the harness is not idle rejects with `AgentHarnessError` code `"busy"`.

在宿主非空闲状态下启动另一个结构性操作，会以 `AgentHarnessError` 的 `"busy"` 错误码 reject。

The following operations are allowed during a turn where appropriate:

在合适的情况下，以下操作允许在回合进行中执行：

- `steer`
- `followUp`
- `nextTurn`
- `abort`
- runtime config setters
- 运行时配置的 setter

Phase/settlement semantics are still provisional and need a full lifecycle pass.

阶段/结算语义仍是临时方案，需要一次完整的生命周期梳理。

## Turn execution 回合执行

`prompt`, `skill`, and `promptFromTemplate` follow the same flow:

`prompt`、`skill` 与 `promptFromTemplate` 遵循相同的流程：

1. Assert idle and set phase to `"turn"`.
1. 断言处于空闲状态，并将阶段设置为 `"turn"`。
2. Create a turn snapshot with `createTurnState()`.
2. 使用 `createTurnState()` 创建回合快照。
3. Derive invocation text from that snapshot.
3. 从该快照推导出调用文本。
4. Execute the turn with `executeTurn()`.
4. 使用 `executeTurn()` 执行该回合。

`skill` and `promptFromTemplate` resolve their resource from the same snapshot that is passed to the turn. They do not resolve resources separately.

`skill` 与 `promptFromTemplate` 从传给该回合的同一个快照中解析各自的资源，不会单独进行资源解析。

`steer`, `followUp`, and `nextTurn` accept text plus optional images and create user messages internally. `nextTurn` messages are inserted before the new user message on the next user-initiated turn.

`steer`、`followUp` 与 `nextTurn` 接受文本以及可选的图像，并在内部创建用户消息。`nextTurn` 的消息会在下一次由用户发起的回合中被插入到新用户消息之前。

Queue modes are live, not turn-snapshotted:

队列模式是实时的，不会被纳入回合快照：

- `getSteeringMode()` / `setSteeringMode()`
- `getFollowUpMode()` / `setFollowUpMode()`

Changing a queue mode during a run affects the next queue drain. Queue drains happen at safe points.

在运行过程中修改队列模式会影响下一次队列排空（drain）。队列排空发生在安全点上。

## Save points 保存点

A save point occurs after an assistant turn and its tool-result messages have completed.

保存点发生在一次 assistant 回合及其工具结果消息全部完成之后。

At a save point the harness:

在保存点上，宿主会：

1. flushes pending session writes after the agent-emitted messages for that turn
1. 在该回合由 agent 发出的消息之后，刷新待处理的会话写入
2. creates a fresh turn snapshot if the low-level loop may continue
2. 如果底层循环可能继续，则创建一个新的回合快照
3. applies the fresh context/model/thinking-level/stream-options/session-id state before the next provider request
3. 在下一次 provider 请求之前，应用新的上下文/模型/思考等级/流式选项/会话 id 状态

This lets model, thinking level, tool, resource, stream option, and system prompt changes made during a turn affect the next turn in the same run, while never mutating an in-flight provider request. Because provider transport reading is already decoupled by `AssistantMessageStream`, save-point work and hook settlement can be awaited directly to keep transcript/session ordering deterministic. The loop callbacks are not recreated at save points.

这使得在回合进行中所做的模型、思考等级、工具、资源、流式选项与系统提示词变更，能够在同一次运行的下一个回合中生效，同时绝不修改进行中的 provider 请求。由于 provider 的传输读取已由 `AssistantMessageStream` 解耦，保存点工作与钩子结算可以直接被 await，以保持转录/会话顺序的确定性。循环回调不会在保存点被重新创建。

The low-level loop converts harness `ThinkingLevel` to provider `reasoning` at the provider boundary:

底层循环会在 provider 边界处将宿主的 `ThinkingLevel` 转换为 provider 的 `reasoning`：

- `"off"` -> `undefined`
- all other thinking levels pass through
- 其他所有思考等级原样透传

No state refresh is needed on `agent_end` except flushing leftover pending session writes and clearing the operation phase. The exact `settled` event timing is still under review.

在 `agent_end` 时不需要刷新状态，只需刷新剩余的待处理会话写入并清除操作阶段。`settled` 事件的确切触发时机仍在评估中。

If the system-prompt callback throws while starting `prompt`, `skill`, or `promptFromTemplate`, the operation rejects with `AgentHarnessError` and the harness returns to idle. If it throws from the save-point snapshot created by `prepareNextTurn`, the low-level agent run records an assistant error message.

如果系统提示词回调在启动 `prompt`、`skill` 或 `promptFromTemplate` 时抛出异常，该操作会以 `AgentHarnessError` reject，宿主返回空闲状态。如果异常来自 `prepareNextTurn` 创建的保存点快照，则底层 agent 运行会记录一条 assistant 错误消息。

## Hooks and events 钩子与事件

The target hook system is described in [hooks.md](./hooks.md).

目标钩子系统在 [hooks.md](./hooks.md) 中描述。

Summary:

概要：

- `AgentHarness` emits typed hook events and consumes typed results.
- `AgentHarness` 发出带类型的钩子事件，并消费带类型的结果。
- A single hooks implementation owns registration, cleanup, provenance, and result reducers.
- 由单一的 hooks 实现负责注册、清理、来源（provenance）追踪与结果归约器（reducer）。
- Observational and mutation hooks use one event-specific `on()` API; the event result type determines whether a handler may return a result.
- 观察型钩子与变更型钩子共用同一个按事件区分的 `on()` API；事件的结果类型决定处理器是否可以返回结果。
- Result-producing events are reduced by typed reducer tables; app-specific hooks add reducers only for app-specific result-producing events.
- 产生结果的事件由带类型的归约器表进行归约；应用特有的钩子只需为应用特有的、产生结果的事件添加归约器。
- Hook registration provenance is sidecar metadata on the registration. Resource and tool provenance belongs on app-specific concrete value types.
- 钩子注册的来源信息是附加在注册项上的旁路（sidecar）元数据。资源与工具的来源信息则应归属于应用特有的具体值类型。
- Hook context should be a plain object of facades, not raw internals or late-bound getter mazes.
- 钩子上下文应当是一个由门面对象构成的普通对象，而不是原始内部实现或层层嵌套的延迟绑定 getter。

Event payloads describe what is happening. Harness getters describe latest config for future snapshots. Hook and listener settlement should be awaited in lifecycle order where possible; transport backpressure is handled below the harness by `AssistantMessageStream`, so the harness does not need a separate async event queue merely to keep SSE or websocket reads flowing.

事件负载描述的是「正在发生什么」。宿主 getter 描述的是用于未来快照的最新配置。钩子与监听器的结算应尽可能按生命周期顺序 await；传输层的背压由宿主之下的 `AssistantMessageStream` 处理，因此宿主无需仅为了保持 SSE 或 websocket 读取畅通而单独维护一个异步事件队列。

### Summarization retry events 摘要生成重试事件

When the harness is configured with a retry policy, generated compaction and branch-summary requests emit retry lifecycle events for transient provider errors:

当宿主配置了重试策略时，生成式的压缩（compaction）与分支摘要（branch summary）请求会针对暂时性的 provider 错误发出重试生命周期事件：

- `retry_scheduled`: a retry was scheduled. Includes `operation: "compaction" | "branch_summary"`, `attempt`, `maxAttempts`, `delayMs`, and `errorMessage`.
- `retry_scheduled`：已安排一次重试。包含 `operation: "compaction" | "branch_summary"`、`attempt`、`maxAttempts`、`delayMs` 与 `errorMessage`。
- `retry_attempt_start`: the backoff delay completed and the retried summarization request is starting. Includes `operation`.
- `retry_attempt_start`：退避延迟已结束，重试的摘要生成请求正在启动。包含 `operation`。
- `retry_finished`: the retry loop finished after success, exhaustion, or abort. Includes `operation`.
- `retry_finished`：重试循环在成功、重试耗尽或中止后结束。包含 `operation`。

These events are observational and do not accept hook results.

这些事件属于观察型事件，不接受钩子返回结果。

## Planned session facade 计划中的会话门面

Extensions should eventually interact with a harness-scoped `HarnessSession` facade rather than the raw session. The facade should wrap the internal session and enforce harness pending-write ordering semantics. Once this exists, hooks and event listeners can receive a context that exposes the full `AgentHarness` plus the session facade without giving direct access to unordered raw session writes.

扩展最终应当通过宿主作用域内的 `HarnessSession` 门面进行交互，而不是直接使用原始会话。该门面应包装内部会话，并强制执行宿主的待处理写入排序语义。一旦它落地，钩子与事件监听器就可以获得一个同时暴露完整 `AgentHarness` 与会话门面的上下文，而不必直接开放无序的原始会话写入能力。

Planned read semantics:

计划中的读取语义：

- reads delegate to persisted session state
- 读取委托给已持久化的会话状态
- reads do not include queued pending writes
- 读取不包含排队中的待处理写入

Planned write semantics:

计划中的写入语义：

- idle: persist immediately
- 空闲时：立即持久化
- busy: enqueue as pending session writes
- 忙碌时：作为待处理会话写入入队

A planned diagnostics API may expose pending writes explicitly:

计划中的诊断 API 可能会显式暴露待处理写入：

```ts
getPendingWrites(): readonly PendingSessionWrite[]
```

Agent-emitted messages are persisted on `message_end` to preserve transcript ordering. Pending extension/session writes flush after those messages at save points.

由 agent 发出的消息会在 `message_end` 时持久化，以保持转录顺序。扩展/会话的待处理写入则在保存点上、这些消息之后刷新落盘。

## Abort 中止

Abort is allowed during a turn. It aborts the low-level run and clears steering/follow-up queues.

中止（abort）允许在回合进行中执行。它会中止底层运行，并清空 steering / follow-up 队列。

Abort does not clear `nextTurn` messages. Messages queued with `nextTurn()` survive abort and are inserted before the user message on the next user-initiated turn.

中止不会清除 `nextTurn` 消息。通过 `nextTurn()` 入队的消息在中止后依然保留，并会在下一次由用户发起的回合中被插入到用户消息之前。

Abort does not discard pending session writes. Pending writes flush at the next save point if reached, at `agent_end`, or in operation failure cleanup.

中止不会丢弃待处理的会话写入。待处理写入会在到达下一个保存点时、在 `agent_end` 时，或在操作失败清理过程中刷新落盘。

Abort barrier semantics still need an audit.

中止屏障（abort barrier）语义仍需进一步审查。

## Compaction and tree navigation 压缩与树导航

Compaction and tree navigation are structural session mutations.

压缩（compaction）与树导航（tree navigation）属于结构性的会话变更。

They are allowed only while idle and are not queued. They operate on persisted session state. The next prompt creates a fresh turn snapshot.

它们只允许在空闲状态下执行，并且不会排队。它们作用于已持久化的会话状态。下一次 prompt 会创建一个新的回合快照。

Branch summary generation is part of the tree navigation operation.

分支摘要生成是树导航操作的一部分。

Auto-compaction and retry decision points are not implemented in `AgentHarness` yet.

自动压缩与重试决策点尚未在 `AgentHarness` 中实现。

## Test organization 测试组织

Harness tests should stay focused by area instead of growing one large catch-all file.

宿主测试应按领域保持聚焦，而不是膨胀成一个包罗万象的大文件。

Current structure:

当前结构：

- `packages/agent/test/harness/agent-harness.test.ts`: core lifecycle and public API behavior.
- `packages/agent/test/harness/agent-harness.test.ts`：核心生命周期与公开 API 行为。
- `packages/agent/test/harness/agent-harness-stream.test.ts`: stream options and provider hook semantics.
- `packages/agent/test/harness/agent-harness-stream.test.ts`：流式选项与 provider 钩子语义。

Preferred future structure:

期望的未来结构：

- `agent-harness-resources.test.ts`: resource snapshot/loading semantics.
- `agent-harness-resources.test.ts`：资源快照/加载语义。
- `agent-harness-tools.test.ts`: tool registry getters, active-tool semantics, and update events.
- `agent-harness-tools.test.ts`：工具注册表的 getter、激活工具语义与更新事件。
- `agent-harness-lifecycle.test.ts`: phase/save-point/settled/reentrancy behavior.
- `agent-harness-lifecycle.test.ts`：阶段/保存点/`settled`/重入行为。

Use the `pi-ai` faux provider (`registerFauxProvider`, `fauxAssistantMessage`) for deterministic harness/provider tests. Faux response factories can inspect `StreamOptions`, invoke `options.onPayload`, and return scripted assistant messages without real provider APIs or network access.

使用 `pi-ai` 的伪造 provider（`registerFauxProvider`、`fauxAssistantMessage`）来编写确定性的宿主/provider 测试。伪造响应工厂可以检查 `StreamOptions`、调用 `options.onPayload`，并返回预设的 assistant 消息，无需真实的 provider API 或网络访问。

Harness coverage is configured separately from the default package test run:

宿主的覆盖率配置独立于包的默认测试运行：

```bash
npm run test:harness
npm run coverage:harness
```

`coverage:harness` runs `test/harness/**/*.test.ts` and reports coverage for `src/harness/**/*.ts` plus the non-harness runtime files it directly exercises (`src/agent.ts` and `src/agent-loop.ts`) into `coverage/harness`. Type-only dependencies such as `src/types.ts` are not included because they have no meaningful runtime coverage.

`coverage:harness` 会运行 `test/harness/**/*.test.ts`，并将 `src/harness/**/*.ts` 以及它直接触及的非宿主运行时文件（`src/agent.ts` 与 `src/agent-loop.ts`）的覆盖率报告输出到 `coverage/harness`。诸如 `src/types.ts` 这类纯类型依赖不会被纳入，因为它们没有有意义的运行时覆盖率。

## Implementation todo 实现待办

This list tracks the remaining work before treating `AgentHarness` as migration-ready. Active/planned items are ordered from easiest to hardest. Completed items are archived at the bottom.

本列表跟踪在将 `AgentHarness` 视为「可迁移」状态之前的剩余工作。进行中/计划中的条目按从易到难排序。已完成的条目归档在文末。

### 1. Add explicit tool registry read/update semantics 添加显式的工具注册表读取/更新语义

Status: In progress

状态：进行中

Done:

已完成：

- Added `setTools(tools, activeToolNames?)`.
- 新增 `setTools(tools, activeToolNames?)`。
- Added `setActiveTools(toolNames)`.
- 新增 `setActiveTools(toolNames)`。
- Invalid active tool names reject with `AgentHarnessError`.
- 非法的激活工具名称会以 `AgentHarnessError` reject。
- Added generic app tool and context shapes via `AgentHarness<TContext, TSkill, TPromptTemplate, TTool>`.
- 通过 `AgentHarness<TContext, TSkill, TPromptTemplate, TTool>` 提供了泛型的应用工具与上下文结构。
- Exported `QueueMode` from core types.
- 从核心类型中导出了 `QueueMode`。
- Added `AgentHarnessOptions.steeringMode` and `followUpMode`.
- 新增 `AgentHarnessOptions.steeringMode` 与 `followUpMode`。
- Added live `getSteeringMode()` / `setSteeringMode()` and `getFollowUpMode()` / `setFollowUpMode()`.
- 新增实时的 `getSteeringMode()` / `setSteeringMode()` 与 `getFollowUpMode()` / `setFollowUpMode()`。
- Added `getTools()` and `getActiveTools()`.
- 新增 `getTools()` 与 `getActiveTools()`。
- Added `tools_update` observability events, including active-tool-only updates.
- 新增 `tools_update` 可观测性事件，包括仅涉及激活工具的更新。
- Active tool changes are persisted as branch-scoped `active_tools_change` entries.
- 激活工具的变更以分支作用域的 `active_tools_change` 条目持久化。
- Duplicate tool names and duplicate active tool names reject.
- 重复的工具名称与重复的激活工具名称会被拒绝。

Remaining:

待完成：

- None.
- 无。

Notes:

备注：

- Observability design: [observability.md](./observability.md)
- 可观测性设计：[observability.md](./observability.md)

### 2. Design per-`AgentHarness` model registry 设计每个 `AgentHarness` 独立的模型注册表

Status: Planned

状态：计划中

Done:

已完成：

- Current `setModel()` behavior is preserved.
- 保留当前的 `setModel()` 行为。

Remaining:

待完成：

- Decide how applications supply the model registry.
- 确定应用以何种方式提供模型注册表。
- Decide whether the harness stores concrete `Model` objects, model references, or both.
- 确定宿主存储的是具体的 `Model` 对象、模型引用，还是两者兼有。
- Validate model selection against the registry.
- 依据注册表校验模型选择。
- Define model change semantics during active turns and save points.
- 定义回合进行中与保存点上的模型变更语义。

### 3. Full `AgentHarness` lifecycle/state pass 完整梳理 `AgentHarness` 的生命周期/状态

Status: In progress

状态：进行中

Done:

已完成：

- Removed constructor `void syncFromTree()`, `syncFromTree()`, `liveOperationId`, and `shell()`.
- 移除了构造函数中的 `void syncFromTree()`、`syncFromTree()`、`liveOperationId` 与 `shell()`。
- Added `createTurnState()`, `applyTurnState()`, and `executeTurn()`.
- 新增 `createTurnState()`、`applyTurnState()` 与 `executeTurn()`。
- Added explicit `phase` in place of boolean idle state.
- 以显式的 `phase` 取代布尔型的空闲状态。
- Save points refresh context, model, thinking level, stream options, and session snapshot state.
- 保存点会刷新上下文、模型、思考等级、流式选项与会话快照状态。
- Pending session writes use session-entry shapes without generated fields.
- 待处理会话写入使用不含自动生成字段的会话条目结构。
- Pending session writes flush at save points, settlement, and failure cleanup.
- 待处理会话写入在保存点、结算与失败清理时刷新落盘。
- `steer`, `followUp`, and `nextTurn` create user messages from text plus optional images.
- `steer`、`followUp` 与 `nextTurn` 根据文本及可选图像创建用户消息。
- `nextTurn` messages are inserted before the new user prompt.
- `nextTurn` 消息会被插入到新的用户 prompt 之前。
- Structural compaction/tree operations restore phase with `finally`.
- 结构性的压缩/树操作通过 `finally` 恢复阶段状态。
- Public harness failures normalize subsystem causes to `AgentHarnessError`.
- 宿主的公开失败会将子系统原因归一化为 `AgentHarnessError`。
- Pending session writes flush one-by-one and are not dropped on failure.
- 待处理会话写入逐条刷新，失败时不会被丢弃。
- Queue drains roll back if queue-update notification fails.
- 若队列更新通知失败，队列排空会回滚。
- `message_end` persistence happens before subscriber notification.
- `message_end` 的持久化发生在通知订阅者之前。
- `abort()` signals cancellation before notifications and still waits for idle through notification errors.
- `abort()` 在发出通知之前先触发取消信号，并且即便通知过程出错也仍会等待进入空闲状态。
- Idle model/thinking/tool updates validate and persist before committing in-memory state.
- 空闲状态下的模型/思考等级/工具更新会先校验并持久化，然后再提交内存状态。
- `setLeafId()` persists durable `leaf` entries so tree navigation survives storage reopen.
- `setLeafId()` 会持久化 `leaf` 条目，使树导航状态在存储重新打开后依然有效。

Remaining:

待完成：

- Finalize phase/idle semantics.
- 敲定阶段/空闲语义。
- Audit whether `settled` can fire too early.
- 审查 `settled` 是否可能过早触发。
- Make session writes inside `settled` callbacks deterministic.
- 使 `settled` 回调内部的会话写入具备确定性。
- Audit follow-up behavior around `agent_end`.
- 审查 `agent_end` 前后的 follow-up 行为。
- Implement auto-compaction decision point.
- 实现自动压缩的决策点。
- Implement retry handling.
- 实现重试处理。
- Verify `before_agent_start` hook semantics against coding-agent.
- 对照 coding-agent 验证 `before_agent_start` 钩子的语义。
- Decide whether `before_agent_start` needs more turn info such as tools/tool snippets.
- 确定 `before_agent_start` 是否需要更多回合信息，例如工具/工具片段。
- Document or change runtime config event timing while busy.
- 记录或调整忙碌期间运行时配置事件的触发时机。
- Audit `abort()` barrier semantics.
- 审查 `abort()` 的屏障语义。

### 4. Implement generic hook/event extension mechanism 实现通用的钩子/事件扩展机制

Status: Designed in [hooks.md](./hooks.md), not implemented

状态：已在 [hooks.md](./hooks.md) 中完成设计，尚未实现

Done:

已完成：

- Removed `AgentHarnessContext`.
- 移除了 `AgentHarnessContext`。
- Hooks receive only event payloads.
- 钩子仅接收事件负载。
- `emitHook(event)` derives the hook type from `event.type`.
- `emitHook(event)` 依据 `event.type` 推导钩子类型。
- Provider request/payload hooks have ordered transform semantics.
- provider 请求/负载钩子具备有序的转换语义。

Remaining:

待完成：

- Add `HookEvent`, `ResultOf`, registration options with generic source metadata, and the single `AgentHarnessHooks` implementation.
- 新增 `HookEvent`、`ResultOf`、带泛型来源元数据的注册选项，以及单一的 `AgentHarnessHooks` 实现。
- Move result chaining out of `AgentHarness` into reducer functions.
- 将结果链式处理从 `AgentHarness` 中移出，交由归约函数负责。
- Type-check base harness reducers so every result-producing `AgentHarnessEvent` has reducer semantics.
- 对基础宿主归约器进行类型检查，确保每个产生结果的 `AgentHarnessEvent` 都具备归约语义。
- Make `AgentHarness` accept and expose the concrete hooks instance with constructor inference for app-specific hooks.
- 让 `AgentHarness` 接受并暴露具体的 hooks 实例，并通过构造函数推导支持应用特有的钩子。
- Define the initial harness/context facades exposed through hook context.
- 定义通过钩子上下文暴露的初始宿主/上下文门面。
- Preserve current provider hook behavior, including stream option patch deletion semantics.
- 保留当前的 provider 钩子行为，包括流式选项补丁的删除语义。
- Add parity tests for reducer semantics: transform chaining, patch chaining, early block/cancel, cleanup, source metadata, and typed app-specific reducer coverage.
- 为归约语义添加对等性测试：转换链、补丁链、提前阻断/取消、清理、来源元数据，以及应用特有归约器的类型化覆盖。

Notes:

备注：

- Hook design: [hooks.md](./hooks.md)
- 钩子设计：[hooks.md](./hooks.md)

### 5. Spike semi-durable harness/session recovery 探索半持久化的宿主/会话恢复

Status: Planned

状态：计划中

Done:

已完成：

- Wrote durability design: [durable-harness.md](./durable-harness.md)
- 已编写持久化设计文档：[durable-harness.md](./durable-harness.md)

Remaining:

待完成：

- Decide whether session owns all durable harness state or whether any sidecars are needed for large blobs.
- 确定是否由会话持有全部持久化的宿主状态，或大块二进制数据是否需要旁路存储（sidecar）。
- Define durable entries for queues, pending writes, operations, turns, provider requests, and tool calls.
- 为队列、待处理写入、操作、回合、provider 请求与工具调用定义持久化条目。
- Define resume requirements for app-provided tools, models, extensions, resources, hooks, and auth providers.
- 定义应用提供的工具、模型、扩展、资源、钩子与认证提供器的恢复要求。
- Define conservative recovery policy for unfinished agent turns, provider requests, tool calls, compaction, and tree navigation.
- 为未完成的 agent 回合、provider 请求、工具调用、压缩与树导航定义保守的恢复策略。
- Prototype reducer-based recovery from session entries.
- 基于会话条目原型验证归约器式的恢复方案。
- Decide whether interrupted operations append user-visible messages or only internal operation entries.
- 确定被中断的操作是追加用户可见的消息，还是仅追加内部操作条目。

Notes:

备注：

- Provider streams are not resumable; recovery should restart from durable boundaries or mark operations interrupted.
- provider 流不可恢复续传；恢复应从持久化边界处重新开始，或将操作标记为已中断。
- Unfinished tool calls are unsafe to retry unless tools declare idempotent/retry-safe behavior.
- 除非工具声明自身是幂等/可安全重试的，否则重试未完成的工具调用是不安全的。

### 6. Final lifecycle hardening suite 最终的生命周期加固测试套件

Status: Planned

状态：计划中

Done:

已完成：

- None.
- 无。

Remaining:

待完成：

- Add broad listener/hook reentrancy tests across relevant events.
- 针对相关事件添加覆盖面广的监听器/钩子重入测试。
- Test runtime config setters from low-level lifecycle events and harness events.
- 测试从底层生命周期事件与宿主事件中调用运行时配置 setter 的行为。
- Test runtime config observability for model, thinking, resources, tools, active tools, and stream options.
- 测试模型、思考等级、资源、工具、激活工具与流式选项的运行时配置可观测性。
- Test resource/tool/model/thinking/stream-option updates during active turns and save points.
- 测试在回合进行中与保存点上进行资源/工具/模型/思考等级/流式选项更新的行为。
- Test session writes from listeners and hooks, including `settled` writes.
- 测试来自监听器与钩子的会话写入，包括 `settled` 阶段的写入。
- Test queue operations from turn events, tool events, and provider hooks.
- 测试来自回合事件、工具事件与 provider 钩子的队列操作。
- Test rejected structural operations while busy.
- 测试忙碌期间结构性操作被拒绝的行为。
- Test abort from listeners/hooks.
- 测试从监听器/钩子中触发中止的行为。
- Test getter behavior during active operations.
- 测试操作进行期间 getter 的行为。
- Test deterministic ordering of agent-emitted messages and pending listener writes.
- 测试 agent 发出的消息与监听器待处理写入之间的确定性顺序。
- Test no deadlocks when async listeners call harness APIs and await them.
- 测试异步监听器调用并 await 宿主 API 时不会发生死锁。
- Test phase cleanup through success, provider error, hook error, abort, compaction, and tree navigation.
- 测试在成功、provider 错误、钩子错误、中止、压缩与树导航等路径下的阶段清理。

### 7. Later coding-agent migration plan 后续 coding-agent 迁移计划

Status: Planned

状态：计划中

Done:

已完成：

- None.
- 无。

Remaining:

待完成：

- Map coding-agent resources to sourced loaders.
- 将 coding-agent 的资源映射到带来源信息的加载器。
- Keep app-level resource dedupe/provenance outside the harness.
- 将应用级的资源去重/来源追踪保持在宿主之外。
- Adapt extension loading to the future hook/session facade.
- 使扩展加载适配未来的钩子/会话门面。
- Preserve UI/session behavior outside core.
- 在核心之外保留 UI/会话行为。
- Move coding-agent stream/auth/retry/header behavior onto harness stream configuration and provider hooks.
- 将 coding-agent 的流式/认证/重试/请求头行为迁移到宿主的流式配置与 provider 钩子上。

---

## Completed implementation todo 已完成的实现待办

### 8. Remove `Agent` dependency from `AgentHarness` 移除 `AgentHarness` 对 `Agent` 的依赖

Status: Done

状态：已完成

Done:

已完成：

- `AgentHarness` calls `runAgentLoop()` directly.
- `AgentHarness` 直接调用 `runAgentLoop()`。
- Harness owns run lifecycle, abort controller, queue draining, provider stream config, event reduction, session persistence, pending write flushing, and save-point snapshots.
- 宿主负责运行生命周期、abort 控制器、队列排空、provider 流式配置、事件归约、会话持久化、待处理写入刷新与保存点快照。
- Harness tests cover prompt construction, queue draining, abort behavior, save-point refresh, pending write ordering, awaited listener settlement, tool hooks, and provider stream wrapping.
- 宿主测试覆盖了 prompt 构建、队列排空、中止行为、保存点刷新、待处理写入顺序、await 监听器结算、工具钩子与 provider 流包装。

Remaining:

待完成：

- None.
- 无。

Notes:

备注：

- Broader listener/hook reentrancy coverage is tracked in item 6.
- 更广泛的监听器/钩子重入覆盖在第 6 项中跟踪。

### 9. Finish curated provider/stream configuration 完成精选的 provider/流式配置

Status: Done

状态：已完成

Done:

已完成：

- Added curated `AgentHarnessOptions.streamOptions`, `getStreamOptions()`, and `setStreamOptions()`.
- 新增了精选的 `AgentHarnessOptions.streamOptions`、`getStreamOptions()` 与 `setStreamOptions()`。
- Stream options, headers, metadata, and derived session id are snapshotted per turn.
- 流式选项、请求头、元数据与派生的会话 id 按回合进行快照。
- Harness-owned stream wrapper calls `streamSimple()` and keeps lifecycle-owned `signal` and `reasoning` from the low-level loop.
- 宿主自有的流包装器调用 `streamSimple()`，并保留由底层循环生命周期所有的 `signal` 与 `reasoning`。
- `getApiKeyAndHeaders()` resolves credentials per provider request.
- `getApiKeyAndHeaders()` 在每次 provider 请求时解析凭据。
- `before_provider_request`, `before_provider_payload`, and `after_provider_response` hooks are implemented.
- 已实现 `before_provider_request`、`before_provider_payload` 与 `after_provider_response` 钩子。
- Stream option patching supports explicit field deletion and ordered hook chaining.
- 流式选项补丁支持显式字段删除与有序的钩子链式调用。
- `agent-harness-stream.test.ts` covers forwarding, auth merge, hook patching/deletion/chaining, payload hooks, and busy/save-point snapshot behavior.
- `agent-harness-stream.test.ts` 覆盖了转发、认证信息合并、钩子补丁/删除/链式调用、负载钩子，以及忙碌/保存点的快照行为。

Remaining:

待完成：

- None.
- 无。

### 10. Complete low-level `Result` cleanup 完成底层 `Result` 清理

Status: Done

状态：已完成

Done:

已完成：

- Added generic `Result<TValue, TError>` plus helpers.
- 新增了泛型 `Result<TValue, TError>` 及其辅助函数。
- Updated `ExecutionEnv` and `NodeExecutionEnv` to return typed results for filesystem/process operations.
- 更新 `ExecutionEnv` 与 `NodeExecutionEnv`，使文件系统/进程操作返回带类型的结果。
- Split filesystem and shell capabilities.
- 拆分了文件系统能力与 shell 能力。
- Moved JSONL session storage/repo onto filesystem picks instead of direct Node imports.
- 将 JSONL 会话存储/仓库改为基于文件系统能力的选择性依赖，而非直接导入 Node 模块。
- Added `ExecutionEnv.appendFile()` for streaming append use cases.
- 新增 `ExecutionEnv.appendFile()` 以支持流式追加场景。
- Updated skill and prompt-template loaders to consume `ExecutionEnv` results.
- 更新 skill 与 prompt-template 加载器以消费 `ExecutionEnv` 的结果。
- Updated shell output capture to return a result and use `ExecutionEnv`, including full-output spill via `appendFile()`.
- 更新 shell 输出捕获，使其返回结果并使用 `ExecutionEnv`，包括通过 `appendFile()` 溢写完整输出。
- Removed `NodeExecutionEnv` from browser-safe root exports.
- 从浏览器安全的根导出中移除了 `NodeExecutionEnv`。
- Replaced `Buffer` usage in generic truncation utilities with runtime-neutral UTF-8 handling.
- 将通用截断工具中对 `Buffer` 的使用替换为与运行时无关的 UTF-8 处理。
- Converted compaction and branch-summary helpers to typed result returns.
- 将压缩与分支摘要辅助函数改为返回带类型的结果。
- Added `readTextLines()` so JSONL metadata loading reads only the header line.
- 新增 `readTextLines()`，使 JSONL 元数据加载只读取头部行。
- Removed no-op abort handling from Node filesystem methods where cancellation is not meaningful.
- 在取消操作没有实际意义的 Node 文件系统方法中，移除了无效的 abort 处理。
- Mapped filesystem errors crossing the session boundary to typed `SessionError`.
- 将跨越会话边界的文件系统错误映射为带类型的 `SessionError`。
- Added typed branch-summary errors and cause-aware public harness error normalization.
- 新增带类型的分支摘要错误，以及可感知 cause 的公开宿主错误归一化。
- Resource loaders report structured diagnostics for non-`not_found` filesystem failures.
- 资源加载器针对非 `not_found` 的文件系统失败上报结构化诊断信息。
- Expanded `NodeExecutionEnv` tests for file operations, exec errors, aborts, callbacks, timeouts, and shell-output spill.
- 扩展了 `NodeExecutionEnv` 的测试，覆盖文件操作、执行错误、中止、回调、超时与 shell 输出溢写。

Remaining:

待完成：

- None.
- 无。

Notes:

备注：

- Keep low-level capability/helper APIs non-throwing where they return `Result`.
- 底层能力/辅助 API 在返回 `Result` 时应保持不抛异常。
- Keep session storage/repo/session APIs throwing typed `SessionError`.
- 会话存储/仓库/会话 API 应继续抛出带类型的 `SessionError`。
- Keep public structural harness failures normalized to `AgentHarnessError`.
- 公开的结构性宿主失败应继续归一化为 `AgentHarnessError`。
- Keep Node-specific APIs isolated under `src/harness/env/nodejs.ts`, Node-backed storage/session implementations, or explicit Node-only entry points.
- Node 特有的 API 应继续隔离在 `src/harness/env/nodejs.ts`、基于 Node 的存储/会话实现，或显式的仅 Node 入口点中。
- Audit generic harness utilities for Node globals as APIs are added.
- 随着 API 的增加，持续审查通用宿主工具中是否引入了 Node 全局对象。
- Audit package exports so browser/generic imports do not pull Node-only modules.
- 审查包导出，确保浏览器/通用导入不会引入仅 Node 可用的模块。
- Keep expanding `ExecutionEnv` and shell-output contract tests as APIs evolve.
- 随着 API 演进，持续扩展 `ExecutionEnv` 与 shell 输出的契约测试。
