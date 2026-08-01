# Extension Examples 扩展示例

Example extensions for pi-coding-agent.
pi-coding-agent 的扩展(extension)示例。

## Usage 用法

```bash
# Load an extension with --extension flag
pi --extension examples/extensions/permission-gate.ts

# Or copy to extensions directory for auto-discovery
cp permission-gate.ts ~/.pi/agent/extensions/
```

## Examples 示例

### Lifecycle & Safety 生命周期与安全

| Extension 扩展 | Description 说明 |
|-----------|-------------|
| `permission-gate.ts` | Prompts for confirmation before dangerous bash commands (rm -rf, sudo, etc.)<br>在执行危险的 bash 命令(rm -rf、sudo 等)前请求用户确认 |
| `project-trust.ts` | Demonstrates the `project_trust` event for user/global and CLI extensions<br>演示用户级/全局扩展与 CLI 扩展中的 `project_trust` 事件 |
| `protected-paths.ts` | Blocks writes to protected paths (.env, .git/, node_modules/)<br>阻止对受保护路径(.env、.git/、node_modules/)的写入 |
| `confirm-destructive.ts` | Confirms before destructive session actions (clear, switch, fork)<br>在执行破坏性会话操作(clear、switch、fork)前进行确认 |
| `dirty-repo-guard.ts` | Prevents session changes with uncommitted git changes<br>当 git 中存在未提交改动时,阻止切换会话 |
| `sandbox/` | OS-level sandboxing using `@anthropic-ai/sandbox-runtime` with per-project config<br>基于 `@anthropic-ai/sandbox-runtime` 的操作系统级沙箱,支持按项目配置 |
| `gondolin/` | Route built-in tools and `!` commands into a Gondolin micro-VM<br>将内置工具和 `!` 命令路由到 Gondolin 微虚拟机中执行 |

### Custom Tools 自定义工具

| Extension 扩展 | Description 说明 |
|-----------|-------------|
| `todo.ts` | Todo list tool + `/todos` command with custom rendering and state persistence<br>待办清单工具 + `/todos` 命令,带自定义渲染和状态持久化 |
| `hello.ts` | Minimal custom tool example<br>最简自定义工具示例 |
| `question.ts` | Demonstrates `ctx.ui.select()` for asking the user questions with custom UI<br>演示用 `ctx.ui.select()` 通过自定义 UI 向用户提问 |
| `questionnaire.ts` | Multi-question input with tab bar navigation between questions<br>多问题输入,可通过标签栏在各问题间导航 |
| `tool-override.ts` | Override built-in tools (e.g., add logging/access control to `read`)<br>覆写内置工具(例如为 `read` 添加日志记录/访问控制) |
| `dynamic-tools.ts` | Register tools after startup (`session_start`) and at runtime via command, with prompt snippets and tool-specific prompt guidelines<br>在启动后(`session_start`)以及运行时通过命令注册工具,并附带提示词片段与针对特定工具的提示词规范 |
| `kimi-deferred-tools.ts` | Search for and progressively activate tools for Kimi's deferred-tool loading protocol<br>为 Kimi 的延迟工具加载协议搜索并逐步激活工具 |
| `structured-output.ts` | Final structured-output tool that returns `terminate: true` so the agent can end on the tool call<br>返回 `terminate: true` 的终结性结构化输出工具,使 agent 可以在该工具调用处结束 |
| `built-in-tool-renderer.ts` | Custom compact rendering for built-in tools (read, bash, edit, write) while keeping original behavior<br>为内置工具(read、bash、edit、write)提供紧凑的自定义渲染,同时保留原有行为 |
| `minimal-mode.ts` | Override built-in tool rendering for minimal display (only tool calls, no output in collapsed mode)<br>覆写内置工具的渲染以实现极简显示(折叠模式下只显示工具调用,不显示输出) |
| `truncated-tool.ts` | Wraps ripgrep with proper output truncation (50KB/2000 lines)<br>封装 ripgrep 并做恰当的输出截断(50KB/2000 行) |
| `ssh.ts` | Delegate all tools to a remote machine via SSH using pluggable operations<br>通过 SSH 使用可插拔操作,将所有工具委派到远程机器执行 |
| `subagent/` | Delegate tasks to specialized subagents with isolated context windows<br>将任务委派给拥有独立上下文窗口的专用子 agent(subagent) |

### Commands & UI 命令与界面

| Extension 扩展 | Description 说明 |
|-----------|-------------|
| `preset.ts` | Named presets for model, thinking level, tools, and instructions via `--preset` flag and `/preset` command<br>通过 `--preset` 参数和 `/preset` 命令,为模型、思考等级、工具和指令提供具名预设 |
| `plan-mode/` | Claude Code-style plan mode for read-only exploration with `/plan` command and step tracking<br>Claude Code 风格的计划模式,用于只读探索,提供 `/plan` 命令和步骤跟踪 |
| `tools.ts` | Interactive `/tools` command to enable/disable tools with session persistence<br>交互式 `/tools` 命令,可启用/禁用工具并持久化到会话 |
| `handoff.ts` | Transfer context to a new focused session via `/handoff <goal>`<br>通过 `/handoff <goal>` 将上下文转移到一个目标更聚焦的新会话 |
| `qna.ts` | Extracts questions from last response into editor via `ctx.ui.setEditorText()`<br>通过 `ctx.ui.setEditorText()` 把上一条回复中的问题提取到编辑器中 |
| `status-line.ts` | Shows turn progress in footer via `ctx.ui.setStatus()` with themed colors<br>通过 `ctx.ui.setStatus()` 在页脚以主题配色展示当前轮次进度 |
| `github-issue-autocomplete.ts` | Adds `#1234` issue completions by stacking a custom autocomplete provider that preloads open issues from `gh issue list`<br>叠加一个自定义自动补全提供者,预加载 `gh issue list` 中的开放 issue,从而支持 `#1234` 形式的补全 |
| `widget-placement.ts` | Shows widgets above and below the editor via `ctx.ui.setWidget()` placement<br>通过 `ctx.ui.setWidget()` 的位置设置,在编辑器上方和下方展示组件(widget) |
| `hidden-thinking-label.ts` | Customizes the collapsed thinking label via `ctx.ui.setHiddenThinkingLabel()`<br>通过 `ctx.ui.setHiddenThinkingLabel()` 自定义折叠状态下的思考标签文案 |
| `working-indicator.ts` | Customizes the streaming working indicator via `ctx.ui.setWorkingIndicator()`<br>通过 `ctx.ui.setWorkingIndicator()` 自定义流式输出时的工作状态指示器 |
| `model-status.ts` | Shows model changes in status bar via `model_select` hook<br>通过 `model_select` 钩子在状态栏展示模型切换情况 |
| `snake.ts` | Snake game with custom UI, keyboard handling, and session persistence<br>贪吃蛇游戏,包含自定义 UI、键盘处理和会话持久化 |
| `tic-tac-toe.ts` | Tic-tac-toe vs the agent with `executionMode: "sequential"` tools to prevent race conditions on shared cursor state<br>与 agent 对战井字棋,工具使用 `executionMode: "sequential"` 以避免共享光标状态上的竞态条件 |
| `send-user-message.ts` | Demonstrates `pi.sendUserMessage()` for sending user messages from extensions<br>演示用 `pi.sendUserMessage()` 从扩展中发送用户消息 |
| `timed-confirm.ts` | Demonstrates AbortSignal for auto-dismissing `ctx.ui.confirm()` and `ctx.ui.select()` dialogs<br>演示用 AbortSignal 自动关闭 `ctx.ui.confirm()` 和 `ctx.ui.select()` 对话框 |
| `rpc-demo.ts` | Exercises all RPC-supported extension UI methods; pair with [`examples/rpc-extension-ui.ts`](../rpc-extension-ui.ts)<br>演练所有支持 RPC 的扩展 UI 方法;需与 [`examples/rpc-extension-ui.ts`](../rpc-extension-ui.ts) 搭配使用 |
| `modal-editor.ts` | Custom vim-like modal editor via `ctx.ui.setEditorComponent()`<br>通过 `ctx.ui.setEditorComponent()` 实现类 vim 的自定义模式化编辑器 |
| `rainbow-editor.ts` | Animated rainbow text effect via custom editor<br>通过自定义编辑器实现彩虹文字动画效果 |
| `notify.ts` | Desktop notifications via OSC 777 when agent finishes (Ghostty, iTerm2, WezTerm)<br>agent 完成任务时通过 OSC 777 发送桌面通知(Ghostty、iTerm2、WezTerm) |
| `titlebar-spinner.ts` | Braille spinner animation in terminal title while the agent is working<br>agent 工作期间在终端标题栏显示盲文字符加载动画 |
| `summarize.ts` | Summarize conversation with GPT-5.2 and show in transient UI<br>用 GPT-5.2 总结对话内容,并显示在临时 UI 中 |
| `custom-footer.ts` | Custom footer with git branch and token stats via `ctx.ui.setFooter()`<br>通过 `ctx.ui.setFooter()` 自定义页脚,展示 git 分支和 token 统计 |
| `custom-header.ts` | Custom header via `ctx.ui.setHeader()`<br>通过 `ctx.ui.setHeader()` 自定义页眉 |
| `overlay-test.ts` | Test overlay compositing with inline text inputs and edge cases<br>测试浮层(overlay)合成,涵盖内联文本输入及各种边界情况 |
| `overlay-qa-tests.ts` | Comprehensive overlay QA tests: anchors, margins, stacking, overflow, animation<br>全面的浮层 QA 测试:锚点、外边距、层叠、溢出、动画 |
| `doom-overlay/` | DOOM game running as an overlay at 35 FPS (demonstrates real-time game rendering)<br>以 35 FPS 在浮层中运行 DOOM 游戏(演示实时游戏渲染) |
| `shutdown-command.ts` | Adds `/quit` command demonstrating `ctx.shutdown()`<br>新增 `/quit` 命令以演示 `ctx.shutdown()` |
| `reload-runtime.ts` | Adds `/reload-runtime` and `reload_runtime` tool showing safe reload flow<br>新增 `/reload-runtime` 命令和 `reload_runtime` 工具,展示安全的重载流程 |
| `interactive-shell.ts` | Run interactive commands (vim, htop) with full terminal via `user_bash` hook<br>通过 `user_bash` 钩子在完整终端中运行交互式命令(vim、htop) |
| `inline-bash.ts` | Expands `!{command}` patterns in prompts via `input` event transformation<br>通过 `input` 事件转换,在提示词中展开 `!{command}` 模式 |
| `input-transform-streaming.ts` | Skips expensive input preprocessing for mid-stream steering via `streamingBehavior`<br>通过 `streamingBehavior` 跳过高开销的输入预处理,以支持流式过程中的即时干预 |

### Git Integration Git 集成

| Extension 扩展 | Description 说明 |
|-----------|-------------|
| `git-checkpoint.ts` | Creates git stash checkpoints at each turn for code restoration on fork<br>在每一轮创建 git stash 检查点,便于分叉(fork)时恢复代码 |
| `auto-commit-on-exit.ts` | Auto-commits on exit using last assistant message for commit message<br>退出时自动提交,并以最后一条助手消息作为提交信息 |

### System Prompt & Compaction 系统提示词与上下文压缩

| Extension 扩展 | Description 说明 |
|-----------|-------------|
| `pirate.ts` | Demonstrates `systemPromptAppend` to dynamically modify system prompt<br>演示用 `systemPromptAppend` 动态修改系统提示词 |
| `claude-rules.ts` | Scans `.claude/rules/` folder and lists rules in system prompt<br>扫描 `.claude/rules/` 目录并在系统提示词中列出规则 |
| `custom-compaction.ts` | Custom compaction that summarizes entire conversation<br>自定义压缩(compaction)策略,对整段对话进行总结 |
| `trigger-compact.ts` | Triggers compaction when context usage exceeds 100k tokens and adds `/trigger-compact` command<br>当上下文用量超过 10 万 token 时触发压缩,并新增 `/trigger-compact` 命令 |

### System Integration 系统集成

| Extension 扩展 | Description 说明 |
|-----------|-------------|
| `mac-system-theme.ts` | Syncs pi theme with macOS dark/light mode<br>将 pi 主题与 macOS 的深色/浅色模式保持同步 |

### Resources 资源

| Extension 扩展 | Description 说明 |
|-----------|-------------|
| `dynamic-resources/` | Loads skills, prompts, and themes using `resources_discover`<br>使用 `resources_discover` 加载技能(skill)、提示词和主题 |

### Messages & Communication 消息与通信

| Extension 扩展 | Description 说明 |
|-----------|-------------|
| `message-renderer.ts` | Custom message rendering with colors and expandable details via `registerMessageRenderer`<br>通过 `registerMessageRenderer` 实现带颜色和可展开详情的自定义消息渲染 |
| `entry-renderer.ts` | TUI-only session entry rendering via `appendEntry` and `registerEntryRenderer`<br>通过 `appendEntry` 和 `registerEntryRenderer` 实现仅在 TUI 中生效的会话条目渲染 |
| `event-bus.ts` | Inter-extension communication via `pi.events`<br>通过 `pi.events` 实现扩展之间的通信 |

### Session Metadata 会话元数据

| Extension 扩展 | Description 说明 |
|-----------|-------------|
| `session-name.ts` | Name sessions for the session selector via `setSessionName`<br>通过 `setSessionName` 为会话命名,便于在会话选择器中识别 |
| `bookmark.ts` | Bookmark entries with labels for `/tree` navigation via `setLabel`<br>通过 `setLabel` 为条目添加带标签的书签,便于 `/tree` 导航 |

### Custom Providers 自定义服务提供方

| Extension 扩展 | Description 说明 |
|-----------|-------------|
| `custom-provider-anthropic/` | Custom Anthropic provider with OAuth support and custom streaming implementation<br>自定义 Anthropic provider,支持 OAuth 并自行实现流式传输 |
| `custom-provider-gitlab-duo/` | GitLab Duo provider using pi-ai's built-in Anthropic/OpenAI streaming via proxy<br>GitLab Duo provider,通过代理复用 pi-ai 内置的 Anthropic/OpenAI 流式实现 |

### External Dependencies 外部依赖

| Extension 扩展 | Description 说明 |
|-----------|-------------|
| `with-deps/` | Extension with its own package.json and dependencies (demonstrates jiti module resolution)<br>拥有独立 package.json 和依赖的扩展(演示 jiti 的模块解析) |
| `file-trigger.ts` | Watches a trigger file and injects contents into conversation<br>监听触发文件,并将其内容注入到对话中 |

## Writing Extensions 编写扩展

See [docs/extensions.md](../../docs/extensions.md) for full documentation.
完整文档参见 [docs/extensions.md](../../docs/extensions.md)。

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  // Subscribe to lifecycle events
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName === "bash" && event.input.command?.includes("rm -rf")) {
      const ok = await ctx.ui.confirm("Dangerous!", "Allow rm -rf?");
      if (!ok) return { block: true, reason: "Blocked by user" };
    }
  });

  // Register custom tools
  pi.registerTool({
    name: "greet",
    label: "Greeting",
    description: "Generate a greeting",
    parameters: Type.Object({
      name: Type.String({ description: "Name to greet" }),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return {
        content: [{ type: "text", text: `Hello, ${params.name}!` }],
        details: {},
      };
    },
  });

  // Register commands
  pi.registerCommand("hello", {
    description: "Say hello",
    handler: async (args, ctx) => {
      ctx.ui.notify("Hello!", "info");
    },
  });
}
```

## Key Patterns 关键模式

**Use StringEnum for string parameters** (required for Google API compatibility):
**字符串参数请使用 StringEnum**(这是兼容 Google API 的必要条件):
```typescript
import { StringEnum } from "@earendil-works/pi-ai";

// Good
action: StringEnum(["list", "add"] as const)

// Bad - doesn't work with Google
action: Type.Union([Type.Literal("list"), Type.Literal("add")])
```

**State persistence via details:**
**通过 details 实现状态持久化:**
```typescript
// Store state in tool result details for proper forking support
return {
  content: [{ type: "text", text: "Done" }],
  details: { todos: [...todos], nextId },  // Persisted in session
};

// Reconstruct on session events
pi.on("session_start", async (_event, ctx) => {
  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type === "message" && entry.message.toolName === "my_tool") {
      const details = entry.message.details;
      // Reconstruct state from details
    }
  }
});
```
