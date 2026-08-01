---
description: Analyze GitHub issues (bugs or feature requests)
argument-hint: "<issue>"
---
Analyze GitHub issue(s): $ARGUMENTS
分析 GitHub issue：$ARGUMENTS

For each issue:
对每个 issue：

1. If running under CI (`CI=true`), do not add the `inprogress` label and do not assign the issue. Otherwise, add the `inprogress` label to the issue via GitHub CLI and assign the issue to the local `gh` user before analysis starts. If either action fails, report that explicitly and continue.
   如果运行在 CI 环境下（`CI=true`），不要添加 `inprogress` 标签，也不要指派该 issue。否则，在开始分析之前，通过 GitHub CLI 为该 issue 添加 `inprogress` 标签，并将其指派给本地 `gh` 用户。若其中任一操作失败，明确报告出来并继续执行。
2. Read the issue in full, including all comments and linked issues/PRs. Use fields supported by GitHub CLI, for example:
   完整阅读该 issue，包括所有评论以及关联的 issue/PR。使用 GitHub CLI 支持的字段，例如：
   ```sh
   gh issue view <issue> --json title,body,comments,labels,assignees,state,url,author,createdAt,updatedAt,closedByPullRequestsReferences
   ```
3. Do not trust analysis written in the issue. Independently verify behavior and derive your own analysis from the code and execution path.
   不要轻信 issue 中已有的分析。独立验证实际行为，并从代码和执行路径出发得出你自己的结论。

4. **For bugs**:
   **对于缺陷（bug）**：
   - Ignore any root cause analysis in the issue (likely wrong)
     忽略 issue 中的任何根因分析（很可能是错的）
   - Read all related code files in full (no truncation)
     完整阅读所有相关代码文件（不要截断）
   - Trace the code path and identify the actual root cause
     追踪代码执行路径，定位真正的根本原因
   - Propose a fix
     提出修复方案

5. **For feature requests**:
   **对于需求（feature request）**：
   - Do not trust implementation proposals in the issue without verification
     未经验证，不要轻信 issue 中给出的实现方案
   - Read all related code files in full (no truncation)
     完整阅读所有相关代码文件（不要截断）
   - Propose the most concise implementation approach
     提出最简洁的实现方案
   - List affected files and changes needed
     列出受影响的文件以及需要做的改动

Do NOT implement unless explicitly asked. Analyze and propose only.
除非被明确要求，否则不要动手实现。只做分析和方案建议。
