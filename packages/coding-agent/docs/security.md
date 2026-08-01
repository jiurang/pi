# Security 安全

Pi is a local coding agent. It runs with the permissions of the user account that starts it, and it treats files writable by that user as inside the same local trust boundary.
Pi 是一个本地编码代理（coding agent）。它以启动它的用户账户的权限运行，并将该用户可写的文件视为处于同一个本地信任边界（trust boundary）之内。

## Project Trust 项目信任

Project trust controls whether pi loads project-local settings, resources, packages, and extensions. It is not a sandbox and it does not restrict what the model can ask tools to do after you start working in a directory.
项目信任控制 pi 是否加载项目本地的设置、资源、包和扩展。它不是沙箱（sandbox），在你开始于某个目录中工作之后，它也不会限制模型可以要求工具执行的操作。

Pi considers a project to have resources that require trust when it finds any of these from the current working directory:
当 pi 从当前工作目录发现以下任意一项时，就认为该项目含有需要信任才能加载的资源：

- `.pi/settings.json`
- `.pi/extensions`, `.pi/skills`, `.pi/prompts`, or `.pi/themes`
  `.pi/extensions`、`.pi/skills`、`.pi/prompts` 或 `.pi/themes`
- `.pi/SYSTEM.md` or `.pi/APPEND_SYSTEM.md`
  `.pi/SYSTEM.md` 或 `.pi/APPEND_SYSTEM.md`
- project `.agents/skills` in the current directory or an ancestor directory
  位于当前目录或其祖先目录中的项目 `.agents/skills`

A bare `.pi` directory does not count as a project resource that requires trust.
仅有一个空的 `.pi` 目录不算作需要信任的项目资源。

When an interactive session starts in a project with resources that require trust and no saved decision for the current directory or a parent directory, pi follows `defaultProjectTrust` from global settings. The default value is `"ask"`, which asks whether to trust the project when UI is available. Saved decisions are stored by canonical directory in `~/.pi/agent/trust.json`, and the closest saved decision on the current or parent path applies before the global default.
当交互式会话在含有需信任资源的项目中启动，且当前目录或其父目录没有已保存的决定时，pi 会遵循全局设置中的 `defaultProjectTrust`。默认值为 `"ask"`，即在有 UI 可用时询问是否信任该项目。已保存的决定按规范化（canonical）目录存储在 `~/.pi/agent/trust.json` 中，当前路径或父路径上最近的已保存决定优先于全局默认值生效。

Trusting a project allows pi to load project resources that require trust, including:
信任一个项目会允许 pi 加载需要信任的项目资源，包括：

- `.pi/settings.json`
- `.pi` resources such as extensions, skills, prompt templates, themes, and system prompt files
  `.pi` 资源，例如扩展、技能（skills）、提示词模板、主题以及系统提示词文件
- missing project packages configured through project settings
  通过项目设置配置但尚未安装的项目包
- project-local extensions and project package-managed extensions
  项目本地扩展以及由项目包管理的扩展

Declining trust skips protected resources. `AGENTS.md` and `CLAUDE.md` context files are loaded regardless of project trust unless context loading is disabled. Before trust is resolved, pi only loads context files, user/global extensions, and CLI `-e` extensions. User/global and CLI extensions can handle the `project_trust` event; the first extension that returns a yes/no decision owns the decision.
拒绝信任则会跳过受保护的资源。除非上下文加载被禁用，否则 `AGENTS.md` 和 `CLAUDE.md` 上下文文件都会被加载，与项目信任无关。在信任状态确定之前，pi 只加载上下文文件、用户/全局扩展以及通过 CLI `-e` 指定的扩展。用户/全局扩展和 CLI 扩展可以处理 `project_trust` 事件；第一个返回是/否决定的扩展将拥有该决定权。

Non-interactive modes (`-p`, `--mode json`, and `--mode rpc`) do not show a trust prompt. Without an applicable saved trust decision, `defaultProjectTrust: "ask"` and `"never"` ignore such resources, while `"always"` trusts them. Use `--approve`/`-a` or `--no-approve`/`-na` to override project trust for one run.
非交互模式（`-p`、`--mode json` 和 `--mode rpc`）不会显示信任提示。在没有适用的已保存信任决定时，`defaultProjectTrust: "ask"` 和 `"never"` 会忽略这类资源，而 `"always"` 则会信任它们。可使用 `--approve`/`-a` 或 `--no-approve`/`-na` 为单次运行覆盖项目信任设置。

## No Built-in Sandbox 无内置沙箱

Pi does not include a built-in sandbox. Built-in tools can read files, write files, edit files, and run shell commands with the permissions of the pi process. Extensions are TypeScript modules that run with the same permissions. Package installs, shell commands, language servers, test commands, and other developer tools behave as ordinary local processes.
Pi 不包含内置沙箱。内置工具可以以 pi 进程的权限读取文件、写入文件、编辑文件和运行 shell 命令。扩展是以相同权限运行的 TypeScript 模块。包安装、shell 命令、语言服务器、测试命令以及其他开发者工具都表现为普通的本地进程。

This is intentional. Pi is designed to operate on local source trees, invoke project toolchains, and integrate with the user's existing development environment. A partial in-process sandbox would be easy to misunderstand as a security boundary while still depending on the host shell, filesystem, package managers, credentials, and extension code. Real isolation needs to come from the operating system or a virtualization/container boundary.
这是有意为之的设计。Pi 的目标是操作本地源码树、调用项目工具链，并与用户已有的开发环境集成。一个不完整的进程内沙箱很容易被误认为是安全边界，而实际上它仍然依赖宿主机的 shell、文件系统、包管理器、凭据和扩展代码。真正的隔离必须来自操作系统或虚拟化/容器边界。

Project trust is only an input-loading guard. It prevents a repository from silently changing pi's settings or extensions before you approve it. It does not make untrusted code, untrusted prompts, or untrusted model output safe. Prompt injection from repository files, comments, documentation, context files, or build output is expected local-agent risk and cannot be reliably prevented by pi.
项目信任只是一道输入加载的防护。它可以防止仓库在你批准之前悄悄修改 pi 的设置或扩展。它并不能让不受信任的代码、不受信任的提示词或不受信任的模型输出变得安全。来自仓库文件、注释、文档、上下文文件或构建输出的提示词注入（prompt injection）是本地代理固有的预期风险，pi 无法可靠地阻止。

## Running Untrusted or Unmonitored Work 运行不受信任或无人监控的任务

For untrusted repositories, generated code you do not intend to monitor closely, or unattended automation, run pi in a contained environment. Use a container, VM, micro-VM, remote sandbox, or policy-controlled sandbox with only the files and credentials required for the task.
对于不受信任的仓库、你不打算密切监控的生成代码，或者无人值守的自动化任务，请在受限环境中运行 pi。使用容器、虚拟机（VM）、微虚拟机（micro-VM）、远程沙箱或受策略控制的沙箱，并只提供该任务所需的文件和凭据。

Common patterns are documented in [Containerization](containerization.md):
常见的做法记录在 [Containerization](containerization.md) 中：

- run the whole `pi` process inside a container/sandbox
  在容器/沙箱内运行整个 `pi` 进程
- run host pi while routing built-in tool execution into a Gondolin micro-VM
  在宿主机上运行 pi，同时将内置工具的执行路由到 Gondolin 微虚拟机中
- mount only the workspace paths the agent should access
  只挂载代理应当访问的工作区路径
- avoid mounting host `~/.pi/agent` unless the container should access host sessions, settings, and credentials
  除非容器确实需要访问宿主机的会话、设置和凭据，否则避免挂载宿主机的 `~/.pi/agent`
- pass the minimum required API keys or use short-lived credentials
  只传入必需的最少 API 密钥，或使用短期有效的凭据
- restrict network access when the task does not need it
  当任务不需要网络时限制网络访问
- review diffs and outputs before copying results back to trusted systems
  在将结果复制回受信任的系统之前，先审查 diff 和输出

If you bind-mount a host workspace read/write, writes from inside the container or VM can still modify host files. Use read-only mounts or copy files into and out of the sandbox when you need stronger protection from unintended writes.
如果你以可读写方式绑定挂载（bind-mount）宿主机工作区，容器或虚拟机内部的写入仍然可以修改宿主机文件。当你需要更强的防误写保护时，请使用只读挂载，或者在沙箱内外手动复制文件。

## Reporting Security Issues 报告安全问题

To report a security issue, follow the repository [Security Policy](https://github.com/earendil-works/pi-mono/blob/main/SECURITY.md). Do not open a public issue for security-sensitive reports.
如需报告安全问题，请遵循仓库的 [Security Policy](https://github.com/earendil-works/pi-mono/blob/main/SECURITY.md)。请勿为涉及安全敏感内容的报告创建公开 issue。

Expected local-agent behavior, lack of a built-in sandbox, prompt injection from untrusted content, and behavior of user-installed extensions or skills are generally outside the security boundary unless the report demonstrates a real privilege-boundary bypass or shows how pi grants access that the local user did not already have.
预期内的本地代理行为、缺少内置沙箱、来自不受信任内容的提示词注入，以及用户自行安装的扩展或技能的行为，通常都不在安全边界之内，除非报告能证明存在真实的权限边界绕过，或说明 pi 授予了本地用户原本并不具备的访问权限。
