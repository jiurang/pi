# 调试

## 1. 内置调试命令：`/debug`

在**交互模式**中输入 `/debug`（隐藏命令，`packages/coding-agent/src/modes/interactive/interactive-mode.ts` L2986/L6257）：

写入 `~/.pi/agent/pi-debug.log`（`getDebugLogPath()`，`src/config.ts`）：
- 终端尺寸与所有渲染行（带 ANSI 码与可见宽度）；
- Agent 的消息（JSONL）。

适合排查 **TUI 渲染问题**（行宽、截断、乱码）与**消息内容**。

## 2. 观察 provider 请求：onPayload / onResponse

pi-ai 的 `StreamOptions` 提供两个钩子（`packages/ai/src/types.ts`）：

- `onPayload`：每个请求发出前回调，可**改写请求负载**；
- `onResponse`：响应到达后回调。

coding-agent 把它们接到扩展事件 `before_provider_request` / `after_provider_response`（见 `src/core/sdk.ts` 的 `createAgentSession`）。在扩展里注册 `on("before_provider_request", ...)` 即可看到/改写发给服务商的真实请求。

## 3. 断点调试（推荐）

项目是 ESM + TypeScript，可用 **Node 内置调试器**或 IDE（VS Code/WebStorm）直接对源码断点：

```bash
# 用 node --inspect + tsx 启动，VS Code 附加到 9229
node --inspect-brk --import tsx packages/coding-agent/src/cli.ts -p "hello"
```

常用断点位置（见 [04-entrypoints](../04-entrypoints/) 各文档的"调试锚点"）：

| 想观察什么 | 断在哪 |
|---|---|
| CLI 模式选择 | `main.ts` 的 `resolveAppMode`（L115-126） |
| 会话创建 | `main.ts` 的 `createSessionManager`（L324-415）或 `SessionManager.create` |
| Agent 构造 | `sdk.ts` 的 `createAgentSession` 中 `new Agent(...)` |
| 核心循环 | `agent-loop.ts` 的 `runLoop`（L165）、`streamAssistantResponse`（L305） |
| 工具执行 | `agent-loop.ts` 的 `executeToolCalls`（L444）、`prepareToolCall`（L633） |
| Harness 编排 | `agent-harness.ts` 的 `executeTurn`（L623）、`createLoopConfig`（L484） |
| 会话持久化 | `agent-session.ts` 的 `_handleAgentEvent` 或 `sessionManager.appendMessage` |
| 压缩触发 | `compaction.ts` 的 `shouldCompact`（L336） |
| provider 请求 | `ai/src/models.ts` 的 `stream` 或各 `api/*.ts` 的 `stream` |

> Windows 用户注意：`node --inspect-brk --import tsx` 在 PowerShell 下可直接运行；也可配置 VS Code 的 `launch.json` 用 tsx 作为 runtime。

## 4. 终端与 TUI 调试

- **tmux 受控终端**（仓库 `AGENTS.md` 推荐）：在固定尺寸终端里跑 TUI 并抓屏：

```bash
tmux new-session -d -s pi-test -x 80 -y 24
tmux send-keys -t pi-test "./pi-test.sh" Enter
sleep 3 && tmux capture-pane -t pi-test -p
tmux send-keys -t pi-test "your prompt here" Enter
tmux kill-session -t pi-test
```

- **`--no-alt-screen`**：TUI 用主缓冲区渲染（保留回滚历史），方便观察完整输出。

## 5. 打印模式 / JSON 模式（绕开 TUI）

- `-p "提示词"`：打印模式，只输出最后一条文本；错误走 stderr、退出码 1。
- `--mode json`：每条会话事件以 JSON 行流式输出，**最适合脚本化调试**——可以看到 `message_start/message_update/message_end/tool_execution_*` 的完整事件流。
- `--mode rpc`：JSONL 请求/响应（供外部进程驱动），见 `packages/coding-agent/docs/rpc.md` 与 `sdk.md`。

## 6. 查看完整会话内容

会话是 JSONL 文件：`~/.pi/agent/sessions/<cwd-encoded>/<timestamp>_<id>.jsonl`。直接查看/编辑即可审计历史；`pi --export <session>` 可导出 HTML。

## 7. 环境变量辅助

- `PI_OFFLINE=1`：离线模式，跳过版本检查与模型刷新（排查网络/版本检查问题）。
- `PI_STARTUP_BENCHMARK=1`：交互模式启动基准（`main.ts`）。
- provider 的 API key 环境变量（`packages/ai/src/env-api-keys.ts`）错误会直接导致鉴权失败——先用 `pi --list-models` 确认 provider 可用。

## 8. 日志

- 无独立 stdout 日志文件；运行日志主要靠：
  - `/debug` 输出的 `~/.pi/agent/pi-debug.log`；
  - 交互模式下扩展/诊断信息；
  - `--mode json`/`--mode rpc` 的事件流。
- 需要结构化可观测性时，在扩展中订阅 `AgentSessionEvent` 自行落盘（参考 `examples/extensions/`）。
