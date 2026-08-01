# Development Rules 开发规范

## Conversational Style 对话风格

- Keep answers short and concise
  回答保持简短精炼。
- No emojis in commits, issues, PR comments, or code
  提交信息、issue、PR 评论和代码中一律不使用 emoji。
- No fluff or cheerful filler text (e.g., "Thanks @user" not "Thanks so much @user!")
  不要有客套话或欢快的填充文字（例如写 "Thanks @user"，而不是 "Thanks so much @user!"）。
- Technical prose only, be direct
  只使用技术性表述，直截了当。
- When the user asks a question, answer it first before making edits or running implementation commands.
  当用户提出问题时，先回答问题，再进行编辑或执行实现类命令。
- When responding to user feedback or an analysis, explicitly say whether you agree or disagree before saying what you changed.
  回应用户反馈或分析时，先明确表态同意还是不同意，然后再说明你改了什么。

## Code Quality 代码质量

- Read files in full before wide-ranging changes, before editing files you have not fully inspected, and when asked to investigate or audit. Do not rely on search snippets for broad changes.
  在进行大范围改动前、在编辑尚未完整检查过的文件前，以及被要求调查或审计时，都要完整读取文件。不要依赖搜索片段来做大范围改动。
- No `any` unless absolutely necessary.
  除非绝对必要，否则不要使用 `any`。
- Inline single-line helpers that have only one call site.
  只有一个调用点的单行辅助函数应内联展开。
- Check node_modules for external API types; don't guess.
  外部 API 的类型请到 node_modules 中查证，不要靠猜。
- **No inline imports** (`await import()`, `import("pkg").Type`, dynamic type imports). Top-level imports only.
  **禁止内联导入**（`await import()`、`import("pkg").Type`、动态类型导入）。只使用顶层导入。
- Never remove or downgrade code to fix type errors from outdated deps; upgrade the dep instead.
  切勿为了修复过时依赖引发的类型错误而删除或降级代码；应升级该依赖。
- Use only erasable TypeScript syntax (Node strip-only mode) in code checked by the root config (`packages/*/src`, `packages/*/test`, `packages/coding-agent/examples`): no parameter properties, `enum`, `namespace`/`module`, `import =`, `export =`, or other constructs needing JS emit. Use explicit fields with constructor assignments.
  在受根配置检查的代码中（`packages/*/src`、`packages/*/test`、`packages/coding-agent/examples`）只使用可擦除的 TypeScript 语法（Node strip-only 模式）：不使用参数属性、`enum`、`namespace`/`module`、`import =`、`export =` 或其他需要 JS 代码生成的语法结构。请使用显式字段加构造函数赋值。
- Always ask before removing functionality or code that appears intentional.
  删除看起来是有意为之的功能或代码前，务必先询问。
- Do not preserve backward compatibility unless the user asks for it.
  除非用户要求，否则不必保持向后兼容。
- Never hardcode key checks (e.g. `matchesKey(keyData, "ctrl+x")`). Add defaults to `DEFAULT_EDITOR_KEYBINDINGS` or `DEFAULT_APP_KEYBINDINGS` so they stay configurable.
  切勿硬编码按键判断（例如 `matchesKey(keyData, "ctrl+x")`）。应将默认值加入 `DEFAULT_EDITOR_KEYBINDINGS` 或 `DEFAULT_APP_KEYBINDINGS`，以保持可配置性。
- Never modify `packages/ai/src/models.generated.ts` directly; update `packages/ai/scripts/generate-models.ts` instead, then regenerate. Including the resulting `models.generated.ts` diff is always OK, even if regeneration includes unrelated upstream model metadata changes.
  切勿直接修改 `packages/ai/src/models.generated.ts`；应改为更新 `packages/ai/scripts/generate-models.ts` 后重新生成。提交由此产生的 `models.generated.ts` 差异总是可以的，即使重新生成时包含了无关的上游模型元数据变更。

## Commands 命令

- After code changes (not docs): `npm run check` (full output, no tail). Fix all errors, warnings, and infos before committing. Does not run tests.
  代码改动后（文档改动除外）执行：`npm run check`（查看完整输出，不要 tail 截断）。提交前修复所有 error、warning 和 info。该命令不运行测试。
- Never run `npm run build` or `npm test` unless requested by the user.
  除非用户要求，否则切勿运行 `npm run build` 或 `npm test`。
- Never run the full vitest suite directly: it includes e2e tests that activate when endpoint/auth env vars are present. For all non-e2e tests, run `./test.sh` from the repo root. Otherwise run specific tests from the package root: `node ../../node_modules/vitest/dist/cli.js --run test/specific.test.ts`.
  切勿直接运行完整的 vitest 测试套件：其中包含在存在 endpoint/auth 环境变量时会激活的 e2e 测试。所有非 e2e 测试请在仓库根目录运行 `./test.sh`。否则请在包根目录运行特定测试：`node ../../node_modules/vitest/dist/cli.js --run test/specific.test.ts`。
- If you create or modify a test file, run it and iterate on test or implementation until it passes.
  如果你创建或修改了测试文件，请运行它，并反复调整测试或实现直至通过。
- For `packages/coding-agent/test/suite/`, use `test/suite/harness.ts` + the faux provider. No real provider APIs, keys, or paid tokens.
  对于 `packages/coding-agent/test/suite/`，请使用 `test/suite/harness.ts` 加 faux provider。不要使用真实的 provider API、密钥或付费 token。
- Put issue-specific regressions under `packages/coding-agent/test/suite/regressions/` named `<issue-number>-<short-slug>.test.ts`.
  针对特定 issue 的回归测试请放在 `packages/coding-agent/test/suite/regressions/` 下，命名为 `<issue-number>-<short-slug>.test.ts`。
- For ad-hoc scripts, `write` them to a temp file (e.g. `/tmp`), run, edit if needed, remove when done. Don't embed multi-line scripts in `bash` commands.
  临时脚本请用 `write` 写入临时文件（例如 `/tmp`），运行、按需修改，完成后删除。不要在 `bash` 命令中嵌入多行脚本。
- Never commit unless the user asks.
  除非用户要求，否则切勿提交。

## Dependency and Install Security 依赖与安装安全

- Treat npm dep and lockfile changes as reviewed code. Direct external deps stay pinned to exact versions.
  将 npm 依赖和 lockfile 的变更视为需要审查的代码。直接外部依赖必须锁定到精确版本。
- Hydrate/update locally with `npm install --ignore-scripts`; clean/CI-style with `npm ci --ignore-scripts`. Don't run lifecycle scripts unless the user asks.
  本地安装/更新使用 `npm install --ignore-scripts`；干净安装/CI 风格使用 `npm ci --ignore-scripts`。除非用户要求，否则不要运行生命周期脚本。
- If dep metadata changes, refresh `package-lock.json` with `npm install --package-lock-only --ignore-scripts`.
  如果依赖元数据发生变化，请用 `npm install --package-lock-only --ignore-scripts` 刷新 `package-lock.json`。
- If `packages/coding-agent/npm-shrinkwrap.json` needs regen, run `node scripts/generate-coding-agent-shrinkwrap.mjs` (verify with `--check` or `npm run check`). New deps with lifecycle scripts require review and an explicit allowlist entry in that script; never add one silently.
  如果 `packages/coding-agent/npm-shrinkwrap.json` 需要重新生成，请运行 `node scripts/generate-coding-agent-shrinkwrap.mjs`（用 `--check` 或 `npm run check` 验证）。带生命周期脚本的新依赖需要经过审查并在该脚本中显式加入白名单条目；切勿悄悄添加。
- Pre-commit blocks lockfile commits unless `PI_ALLOW_LOCKFILE_CHANGE=1`. Don't bypass unless the user wants the lockfile change committed.
  除非设置 `PI_ALLOW_LOCKFILE_CHANGE=1`，否则 pre-commit 会阻止提交 lockfile。除非用户希望提交 lockfile 变更，否则不要绕过该限制。

## Git

Multiple pi sessions may be running in this cwd at the same time, each modifying different files. Git operations that touch unstaged, staged, or untracked files outside your own changes will stomp on other sessions' work. Follow these rules:

同一工作目录下可能同时运行多个 pi 会话，各自修改不同的文件。凡是触及你自身改动之外的未暂存、已暂存或未跟踪文件的 Git 操作，都会破坏其他会话的工作成果。请遵守以下规则：

Committing:

提交：

- Only commit files YOU changed in THIS session.
  只提交你在本次会话中修改过的文件。
- Stage explicit paths (`git add <path1> <path2>`); never `git add -A` / `git add .`.
  暂存时显式指定路径（`git add <path1> <path2>`）；切勿使用 `git add -A` 或 `git add .`。
- Before committing, run `git status` and verify you are only staging your files.
  提交前运行 `git status`，确认只暂存了属于你的文件。
- `packages/ai/src/models.generated.ts` may always be included alongside your files.
  `packages/ai/src/models.generated.ts` 总是可以与你的文件一起提交。
- Message format: `{feat,fix,docs}[(ai,tui,agent,coding-agent)]: <commit message> (optionally multiple lines)`. Message is informative and concise.
  提交信息格式：`{feat,fix,docs}[(ai,tui,agent,coding-agent)]: <commit message> (optionally multiple lines)`。信息应有实质内容且简洁。

Never run (destroys other agents' work or bypasses checks):

切勿运行以下命令（会破坏其他 agent 的工作或绕过检查）：

- `git reset --hard`, `git checkout .`, `git clean -fd`, `git stash`, `git add -A`, `git add .`, `git commit --no-verify`.
  `git reset --hard`、`git checkout .`、`git clean -fd`、`git stash`、`git add -A`、`git add .`、`git commit --no-verify`。

If rebase conflicts occur:

如果发生 rebase 冲突：

- Resolve conflicts only in files you modified.
  只解决你修改过的文件中的冲突。
- If a conflict is in a file you did not modify, abort and ask the user.
  如果冲突出现在你未修改的文件中，请中止操作并询问用户。
- Never force push.
  切勿强制推送。

## Issues and PRs Issue 与 PR

See `CONTRIBUTING.md` for the contributor gate (auto-close workflows, `lgtm`/`lgtmi`, quality bar).

关于贡献者准入机制（自动关闭工作流、`lgtm`/`lgtmi`、质量标准），请参阅 `CONTRIBUTING.md`。

When reviewing PRs:

审查 PR 时：

- Do not run `gh pr checkout`, `git switch`, or otherwise move the worktree to the PR branch unless the user explicitly asks.
  除非用户明确要求，否则不要运行 `gh pr checkout`、`git switch` 或以其他方式将工作区切换到 PR 分支。
- Use `gh pr view`, `gh pr diff`, `gh api`, and local `git show`/`git diff` against fetched refs to inspect PR metadata, commits, and patches without changing branches.
  使用 `gh pr view`、`gh pr diff`、`gh api` 以及针对已 fetch 引用的本地 `git show`/`git diff` 来查看 PR 的元数据、提交和补丁，无需切换分支。
- If you need PR file contents, fetch/read them into temporary files or use `git show <ref>:<path>` without switching branches.
  如果需要 PR 中的文件内容，请将其 fetch/读取到临时文件，或使用 `git show <ref>:<path>`，无需切换分支。

When creating issues:

创建 issue 时：

- Add `pkg:*` labels for affected packages (`pkg:agent`, `pkg:ai`, `pkg:coding-agent`, `pkg:tui`); use all that apply.
  为受影响的包添加 `pkg:*` 标签（`pkg:agent`、`pkg:ai`、`pkg:coding-agent`、`pkg:tui`）；所有适用的都要加上。

When posting issue/PR comments:

发表 issue/PR 评论时：

- Write the comment to a temp file and post with `gh issue/pr comment --body-file` (never multi-line markdown via `--body`).
  将评论写入临时文件，并用 `gh issue/pr comment --body-file` 发布（切勿通过 `--body` 传递多行 markdown）。
- Keep comments concise, technical, in the user's tone.
  评论应简洁、技术化，并符合用户的语气。
- End every AI-posted comment with the AI-generated disclaimer line specified by the originating prompt (e.g. `This comment is AI-generated by `/wr``).
  每条由 AI 发布的评论都要以发起提示词所指定的 AI 生成声明行结尾（例如 `This comment is AI-generated by `/wr``）。

When closing issues via commit:

通过提交关闭 issue 时：

- Include `fixes #<number>` or `closes #<number>` in the message so merging auto-closes the issue. For multiple issues, repeat the keyword per issue (`closes #1, closes #2`); a shared keyword (`closes #1, #2`) only closes the first.
  在提交信息中包含 `fixes #<number>` 或 `closes #<number>`，这样合并时会自动关闭该 issue。涉及多个 issue 时，每个 issue 都要重复关键字（`closes #1, closes #2`）；共用一个关键字（`closes #1, #2`）只会关闭第一个。

## Testing pi Interactive Mode with tmux 使用 tmux 测试 pi 交互模式

Run the TUI in a controlled terminal (from the repo root):

在受控终端中运行 TUI（从仓库根目录执行）：

```bash
tmux new-session -d -s pi-test -x 80 -y 24
tmux send-keys -t pi-test "./pi-test.sh" Enter
sleep 3 && tmux capture-pane -t pi-test -p     # capture after startup
tmux send-keys -t pi-test "your prompt here" Enter
tmux send-keys -t pi-test Escape               # special keys (also C-o for ctrl+o, etc.)
tmux kill-session -t pi-test
```

## Changelog 变更日志

Location: `packages/*/CHANGELOG.md` (one per package).

位置：`packages/*/CHANGELOG.md`（每个包一个）。

Sections under `## [Unreleased]`: `### Breaking Changes` (API changes requiring migration), `### Added`, `### Changed`, `### Fixed`, `### Removed`.

`## [Unreleased]` 下的分节包括：`### Breaking Changes`（需要迁移的 API 变更）、`### Added`、`### Changed`、`### Fixed`、`### Removed`。

Rules:

规则：

- All new entries go under `## [Unreleased]`. Read the full section first and append to existing subsections; never duplicate them.
  所有新条目都放在 `## [Unreleased]` 下。先完整阅读该章节，再追加到已有子分节中；切勿重复创建子分节。
- Released version sections (e.g. `## [0.12.2]`) are immutable; never modify them.
  已发布版本的章节（例如 `## [0.12.2]`）不可变更；切勿修改。

Attribution:

署名：

- Internal (from issues): `Fixed foo bar ([#123](https://github.com/earendil-works/pi-mono/issues/123))`
  内部（源自 issue）：`Fixed foo bar ([#123](https://github.com/earendil-works/pi-mono/issues/123))`
- External contributions: `Added feature X ([#456](https://github.com/earendil-works/pi-mono/pull/456) by [@username](https://github.com/username))`
  外部贡献：`Added feature X ([#456](https://github.com/earendil-works/pi-mono/pull/456) by [@username](https://github.com/username))`

## Releasing 发布

**Lockstep versioning**: all packages share one version; every release updates all together. `patch` = fixes + additions, `minor` = breaking changes. No major releases.

**版本同步（Lockstep versioning）**：所有包共用一个版本号；每次发布都一起更新。`patch` = 修复加新增，`minor` = 破坏性变更。不做 major 发布。

1. **Update CHANGELOGs**: ask the user whether they ran the `/cl` prompt on the latest commit on `main`. If not, they must run `/cl` first to audit and update each package's `[Unreleased]` section before releasing.

   **更新 CHANGELOG**：询问用户是否已针对 `main` 上的最新提交运行过 `/cl` 提示词。如果没有，必须先运行 `/cl` 来审查并更新每个包的 `[Unreleased]` 章节，然后才能发布。

2. **Local smoke test**: build an unpublished release and smoke test from outside the repo (so it can't resolve workspace files):

   **本地冒烟测试**：构建一个未发布的版本，并在仓库之外进行冒烟测试（使其无法解析工作区文件）：
   ```bash
   npm run release:local -- --out /tmp/pi-local-release --force
   cd /tmp

   # Node package install smoke tests
   /tmp/pi-local-release/node/pi --help
   /tmp/pi-local-release/node/pi --version
   /tmp/pi-local-release/node/pi --list-models
   /tmp/pi-local-release/node/pi -p "Say exactly: ok"
   /tmp/pi-local-release/node/pi

   # Bun binary smoke tests
   /tmp/pi-local-release/bun/pi --help
   /tmp/pi-local-release/bun/pi --version
   /tmp/pi-local-release/bun/pi --list-models
   /tmp/pi-local-release/bun/pi -p "Say exactly: ok"
   /tmp/pi-local-release/bun/pi
   ```
   Verify both Node and Bun startup, model/account listing, interactive startup, and at least one real prompt with the intended default provider. The bare commands `/tmp/pi-local-release/node/pi` and `/tmp/pi-local-release/bun/pi` start interactive mode; run each in tmux, submit a prompt, and wait for the model reply before considering the interactive smoke test passed. Failures are release blockers unless the user explicitly accepts the risk.

   需要验证 Node 和 Bun 两种方式的启动、模型/账号列表、交互模式启动，以及至少一次使用目标默认 provider 的真实提示词请求。裸命令 `/tmp/pi-local-release/node/pi` 和 `/tmp/pi-local-release/bun/pi` 会启动交互模式；请分别在 tmux 中运行、提交一个提示词并等待模型回复，然后才能认为交互冒烟测试通过。除非用户明确接受风险，否则任何失败都是发布阻断项。

3. **Run the release script**:

   **运行发布脚本**：
   ```bash
   PI_ALLOW_LOCKFILE_CHANGE=1 npm_config_min_release_age=0 npm run release:patch    # fixes + additions
   PI_ALLOW_LOCKFILE_CHANGE=1 npm_config_min_release_age=0 npm run release:minor    # breaking changes
   ```
   Use `npm_config_min_release_age=0` only for the release command. The repo's normal npm age gate can otherwise block the release lockfile refresh when the current workspace package version was published recently. Review any lockfile or shrinkwrap diffs the release creates before push.

   仅在发布命令中使用 `npm_config_min_release_age=0`。否则，当当前工作区包版本刚发布不久时，仓库常规的 npm 版本时效门槛会阻止发布过程中的 lockfile 刷新。推送前请审查发布过程产生的所有 lockfile 或 shrinkwrap 差异。

   The release script bumps all package versions, updates changelogs, regenerates release artifacts, runs `npm run check`, commits `Release vX.Y.Z`, tags `vX.Y.Z`, adds fresh `## [Unreleased]` changelog sections, commits `Add [Unreleased] section for next cycle`, then pushes `main` and the tag. Do not rerun the release script after a tag was pushed.

   发布脚本会提升所有包的版本号、更新变更日志、重新生成发布产物、运行 `npm run check`、提交 `Release vX.Y.Z`、打上 `vX.Y.Z` 标签、添加新的 `## [Unreleased]` 变更日志章节、提交 `Add [Unreleased] section for next cycle`，然后推送 `main` 和该标签。标签推送之后不要重复运行发布脚本。

4. **CI publishes npm packages**: pushing the `vX.Y.Z` tag triggers `.github/workflows/build-binaries.yml`. The `publish-npm` job uses npm trusted publishing through GitHub Actions OIDC with environment `npm-publish`; no local `npm publish`, `npm whoami`, OTP, or WebAuthn flow is required.

   **CI 发布 npm 包**：推送 `vX.Y.Z` 标签会触发 `.github/workflows/build-binaries.yml`。`publish-npm` job 通过 GitHub Actions OIDC 使用 npm 可信发布（trusted publishing），环境为 `npm-publish`；无需本地执行 `npm publish`、`npm whoami`、OTP 或 WebAuthn 流程。

5. **If CI publish fails**: inspect the failed `publish-npm` job. The publish helper is idempotent and skips package versions already present on npm, so rerun the tag workflow after fixing CI or transient npm issues. Do not rerun `npm run release:patch` or `npm run release:minor` for the same version.

   **如果 CI 发布失败**：检查失败的 `publish-npm` job。发布辅助脚本是幂等的，会跳过 npm 上已存在的包版本，因此在修复 CI 问题或临时性 npm 故障后重新运行该标签的工作流即可。不要为同一版本重复运行 `npm run release:patch` 或 `npm run release:minor`。

## User Override 用户覆盖规则

If the user's instructions conflict with any rule in this document, ask for explicit confirmation before overriding. Only then execute their instructions.

如果用户的指示与本文档中的任何规则冲突，请在覆盖规则前请求明确确认。确认后方可执行用户的指示。
