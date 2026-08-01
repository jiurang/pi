---
description: Review PRs from URLs with structured issue and code analysis
argument-hint: "<PR-URL>"
---
You are given one or more GitHub PR URLs: $@
你会收到一个或多个 GitHub PR 的 URL：$@

For each PR URL, do the following in order:
对每个 PR URL，按顺序执行以下步骤：
1. Add the `inprogress` label to the PR via GitHub CLI before analysis starts. If adding the label fails, report that explicitly and continue.
   在开始分析之前，通过 GitHub CLI 为该 PR 添加 `inprogress` 标签。若添加标签失败，明确报告出来并继续执行。
2. Read the PR page in full. Include description, all comments, all commits, and all changed files.
   完整阅读该 PR 页面，包括描述、所有评论、所有提交以及所有改动的文件。
3. Identify any linked issues referenced in the PR body, comments, commit messages, or cross links. Read each issue in full, including all comments.
   找出 PR 正文、评论、提交信息或交叉引用中提到的所有关联 issue。完整阅读每个 issue，包括其所有评论。
4. Analyze the PR diff without checking out or switching to the PR branch. Use `gh pr diff`, `gh pr view`, `gh api`, and local main-branch files; if PR file contents are needed, use fetched refs with `git show <ref>:<path>` or temporary files. Read all relevant code files in full with no truncation and compare against the diff. Do not fetch PR file blobs unless a file is missing on main or the diff context is insufficient. Include related code paths that are not in the diff but are required to validate behavior.
   在不检出、也不切换到 PR 分支的前提下分析 PR 的 diff。使用 `gh pr diff`、`gh pr view`、`gh api` 以及本地 main 分支上的文件；如果需要 PR 中的文件内容，可通过已抓取的 ref 使用 `git show <ref>:<path>` 或临时文件获取。完整阅读所有相关代码文件（不要截断），并与 diff 对照。除非某个文件在 main 上不存在，或 diff 的上下文不足，否则不要去拉取 PR 的文件 blob。同时纳入那些不在 diff 中、但验证行为所必需的相关代码路径。
5. Do not check for a changelog entry. Per CONTRIBUTING.md, contributor PRs must not edit `CHANGELOG.md` — the maintainer adds the entry when merging.
   不要检查是否有 changelog 条目。按照 CONTRIBUTING.md 的规定，贡献者的 PR 不得修改 `CHANGELOG.md`——条目由维护者在合并时添加。
6. Check if packages/coding-agent/README.md, packages/coding-agent/docs/*.md, packages/coding-agent/examples/**/*.md require modification. This is usually the case when existing features have been changed, or new features have been added.
   检查 packages/coding-agent/README.md、packages/coding-agent/docs/*.md、packages/coding-agent/examples/**/*.md 是否需要相应修改。当现有功能发生变更或新增了功能时，通常都需要。
7. Provide a structured review with these sections:
   给出一份包含以下小节的结构化评审：
   - What it does: one short paragraph describing the change and its intent.
     What it does（做了什么）：用一小段话描述该改动及其意图。
   - Good: solid choices or improvements.
     Good（好的部分）：靠谱的设计选择或改进之处。
   - Bad: concrete issues, regressions, missing tests, or risks.
     Bad（不好的部分）：具体的问题、回归、缺失的测试或风险。
   - Ugly: subtle or high impact problems.
     Ugly（糟糕的部分）：隐蔽或影响重大的问题。
   - Tests: what is covered, what is missing, and whether existing tests are adequate.
     Tests（测试）：覆盖了什么、缺了什么，以及现有测试是否充分。
   - Open questions for you: only things blocking a merge decision that need the user's input. Omit the section entirely if there are none.
     Open questions for you（需要你确认的问题）：仅列出阻碍合并决策、需要用户输入的事项。若没有则整个小节省略。

Output format per PR:
每个 PR 的输出格式：
PR: <url>
What it does:
- ...
Good:
- ...
Bad:
- ...
Ugly:
- ...
Tests:
- ...
Open questions for you:
- ...

If no issues are found, say so under Bad and Ugly.
如果没有发现任何问题，就在 Bad 和 Ugly 小节中明确说明。
