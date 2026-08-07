# 会话持久化与压缩链路

> 第 4 层：细节链路（第五篇）。**全局定位**：会话是 Pi 的"记忆"。这条链路横跨两层：**写入**发生在 coding-agent 的 `AgentSession`（订阅 `message_end` 事件写 JSONL），**模型与压缩**定义在 agent-core 的 harness 会话（`Session` 门面）与 `compaction` 模块（见 [03-packages/02-pi-agent-core.md](../03-packages/02-pi-agent-core.md#4-会话存储session)）。它是"对话能继续、重启不丢"的保障。

会话（session）是 Pi 的记忆：对话历史、模型/思考级别变更、分支、压缩摘要都以"条目树"的形式持久化。本文梳理会话如何存储、如何恢复、以及上下文如何压缩。

## 1. 会话模型：append-only 条目树

会话由**条目**组成，每条目有 `id / parentId / type / timestamp / payload`，形成**树**（支持分支）。叶子位置由 `leaf` 条目记录（`targetId: null` = root）。

条目类型（`packages/agent/src/harness/types.ts`）：

```
message | thinking_level_change | model_change | active_tools_change
compaction | branch_summary | custom | custom_message | label | session_info | leaf
```

## 2. 存储实现：JSONL v3

### 文件格式（`packages/agent/src/harness/session/jsonl-storage.ts`）

```
首行：{ "type":"session", "version":3, "id", "timestamp", "cwd", "parentSession?", "metadata?" }
之后：每行一个 JSON 条目
```

- **torn tail 容错**：仅当**最后一行**损坏时截断；其余位置损坏抛 `SessionError`。
- 追加写走 `env.appendFile`（单行）。
- 8 字符短条目 id：`uuidv7().slice(-8)`，碰撞回退完整 uuidv7。

### 目录布局（`jsonl-repo.ts`）

```
<sessionsRoot>/<encodeCwd(cwd)>/<timestamp>_<sessionId>.jsonl
```

- `create`：写新文件；`fork`：复制源条目并记录 `parentSessionPath`；`list`：扫描 `*.jsonl` 按创建时间降序；`delete`：`fs.remove(force:true)`。

### 存储抽象分层

```
SessionStorage<T>    单会话能力（getMetadata/appendEntry/getEntries/moveTo…）
SessionStore         多会话仓库（create/load/list/delete/fork）
SessionRepository    包装 SessionStore + 可选搜索
Session              高层门面（session.ts）
```

SQLite 是平级的可选后端（见 [05-other-packages.md](../03-packages/05-other-packages.md)）。

## 3. Session 门面（`packages/agent/src/harness/session/session.ts`）

| 方法 | 行号 | 说明 |
|---|---|---|
| `getBranch(fromId?)` | L176 | 从指定 id（缺省 = leaf）回溯到根或上次压缩 |
| `buildContextEntries()` | L180 | 压缩感知的条目序列 |
| `buildContext()` | L184 | 投影为 `AgentMessage[]`；压缩条目替换为摘要消息并拼接 `retainedTail` |
| `appendMessage()` | L227 | 追加消息（返回新条目 id） |
| `appendCompaction()` | - | 追加压缩条目 |
| `appendCustomEntry()` | L292 | 追加自定义条目 |
| `moveTo()` | L346 | 移动 leaf（写 leaf + 可选 branch_summary） |
| `getSessionStats()` | L202 | 累计 assistant usage 等 |

## 4. coding-agent 的会话管理器

coding-agent 的会话持久化在 `packages/coding-agent/src/core/session-manager.ts`（与 pi-agent-core 的 harness 会话是两套独立实现，都基于 JSONL 条目树；coding-agent 用版本 3，id/parentId 树）：

- `SessionManager.create(cwd, sessionDir)` / `open(path)` / `forkFrom(sourcePath, cwd)` / `continueRecent(cwd)` / `list(cwd)` / `listAll()`。
- 写入点：`AgentSession` 在 `message_end` 事件时 `sessionManager.appendMessage(...)`。

## 5. 压缩（Compaction）

文件：`packages/agent/src/harness/compaction/compaction.ts`。

### 触发判定

```
DEFAULT_COMPACTION_SETTINGS = { enabled: true, reserveTokens: 16384, keepRecentTokens: 20000 }  // L220
shouldCompact(contextTokens, contextWindow, settings)   // L336
  = settings.enabled && contextTokens > contextWindow - settings.reserveTokens
```

- `calculateContextTokens(usage)`（L230）：`usage.totalTokens || input+output+cacheRead+cacheWrite`。
- `estimateContextTokens(messages)`（L302）：优先"最后一条有效 assistant usage + 其后消息的启发式估算"；无 usage 则全量估算。
- `estimateTokens(message)`（L363）：保守启发式 `chars/4`；图片按 4800 chars；assistant 计 text+thinking+toolCall。

### 切点

```
findCutPoint(entries, start, end, keepRecentTokens)   // L490
  从尾部累积 estimateTokens 至 ≥ keepRecentTokens，取最近合法切点
  切点落在非 user 消息 → findTurnStartIndex 回溯（L448）得到 turnStartIndex（支持 split-turn）
```

### 准备与执行

```
prepareCompaction(pathEntries, settings)  // L773
  → 空路径或以 compaction 结尾 → undefined（不适用）
  → boundaryStart = 上次 compaction 的 firstKeptEntryId
  → 产出 { firstKeptEntryId, messagesToSummarize, turnPrefixMessages, retainedTail, isSplitTurn, ... }

compact()  // L869
  → split-turn：分别摘要 history 与 turn-prefix（combineUsage 合并）
  → 非 split：update（<previous-summary> 增量更新）或全量摘要
  → 追加文件操作清单（read/modified 文件）到摘要末尾
  → 返回 CompactionResult { summary, firstKeptEntryId, tokensBefore, usage, ... }
```

### 摘要生成

`generateSummaryWithUsage()`（L651-715）：

- `maxTokens = min(floor(0.8 * reserveTokens), model.maxTokens)`；
- 历史序列化为 `<conversation>...</conversation>`；
- 经 `completeSimpleWithRetries` 调用，强制 `cacheRetention: "none"` + 新 `uuidv7` sessionId（隔离路由，避免污染缓存）；
- aborted → `CompactionError("aborted")`，error → `CompactionError("summarization_failed")`。

### 摘要提示词（固定格式）

`SUMMARIZATION_PROMPT`：`## Goal / ## Constraints & Preferences / ## Progress (### Done / In Progress / Blocked) / ## Key Decisions / ## Next Steps / ## Critical Context`，要求保留精确文件路径/函数名/错误信息。`UPDATE_SUMMARIZATION_PROMPT` 在旧摘要上增量更新。

### 分支摘要

`compaction/branch-summarization.ts`：`collectEntriesForBranchSummary / prepareBranchEntries / generateBranchSummary`——供 `navigateTree` 折叠旧分支（把 A 分支总结为一条 branch_summary 摘要，继续从 B 分支工作）。

## 6. 谁触发压缩

- **coding-agent**：`AgentSession` 每轮 prompt 前检查 `shouldCompact()`，超限自动压缩（`set_auto_compaction` 可关闭）。
- **AgentHarness**：`compact()` 结构性操作（含 `session_before_compact` 钩子，宿主可拦截/覆盖）。

## 7. 恢复与继续

- `--continue`：`SessionManager.continueRecent(cwd)` 打开最近会话。
- `--resume`：交互式选择会话。
- `--session <id>` / `--fork <id>`：打开或分叉。
- 会话恢复时 `buildSessionContext()` 重建上下文（压缩感知），`sdk.ts` 用其恢复模型与消息到 Agent。
