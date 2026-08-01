# Coding agent suite tests 编码 Agent 套件测试

Use `test/suite/` for the new harness-based test suite around `AgentSession` and `AgentSessionRuntime`.
针对 `AgentSession` 和 `AgentSessionRuntime` 的新版基于测试框架（harness）的测试套件，请使用 `test/suite/` 目录。

Rules:
规则：
- Use `test/suite/harness.ts`
  使用 `test/suite/harness.ts`
- Use the faux provider from `packages/ai/src/providers/faux.ts`
  使用来自 `packages/ai/src/providers/faux.ts` 的伪造（faux）provider
- Do not use real provider APIs, real API keys, network calls, or paid tokens
  不要使用真实的 provider API、真实的 API key、网络调用或付费 token
- Keep these tests CI-safe and deterministic
  保持这些测试对 CI 安全且具有确定性
- Do not use or extend the legacy `test/test-harness.ts` path unless a missing capability forces it
  不要使用或扩展遗留的 `test/test-harness.ts` 路径，除非缺失的能力迫使你这样做

Organization:
组织方式：
- Put broad lifecycle and characterization tests directly under `test/suite/`
  将宽泛的生命周期测试和特征化（characterization）测试直接放在 `test/suite/` 下
- Put issue-specific regression tests under `test/suite/regressions/`
  将针对特定 issue 的回归测试放在 `test/suite/regressions/` 下
- Name regression tests as `<issue-number>-<short-slug>.test.ts`
  回归测试按 `<issue-number>-<short-slug>.test.ts` 命名
- Example: `test/suite/regressions/2023-queued-slash-command-followup.test.ts`
  示例：`test/suite/regressions/2023-queued-slash-command-followup.test.ts`
