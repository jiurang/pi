# Plan Mode Extension 计划模式扩展

Read-only exploration mode for safe code analysis.
用于安全代码分析的只读探索模式。

## Features 特性

- **Built-in write tools disabled**: Disables edit/write while preserving other active tools
  **禁用内置写入工具**:禁用 edit/write 工具,同时保留其他已启用的工具
- **Bash allowlist**: Only read-only bash commands are allowed
  **Bash 白名单**:仅允许执行只读的 bash 命令
- **Plan extraction**: Extracts numbered steps from `Plan:` sections
  **计划提取**:从 `Plan:` 小节中提取带编号的步骤
- **Progress tracking**: Widget shows completion status during execution
  **进度跟踪**:执行过程中通过组件(widget)展示完成状态
- **[DONE:n] markers**: Explicit step completion tracking
  **[DONE:n] 标记**:显式跟踪各步骤的完成情况
- **Session persistence**: State survives session resume
  **会话持久化**:状态可在会话恢复后继续保留

## Commands 命令

- `/plan` - Toggle plan mode
  `/plan` - 切换计划模式
- `/todos` - Show current plan progress
  `/todos` - 查看当前计划的进度
- `Ctrl+Alt+P` - Toggle plan mode (shortcut)
  `Ctrl+Alt+P` - 切换计划模式(快捷键)

## Usage 用法

1. Enable plan mode with `/plan` or `--plan` flag
   使用 `/plan` 命令或 `--plan` 参数启用计划模式
2. Ask the agent to analyze code and create a plan
   让 agent 分析代码并制定一份计划
3. The agent should output a numbered plan under a `Plan:` header:
   agent 应在 `Plan:` 标题下输出一份带编号的计划:

```
Plan:
1. First step description
2. Second step description
3. Third step description
```

4. Choose "Execute the plan" when prompted
   在出现提示时选择 "Execute the plan"(执行计划)
5. During execution, the agent marks steps complete with `[DONE:n]` tags
   执行过程中,agent 会用 `[DONE:n]` 标签标记已完成的步骤
6. Progress widget shows completion status
   进度组件(widget)会展示完成状态

## How It Works 工作原理

### Plan Mode (Read-Only) 计划模式(只读)
- Built-in edit/write tools disabled
  内置的 edit/write 工具被禁用
- Other active tools remain available
  其他已启用的工具仍可正常使用
- Bash commands filtered through allowlist
  bash 命令会经过白名单过滤
- Agent creates a plan without making changes
  agent 只制定计划,不做任何修改

### Execution Mode 执行模式
- Full tool access restored
  恢复完整的工具访问权限
- Agent executes steps in order
  agent 按顺序执行各个步骤
- `[DONE:n]` markers track completion
  通过 `[DONE:n]` 标记跟踪完成情况
- Widget shows progress
  组件(widget)展示进度

### Command Allowlist 命令白名单

Safe commands (allowed):
安全命令(允许执行):
- File inspection: `cat`, `head`, `tail`, `less`, `more`
  查看文件:`cat`、`head`、`tail`、`less`、`more`
- Search: `grep`, `find`, `rg`, `fd`
  搜索:`grep`、`find`、`rg`、`fd`
- Directory: `ls`, `pwd`, `tree`
  目录操作:`ls`、`pwd`、`tree`
- Git read: `git status`, `git log`, `git diff`, `git branch`
  Git 读取:`git status`、`git log`、`git diff`、`git branch`
- Package info: `npm list`, `npm outdated`, `yarn info`
  包信息查询:`npm list`、`npm outdated`、`yarn info`
- System info: `uname`, `whoami`, `date`, `uptime`
  系统信息:`uname`、`whoami`、`date`、`uptime`

Blocked commands:
被阻止的命令:
- File modification: `rm`, `mv`, `cp`, `mkdir`, `touch`
  文件修改:`rm`、`mv`、`cp`、`mkdir`、`touch`
- Git write: `git add`, `git commit`, `git push`
  Git 写入:`git add`、`git commit`、`git push`
- Package install: `npm install`, `yarn add`, `pip install`
  安装依赖包:`npm install`、`yarn add`、`pip install`
- System: `sudo`, `kill`, `reboot`
  系统操作:`sudo`、`kill`、`reboot`
- Editors: `vim`, `nano`, `code`
  编辑器:`vim`、`nano`、`code`
