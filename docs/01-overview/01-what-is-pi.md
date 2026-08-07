# 项目定位与核心设计哲学

> 第 1 层：大的面。如果还没看过 [02-architecture-at-a-glance.md](02-architecture-at-a-glance.md) 的一图看懂，建议先花 5 分钟看它，再回到这篇看 Pi 的定位、包组成与设计哲学。

## Pi 是什么

Pi 是一个 **LLM 智能体框架（agent harness）**，同时自带一个 **可自我扩展的交互式编程智能体（coding agent）**。它的目标是用一个最小而坚实的运行时，让"智能体"（基于 LLM 的循环 + 工具调用）能够稳定、持久化地运行，并让用户/开发者可以深度定制（技能、扩展、提示词模板、主题）。

Pi 由以下 npm 包组成：

| 包 | 定位 | 一句话说明 |
|---|---|---|
| `@earendil-works/pi-ai` | LLM 抽象层 | 统一多服务商 LLM API，37+ provider，自动模型发现与鉴权 |
| `@earendil-works/pi-agent-core` | Agent 运行时 | 工具调用、状态管理、会话存储、压缩、技能、Harness 编排 |
| `@earendil-works/pi-coding-agent` | 应用层 | 交互式编程智能体 CLI，TUI / 打印 / RPC 三种模式 |
| `@earendil-works/pi-tui` | 终端 UI | 支持差分渲染的终端 UI 组件库 |
| `@earendil-works/pi-protocol` | 协议 | 实验性 CBOR 远程会话协议（编码 / 分帧 / 校验） |
| `@earendil-works/pi-client` | RPC 客户端 | 传输无关的远程会话客户端（浏览器可用） |
| `@earendil-works/pi-server` | 守护进程 | 实验性 Unix socket IPC 守护进程，监督 coding-agent 的 RPC 子进程 |
| `@earendil-works/pi-storage-sqlite-node` | 存储后端 | pi-agent-core 会话存储的可选 SQLite 后端 |
| `@earendil-works/pi-evals` | 评测 | 模型驱动的行为评测（private，不发布） |

## 设计哲学

`packages/coding-agent/README.md` 明确了一些"反其道而行"的设计决策：

- **无 MCP**：不引入 Model Context Protocol，保持依赖与心智模型最小。
- **无子智能体**：核心是单一 agent 循环，不提供内置的 sub-agent 编排。
- **无权限弹窗**：没有内置权限系统，默认以启动用户权限运行；隔离通过容器化 / 沙箱方案（见根 `README.md` 的 Permissions & Containerization 章节）。
- **无 plan mode**：不做独立的"计划模式"，规划通过工具调用自然发生。

## 核心抽象（提前认识，后面会反复出现）

在深入代码之前，先认识贯穿全项目的三个抽象，它们也是"拆元素"时最重要的三个：

1. **`Model`（模型）**：一个纯数据对象，描述"用什么 API、哪个 provider、哪个模型 id、什么能力、什么价格"。可 JSON 序列化，无任何函数。
2. **`Message` / `AgentMessage`（消息）**：对话的基本单元，有三种角色（`user` / `assistant` / `toolResult`），内部由内容块（text / thinking / image / toolCall）组成。
3. **`EventStream`（事件流）**：LLM 调用的统一返回形态，是异步可迭代的，产出细粒度事件（`start` / `text_delta` / `thinking_delta` / `toolcall_delta` / `done` / `error`），**错误编码进流而非抛出异常**。

这三个抽象分别在 `pi-ai` 的 `src/types.ts` 中定义，被所有上层包复用。详见 [02-architecture/03-message-and-stream.md](../02-architecture/03-message-and-stream.md)。

## 一条主链路（30 秒速览）

```
用户输入
  │
  ▼
pi-coding-agent  AgentSession  （解析输入、加载技能/上下文、管理会话）
  │
  ▼
pi-agent-core    Agent / AgentHarness → agent-loop
  │               （消息转换 → 调用 LLM → 执行工具 → 循环，直到停止）
  ▼
pi-ai            Models → provider api adapter → 各家 LLM 服务商
  │               （鉴权、模型目录、流式请求、usage/成本统计）
  ▼
事件流返回（text_delta / toolcall_delta / done ...）
  │
  ▼
agent-loop 把最终 assistant 消息写回上下文，
若有工具调用则执行工具，把结果作为 toolResult 消息继续下一轮
```

## 与其他项目的关系

- **pi-chat**（`earendil-works/pi-chat`）：基于 Pi 的 Slack / 聊天自动化与工作流项目，是 Pi 生态的另一个应用。
- **pi.dev**：项目官网，包含文档与演示。

> 官方文档在 https://pi.dev/docs/latest ；本仓库内 `packages/*/docs` 目录也散落着各包的设计文档（例如 `packages/agent/docs/agent-harness.md` 是 AgentHarness 当前行为的权威说明），本套文档会引用它们。

## 许可证

MIT。
