---
description: Audit changelog entries before release
---
Audit changelog entries for all commits since the last release.
审计自上次发布以来所有提交的 changelog 条目。

## Process 流程

1. **Find the last release tag:**
   **找到最近一次发布的 tag：**
   ```bash
   git tag --sort=-version:refname | head -1
   ```

2. **List all commits since that tag:**
   **列出该 tag 之后的所有提交：**
   ```bash
   git log <tag>..HEAD --oneline
   ```

3. **Read each package's [Unreleased] section:**
   **阅读每个包的 [Unreleased] 小节：**
   - packages/ai/CHANGELOG.md
   - packages/tui/CHANGELOG.md
   - packages/coding-agent/CHANGELOG.md

4. **For each commit, check:**
   **对每个提交，检查：**
   - Skip: changelog updates, doc-only changes, release housekeeping
     跳过：changelog 更新、纯文档改动、发布相关的杂务性提交
   - Skip: changes to generated model catalogs (for example `packages/ai/src/models.generated.ts`) unless accompanied by an intentional product-facing change in non-generated source/docs.
     跳过：对生成的模型目录（例如 `packages/ai/src/models.generated.ts`）的改动，除非同时伴随着非生成源码/文档中有意为之的、面向产品的改动。
   - Determine which package(s) the commit affects (use `git show <hash> --stat`)
     判断该提交影响了哪些包（使用 `git show <hash> --stat`）
   - Verify a changelog entry exists in the affected package(s)
     确认受影响的包中存在对应的 changelog 条目
   - For external contributions (PRs), verify format: `Description ([#N](url) by [@user](url))`
     对于外部贡献（PR），确认格式为：`Description ([#N](url) by [@user](url))`

5. **Cross-package duplication rule:**
   **跨包重复记录规则：**
   Changes in `ai`, `agent` or `tui` that affect end users should be duplicated to `coding-agent` changelog, since coding-agent is the user-facing package that depends on them.
   `ai`、`agent` 或 `tui` 中影响最终用户的改动，应同时记录到 `coding-agent` 的 changelog 中，因为 coding-agent 是依赖它们的、直接面向用户的包。

6. **Add New Features section after changelog fixes:**
   **修正 changelog 后添加 New Features 小节：**
   - Insert a `### New Features` section at the start of `## [Unreleased]` in `packages/coding-agent/CHANGELOG.md`.
     在 `packages/coding-agent/CHANGELOG.md` 的 `## [Unreleased]` 开头插入一个 `### New Features` 小节。
   - Propose the top new features to the user for confirmation before writing them.
     在写入之前，先向用户提出最重要的几项新特性并请其确认。
   - Link to relevant docs and sections whenever possible.
     尽可能链接到相关的文档和章节。

7. **Report:**
   **汇报：**
   - List commits with missing entries
     列出缺少 changelog 条目的提交
   - List entries that need cross-package duplication
     列出需要跨包重复记录的条目
   - Add any missing entries directly
     直接补上所有缺失的条目

## Changelog Format Reference changelog 格式参考

Sections (in order):
小节（按顺序）：
- `### Breaking Changes` - API changes requiring migration
  需要迁移的 API 变更
- `### Added` - New features
  新增特性
- `### Changed` - Changes to existing functionality
  对现有功能的变更
- `### Fixed` - Bug fixes
  缺陷修复
- `### Removed` - Removed features
  移除的特性

Attribution:
署名方式：
- Internal: `Fixed foo ([#123](https://github.com/earendil-works/pi-mono/issues/123))`
  内部贡献：`Fixed foo ([#123](https://github.com/earendil-works/pi-mono/issues/123))`
- External: `Added bar ([#456](https://github.com/earendil-works/pi-mono/pull/456) by [@user](https://github.com/user))`
  外部贡献：`Added bar ([#456](https://github.com/earendil-works/pi-mono/pull/456) by [@user](https://github.com/user))`
