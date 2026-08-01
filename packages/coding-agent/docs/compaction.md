# Compaction & Branch Summarization 压缩与分支摘要

LLMs have limited context windows. When conversations grow too long, pi uses compaction to summarize older content while preserving recent work. This page covers both auto-compaction and branch summarization.
LLM 的上下文窗口是有限的。当对话变得过长时，pi 会通过压缩（compaction）机制对较早的内容进行摘要，同时保留近期的工作内容。本文同时介绍自动压缩和分支摘要两种机制。

**Source files** ([pi-mono](https://github.com/earendil-works/pi-mono)):
**源码文件**（[pi-mono](https://github.com/earendil-works/pi-mono)）：
- [`packages/coding-agent/src/core/compaction/compaction.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/compaction/compaction.ts) - Auto-compaction logic
  [`packages/coding-agent/src/core/compaction/compaction.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/compaction/compaction.ts) - 自动压缩逻辑
- [`packages/coding-agent/src/core/compaction/branch-summarization.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts) - Branch summarization
  [`packages/coding-agent/src/core/compaction/branch-summarization.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts) - 分支摘要
- [`packages/coding-agent/src/core/compaction/utils.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/compaction/utils.ts) - Shared utilities (file tracking, serialization)
  [`packages/coding-agent/src/core/compaction/utils.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/compaction/utils.ts) - 公共工具函数（文件跟踪、序列化）
- [`packages/coding-agent/src/core/session-manager.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/session-manager.ts) - Entry types (`CompactionEntry`, `BranchSummaryEntry`)
  [`packages/coding-agent/src/core/session-manager.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/session-manager.ts) - 条目类型（`CompactionEntry`、`BranchSummaryEntry`）
- [`packages/coding-agent/src/core/extensions/types.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/extensions/types.ts) - Extension event types
  [`packages/coding-agent/src/core/extensions/types.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/extensions/types.ts) - 扩展事件类型

For TypeScript definitions in your project, inspect `node_modules/@earendil-works/pi-coding-agent/dist/`.
若要在自己的项目中查看 TypeScript 类型定义，请查阅 `node_modules/@earendil-works/pi-coding-agent/dist/`。

## Overview 概述

Pi has two summarization mechanisms:
Pi 提供两种摘要机制：

| Mechanism | Trigger | Purpose |
|-----------|---------|---------|
| Compaction<br>压缩 | Context exceeds threshold, or `/compact`<br>上下文超过阈值，或手动执行 `/compact` | Summarize old messages to free up context<br>对旧消息进行摘要以释放上下文空间 |
| Branch summarization<br>分支摘要 | `/tree` navigation<br>通过 `/tree` 进行导航 | Preserve context when switching branches<br>在切换分支时保留上下文 |

Both use the same structured summary format and track file operations cumulatively. Compaction and branch-summary requests use fresh routing session IDs and, where supported by the provider, disable prompt-cache writes because these one-off prompts are unlikely to be reused.
两者使用相同的结构化摘要格式，并以累积方式跟踪文件操作。压缩和分支摘要请求会使用全新的路由会话 ID；在提供方支持的情况下，还会禁用 prompt 缓存写入，因为这类一次性 prompt 几乎不会被复用。

## Compaction 压缩

### When It Triggers 触发时机

Auto-compaction triggers when:
自动压缩在满足以下条件时触发：

```
contextTokens > contextWindow - reserveTokens
```

By default, `reserveTokens` is 16384 tokens (configurable in `~/.pi/agent/settings.json` or `<project-dir>/.pi/settings.json`). This leaves room for the LLM's response.
`reserveTokens` 默认为 16384 个 token（可在 `~/.pi/agent/settings.json` 或 `<project-dir>/.pi/settings.json` 中配置）。这部分空间预留给 LLM 的回复。

You can also trigger manually with `/compact [instructions]`, where optional instructions focus the summary.
你也可以用 `/compact [instructions]` 手动触发压缩，其中可选的 instructions 用于引导摘要的侧重点。

### How It Works 工作原理

1. **Find cut point**: Walk backwards from newest message, accumulating token estimates until `keepRecentTokens` (default 20k, configurable in `~/.pi/agent/settings.json` or `<project-dir>/.pi/settings.json`) is reached
   **确定切分点**：从最新的消息开始向前回溯，累加 token 估算值，直到达到 `keepRecentTokens`（默认 20k，可在 `~/.pi/agent/settings.json` 或 `<project-dir>/.pi/settings.json` 中配置）
2. **Extract messages**: Collect messages from the previous kept boundary (or session start) up to the cut point
   **提取消息**：收集从上一次保留边界（或会话起点）直到切分点之间的消息
3. **Generate summary**: Call LLM to summarize with structured format, passing the previous summary as iterative context when present
   **生成摘要**：调用 LLM 按结构化格式生成摘要；若存在上一次的摘要，则将其作为迭代上下文一并传入
4. **Append entry**: Save `CompactionEntry` with summary and `firstKeptEntryId`
   **追加条目**：保存包含摘要和 `firstKeptEntryId` 的 `CompactionEntry`
5. **Reload**: Session reloads, using summary + messages from `firstKeptEntryId` onwards
   **重新加载**：会话重新加载，使用「摘要 + 从 `firstKeptEntryId` 开始的消息」作为上下文

```
Before compaction:

  entry:  0     1     2     3      4     5     6      7      8     9
        ┌─────┬─────┬─────┬─────┬──────┬─────┬─────┬──────┬──────┬─────┐
        │ hdr │ usr │ ass │ tool │ usr │ ass │ tool │ tool │ ass │ tool│
        └─────┴─────┴─────┴──────┴─────┴─────┴──────┴──────┴─────┴─────┘
                └────────┬───────┘ └──────────────┬──────────────┘
               messagesToSummarize            kept messages
                                   ↑
                          firstKeptEntryId (entry 4)

After compaction (new entry appended):

  entry:  0     1     2     3      4     5     6      7      8     9     10
        ┌─────┬─────┬─────┬─────┬──────┬─────┬─────┬──────┬──────┬─────┬─────┐
        │ hdr │ usr │ ass │ tool │ usr │ ass │ tool │ tool │ ass │ tool│ cmp │
        └─────┴─────┴─────┴──────┴─────┴─────┴──────┴──────┴─────┴─────┴─────┘
               └──────────┬──────┘ └──────────────────────┬───────────────────┘
                 not sent to LLM                    sent to LLM
                                                         ↑
                                              starts from firstKeptEntryId

What the LLM sees:

  ┌────────┬─────────┬─────┬─────┬──────┬──────┬─────┬──────┐
  │ system │ summary │ usr │ ass │ tool │ tool │ ass │ tool │
  └────────┴─────────┴─────┴─────┴──────┴──────┴─────┴──────┘
       ↑         ↑      └─────────────────┬────────────────┘
    prompt   from cmp          messages from firstKeptEntryId
```

On repeated compactions, the summarized span starts at the previous compaction's kept boundary (`firstKeptEntryId`), not at the compaction entry itself, falling back to the entry after the previous compaction if that kept entry cannot be found in the path. This preserves messages that survived the earlier compaction by including them in the next summarization pass as well. Pi also recalculates `tokensBefore` from the rebuilt session context before writing the new `CompactionEntry`, so the token count reflects the actual pre-compaction context being replaced.
在多次重复压缩时，被摘要的区间起点是上一次压缩的保留边界（`firstKeptEntryId`），而不是压缩条目本身；如果在路径中找不到该保留条目，则回退到上一次压缩之后的那个条目。这样可以把在上一次压缩中幸存下来的消息也纳入下一轮摘要，从而保留它们的信息。此外，Pi 会在写入新的 `CompactionEntry` 之前，基于重建后的会话上下文重新计算 `tokensBefore`，使该 token 计数如实反映本次被替换掉的压缩前上下文。

### Split Turns 拆分回合

A "turn" starts with a user message and includes all assistant responses and tool calls until the next user message. Normally, compaction cuts at turn boundaries.
一个「回合」（turn）以一条用户消息开始，包含在下一条用户消息之前的所有助手回复和工具调用。通常情况下，压缩会在回合边界处切分。

When a single turn exceeds `keepRecentTokens`, the cut point lands mid-turn at an assistant message. This is a "split turn":
当单个回合本身就超过了 `keepRecentTokens` 时，切分点会落在回合中间的某条助手消息上。这就是所谓的「拆分回合」（split turn）：

```
Split turn (one huge turn exceeds budget):

  entry:  0     1     2      3     4      5      6     7      8
        ┌─────┬─────┬─────┬──────┬─────┬──────┬──────┬─────┬──────┐
        │ hdr │ usr │ ass │ tool │ ass │ tool │ tool │ ass │ tool │
        └─────┴─────┴─────┴──────┴─────┴──────┴──────┴─────┴──────┘
                ↑                                     ↑
         turnStartIndex = 1                  firstKeptEntryId = 7
                │                                     │
                └──── turnPrefixMessages (1-6) ───────┘
                                                      └── kept (7-8)

  isSplitTurn = true
  messagesToSummarize = []  (no complete turns before)
  turnPrefixMessages = [usr, ass, tool, ass, tool, tool]
```

For split turns, pi generates two summaries and merges them:
对于拆分回合，pi 会生成两份摘要并将它们合并：
1. **History summary**: Previous context (if any)
   **历史摘要**：此前的上下文（如果有）
2. **Turn prefix summary**: The early part of the split turn
   **回合前缀摘要**：被拆分回合的前半部分

### Cut Point Rules 切分点规则

Valid cut points are:
有效的切分点包括：
- User messages
  用户消息
- Assistant messages
  助手消息
- BashExecution messages
  BashExecution 消息
- Custom messages (custom_message, branch_summary)
  自定义消息（custom_message、branch_summary）

Never cut at tool results (they must stay with their tool call).
绝不能在工具结果处切分（工具结果必须与其对应的工具调用保持在一起）。

### CompactionEntry Structure CompactionEntry 结构

Defined in [`session-manager.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/session-manager.ts):
定义于 [`session-manager.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/session-manager.ts)：

```typescript
interface CompactionEntry<T = unknown> {
  type: "compaction";
  id: string;
  parentId: string;
  timestamp: number;
  summary: string;
  firstKeptEntryId: string;
  tokensBefore: number;
  usage?: Usage;       // LLM usage that generated the summary
  fromHook?: boolean;  // true if provided by extension (legacy field name)
  details?: T;         // implementation-specific data
}

// Default compaction uses this for details (from compaction.ts):
interface CompactionDetails {
  readFiles: string[];
  modifiedFiles: string[];
}
```

Extensions can store any JSON-serializable data in `details`. The default compaction tracks file operations, but custom extension implementations can use their own structure. Generated and extension-provided summaries store their LLM `usage` when available so session totals include summarization work.
扩展可以在 `details` 中存放任意可 JSON 序列化的数据。默认压缩实现记录的是文件操作，但自定义扩展实现可以使用自己的结构。无论是自动生成的摘要还是扩展提供的摘要，只要有 LLM `usage` 数据都会被记录下来，从而使会话的总用量统计包含摘要生成的开销。

See [`prepareCompaction()`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/compaction/compaction.ts) and [`compact()`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/compaction/compaction.ts) for the implementation. For direct programmatic summarization, `generateSummary()` returns the summary text and `generateSummaryWithUsage()` returns `{ text, usage }`.
具体实现参见 [`prepareCompaction()`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/compaction/compaction.ts) 和 [`compact()`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/compaction/compaction.ts)。若要以编程方式直接生成摘要，`generateSummary()` 返回摘要文本，`generateSummaryWithUsage()` 返回 `{ text, usage }`。

## Branch Summarization 分支摘要

### When It Triggers 触发时机

When you use `/tree` to navigate to a different branch, pi offers to summarize the work you're leaving. This injects context from the left branch into the new branch.
当你使用 `/tree` 导航到另一个分支时，pi 会询问是否要为你即将离开的那部分工作生成摘要。该摘要会把离开分支上的上下文注入到新分支中。

### How It Works 工作原理

1. **Find common ancestor**: Deepest node shared by old and new positions
   **查找共同祖先**：新旧两个位置共享的最深节点
2. **Collect entries**: Walk from old leaf back to common ancestor
   **收集条目**：从旧的叶子节点回溯到共同祖先
3. **Prepare with budget**: Include messages up to token budget (newest first)
   **按预算准备内容**：在 token 预算范围内纳入消息（从最新的开始）
4. **Generate summary**: Call LLM with structured format
   **生成摘要**：按结构化格式调用 LLM
5. **Append entry**: Save `BranchSummaryEntry` at navigation point
   **追加条目**：在导航点处保存 `BranchSummaryEntry`

```
Tree before navigation:

         ┌─ B ─ C ─ D (old leaf, being abandoned)
    A ───┤
         └─ E ─ F (target)

Common ancestor: A
Entries to summarize: B, C, D

After navigation with summary:

         ┌─ B ─ C ─ D ─ [summary of B,C,D]
    A ───┤
         └─ E ─ F (new leaf)
```

### Cumulative File Tracking 累积式文件跟踪

Both compaction and branch summarization track files cumulatively. When generating a summary, pi extracts file operations from:
压缩和分支摘要都以累积方式跟踪文件。生成摘要时，pi 会从以下来源提取文件操作：
- Tool calls in the messages being summarized
  被摘要消息中的工具调用
- Previous compaction or branch summary `details` (if any)
  此前压缩或分支摘要的 `details`（如果有）

This means file tracking accumulates across multiple compactions or nested branch summaries, preserving the full history of read and modified files.
这意味着文件跟踪信息会跨多次压缩或嵌套的分支摘要不断累积，从而完整保留读取过和修改过的文件历史。

### BranchSummaryEntry Structure BranchSummaryEntry 结构

Defined in [`session-manager.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/session-manager.ts):
定义于 [`session-manager.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/session-manager.ts)：

```typescript
interface BranchSummaryEntry<T = unknown> {
  type: "branch_summary";
  id: string;
  parentId: string;
  timestamp: number;
  summary: string;
  fromId: string;      // Entry we navigated from
  usage?: Usage;       // LLM usage that generated the summary
  fromHook?: boolean;  // true if provided by extension (legacy field name)
  details?: T;         // implementation-specific data
}

// Default branch summarization uses this for details (from branch-summarization.ts):
interface BranchSummaryDetails {
  readFiles: string[];
  modifiedFiles: string[];
}
```

Same as compaction, extensions can store custom data in `details`.
与压缩机制一样，扩展也可以在 `details` 中存放自定义数据。

See [`collectEntriesForBranchSummary()`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts), [`prepareBranchEntries()`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts), and [`generateBranchSummary()`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts) for the implementation.
具体实现参见 [`collectEntriesForBranchSummary()`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts)、[`prepareBranchEntries()`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts) 和 [`generateBranchSummary()`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/compaction/branch-summarization.ts)。

## Summary Format 摘要格式

Both compaction and branch summarization use the same structured format:
压缩和分支摘要使用相同的结构化格式：

```markdown
## Goal
[What the user is trying to accomplish]

## Constraints & Preferences
- [Requirements mentioned by user]

## Progress
### Done
- [x] [Completed tasks]

### In Progress
- [ ] [Current work]

### Blocked
- [Issues, if any]

## Key Decisions
- **[Decision]**: [Rationale]

## Next Steps
1. [What should happen next]

## Critical Context
- [Data needed to continue]

<read-files>
path/to/file1.ts
path/to/file2.ts
</read-files>

<modified-files>
path/to/changed.ts
</modified-files>
```

### Message Serialization 消息序列化

Before summarization, messages are serialized to text via [`serializeConversation()`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/compaction/utils.ts):
在摘要之前，消息会通过 [`serializeConversation()`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/compaction/utils.ts) 序列化为文本：

```
[User]: What they said
[Assistant thinking]: Internal reasoning
[Assistant]: Response text
[Assistant tool calls]: read(path="foo.ts"); edit(path="bar.ts", ...)
[Tool result]: Output from tool
```

This prevents the model from treating it as a conversation to continue.
这样可以避免模型把这些内容当成一段需要继续的对话。

Tool results are truncated to 2000 characters during serialization. Content beyond that limit is replaced with a marker indicating how many characters were truncated. This keeps summarization requests within reasonable token budgets, since tool results (especially from `read` and `bash`) are typically the largest contributors to context size.
序列化过程中，工具结果会被截断为 2000 个字符。超出部分会被替换成一个标记，说明被截断了多少字符。由于工具结果（尤其是 `read` 和 `bash` 的输出）通常是上下文体积的最大来源，这样做可以把摘要请求控制在合理的 token 预算之内。

## Custom Summarization via Extensions 通过扩展自定义摘要

Extensions can intercept and customize both compaction and branch summarization. See [`extensions/types.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/extensions/types.ts) for event type definitions.
扩展可以拦截并自定义压缩与分支摘要这两种流程。事件类型定义参见 [`extensions/types.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/coding-agent/src/core/extensions/types.ts)。

### session_before_compact

Fired before auto-compaction or `/compact`. Can cancel or provide custom summary. See `SessionBeforeCompactEvent` and `CompactionPreparation` in the types file.
在自动压缩或 `/compact` 执行之前触发。可以取消本次压缩，也可以提供自定义摘要。请参见类型定义文件中的 `SessionBeforeCompactEvent` 和 `CompactionPreparation`。

```typescript
pi.on("session_before_compact", async (event, ctx) => {
  const { preparation, branchEntries, customInstructions, reason, willRetry, signal } = event;

  // preparation.messagesToSummarize - messages to summarize
  // preparation.turnPrefixMessages - split turn prefix (if isSplitTurn)
  // preparation.previousSummary - previous compaction summary
  // preparation.fileOps - extracted file operations
  // preparation.tokensBefore - context tokens before compaction
  // preparation.firstKeptEntryId - where kept messages start
  // preparation.settings - compaction settings

  // branchEntries - all entries on current branch (for custom state)
  // reason - "manual" (/compact), "threshold", or "overflow"
  // willRetry - whether the aborted turn is retried after compaction (overflow recovery)
  // signal - AbortSignal (pass to LLM calls)

  // Cancel:
  return { cancel: true };

  // Custom summary:
  return {
    compaction: {
      summary: "Your summary...",
      firstKeptEntryId: preparation.firstKeptEntryId,
      tokensBefore: preparation.tokensBefore,
      // usage: summaryResponse.usage, // Optional; included in session totals
      details: { /* custom data */ },
    }
  };
});
```

#### Converting Messages to Text 将消息转换为文本

To generate a summary with your own model, convert messages to text using `serializeConversation`:
如果你想用自己的模型生成摘要，可以使用 `serializeConversation` 将消息转换为文本：

```typescript
import { convertToLlm, serializeConversation } from "@earendil-works/pi-coding-agent";

pi.on("session_before_compact", async (event, ctx) => {
  const { preparation } = event;
  
  // Convert AgentMessage[] to Message[], then serialize to text
  const conversationText = serializeConversation(
    convertToLlm(preparation.messagesToSummarize)
  );
  // Returns:
  // [User]: message text
  // [Assistant thinking]: thinking content
  // [Assistant]: response text
  // [Assistant tool calls]: read(path="..."); bash(command="...")
  // [Tool result]: output text

  // Now send to your model for summarization
  const { summary, usage } = await myModel.summarize(conversationText);
  
  return {
    compaction: {
      summary,
      firstKeptEntryId: preparation.firstKeptEntryId,
      tokensBefore: preparation.tokensBefore,
      usage,
    }
  };
});
```

See [custom-compaction.ts](../examples/extensions/custom-compaction.ts) for a complete example using a different model.
使用其他模型的完整示例参见 [custom-compaction.ts](../examples/extensions/custom-compaction.ts)。

### session_before_tree

Fired before `/tree` navigation. Always fires regardless of whether user chose to summarize. Can cancel navigation or provide custom summary.
在 `/tree` 导航之前触发。无论用户是否选择生成摘要，该事件都会触发。可以取消本次导航，也可以提供自定义摘要。

```typescript
pi.on("session_before_tree", async (event, ctx) => {
  const { preparation, signal } = event;

  // preparation.targetId - where we're navigating to
  // preparation.oldLeafId - current position (being abandoned)
  // preparation.commonAncestorId - shared ancestor
  // preparation.entriesToSummarize - entries that would be summarized
  // preparation.userWantsSummary - whether user chose to summarize

  // Cancel navigation entirely:
  return { cancel: true };

  // Provide custom summary (only used if userWantsSummary is true):
  if (preparation.userWantsSummary) {
    return {
      summary: {
        summary: "Your summary...",
        // usage: summaryResponse.usage, // Optional; included in session totals
        details: { /* custom data */ },
      }
    };
  }
});
```

See `SessionBeforeTreeEvent` and `TreePreparation` in the types file.
请参见类型定义文件中的 `SessionBeforeTreeEvent` 和 `TreePreparation`。

## Settings 配置项

Configure compaction in `~/.pi/agent/settings.json` or `<project-dir>/.pi/settings.json`:
可在 `~/.pi/agent/settings.json` 或 `<project-dir>/.pi/settings.json` 中配置压缩行为：

```json
{
  "compaction": {
    "enabled": true,
    "reserveTokens": 16384,
    "keepRecentTokens": 20000
  }
}
```

| Setting | Default | Description |
|---------|---------|-------------|
| `enabled` | `true` | Enable auto-compaction<br>是否启用自动压缩 |
| `reserveTokens` | `16384` | Tokens to reserve for LLM response<br>为 LLM 回复预留的 token 数 |
| `keepRecentTokens` | `20000` | Recent tokens to keep (not summarized)<br>需要保留（不做摘要）的近期 token 数 |

Disable auto-compaction with `"enabled": false`. You can still compact manually with `/compact`.
将 `"enabled": false` 可禁用自动压缩。即便如此，你仍然可以使用 `/compact` 手动执行压缩。
