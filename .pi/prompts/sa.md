---
description: Update a GitHub security advisory for publication
argument-hint: "<advisory-url-or-draft-path>"
---
Update a GitHub security advisory for publication: $ARGUMENTS
更新一份 GitHub 安全公告（security advisory）以供发布：$ARGUMENTS

Use `gh` for all GitHub operations. Do not publish the advisory, change its state, or request a CVE unless the user explicitly agrees or the draft markdown explicitly says `request_cve: true`.
所有 GitHub 操作都使用 `gh`。除非用户明确同意，或草稿 markdown 中明确写明 `request_cve: true`，否则不要发布公告、不要改变其状态、也不要申请 CVE。

GitHub does not expose repository security advisory comments/discussion through the documented REST OpenAPI schema or public GraphQL schema. A 404 from guessed API endpoints such as `api.github.com/repos/.../security-advisories/<GHSA>/comments`, `.../timeline`, or `.../events` is expected and is not, by itself, an auth failure. Do not use a browser session, browser cookies, or cookie extraction to fetch advisory comments. Instead, clearly tell the user that advisory comments were not included and that they can paste any relevant comments if they want them considered.
GitHub 并未通过其已文档化的 REST OpenAPI schema 或公开的 GraphQL schema 暴露仓库安全公告的评论/讨论内容。对 `api.github.com/repos/.../security-advisories/<GHSA>/comments`、`.../timeline`、`.../events` 这类猜测出来的 API 端点返回 404 属于预期行为，其本身并不代表认证失败。不要使用浏览器会话、浏览器 cookie 或 cookie 提取手段去获取公告评论。相反，要明确告知用户公告评论未被纳入，并说明如果希望这些评论被考虑，可以自行粘贴过来。

## Input handling 输入处理

- If `$ARGUMENTS` is a GitHub security advisory URL, start the investigation and drafting workflow.
  如果 `$ARGUMENTS` 是一个 GitHub 安全公告 URL，则启动调查与起草流程。
- If `$ARGUMENTS` is a path to an existing markdown draft, read it and apply that draft to the advisory.
  如果 `$ARGUMENTS` 是一个已有 markdown 草稿的路径，则读取该文件并将草稿内容应用到公告上。
- In a follow-up message after this prompt, if the user says "update", "apply", "looks good", or similar, treat it as approval to apply the previously written temp markdown draft. Re-read the file from disk before updating GitHub.
  在此提示之后的后续消息中，如果用户说 "update"、"apply"、"looks good" 或类似的话，则视为批准应用先前写好的临时 markdown 草稿。在更新 GitHub 之前，要重新从磁盘读取该文件。
- If applying a draft and there is no known draft path, ask the user for the markdown file path.
  如果要应用草稿但不知道草稿路径，向用户询问该 markdown 文件的路径。

## Initial advisory workflow 公告初始处理流程

1. Parse the advisory URL into `owner`, `repo`, and `GHSA` id.
   将公告 URL 解析为 `owner`、`repo` 和 `GHSA` id。
2. Fetch the advisory with:
   使用以下命令获取公告：
   ```sh
   gh api repos/<owner>/<repo>/security-advisories/<GHSA>
   ```
   Record the advisory's original severity, CVSS vector, and CVSS score exactly as returned before proposing changes.
   在提出任何修改建议之前，先按接口返回的原样记录公告原有的 severity、CVSS 向量和 CVSS 分数。
3. Do not fetch advisory comments/discussion unless the user pasted them into the conversation:
   除非用户已将公告评论/讨论粘贴到对话中，否则不要去获取它们：
   - Inspect the advisory JSON for references, credits, linked issues/PRs, and any discussion fields.
     检查公告 JSON 中的 references、credits、关联的 issue/PR 以及任何讨论相关字段。
   - Do not rely on invented API endpoints such as `/comments`, `/timeline`, or `/events`; they commonly return 404 because GitHub does not expose draft advisory comments through the public API.
     不要依赖 `/comments`、`/timeline`、`/events` 这类臆造的 API 端点；它们通常返回 404，因为 GitHub 并未通过公开 API 暴露草稿公告的评论。
   - Do not use a browser session, browser cookies, or cookie extraction to fetch comments.
     不要使用浏览器会话、浏览器 cookie 或 cookie 提取手段去获取评论。
   - Explicitly tell the user: `Advisory comments were not included because GitHub does not expose them through the public API. Paste any relevant comments if you want them considered.`
     明确告知用户：`Advisory comments were not included because GitHub does not expose them through the public API. Paste any relevant comments if you want them considered.`
   - If the user pasted comments, read and consider them.
     如果用户粘贴了评论，则阅读并纳入考量。
   - Never pretend comments were read.
     绝不要假装已经读过评论。
4. Investigate independently:
   独立开展调查：
   - Read the advisory text, metadata, affected package(s), version ranges, CVSS, CWE, references, and linked issues/PRs/commits.
     阅读公告正文、元数据、受影响的包、版本范围、CVSS、CWE、参考链接以及关联的 issue/PR/提交。
   - Inspect relevant code history, releases, changelogs, package metadata, and tags.
     检查相关的代码历史、发布记录、changelog、包元数据和 tag。
   - Determine whether the vulnerability is already fixed.
     判断该漏洞是否已经被修复。
   - If fixed, identify the patched version(s) and the correct affected version range.
     如果已修复，确定修复版本以及正确的受影响版本范围。
   - Do not trust the reporter's analysis without verification.
     未经验证，不要轻信报告者的分析。
5. Discuss CVSS with the user before drafting the final update:
   在起草最终更新内容之前，先与用户讨论 CVSS：
   - Propose a CVSS vector, score, and severity.
     提出建议的 CVSS 向量、分数和严重级别。
   - Explain the controversial metrics briefly.
     简要解释其中有争议的指标。
   - Ask the user to confirm or adjust it.
     请用户确认或调整。
6. Ask whether a CVE should be requested from GitHub for this advisory.
   询问是否需要就该公告向 GitHub 申请 CVE。
7. Draft a publication-ready advisory markdown file under `/tmp`, for example `/tmp/sa-<GHSA>.md`. Include both the original CVSS from the advisory and the proposed/confirmed updated CVSS.
   在 `/tmp` 下起草一份可直接发布的公告 markdown 文件，例如 `/tmp/sa-<GHSA>.md`。其中要同时包含公告原有的 CVSS 和建议/已确认的更新后 CVSS。
8. Tell the user:
   告知用户：
   - the path to the temp markdown file
     临时 markdown 文件的路径
   - the original advisory URL
     原始公告 URL
   - that they can edit the file and then say "update" or provide the path
     他们可以编辑该文件，然后说 "update" 或提供文件路径

## Draft markdown format 草稿 markdown 格式

The draft file must contain YAML frontmatter followed by the advisory body. Include all fields needed to update GitHub and to decide whether to request a CVE.
草稿文件必须由 YAML frontmatter 加上公告正文构成。需包含更新 GitHub 以及判断是否申请 CVE 所需的全部字段。

```markdown
---
advisory_url: https://github.com/<owner>/<repo>/security/advisories/<GHSA>
owner: <owner>
repo: <repo>
ghsa_id: <GHSA>
summary: <short advisory summary>
original_severity: <low|medium|high|critical|null>
original_cvss_vector: <original CVSS:3.1/... or null>
original_cvss_score: <original number or null>
severity: <proposed/confirmed low|medium|high|critical>
cvss_vector: <proposed/confirmed CVSS:3.1/...>
cvss_score: <proposed/confirmed number>
cwe_ids:
  - CWE-...
vulnerabilities:
  - package:
      ecosystem: npm
      name: <package-name>
    vulnerable_version_range: <range>
    patched_versions: <range-or-version>
request_cve: false
---

# <Advisory title>

<Concise description of the vulnerability and vulnerable behavior.>

## Info

<Technical explanation of the root cause and affected component. Focus on facts needed by defenders and maintainers. Do not include PoC steps, exploit payloads, or copy-pastable exploit strings.>

## Impact

<Who can exploit it, prerequisites, confidentiality/integrity/availability impact, and realistic deployment assumptions.>

## Affected versions

- Affected: `<range>`
- Patched: `<version or range>`

## The solution

<Describe the fix and the patched release.>

## Recommendations

<Upgrade guidance and operational mitigations.>

## Workarounds

<Workarounds if any; otherwise skip this section entirely>

## Timeline

- YYYY-MM-DD: Report received
- YYYY-MM-DD: Fix committed
- YYYY-MM-DD: Fixed version released
- YYYY-MM-DD: Advisory published

## Credits

<Reporter/researcher attribution if appropriate, otherwise skip section.>

## References

- <links to releases, commits, advisories, documentation>
```

Use the curl advisory style as inspiration: clear sections, direct language, affected/fixed version facts, recommendations, timeline, and credits. Do not include a PoC.
参考 curl 项目的公告风格：清晰的分节、直白的措辞、明确的受影响/已修复版本事实、建议措施、时间线和致谢。不要包含 PoC。

## Applying a draft to GitHub 将草稿应用到 GitHub

When the user approves with "update"/similar or provides a markdown path:
当用户以 "update" 之类的说法表示批准，或提供了一个 markdown 路径时：

1. Re-read the markdown file from disk. Never rely on the previously generated content in memory.
   重新从磁盘读取该 markdown 文件。绝不要依赖内存中先前生成的内容。
2. Parse the YAML frontmatter and body.
   解析 YAML frontmatter 和正文。
3. Build a JSON payload in a temporary file. Map fields as follows:
   在临时文件中构建 JSON 请求体。字段映射如下：
   - `summary` from frontmatter
     `summary` 取自 frontmatter
   - `description` from the markdown body after frontmatter
     `description` 取自 frontmatter 之后的 markdown 正文
   - `severity` from frontmatter if present
     `severity` 若 frontmatter 中存在则取自其中
   - `cvss_vector_string` from `cvss_vector`
     `cvss_vector_string` 取自 `cvss_vector`
   - `cwe_ids` from frontmatter
     `cwe_ids` 取自 frontmatter
   - `vulnerabilities` from frontmatter
     `vulnerabilities` 取自 frontmatter
   - Do not send `original_severity`, `original_cvss_vector`, or `original_cvss_score`; those fields are retained only for audit context.
     不要发送 `original_severity`、`original_cvss_vector` 或 `original_cvss_score`；这些字段仅保留用于审计追溯。
4. Update the advisory with:
   使用以下命令更新公告：
   ```sh
   gh api -X PATCH repos/<owner>/<repo>/security-advisories/<GHSA> --input /tmp/<payload>.json
   ```
5. If and only if the markdown frontmatter has `request_cve: true`, request a CVE with:
   当且仅当 markdown frontmatter 中含有 `request_cve: true` 时，使用以下命令申请 CVE：
   ```sh
   gh api -X POST repos/<owner>/<repo>/security-advisories/<GHSA>/cve
   ```
   Treat "already requested" or "already assigned" as non-fatal and report it.
   将"已申请"或"已分配"视为非致命情况，报告出来即可。
6. Report what was updated:
   汇报更新了哪些内容：
   - advisory URL
     公告 URL
   - summary
     摘要
   - affected range
     受影响版本范围
   - patched versions
     已修复版本
   - original CVSS vector/score/severity
     原有的 CVSS 向量/分数/严重级别
   - updated CVSS vector/score/severity
     更新后的 CVSS 向量/分数/严重级别
   - whether CVE was requested
     是否申请了 CVE

## Safety rules 安全规则

- Do not include PoC material in the final advisory body.
  不要在最终公告正文中包含 PoC 材料。
- Do not request a CVE unless `request_cve: true` is present in the markdown file.
  除非 markdown 文件中存在 `request_cve: true`，否则不要申请 CVE。
- Do not publish the advisory or change its state unless the user explicitly asks.
  除非用户明确要求，否则不要发布公告或改变其状态。
- Do not fetch advisory comments through browser sessions or cookies. State that comments were not included and invite the user to paste relevant comments if they want them considered.
  不要通过浏览器会话或 cookie 获取公告评论。要说明评论未被纳入，并邀请用户在希望其被考虑时自行粘贴相关评论。
- If there is uncertainty in affected ranges, patched versions, CVSS, or CVE request status, ask the user before applying.
  如果在受影响范围、修复版本、CVSS 或 CVE 申请状态上存在不确定性，在应用变更前先询问用户。
