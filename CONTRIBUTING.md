# Contributing to pi 为 pi 做贡献

This guide exists to save both sides time.

本指南的目的是为双方节省时间。

## Philosophy 理念

First things first: **pi's core is minimal**.

首先要明确：**pi 的核心是极简的**。

If your feature does not belong in the core, it should be an extension. PRs that bloat the core will likely be rejected.

如果你的功能不属于核心范畴，就应该做成扩展。使核心臃肿的 PR 很可能会被拒绝。

Pi's core exists to be minimal and to be extensible so that it can be influenced and manipulated by extensions.  Even hook points for extensions however should be well considered and discussed to avoid adding unmaintainable bloat and complex interactions.

Pi 的核心之所以存在，就是为了保持极简且可扩展，从而能被扩展所影响和操控。不过，即便是给扩展用的钩子点，也应经过充分考量和讨论，以免引入难以维护的臃肿代码和复杂的相互作用。

## The One Rule 唯一铁律

**You must understand your code.** If you cannot explain what your changes do and how they interact with the rest of the system, your PR will be closed.

**你必须理解自己的代码。** 如果你无法解释你的改动做了什么、以及它如何与系统其余部分交互，你的 PR 将被关闭。

Using AI to write code is fine. Submitting AI-generated slop without understanding it is not.

用 AI 写代码没问题。但在不理解的情况下提交 AI 生成的垃圾代码则不可接受。

If you use an agent, run it from the `pi` root directory so it picks up `AGENTS.md` automatically. Your agent must follow the rules and guidelines in that file.

如果你使用 agent，请从 `pi` 根目录运行它，以便它自动读取 `AGENTS.md`。你的 agent 必须遵守该文件中的规则和指南。

## Contribution Gate 贡献准入机制

All issues and PRs from new contributors are auto-closed by default.

来自新贡献者的所有 issue 和 PR 默认都会被自动关闭。

Issues submitted Friday through Sunday are not guaranteed to be reviewed.  If something is urgent, ask on Discord: https://discord.com/invite/3cU7Bz4UPx

周五至周日提交的 issue 不保证会被审阅。如果有紧急事项，请在 Discord 上提问：https://discord.com/invite/3cU7Bz4UPx

Maintainers review auto-closed issues daily and reopen worthwhile ones. Issues that do not meet the quality bar below will not be reopened or receive a reply.

维护者每天都会审阅被自动关闭的 issue，并重新开启有价值的那些。不符合下述质量标准的 issue 不会被重新开启，也不会得到回复。

Approval happens through maintainer replies on issues:

批准是通过维护者在 issue 上的回复来完成的：

- `lgtmi`: your future issues will not be auto-closed
  `lgtmi`：你今后提交的 issue 不会被自动关闭。
- `lgtm`: your future issues and PRs will not be auto-closed
  `lgtm`：你今后提交的 issue 和 PR 都不会被自动关闭。

The command must be at the start of the reply (optionally after one or more `@username` mentions) or at the end. `lgtmi` does not grant rights to submit PRs. Only `lgtm` grants rights to submit PRs.

该命令必须位于回复的开头（可以放在一个或多个 `@username` 提及之后）或结尾。`lgtmi` 不授予提交 PR 的权限，只有 `lgtm` 才授予提交 PR 的权限。

## Quality Bar For Issues Issue 的质量标准

If you open an issue, you must use one of the two GitHub issue templates.

如果你要提交 issue，必须使用两个 GitHub issue 模板之一。

If you open an issue, keep it short, concrete, and worth reading.

提交 issue 时，请保持简短、具体、有阅读价值。

- Keep it concise. If it does not fit on one screen, it is too long.
  保持简洁。如果一屏放不下，那就太长了。
- Write in your own voice (do not use an LLM to generate text, if you must, follow up with a clearly AI labeled comment).
  用你自己的语言撰写（不要用 LLM 生成文本；如果确有必要，请另外补充一条明确标注为 AI 生成的评论）。
- State the bug or request clearly.
  清楚地陈述缺陷或需求。
- Explain why it matters.
  说明它为什么重要。
- If you want to implement the change yourself, say so.
  如果你想自己实现这个改动，请说明。

If the issue is real and written well, a maintainer may reopen it or reply with `lgtmi` or `lgtm` in the command position described above.

如果 issue 确有其事且撰写得当，维护者可能会重新开启它，或按上文所述的命令位置回复 `lgtmi` 或 `lgtm`。

## Blocking 封禁

If you ignore this document twice, or if you spam the tracker with agent-generated issues, your GitHub account will be permanently blocked.

如果你两次无视本文档，或用 agent 生成的 issue 刷屏问题追踪器，你的 GitHub 账号将被永久封禁。

If you send a large volume of issues through automation, your GitHub account will be permanently blocked. No taksies backsies.

如果你通过自动化手段提交大量 issue，你的 GitHub 账号将被永久封禁，且不予撤销。

## Before Submitting a PR 提交 PR 之前

Do not open a PR unless you have already been approved by a maintainer using `lgtm` in the command position described above.

除非维护者已按上文所述的命令位置用 `lgtm` 批准了你，否则不要提交 PR。

Before submitting a PR:

提交 PR 之前请运行：

```bash
npm run check
./test.sh
```

Both must pass.

两者都必须通过。

Do not edit `CHANGELOG.md`. Changelog entries are added by maintainers.

不要编辑 `CHANGELOG.md`。变更日志条目由维护者添加。

If you are adding a new provider to `packages/ai`, see `AGENTS.md` for required tests.

如果你要向 `packages/ai` 添加新的 provider，请参阅 `AGENTS.md` 了解必需的测试。

## Questions? 有疑问？

Ask on [Discord](https://discord.com/invite/nKXTsAcmbT).

请在 [Discord](https://discord.com/invite/nKXTsAcmbT) 上提问。

## FAQ 常见问题

### Why are new issues and PRs auto-closed? 为什么新的 issue 和 PR 会被自动关闭？

pi receives more issues than the maintainers can responsibly review in real time. Many reports do not meet the quality bar in this guide or do not follow CONTRIBUTING.md. Some are slung at the repository mindlessly via an agent instead of being reviewed and shaped by the person submitting them. Auto-closing creates a buffer so maintainers can review the tracker on their own schedule and reopen the issues that meet the quality bar.

pi 收到的 issue 数量超出了维护者能够实时负责任地审阅的范围。许多报告达不到本指南中的质量标准，或没有遵循 CONTRIBUTING.md。有些是通过 agent 不加思索地扔到仓库里的，提交者本人并未审阅和打磨。自动关闭机制提供了一个缓冲，使维护者可以按自己的节奏审阅问题追踪器，并重新开启达到质量标准的 issue。

### Why are weekend issues lower priority? 为什么周末的 issue 优先级更低？

We triage the tracker during working hours. That means more issues can accumulate over the weekend. Anything submitted Friday through Sunday may be missed or given lower priority in the Monday review queue. If a problem is urgent, ask on Discord and include the short version, a repro, and the relevant logs.

我们在工作时间内分诊问题追踪器，这意味着周末会积压更多 issue。周五至周日提交的内容可能会被遗漏，或在周一的审阅队列中被降低优先级。如果问题紧急，请在 Discord 上提问，并附上简要说明、复现步骤和相关日志。

### Why do some issues get no reply? 为什么有些 issue 得不到回复？

A reply is maintenance work too. Low-signal issues, unclear reports, duplicates, and issues that do not follow this guide may be closed without discussion. This keeps time available for reproducible bugs, thoughtful requests, and contributors who have done the work to make their report actionable.

回复本身也是维护工作。信息量低的 issue、表述不清的报告、重复内容以及不遵循本指南的 issue，可能会被直接关闭而不予讨论。这样才能把时间留给可复现的缺陷、经过深思熟虑的需求，以及那些认真把报告做到可执行的贡献者。

### Why not let AI triage everything? 为什么不让 AI 来做全部分诊？

AI can help group duplicates, summarize reports, and spot missing information. It is not trusted to make final maintainer decisions. Polished AI-generated issues can still be wrong, misleading, or expensive to investigate. Human review remains the final gate.

AI 可以帮助归并重复内容、总结报告、发现缺失信息，但它不足以被信任去做维护者的最终决策。看似精致的 AI 生成 issue 仍可能是错误的、有误导性的，或调查成本高昂的。人工审阅仍是最后一道关卡。

### Is this hostile to contributors? 这是否对贡献者不友好？

No. It is a guardrail against burnout and tracker spam. Short, concrete, reproducible issues are welcome. Thoughtful contributions are welcome. Automated slop, entitlement, and large volumes of low-effort reports are not.

不是。这是一道防止倦怠和问题追踪器被刷屏的护栏。简短、具体、可复现的 issue 是受欢迎的，用心的贡献也是受欢迎的；而自动化产出的垃圾内容、理所当然的索取心态，以及大量低质量报告则不受欢迎。

## Where can I learn about plans? 在哪里可以了解开发计划？

Earendil uses RFCs to discuss larger changes.  Not all of them are public, but
quite a few are.  They can be found at [rfc.earendil.com](https://rfc.earendil.com/keyword/pi/).

Earendil 使用 RFC 来讨论较大的变更。并非所有 RFC 都公开，但相当一部分是公开的。可以在 [rfc.earendil.com](https://rfc.earendil.com/keyword/pi/) 查阅。
