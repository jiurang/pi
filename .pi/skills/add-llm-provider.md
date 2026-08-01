---
name: add-llm-provider
description: Checklist for adding a new LLM provider to packages/ai. Covers core types, provider implementation, lazy registration, model generation, the full test matrix, coding-agent wiring, and docs.
---

# Adding a New LLM Provider (packages/ai) 新增一个 LLM Provider（packages/ai）

A new provider touches multiple files. Work through these steps in order.
新增一个 provider 会涉及多个文件。请按顺序完成以下步骤。

## 1. Core Types 核心类型 (`packages/ai/src/types.ts`)

- Add API identifier to `Api` type union (e.g. `"bedrock-converse-stream"`).
  向 `Api` 联合类型中添加 API 标识符（例如 `"bedrock-converse-stream"`）。
- Create options interface extending `StreamOptions`.
  创建一个继承自 `StreamOptions` 的选项接口。
- Add mapping to `ApiOptionsMap`.
  在 `ApiOptionsMap` 中添加对应映射。
- Add provider name to `KnownProvider` type union.
  将 provider 名称添加到 `KnownProvider` 联合类型中。

## 2. Provider Implementation Provider 实现 (`packages/ai/src/providers/`)

Create a provider file exporting:
创建一个 provider 文件，导出以下内容：

- `stream<Provider>()` returning `AssistantMessageEventStream`.
  `stream<Provider>()`，返回 `AssistantMessageEventStream`。
- `streamSimple<Provider>()` for `SimpleStreamOptions` mapping.
  `streamSimple<Provider>()`，用于 `SimpleStreamOptions` 的映射。
- Provider-specific options interface.
  该 provider 专属的选项接口。
- Message/tool conversion functions.
  消息/工具的转换函数。
- Response parsing that emits standardized events (`text`, `tool_call`, `thinking`, `usage`, `stop`).
  响应解析逻辑，用于发出标准化事件（`text`、`tool_call`、`thinking`、`usage`、`stop`）。

## 3. Provider Exports and Lazy Registration Provider 导出与惰性注册

- Add a package subpath export in `packages/ai/package.json` pointing at `./dist/providers/<provider>.js`.
  在 `packages/ai/package.json` 中添加指向 `./dist/providers/<provider>.js` 的子路径导出。
- Add `export type` re-exports in `packages/ai/src/index.ts` for provider option types that should remain available from the root entry.
  在 `packages/ai/src/index.ts` 中通过 `export type` 重新导出那些需要从根入口继续可用的 provider 选项类型。
- Register the provider in `packages/ai/src/providers/register-builtins.ts` via lazy loader wrappers; do not statically import provider implementation modules there.
  在 `packages/ai/src/providers/register-builtins.ts` 中通过惰性加载包装器注册该 provider；不要在该文件中静态导入 provider 的实现模块。
- Add credential detection in `packages/ai/src/env-api-keys.ts`.
  在 `packages/ai/src/env-api-keys.ts` 中添加凭据检测逻辑。

## 4. Model Generation 模型生成 (`packages/ai/scripts/generate-models.ts`)

- Add logic to fetch/parse models from the provider source.
  添加从该 provider 源获取/解析模型列表的逻辑。
- Map to the standardized `Model` interface.
  将其映射到标准化的 `Model` 接口。

## 5. Tests 测试 (`packages/ai/test/`)

- Always add the provider to `stream.test.ts` with at least one representative model, even if it reuses an existing API impl such as `openai-completions`.
  务必在 `stream.test.ts` 中加入该 provider 及至少一个有代表性的模型，即使它复用了现有的 API 实现（如 `openai-completions`）也不例外。
- Add the provider to the broader matrix where applicable: `tokens.test.ts`, `abort.test.ts`, `empty.test.ts`, `context-overflow.test.ts`, `unicode-surrogate.test.ts`, `tool-call-without-result.test.ts`, `image-tool-result.test.ts`, `total-tokens.test.ts`, `cross-provider-handoff.test.ts`.
  在适用的情况下，将该 provider 加入更大范围的测试矩阵：`tokens.test.ts`、`abort.test.ts`、`empty.test.ts`、`context-overflow.test.ts`、`unicode-surrogate.test.ts`、`tool-call-without-result.test.ts`、`image-tool-result.test.ts`、`total-tokens.test.ts`、`cross-provider-handoff.test.ts`。
- For `cross-provider-handoff.test.ts`, add at least one provider/model pair. If the provider exposes multiple model families (e.g. GPT and Claude), add at least one pair per family.
  对于 `cross-provider-handoff.test.ts`，至少添加一组 provider/模型组合。如果该 provider 提供多个模型家族（例如 GPT 和 Claude），则每个家族至少添加一组。
- For non-standard auth, create a utility (e.g. `bedrock-utils.ts`) with credential detection.
  对于非标准的认证方式，创建一个包含凭据检测逻辑的工具文件（例如 `bedrock-utils.ts`）。

## 6. Coding Agent (`packages/coding-agent/`)

- `src/core/model-resolver.ts`: add default model ID to `defaultModelPerProvider`.
  `src/core/model-resolver.ts`：将默认模型 ID 添加到 `defaultModelPerProvider`。
- `src/core/provider-display-names.ts`: add API-key login display name so `/login` and related UI show the provider for built-in API-key auth.
  `src/core/provider-display-names.ts`：添加 API key 登录的展示名称，使 `/login` 及相关 UI 能为内置的 API key 认证方式显示该 provider。
- `src/cli/args.ts`: add env var documentation.
  `src/cli/args.ts`：补充环境变量的说明文档。
- `README.md`: add provider setup instructions.
  `README.md`：添加该 provider 的配置说明。
- `docs/providers.md`: add setup instructions, env var, and `auth.json` key.
  `docs/providers.md`：添加配置说明、环境变量以及 `auth.json` 中的键名。

## 7. Documentation 文档

- `packages/ai/README.md`: add to providers table, document options/auth, add env vars.
  `packages/ai/README.md`：加入 provider 列表表格，补充选项/认证方式说明，添加环境变量。
- `packages/ai/CHANGELOG.md`: add entry under `## [Unreleased]`.
  `packages/ai/CHANGELOG.md`：在 `## [Unreleased]` 下添加条目。
