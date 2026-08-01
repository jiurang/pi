> pi can create prompt templates. Ask it to build one for your workflow.
> pi 可以创建提示词模板（prompt template）。让它为你的工作流构建一个即可。

# Prompt Templates 提示词模板

Prompt templates are Markdown snippets that expand into full prompts. Type `/name` in the editor to invoke a template, where `name` is the filename without `.md`.
提示词模板是可以展开为完整提示词的 Markdown 片段。在编辑器中输入 `/name` 即可调用某个模板，其中 `name` 是去掉 `.md` 后缀的文件名。

## Locations 位置

Pi loads prompt templates from:
Pi 会从以下位置加载提示词模板：

- Global: `~/.pi/agent/prompts/*.md`
  全局：`~/.pi/agent/prompts/*.md`
- Project: `.pi/prompts/*.md` (only after the project is trusted)
  项目：`.pi/prompts/*.md`（仅在项目被信任后生效）
- Packages: `prompts/` directories or `pi.prompts` entries in `package.json`
  包：`prompts/` 目录，或 `package.json` 中的 `pi.prompts` 条目
- Settings: `prompts` array with files or directories
  设置：`prompts` 数组中列出的文件或目录
- CLI: `--prompt-template <path>` (repeatable)
  命令行：`--prompt-template <path>`（可重复指定）

Disable discovery with `--no-prompt-templates`.
使用 `--no-prompt-templates` 可禁用模板发现。

## Format 格式

```markdown
---
description: Review staged git changes
---
Review the staged changes (`git diff --cached`). Focus on:
- Bugs and logic errors
- Security issues
- Error handling gaps
```

- The filename becomes the command name. `review.md` becomes `/review`.
  文件名即命令名。`review.md` 对应 `/review`。
- `description` is optional. If missing, the first non-empty line is used.
  `description` 为可选项。若缺省，则使用第一行非空内容作为描述。
- `argument-hint` is optional. When set, the hint is displayed before the description in the autocomplete dropdown.
  `argument-hint` 为可选项。设置后，该提示会显示在自动补全下拉列表中描述文字的前面。

### Argument Hints 参数提示

Use `argument-hint` in frontmatter to show expected arguments in autocomplete. Use `<angle brackets>` for required arguments and `[square brackets]` for optional ones:
在 frontmatter 中使用 `argument-hint` 可在自动补全中展示期望的参数。必填参数用 `<尖括号>` 表示，可选参数用 `[方括号]` 表示：

```markdown
---
description: Review PRs from URLs with structured issue and code analysis
argument-hint: "<PR-URL>"
---
```

This renders in the autocomplete dropdown as:
在自动补全下拉列表中的渲染效果如下：

```
→ pr   <PR-URL>       — Review PRs from URLs with structured issue and code analysis
  is   <issue>        — Analyze GitHub issues (bugs or feature requests)
  wr   [instructions] — Finish the current task end-to-end
  cl   — Audit changelog entries before release
```

## Usage 用法

Type `/` followed by the template name in the editor. Autocomplete shows available templates with descriptions.
在编辑器中输入 `/` 后跟模板名称。自动补全会列出可用模板及其描述。

```
/review                           # Expands review.md
/component Button                 # Expands with argument
/component Button "click handler" # Multiple arguments
```

## Arguments 参数

Templates support positional arguments, defaults, and simple slicing:
模板支持位置参数、默认值以及简单的切片操作：

- `$1`, `$2`, ... positional args
  `$1`、`$2`、…… 表示位置参数
- `$@` or `$ARGUMENTS` for all args joined
  `$@` 或 `$ARGUMENTS` 表示拼接后的全部参数
- `${1:-default}` uses arg 1 when present/non-empty, otherwise `default`
  `${1:-default}` 在参数 1 存在且非空时使用该参数，否则使用 `default`
- `${@:-default}` or `${ARGUMENTS:-default}` uses all arguments when present/non-empty, otherwise `default`
  `${@:-default}` 或 `${ARGUMENTS:-default}` 在参数存在且非空时使用全部参数，否则使用 `default`
- `${@:N}` for args from the Nth position (1-indexed)
  `${@:N}` 表示从第 N 个位置开始的参数（下标从 1 开始）
- `${@:N:L}` for `L` args starting at N
  `${@:N:L}` 表示从第 N 个开始的 `L` 个参数

Example:
示例：

```markdown
---
description: Create a component
---
Create a React component named $1 with features: $@
```

Default values are useful for optional arguments:
默认值对可选参数很有用：

```markdown
Summarize the current state in ${1:-7} bullet points.
```

Usage: `/component Button "onClick handler" "disabled support"`
用法：`/component Button "onClick handler" "disabled support"`

## Loading Rules 加载规则

- Template discovery in `prompts/` is non-recursive.
  `prompts/` 目录中的模板发现不会递归查找子目录。
- If you want templates in subdirectories, add them explicitly via `prompts` settings or a package manifest.
  如果需要使用子目录中的模板，请通过 `prompts` 设置项或包清单（package manifest）显式添加。
