> pi can create skills. Ask it to build one for your use case.
>
> pi 可以创建技能（skill）。你可以让它为你的使用场景构建一个。

# Skills 技能

Skills are self-contained capability packages that the agent loads on-demand. A skill provides specialized workflows, setup instructions, helper scripts, and reference documentation for specific tasks.

技能（skill）是自包含的能力包，由 agent 按需加载。一个技能会为特定任务提供专门的工作流程、安装配置说明、辅助脚本和参考文档。

Pi implements the [Agent Skills standard](https://agentskills.io/specification), warning about most violations but remaining lenient. Pi allows skill names to differ from their parent directory even though the standard disallows it; that rule is suboptimal for shared skill directories used across multiple agent harnesses.

Pi 实现了 [Agent Skills 标准](https://agentskills.io/specification)，对大多数违规情况给出警告但保持宽容。尽管该标准不允许，Pi 仍允许技能名称与其父目录名不一致；因为对于跨多个 agent 客户端（harness）共享的技能目录来说，那条规则并不理想。

## Table of Contents 目录

- [Locations](#locations)
  位置
- [How Skills Work](#how-skills-work)
  技能的工作原理
- [Skill Commands](#skill-commands)
  技能命令
- [Skill Structure](#skill-structure)
  技能结构
- [Frontmatter](#frontmatter)
  前置元数据
- [Validation](#validation)
  校验
- [Example](#example)
  示例
- [Skill Repositories](#skill-repositories)
  技能仓库

## Locations 位置

> **Security:** Skills can instruct the model to perform any action and may include executable code the model invokes. Review skill content before use.
>
> **安全提示：** 技能可以指示模型执行任意操作，并且可能包含由模型调用的可执行代码。使用前请先审查技能内容。

Pi loads skills from:

Pi 会从以下位置加载技能：

- Global:
  全局：
  - `~/.pi/agent/skills/`
  - `~/.agents/skills/`
- Project (only after the project is trusted):
  项目级（仅在项目被信任后生效）：
  - `.pi/skills/`
  - `.agents/skills/` in `cwd` and ancestor directories (up to git repo root, or filesystem root when not in a repo)
    `cwd` 及其祖先目录中的 `.agents/skills/`（向上查找至 git 仓库根目录；若不在仓库中则查找至文件系统根目录）
- Packages: `skills/` directories or `pi.skills` entries in `package.json`
  包：`skills/` 目录，或 `package.json` 中的 `pi.skills` 条目
- Settings: `skills` array with files or directories
  设置：`skills` 数组，可包含文件或目录
- CLI: `--skill <path>` (repeatable, additive even with `--no-skills`)
  CLI：`--skill <path>`（可重复指定；即使使用了 `--no-skills` 也会追加加载）

Discovery rules:

发现规则：
- In `~/.pi/agent/skills/` and `.pi/skills/`, direct root `.md` files are discovered as individual skills
  在 `~/.pi/agent/skills/` 和 `.pi/skills/` 中，根目录下的 `.md` 文件会被识别为独立的技能
- In all skill locations, directories containing `SKILL.md` are discovered recursively
  在所有技能位置中，包含 `SKILL.md` 的目录会被递归发现
- In `~/.agents/skills/` and project `.agents/skills/`, root `.md` files are ignored
  在 `~/.agents/skills/` 和项目的 `.agents/skills/` 中，根目录下的 `.md` 文件会被忽略

Disable discovery with `--no-skills` (explicit `--skill` paths still load).

使用 `--no-skills` 可禁用自动发现（显式指定的 `--skill` 路径仍会加载）。

### Using Skills from Other Harnesses 使用其他客户端的技能

To use skills from Claude Code or OpenAI Codex, add their directories to settings:

若要使用来自 Claude Code 或 OpenAI Codex 的技能，请把它们的目录加入设置：

```json
{
  "skills": [
    "~/.claude/skills",
    "~/.codex/skills"
  ]
}
```

For project-level Claude Code skills, add to `.pi/settings.json`:

对于项目级的 Claude Code 技能，请添加到 `.pi/settings.json` 中：

```json
{
  "skills": ["../.claude/skills"]
}
```

## How Skills Work 技能的工作原理

1. At startup, pi scans skill locations and extracts names and descriptions
   启动时，pi 会扫描各技能位置并提取名称和描述
2. The system prompt includes available skills in XML format per the [specification](https://agentskills.io/integrate-skills)
   系统提示词会按照[规范](https://agentskills.io/integrate-skills)以 XML 格式列出可用技能
3. When a task matches, the agent uses `read` to load the full SKILL.md (models don't always do this; use prompting or `/skill:name` to force it)
   当任务匹配时，agent 会使用 `read` 加载完整的 SKILL.md（模型并不总会这样做；可通过提示词或 `/skill:name` 强制加载）
4. The agent follows the instructions, using relative paths to reference scripts and assets
   agent 按照说明执行，并使用相对路径引用脚本和资源文件

This is progressive disclosure: only descriptions are always in context, full instructions load on-demand.

这就是渐进式披露（progressive disclosure）：上下文中始终只保留描述，完整说明按需加载。

## Skill Commands 技能命令

Skills register as `/skill:name` commands:

技能会注册为 `/skill:name` 形式的命令：

```bash
/skill:brave-search           # Load and execute the skill
/skill:pdf-tools extract      # Load skill with arguments
```

Arguments after the command are appended to the skill content as `User: <args>`.

命令后面的参数会以 `User: <args>` 的形式追加到技能内容之后。

Toggle skill commands via `/settings` in interactive mode or in `settings.json`:

可在交互模式下通过 `/settings`，或在 `settings.json` 中开关技能命令：

```json
{
  "enableSkillCommands": true
}
```

## Skill Structure 技能结构

A skill is a directory with a `SKILL.md` file. Everything else is freeform.

一个技能就是一个包含 `SKILL.md` 文件的目录。其余内容不作限制，可自由组织。

```
my-skill/
├── SKILL.md              # Required: frontmatter + instructions
├── scripts/              # Helper scripts
│   └── process.sh
├── references/           # Detailed docs loaded on-demand
│   └── api-reference.md
└── assets/
    └── template.json
```

### SKILL.md Format SKILL.md 格式

````markdown
---
name: my-skill
description: What this skill does and when to use it. Be specific.
---

# My Skill

## Setup

Run once before first use:
```bash
cd /path/to/skill && npm install
```

## Usage

```bash
./scripts/process.sh <input>
```
````

Use relative paths from the skill directory:

使用相对于技能目录的相对路径：

```markdown
See [the reference guide](references/REFERENCE.md) for details.
```

## Frontmatter 前置元数据

Per the [Agent Skills specification](https://agentskills.io/specification#frontmatter-required):

依据 [Agent Skills 规范](https://agentskills.io/specification#frontmatter-required)：

| Field<br>字段 | Required<br>是否必需 | Description<br>说明 |
|-------|----------|-------------|
| `name` | Yes<br>是 | Max 64 chars. Lowercase a-z, 0-9, hyphens. Unlike the standard, Pi does not require this to match the parent directory because that standard requirement is suboptimal for shared skill directories.<br>最长 64 个字符。仅限小写字母 a-z、数字 0-9 和连字符。与标准不同，Pi 不要求它与父目录名一致，因为该标准要求对共享技能目录来说并不理想。 |
| `description` | Yes<br>是 | Max 1024 chars. What the skill does and when to use it.<br>最长 1024 个字符。说明该技能的功能以及何时使用它。 |
| `license` | No<br>否 | License name or reference to bundled file.<br>许可证名称，或指向随附文件的引用。 |
| `compatibility` | No<br>否 | Max 500 chars. Environment requirements.<br>最长 500 个字符。环境要求。 |
| `metadata` | No<br>否 | Arbitrary key-value mapping.<br>任意的键值映射。 |
| `allowed-tools` | No<br>否 | Space-delimited list of pre-approved tools (experimental).<br>以空格分隔的预授权工具列表（实验特性）。 |
| `disable-model-invocation` | No<br>否 | When `true`, skill is hidden from system prompt. Users must use `/skill:name`.<br>为 `true` 时，该技能不会出现在系统提示词中，用户必须使用 `/skill:name` 调用。 |

### Name Rules 名称规则

- 1-64 characters
  1 至 64 个字符
- Lowercase letters, numbers, hyphens only
  仅允许小写字母、数字和连字符
- No leading/trailing hyphens
  不能以连字符开头或结尾
- No consecutive hyphens
  不能出现连续的连字符

Pi does not require the name to match the parent directory. The Agent Skills standard does, but that requirement is suboptimal for shared skill directories used by multiple tools.

Pi 不要求名称与父目录名一致。Agent Skills 标准有此要求，但对于被多个工具共享使用的技能目录而言，该要求并不理想。

Valid: `pdf-processing`, `data-analysis`, `code-review`
有效示例：`pdf-processing`、`data-analysis`、`code-review`
Invalid: `PDF-Processing`, `-pdf`, `pdf--processing`
无效示例：`PDF-Processing`、`-pdf`、`pdf--processing`

### Description Best Practices 描述编写最佳实践

The description determines when the agent loads the skill. Be specific.

描述决定了 agent 何时加载该技能，务必写得具体。

Good:
推荐写法：
```yaml
description: Extracts text and tables from PDF files, fills PDF forms, and merges multiple PDFs. Use when working with PDF documents.
```

Poor:
不推荐写法：
```yaml
description: Helps with PDFs.
```

## Validation 校验

Pi validates skills against the Agent Skills standard. Most issues produce warnings but still load the skill:

Pi 会依据 Agent Skills 标准校验技能。大多数问题只会产生警告，技能仍会被加载：

- Name exceeds 64 characters or contains invalid characters
  名称超过 64 个字符，或包含非法字符
- Name starts/ends with hyphen or has consecutive hyphens
  名称以连字符开头/结尾，或包含连续的连字符
- Description exceeds 1024 characters
  描述超过 1024 个字符

Unknown frontmatter fields are ignored.

未知的前置元数据字段会被忽略。

**Exception:** Skills with missing description are not loaded.

**例外：** 缺少 description 的技能不会被加载。

Name collisions (same name from different locations) warn and keep the first skill found.

名称冲突（不同位置存在同名技能）会产生警告，并保留最先找到的那个技能。

## Example 示例

```
brave-search/
├── SKILL.md
├── search.js
└── content.js
```

**SKILL.md:**
**SKILL.md：**
````markdown
---
name: brave-search
description: Web search and content extraction via Brave Search API. Use for searching documentation, facts, or any web content.
---

# Brave Search

## Setup

```bash
cd /path/to/brave-search && npm install
```

## Search

```bash
./search.js "query"              # Basic search
./search.js "query" --content    # Include page content
```

## Extract Page Content

```bash
./content.js https://example.com
```
````

## Skill Repositories 技能仓库

- [Anthropic Skills](https://github.com/anthropics/skills) - Document processing (docx, pdf, pptx, xlsx), web development
  [Anthropic Skills](https://github.com/anthropics/skills) —— 文档处理（docx、pdf、pptx、xlsx）、Web 开发
- [Pi Skills](https://github.com/badlogic/pi-skills) - Web search, browser automation, Google APIs, transcription
  [Pi Skills](https://github.com/badlogic/pi-skills) —— 网络搜索、浏览器自动化、Google API、语音转写
