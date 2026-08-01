# Durable AgentHarness and session design 持久化 AgentHarness 与会话设计

<!-- Synced from jot zmnps2zu. Edit this file in-repo going forward. -->

Durable AgentHarness / session design notes.
持久化 AgentHarness / 会话(session)设计笔记。

## Framing 问题框定

A fully durable `AgentHarness` is not realistic by itself because important dependencies are runtime JS supplied by the host app:
完全持久化的 `AgentHarness` 本身并不现实,因为一些重要依赖是由宿主应用在运行时提供的 JS 对象:

- tool implementations
  工具(tool)实现
- model/auth providers
  模型 / 鉴权提供方(provider)
- extensions and hook handlers
  扩展(extension)与钩子(hook)处理器
- resource loaders
  资源加载器
- system-prompt callbacks/modifiers
  系统提示词(system prompt)回调 / 修改器

Tool registries are runtime dependencies. The harness should persist serializable tool configuration, such as active tool names, but not concrete tool implementations.
工具注册表(tool registry)属于运行时依赖。harness 应当持久化可序列化的工具配置(例如激活的工具名称),而不是具体的工具实现。

The practical target is a semi-durable harness:
可行的目标是"半持久化"的 harness:

- session is the durable append-only state tree
  session 是持久化的、仅追加(append-only)的状态树
- harness persists the state it owns into session entries
  harness 将自己拥有的状态持久化为 session 条目(entry)
- the host app is responsible for recreating compatible non-persistable dependencies on resume
  宿主应用负责在恢复(resume)时重建兼容的、不可持久化的依赖
- recovery restarts from durable boundaries, not from an in-flight provider stream
  恢复只能从持久化边界重新开始,而不能从进行中的 provider 流中续接

## Session owns durable state 会话拥有持久化状态

Treat session as all durable agent state, not just transcript history.
应把 session 视为 agent 的全部持久化状态,而不仅仅是对话记录(transcript)历史。

Existing session state already includes harness state:
现有的 session 状态中已经包含了 harness 状态:

- model changes
  模型变更
- thinking-level changes
  思考等级(thinking level)变更
- active-tool changes
  激活工具变更
- leaf entries
  叶子(leaf)条目
- labels
  标签
- compactions and branch summaries
  压缩(compaction)与分支摘要
- custom messages and custom entries
  自定义消息与自定义条目

That suggests continuing with one durable session log rather than adding harness sidecars. Sidecars may still be useful for large blobs, but the session entry should remain the source-of-truth reference.
这说明应继续使用单一的持久化 session 日志,而不是额外增加 harness 的旁路存储(sidecar)。旁路存储对大体积二进制数据仍可能有用,但 session 条目应始终作为唯一可信来源(source of truth)的引用。

## What the app must provide on resume 恢复时应用必须提供什么

The app must recreate compatible runtime dependencies:
应用必须重建兼容的运行时依赖:

- model registry / model objects
  模型注册表 / 模型对象
- tool registry
  工具注册表
- extension set, versions, and ordering
  扩展集合、版本与顺序
- resource loaders
  资源加载器
- system prompt providers/hooks
  系统提示词提供方 / 钩子
- auth providers
  鉴权提供方
- app-specific hooks
  应用特定的钩子

Harness can validate stable IDs/versions/hashes when available, but it cannot serialize these dependencies itself.
在有稳定 ID / 版本号 / 哈希值的情况下,harness 可以做校验,但它无法自行序列化这些依赖。

## Runtime configuration and restore 运行时配置与恢复

Constructor options remain explicit runtime configuration and do not read session state. Hidden async restore in a constructor would make failure handling ambiguous.
构造函数选项仍然是显式的运行时配置,不读取 session 状态。在构造函数中隐式执行异步恢复会让错误处理变得含混不清。

A future async builder/factory should own durable restore:
未来应由异步 builder / 工厂方法负责持久化恢复:

```ts
const harness = await AgentHarness.builder()
  .env(env)
  .session(session)
  .model(defaultModel)
  .tools(runtimeTools)
  .defaultActiveTools(["read", "edit"])
  .restore({ missingActiveTools: "fail" });
```

`restore()` should read the active branch, reduce durable harness configuration, apply defaults for missing entries, validate against app-supplied runtime dependencies, construct the harness, and optionally emit `source: "restore"` update events after construction.
`restore()` 应当读取活动分支,归约(reduce)出持久化的 harness 配置,为缺失的条目应用默认值,对照应用提供的运行时依赖做校验,构造出 harness,并可选地在构造完成后发出 `source: "restore"` 的更新事件。

For active tools:
关于激活工具:

- `active_tools_change` entries are branch-scoped durable config.
  `active_tools_change` 条目是分支作用域内的持久化配置。
- If no `active_tools_change` exists on the branch, restore uses builder defaults, or all registered tools if no default active names were supplied.
  如果分支上不存在 `active_tools_change`,恢复过程将使用 builder 的默认值;若未提供默认激活名称,则使用全部已注册工具。
- Active tool names must be unique.
  激活工具名称必须唯一。
- Tool registry names must be unique.
  工具注册表中的名称必须唯一。
- Missing restored active tool names should fail restore by default; permissive drop/disable policies can be added explicitly later.
  恢复出的激活工具名称若缺失,默认应使恢复失败;宽松的丢弃 / 禁用策略可以在之后显式添加。
- Concrete tools are never restored from session; the host app must provide compatible tools.
  具体的工具实现永远不会从 session 中恢复;宿主应用必须提供兼容的工具。

## What harness should persist harness 应持久化什么

Minimum useful durability entries:
最小可用的持久化条目集合:

- branch-scoped active tool names
  分支作用域的激活工具名称
- queued steer/followUp/nextTurn messages
  已入队的 steer / followUp / nextTurn 消息
- queue consumption tied to a turn
  与某个回合(turn)绑定的队列消费记录
- pending session writes accepted during active operations
  活动操作期间接受的待处理 session 写入
- pending write application status
  待处理写入的应用状态
- operation start/finish/interruption
  操作的开始 / 结束 / 中断
- turn start/finish
  回合的开始 / 结束
- provider request start/finish, if needed for recovery diagnostics
  provider 请求的开始 / 结束(如恢复诊断需要)
- tool call start/finish, if we want safe tool recovery
  工具调用的开始 / 结束(如需安全的工具恢复)

Potential entries:
可能的条目类型:

```ts
type DurableHarnessEntry =
  | QueueEnqueuedEntry
  | QueueConsumedEntry
  | PendingWriteEnqueuedEntry
  | PendingWriteAppliedEntry
  | OperationStartedEntry
  | OperationFinishedEntry
  | OperationInterruptedEntry
  | TurnStartedEntry
  | TurnFinishedEntry
  | ProviderRequestStartedEntry
  | ProviderRequestFinishedEntry
  | ToolCallStartedEntry
  | ToolCallFinishedEntry;
```

Every accepted mutation must be durable before the public API resolves.
每一次被接受的状态变更都必须在公开 API 返回(resolve)之前完成持久化。

## Recovery model 恢复模型

On startup:
启动时:

1. Host app registers tools/models/extensions/resources/auth/hooks.
   宿主应用注册工具 / 模型 / 扩展 / 资源 / 鉴权 / 钩子。
2. Harness opens session.
   harness 打开 session。
3. Harness reduces session entries into:
   harness 将 session 条目归约为:
   - current leaf
     当前叶子节点
   - conversation branch
     对话分支
   - harness config, including active tool names
     harness 配置(包含激活工具名称)
   - queues
     队列
   - pending writes
     待处理写入
   - active operation/turn/tool state
     活动的操作 / 回合 / 工具状态
4. Harness validates required runtime dependencies, including restored active tool names against the app-provided tool registry.
   harness 校验所需的运行时依赖,包括将恢复出的激活工具名称与应用提供的工具注册表进行比对。
5. Harness reconciles unfinished operation state.
   harness 对未完成的操作状态进行调和(reconcile)。

Provider streams are not resumable. Recovery can only retry from a durable boundary or mark the operation interrupted.
provider 流不可恢复续接。恢复只能从持久化边界重试,或将该操作标记为已中断。

## Recovery policies 恢复策略

Default conservative policy:
默认的保守策略:

- unfinished agent turn: mark interrupted, preserve durable queues/pending writes, return idle
  未完成的 agent 回合:标记为中断,保留持久化的队列 / 待处理写入,回到空闲状态
- unfinished provider request: mark interrupted; do not retry automatically
  未完成的 provider 请求:标记为中断;不自动重试
- unfinished tool call: append interrupted/error tool result; retry only if the tool declares retry-safe/idempotent
  未完成的工具调用:追加中断 / 错误的工具结果;仅当该工具声明可安全重试 / 幂等时才重试
- unfinished compaction: rerun if no compaction entry exists
  未完成的压缩:若不存在压缩条目则重新执行
- unfinished branch summary/tree navigation: rerun/apply missing summary or leaf entries if safe
  未完成的分支摘要 / 树导航:在安全的前提下重新执行或补齐缺失的摘要或叶子条目

Optional policy:
可选策略:

```ts
recovery: "mark_interrupted" | "retry_unfinished"
```

`retry_unfinished` must be guarded around non-idempotent tool calls.
`retry_unfinished` 必须对非幂等的工具调用加以保护。

## Critical scenarios 关键场景

### Queues 队列

- Crash before `queue_enqueued`: message was not accepted.
  在 `queue_enqueued` 之前崩溃:消息未被接受。
- Crash after `queue_enqueued`: message is restored.
  在 `queue_enqueued` 之后崩溃:消息会被恢复。
- Crash after queue drain but before durable turn record: risk of loss/duplication.
  在队列排空之后、持久化回合记录之前崩溃:存在丢失 / 重复的风险。
- Required invariant: consumed queue IDs must be recorded in `turn_started` or equivalent before they are considered consumed.
  必须保持的不变量:被消费的队列 ID 必须先记录到 `turn_started`(或等价条目)中,才能被视为已消费。

### Pending writes 待处理写入

- Crash before `pending_write_enqueued`: write was not accepted.
  在 `pending_write_enqueued` 之前崩溃:写入未被接受。
- Crash after enqueue before apply: recovery applies it.
  入队之后、应用之前崩溃:恢复过程会将其应用。
- Crash after apply before applied marker: deterministic target entry IDs let recovery detect the entry already exists and mark it applied.
  应用之后、写入"已应用"标记之前崩溃:确定性的目标条目 ID 可让恢复过程发现该条目已存在,并将其标记为已应用。

### Agent loop turn agent 循环回合

- Crash before provider request: retry or mark interrupted.
  在 provider 请求之前崩溃:重试或标记为中断。
- Crash during provider request: mark interrupted by default.
  在 provider 请求过程中崩溃:默认标记为中断。
- Crash after provider response before assistant message persisted: response is lost unless provider result was journaled.
  在收到 provider 响应之后、assistant 消息持久化之前崩溃:除非 provider 结果已记入日志,否则响应丢失。
- Crash after assistant message persisted: recover from durable message.
  在 assistant 消息持久化之后崩溃:从持久化的消息中恢复。

### Tool calls 工具调用

- Crash after tool call starts but before result: external side effects may already have happened.
  工具调用开始之后、结果产生之前崩溃:外部副作用可能已经发生。
- Default recovery should not rerun non-idempotent tools.
  默认恢复策略不应重新执行非幂等的工具。
- Tool calls need stable IDs and retry-safety metadata for automatic recovery.
  要实现自动恢复,工具调用需要稳定的 ID 和重试安全性元数据。

### Compaction 压缩

- Crash before summary generation: rerun preparation/summary.
  在生成摘要之前崩溃:重新执行准备 / 摘要过程。
- Crash after generated summary but before compaction entry: rerun unless summary was journaled.
  摘要生成之后、写入压缩条目之前崩溃:除非摘要已记入日志,否则重新执行。
- Crash after compaction entry: operation is complete; append finish marker if missing.
  写入压缩条目之后崩溃:操作已完成;若缺少结束标记则补写。

### Branch summary / tree navigation 分支摘要 / 树导航

- Crash before summary: rerun or mark interrupted.
  在摘要之前崩溃:重新执行或标记为中断。
- Crash after summary entry before leaf entry: append missing leaf entry.
  写入摘要条目之后、写入叶子条目之前崩溃:补写缺失的叶子条目。
- Crash after leaf entry: operation is complete; append finish marker if missing.
  写入叶子条目之后崩溃:操作已完成;若缺少结束标记则补写。

## Minimum viable spike 最小可行验证

1. Add durable queue entries.
   增加持久化的队列条目。
2. Add durable pending write entries with deterministic target IDs.
   增加带有确定性目标 ID 的持久化待处理写入条目。
3. Add operation start/finish/interrupted entries.
   增加操作的开始 / 结束 / 中断条目。
4. Add turn start with consumed queue IDs.
   增加带有已消费队列 ID 的回合开始条目。
5. Recover by reducing the session log.
   通过归约 session 日志来完成恢复。
6. Mark unfinished agent turns interrupted by default.
   默认将未完成的 agent 回合标记为中断。
7. Rerun unfinished compaction/tree operations only when no final entry exists.
   仅在不存在最终条目时,才重新执行未完成的压缩 / 树操作。
8. Do not retry unfinished tool calls unless tool metadata says retry-safe.
   除非工具元数据声明可安全重试,否则不重试未完成的工具调用。

## Open questions 待决问题

- Which remaining harness config entries should move into session first: resources, stream options, system prompt refs?
  剩余的 harness 配置项中,哪些应优先迁入 session:资源、流式选项,还是系统提示词引用?
- Should resolved system prompt text be snapshotted per turn for audit/debug?
  是否应按回合对解析后的系统提示词文本做快照,以便审计 / 调试?
- Do we require strict dependency ID/version matching on resume?
  恢复时是否要求严格的依赖 ID / 版本匹配?
- How much provider request data should be journaled?
  应记录多少 provider 请求数据到日志中?
- Should recovery append user-visible assistant interruption messages or only internal operation entries?
  恢复过程应追加用户可见的 assistant 中断消息,还是仅追加内部操作条目?
- Should storage support truncating a final partial JSONL line during recovery?
  存储层是否应支持在恢复期间截断末尾不完整的 JSONL 行?
