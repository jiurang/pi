# Subagent Example 子 Agent 示例

Delegate tasks to specialized subagents with isolated context windows.
将任务委派给拥有独立上下文窗口（context window）的专用子 Agent。

## Features 特性

- **Isolated context**: Each subagent runs in a separate `pi` process
  **上下文隔离**：每个子 Agent 都运行在独立的 `pi` 进程中
- **Streaming output**: See tool calls and progress as they happen
  **流式输出**：实时查看工具调用与执行进度
- **Parallel streaming**: All parallel tasks stream updates simultaneously
  **并行流式输出**：所有并行任务同时流式推送更新
- **Markdown rendering**: Final output rendered with proper formatting (expanded view)
  **Markdown 渲染**：最终输出以正确的格式渲染（展开视图下）
- **Usage tracking**: Shows turns, tokens, cost, and context usage per agent
  **用量追踪**：按 Agent 显示轮次（turns）、token 数、费用和上下文占用
- **Abort support**: Ctrl+C propagates to kill subagent processes
  **中止支持**：Ctrl+C 会向下传递以终止子 Agent 进程

## Structure 目录结构

```
subagent/
├── README.md            # This file
├── index.ts             # The extension (entry point)
├── agents.ts            # Agent discovery logic
├── agents/              # Sample agent definitions
│   ├── scout.md         # Fast recon, returns compressed context
│   ├── planner.md       # Creates implementation plans
│   ├── reviewer.md      # Code review
│   └── worker.md        # General-purpose (full capabilities)
└── prompts/             # Workflow presets (prompt templates)
    ├── implement.md     # scout -> planner -> worker
    ├── scout-and-plan.md    # scout -> planner (no implementation)
    └── implement-and-review.md  # worker -> reviewer -> worker
```

## Installation 安装

From the repository root, symlink the files:
在仓库根目录下，为这些文件创建符号链接：

```bash
# Symlink the extension (must be in a subdirectory with index.ts)
mkdir -p ~/.pi/agent/extensions/subagent
ln -sf "$(pwd)/packages/coding-agent/examples/extensions/subagent/index.ts" ~/.pi/agent/extensions/subagent/index.ts
ln -sf "$(pwd)/packages/coding-agent/examples/extensions/subagent/agents.ts" ~/.pi/agent/extensions/subagent/agents.ts

# Symlink agents
mkdir -p ~/.pi/agent/agents
for f in packages/coding-agent/examples/extensions/subagent/agents/*.md; do
  ln -sf "$(pwd)/$f" ~/.pi/agent/agents/$(basename "$f")
done

# Symlink workflow prompts
mkdir -p ~/.pi/agent/prompts
for f in packages/coding-agent/examples/extensions/subagent/prompts/*.md; do
  ln -sf "$(pwd)/$f" ~/.pi/agent/prompts/$(basename "$f")
done
```

## Security Model 安全模型

This tool executes a separate `pi` subprocess with a delegated system prompt and tool/model configuration.
该工具会启动一个独立的 `pi` 子进程，并为其委派系统提示词以及工具/模型配置。

**Project-local agents** (`.pi/agents/*.md`) are repo-controlled prompts that can instruct the model to read files, run bash commands, etc.
**项目本地 Agent**（`.pi/agents/*.md`）是由仓库控制的提示词，可以指示模型读取文件、执行 bash 命令等。

**Default behavior:** Only loads **user-level agents** from `~/.pi/agent/agents`.
**默认行为：** 仅从 `~/.pi/agent/agents` 加载**用户级 Agent**。

To enable project-local agents, pass `agentScope: "both"` (or `"project"`). Only do this for repositories you trust.
若要启用项目本地 Agent，请传入 `agentScope: "both"`（或 `"project"`）。请仅对你信任的仓库这样做。

When running interactively, the tool prompts for confirmation before running project-local agents. Set `confirmProjectAgents: false` to disable.
在交互式运行时，该工具会在执行项目本地 Agent 前请求确认。设置 `confirmProjectAgents: false` 可关闭此确认。

## Usage 用法

### Single agent 单个 Agent
```
Use scout to find all authentication code
```

### Parallel execution 并行执行
```
Run 2 scouts in parallel: one to find models, one to find providers
```

### Chained workflow 链式工作流
```
Use a chain: first have scout find the read tool, then have planner suggest improvements
```

### Workflow prompts 工作流提示词
```
/implement add Redis caching to the session store
/scout-and-plan refactor auth to support OAuth
/implement-and-review add input validation to API endpoints
```

## Tool Modes 工具模式

| Mode 模式 | Parameter 参数 | Description 说明 |
|------|-----------|-------------|
| Single 单任务 | `{ agent, task }` | One agent, one task<br>一个 Agent，一个任务 |
| Parallel 并行 | `{ tasks: [...] }` | Multiple agents run concurrently (max 8, 4 concurrent)<br>多个 Agent 并发运行（最多 8 个任务，4 个并发） |
| Chain 链式 | `{ chain: [...] }` | Sequential with `{previous}` placeholder<br>顺序执行，可使用 `{previous}` 占位符 |

## Output Display 输出展示

**Collapsed view** (default):
**折叠视图**（默认）：
- Status icon (✓/✗/⏳) and agent name
  状态图标（✓/✗/⏳）与 Agent 名称
- Last 5-10 items (tool calls and text)
  最近 5-10 条内容（工具调用与文本）
- Usage stats: `3 turns ↑input ↓output RcacheRead WcacheWrite $cost ctx:contextTokens model`
  用量统计：`3 turns ↑input ↓output RcacheRead WcacheWrite $cost ctx:contextTokens model`

**Expanded view** (Ctrl+O):
**展开视图**（Ctrl+O）：
- Full task text
  完整的任务文本
- All tool calls with formatted arguments
  全部工具调用及其格式化后的参数
- Final output rendered as Markdown
  以 Markdown 渲染的最终输出
- Per-task usage (for chain/parallel)
  按任务统计的用量（用于链式/并行模式）

**Parallel mode streaming**:
**并行模式的流式输出**：
- Shows all tasks with live status (⏳ running, ✓ done, ✗ failed)
  展示所有任务及其实时状态（⏳ 运行中，✓ 已完成，✗ 已失败）
- Updates as each task makes progress
  随各任务推进而实时更新
- Shows "2/3 done, 1 running" status
  显示类似 "2/3 done, 1 running" 的状态
- Returns each completed task's final output to the parent model, capped at 50 KB per task
  将每个已完成任务的最终输出返回给父模型，每个任务上限为 50 KB
- Returns failure diagnostics from stderr/error messages when a child exits before producing output
  当子进程在产生输出前退出时，返回来自 stderr/错误信息的失败诊断内容

**Tool call formatting** (mimics built-in tools):
**工具调用的格式化展示**（模仿内置工具）：
- `$ command` for bash
  bash 使用 `$ command`
- `read ~/path:1-10` for read
  read 使用 `read ~/path:1-10`
- `grep /pattern/ in ~/path` for grep
  grep 使用 `grep /pattern/ in ~/path`
- etc.
  等等

## Agent Definitions Agent 定义

Agents are markdown files with YAML frontmatter:
Agent 是带有 YAML frontmatter 的 markdown 文件：

```markdown
---
name: my-agent
description: What this agent does
tools: read, grep, find, ls
model: claude-haiku-4-5
---

System prompt for the agent goes here.
```

**Locations:**
**存放位置：**
- `~/.pi/agent/agents/*.md` - User-level (always loaded)
  `~/.pi/agent/agents/*.md` - 用户级（始终加载）
- `.pi/agents/*.md` - Project-level (only with `agentScope: "project"` or `"both"`)
  `.pi/agents/*.md` - 项目级（仅在 `agentScope: "project"` 或 `"both"` 时加载）

Project agents override user agents with the same name when `agentScope: "both"`.
当 `agentScope: "both"` 时，同名的项目级 Agent 会覆盖用户级 Agent。

## Sample Agents 示例 Agent

| Agent | Purpose 用途 | Model 模型 | Tools 工具 |
|-------|---------|-------|-------|
| `scout` | Fast codebase recon<br>快速代码库侦查 | Haiku | read, grep, find, ls, bash |
| `planner` | Implementation plans<br>制定实现方案 | Sonnet | read, grep, find, ls |
| `reviewer` | Code review<br>代码评审 | Sonnet | read, grep, find, ls, bash |
| `worker` | General-purpose<br>通用型 | Sonnet | (all default)<br>（全部默认工具） |

## Workflow Prompts 工作流提示词

| Prompt 提示词 | Flow 流程 |
|--------|------|
| `/implement <query>` | scout → planner → worker |
| `/scout-and-plan <query>` | scout → planner |
| `/implement-and-review <query>` | worker → reviewer → worker |

## Error Handling 错误处理

- **Exit code != 0**: Tool returns error with stderr/output
  **退出码不为 0**：工具返回错误，并附带 stderr/输出内容
- **stopReason "error"**: LLM error propagated with error message
  **stopReason 为 "error"**：LLM 错误连同错误信息一并向上传递
- **stopReason "aborted"**: User abort (Ctrl+C) kills subprocess, throws error
  **stopReason 为 "aborted"**：用户中止（Ctrl+C）会终止子进程并抛出错误
- **Chain mode**: Stops at first failing step, reports which step failed
  **链式模式**：在第一个失败的步骤处停止，并报告是哪一步失败

## Limitations 限制

- Output truncated to last 10 items in collapsed view (expand to see all)
  折叠视图下输出被截断为最近 10 条（展开可查看全部）
- Parallel model-visible output is capped at 50 KB per task; full results remain in tool details
  并行模式下对模型可见的输出每个任务上限为 50 KB；完整结果仍保留在工具详情中
- Agents discovered fresh on each invocation (allows editing mid-session)
  每次调用都会重新发现 Agent（因此可在会话进行中编辑）
- Parallel mode limited to 8 tasks, 4 concurrent
  并行模式最多 8 个任务、4 个并发
