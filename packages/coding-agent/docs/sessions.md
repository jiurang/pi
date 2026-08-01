# Sessions 会话

Pi saves conversations as sessions so you can continue work, branch from earlier turns, and revisit previous paths.
Pi 会把对话保存为会话（session），便于你继续之前的工作、从更早的轮次分支，以及回顾此前走过的路径。

## Session Storage 会话存储

Sessions auto-save to `~/.pi/agent/sessions/`, organized by working directory. Each session is a JSONL file with a tree structure.
会话会自动保存到 `~/.pi/agent/sessions/`，并按工作目录组织。每个会话都是一个具有树形结构的 JSONL 文件。

```bash
pi -c                  # Continue most recent session
pi -r                  # Browse and select from past sessions
pi --no-session        # Ephemeral mode; do not save
pi --name "my task"    # Set session display name at startup
pi --session <path|id> # Use a specific session file or partial session ID
pi --fork <path|id>    # Fork a session file or partial session ID into a new session
```

Use `/session` in interactive mode to see the current session file, session ID, message count, tokens, and cost.
在交互模式下使用 `/session` 可查看当前会话文件、会话 ID、消息数量、token 数和费用。

For the JSONL file format and SessionManager API, see [Session Format](session-format.md).
关于 JSONL 文件格式和 SessionManager API，请参阅 [Session Format](session-format.md)。

## Session Commands 会话命令

| Command<br>命令 | Description<br>说明 |
|---------|-------------|
| `/resume` | Browse and select previous sessions<br>浏览并选择此前的会话 |
| `/new` | Start a new session<br>开始一个新会话 |
| `/name <name>` | Set the current session display name<br>设置当前会话的显示名称 |
| `/session` | Show session info<br>显示会话信息 |
| `/tree` | Navigate the current session tree<br>浏览当前会话树 |
| `/fork` | Create a new session from a previous user message<br>从此前的某条用户消息创建一个新会话 |
| `/clone` | Duplicate the current active branch into a new session<br>将当前活动分支复制为一个新会话 |
| `/compact [prompt]` | Summarize older context; see [Compaction](compaction.md)<br>总结较早的上下文；参见 [Compaction](compaction.md) |
| `/export [file]` | Export session to HTML<br>将会话导出为 HTML |
| `/share` | Upload as private GitHub gist with shareable HTML link<br>上传为私有 GitHub gist，并生成可分享的 HTML 链接 |

## Resuming and Deleting Sessions 恢复与删除会话

`/resume` opens an interactive session picker for the current project. `pi -r` opens the same picker at startup.
`/resume` 会为当前项目打开交互式会话选择器。`pi -r` 会在启动时打开同一个选择器。

In the picker you can:
在选择器中你可以：

- search by typing
  直接输入以搜索
- toggle path display with Ctrl+P
  用 Ctrl+P 切换路径显示
- toggle sort mode with Ctrl+S
  用 Ctrl+S 切换排序方式
- filter to named sessions with Ctrl+N
  用 Ctrl+N 只筛选已命名的会话
- rename with Ctrl+R
  用 Ctrl+R 重命名
- delete with Ctrl+D, then confirm
  用 Ctrl+D 删除，然后确认

When available, pi uses the `trash` CLI for deletion instead of permanently removing files.
在可用时，pi 会使用 `trash` 命令行工具进行删除，而不是永久删除文件。

## Naming Sessions 命名会话

Use `/name <name>` to set a human-readable session name:
使用 `/name <name>` 设置便于识别的会话名称：

```text
/name Refactor auth module
```

Set the name at startup with `--name` or `-n`:
可通过 `--name` 或 `-n` 在启动时设置名称：

```bash
pi --name "Refactor auth module"
pi --name "CI audit" -p "Review this build failure"
```

Named sessions are easier to find in `/resume` and `pi -r`.
已命名的会话在 `/resume` 和 `pi -r` 中更容易查找。

## Branching with `/tree` 使用 `/tree` 分支

Sessions are stored as trees. Every entry has an `id` and `parentId`, and the current position is the active leaf. `/tree` lets you jump to any previous point and continue from there without creating a new file.
会话以树形结构存储。每个条目都有 `id` 和 `parentId`，当前位置即为活动叶子节点（active leaf）。`/tree` 允许你跳转到此前的任意位置并从那里继续，而无需新建文件。

<p align="center"><img src="images/tree-view.png" alt="Tree View" width="600"></p>

Example shape:
结构示例：

```text
├─ user: "Hello, can you help..."
│  └─ assistant: "Of course! I can..."
│     ├─ user: "Let's try approach A..."
│     │  └─ assistant: "For approach A..."
│     │     └─ user: "That worked..."  ← active
│     └─ user: "Actually, approach B..."
│        └─ assistant: "For approach B..."
```

### Tree Controls 树视图操作

| Key<br>按键 | Action<br>操作 |
|-----|--------|
| ↑/↓ | Navigate visible entries<br>在可见条目间移动 |
| ←/→ | Page up/down<br>向上/向下翻页 |
| Ctrl+←/Ctrl+→ or Alt+←/Alt+→ | Fold/unfold or jump between branch segments<br>折叠/展开，或在分支片段之间跳转 |
| Shift+L | Set or clear a label on the selected entry<br>为所选条目设置或清除标签 |
| Shift+T | Toggle label timestamps<br>切换标签时间戳显示 |
| Enter | Select entry<br>选择条目 |
| Escape/Ctrl+C | Cancel<br>取消 |
| Ctrl+O | Cycle filter mode<br>循环切换过滤模式 |

Filter modes are: default, no-tools, user-only, labeled-only, and all. Configure the default with `treeFilterMode` in [Settings](settings.md).
过滤模式包括：default、no-tools、user-only、labeled-only 和 all。可通过 [Settings](settings.md) 中的 `treeFilterMode` 配置默认值。

### Selection Behavior 选择行为

Selecting a user or custom message:
选择一条用户消息或自定义消息时：

1. Moves the leaf to the selected message's parent.
   将叶子节点移动到所选消息的父节点。
2. Places the selected message text in the editor.
   把所选消息的文本放入编辑器。
3. Lets you edit and resubmit, creating a new branch.
   允许你编辑并重新提交，从而创建一个新分支。

Selecting an assistant, tool, compaction, or other non-user entry:
选择助手消息、工具调用、压缩记录或其他非用户条目时：

1. Moves the leaf to that entry.
   将叶子节点移动到该条目。
2. Leaves the editor empty.
   编辑器保持为空。
3. Lets you continue from that point.
   允许你从该处继续。

Selecting the root user message resets the leaf to an empty conversation and places the original prompt in the editor.
选择根用户消息会把叶子节点重置为空对话，并把原始提示词放入编辑器。

## `/tree`, `/fork`, and `/clone` `/tree`、`/fork` 与 `/clone`

| Feature<br>特性 | `/tree` | `/fork` | `/clone` |
|---------|---------|---------|----------|
| Output<br>输出 | Same session file<br>同一个会话文件 | New session file<br>新的会话文件 | New session file<br>新的会话文件 |
| View<br>视图 | Full tree<br>完整树 | User-message selector<br>用户消息选择器 | Current active branch<br>当前活动分支 |
| Typical use<br>典型用途 | Explore alternatives in place<br>就地探索不同方案 | Start a new session from an earlier prompt<br>从更早的提示词开始一个新会话 | Duplicate current work before continuing<br>在继续之前复制当前工作 |
| Summary<br>摘要 | Optional branch summary<br>可选的分支摘要 | None<br>无 | None<br>无 |

Use `/tree` when you want to keep alternatives together. Use `/fork` or `/clone` when you want a separate session file.
如果你希望把多个备选方案保存在一起，请使用 `/tree`。如果你希望得到一个独立的会话文件，请使用 `/fork` 或 `/clone`。

## Branch Summaries 分支摘要

When `/tree` switches away from one branch to another, pi can summarize the abandoned branch and attach that summary at the new position. This preserves important context from the path you left without replaying the whole branch.
当 `/tree` 从一个分支切换到另一个分支时，pi 可以对被放弃的分支生成摘要，并把该摘要附加到新位置。这样既能保留你离开的那条路径中的重要上下文，又无需重放整个分支。

When prompted, choose one of:
出现提示时，可选择以下之一：

1. no summary
   不生成摘要
2. summarize with the default prompt
   使用默认提示词生成摘要
3. summarize with custom focus instructions
   使用自定义的关注点说明生成摘要

See [Compaction](compaction.md) for branch summarization internals and extension hooks.
关于分支摘要的内部实现和扩展钩子（extension hooks），请参阅 [Compaction](compaction.md)。

## Session Format 会话格式

Session files are JSONL and contain message entries, model changes, thinking-level changes, labels, compactions, branch summaries, and extension entries.
会话文件为 JSONL 格式，包含消息条目、模型变更、思考等级（thinking level）变更、标签、压缩记录、分支摘要以及扩展条目。

For parsers, extensions, SDK usage, and the full SessionManager API, see [Session Format](session-format.md).
关于解析器、扩展、SDK 用法以及完整的 SessionManager API，请参阅 [Session Format](session-format.md)。
