# Pi 项目架构文档

> 本套文档帮助你理解 [Pi](https://github.com/earendil-works/pi-mono)（智能体框架 + 可自我扩展的编程智能体）的架构设计、运行调试方式，以及关键代码链路与入口。

## 阅读路线图（由浅入深）

整套文档按**从大到小、由浅入深**的 5 个层次组织。每一层都比上一层更细，**每个"局部"讲之前都会先把你提升到全局**，讲完再落回局部、再深入细节——这就是推荐的阅读节奏。

```
第 1 层  大的面      → 读完你就知道 Pi 是什么、全局长什么样（10 分钟）
第 2 层  全局结构    → 系统的元素有哪些、它们怎么关联（30 分钟）
第 3 层  局部深入    → 逐个包细看，每个包都先看它在全局中的位置，再深入内部
第 4 层  细节链路    → 关键代码链路与入口，跟着真实文件走一遍
第 5 层  上手实战    → 构建、运行、调试、测试
```

### 第 1 层：大的面（先不碰代码）

- [01-overview/01-what-is-pi.md](01-overview/01-what-is-pi.md) — Pi 是什么、设计哲学、三个核心抽象
- [01-overview/02-architecture-at-a-glance.md](01-overview/02-architecture-at-a-glance.md) — **一图看懂全局**：分层全景 + 一条主链路

### 第 2 层：全局结构（把系统看成一个整体）

- [02-architecture/01-elements.md](02-architecture/01-elements.md) — 系统由哪些元素构成（4 层 25+ 元素清单）
- [02-architecture/02-relations.md](02-architecture/02-relations.md) — 元素如何关联（端到端时序 + 5 条主链路）
- [02-architecture/03-message-and-stream.md](02-architecture/03-message-and-stream.md) — 贯穿全局的"通用语言"：消息模型与事件流

### 第 3 层：局部深入（每个包 = 局部 → 全局 → 局部 → 细节）

每个包文档都遵循同一模板：先讲**局部**（这个包是什么）→ **提升到全局**（它在整条链路中的位置、上下游接口）→ **再看局部**（带着全局视角回看它的内部结构）→ **细节**（逐个模块深入）。

- [03-packages/01-pi-ai.md](03-packages/01-pi-ai.md) — LLM 抽象层（地基）
- [03-packages/02-pi-agent-core.md](03-packages/02-pi-agent-core.md) — Agent 运行时（引擎）
- [03-packages/03-pi-coding-agent.md](03-packages/03-pi-coding-agent.md) — 应用层 CLI（整车）
- [03-packages/04-pi-tui.md](03-packages/04-pi-tui.md) — 终端 UI 库（内饰）
- [03-packages/05-other-packages.md](03-packages/05-other-packages.md) — 外围与实验包

### 第 4 层：细节链路（跟着真实代码走一遍）

每条链路同样先交代"它在全局中的位置"，再深入细节：

- [04-entrypoints/01-cli-entry.md](04-entrypoints/01-cli-entry.md) — CLI 启动链路（入口）
- [04-entrypoints/02-agent-loop.md](04-entrypoints/02-agent-loop.md) — Agent 循环（引擎核心）
- [04-entrypoints/03-agent-harness.md](04-entrypoints/03-agent-harness.md) — AgentHarness 编排层
- [04-entrypoints/04-tool-execution.md](04-entrypoints/04-tool-execution.md) — 工具调用链路
- [04-entrypoints/05-session-compaction.md](04-entrypoints/05-session-compaction.md) — 会话持久化与压缩链路

### 第 5 层：上手实战

- [05-development/01-build-run.md](05-development/01-build-run.md) — 构建与运行
- [05-development/02-debug.md](05-development/02-debug.md) — 调试
- [05-development/03-test.md](05-development/03-test.md) — 测试

> **提示**：文档中的代码引用均为相对路径（如 `packages/agent/src/agent-loop.ts`），可直接在仓库中打开对应文件对照阅读。文中的行号基于当前仓库版本（v0.83.x），若代码有更新，行号可能漂移，但文件路径与函数名是稳定的锚点。

## 文档目录

```
docs/
├── README.md                     # 本导航页（阅读路线图）
├── 01-overview/                  # ── 第 1 层：大的面
│   ├── 01-what-is-pi.md          #    Pi 是什么
│   └── 02-architecture-at-a-glance.md   # 一图看懂全局 ★
├── 02-architecture/              # ── 第 2 层：全局结构
│   ├── 01-elements.md            #    元素拆解
│   ├── 02-relations.md           #    元素关联
│   └── 03-message-and-stream.md  #    消息模型与事件流
├── 03-packages/                  # ── 第 3 层：局部深入
│   ├── 01-pi-ai.md               #    LLM 抽象层
│   ├── 02-pi-agent-core.md       #    Agent 运行时
│   ├── 03-pi-coding-agent.md     #    应用层 CLI
│   ├── 04-pi-tui.md              #    终端 UI 库
│   └── 05-other-packages.md      #    外围与实验包
├── 04-entrypoints/               # ── 第 4 层：细节链路
│   ├── 01-cli-entry.md           #    CLI 启动链路
│   ├── 02-agent-loop.md          #    Agent 循环
│   ├── 03-agent-harness.md       #    AgentHarness 编排层
│   ├── 04-tool-execution.md      #    工具调用链路
│   └── 05-session-compaction.md  #    会话与压缩链路
└── 05-development/               # ── 第 5 层：上手实战
    ├── 01-build-run.md           #    构建与运行
    ├── 02-debug.md               #    调试
    └── 03-test.md                #    测试
```

## 核心速览

- **Pi 是什么**：一个 LLM 智能体框架（harness）+ 可自我扩展的交互式编程智能体 CLI。
- **三大核心包**：
  - `pi-ai`：统一的多服务商 LLM API（OpenAI / Anthropic / Google 等 37+ provider）。
  - `pi-agent-core`：Agent 运行时（工具调用、状态管理、会话存储、压缩、技能）。
  - `pi-coding-agent`：交互式编程智能体 CLI（TUI / 打印 / RPC 三种运行模式）。
- **一条主链路**：`用户输入 → coding-agent(AgentSession) → agent-core(Agent/AgentHarness → agent-loop) → pi-ai(Models → provider api → LLM) → 流式事件 → 消息回写 → 工具调用 → 循环`。
