# Security Policy 安全策略

This document should guide you about understanding the security concept behind
Pi and also where the boundaries are.
本文档旨在帮助你理解 Pi 背后的安全理念，以及其安全边界所在。

In general Pi is a coding agent that runs locally within the security boundary
of the user that is running it.  It's the responsibiltiy of the user to monitor
its operations or to contain it within a container, virtual machine or other
Sandbox solution.
总体而言，Pi 是一个在本地运行的编程智能体（coding agent），运行于启动它的用户所处的安全边界之内。用户有责任监控其操作，或将其限制在容器、虚拟机或其他沙箱方案中运行。

Pi treats the local user account and files writable by that account as inside
the same trust boundary as the Pi process itself.  If an attacker can modify files
under the user's home directory, workspace, shell startup files, environment, or
Pi configuration, they can generally influence Pi or other local developer tools.
Reports that depend on such prior local write access are not security
vulnerabilities unless they demonstrate how Pi grants that write access or crosses
an operating-system privilege boundary.
Pi 将本地用户账户以及该账户可写的文件，视作与 Pi 进程本身处于同一信任边界之内。如果攻击者能够修改用户主目录下的文件、工作区、shell 启动文件、环境变量或 Pi 配置，那么他们通常也能影响 Pi 或其他本地开发者工具。凡是依赖于此类既有本地写权限的报告，除非能证明 Pi 本身授予了该写权限或跨越了操作系统的权限边界，否则不属于安全漏洞。

Pi relies on users installing trustworthy extensions and loading trustworthy
skills and only to use pi within trusted repositories.  This is because files
like `AGENTS.md` or instructions in comments can be used to prompt inject the
coding agent trivially and this cannot be protected against.
Pi 依赖于用户只安装可信的扩展、只加载可信的技能（skill），并且只在可信的代码仓库中使用 pi。这是因为像 `AGENTS.md` 这样的文件或注释中的指令，可以非常轻易地对编程智能体进行提示注入（prompt injection），而这一点是无法防护的。

## Reporting a Vulnerability 漏洞报告

If you believe you found a security vulnerability in pi or another package in
this repository, please report it privately by either:
如果你认为在 pi 或本仓库中的其他包里发现了安全漏洞，请通过以下任一方式私下报告：

- Emailing `security@earendil.com`, or
  发送邮件至 `security@earendil.com`；或
- Opening a private report through GitHub Security Advisories for this repository
  通过本仓库的 GitHub Security Advisories 提交私密报告

Please include:
请在报告中包含：

- A description of the issue and its impact
  问题描述及其影响
- Steps to reproduce, proof of concept, or relevant logs
  复现步骤、概念验证（PoC）或相关日志
- Affected package, version, commit, or configuration
  受影响的包、版本、提交（commit）或配置
- Any known mitigations
  任何已知的缓解措施

Do not open a public issue for security-sensitive reports.  We will review
reports and coordinate disclosure as appropriate.
请勿为安全敏感的报告创建公开 issue。我们会审阅报告，并在适当时协调披露事宜。

## Scope 适用范围

Security issues in the distributed packages, command-line tools, APIs, and
repository code are in scope as well as earendil operated infrastricture
on `pi.dev`.
分发的软件包、命令行工具、API 以及仓库代码中的安全问题均在范围内，`pi.dev` 上由 earendil 运营的基础设施同样在范围内。

## Out Of Scope 不在适用范围内

- Local code execution or sandboxing behavior (the Pi coding agent intentionally does not have a sandbox)
  本地代码执行或沙箱行为（Pi 编程智能体有意不提供沙箱）
- Behavior of pi extensions or skills installed by the user
  用户自行安装的 pi 扩展或技能的行为
- Risks from working in untrusted repositories
  在不可信仓库中工作所带来的风险
- Risks from installing untrusted extensions, skills, packages, or tools
  安装不可信的扩展、技能、软件包或工具所带来的风险
- Isuses caused by non trustworthy MITM proxies
  由不可信的中间人（MITM）代理导致的问题
- Public internet exposure of a Pi installation
  将 Pi 部署暴露在公共互联网上
- Prompt injection attacks
  提示注入（prompt injection）攻击
- Exposed secrets that are third-party/user-controlled credentials
  泄露的密钥属于第三方或用户自行掌控的凭据
- Reports requiring the ability to create, modify, delete, or replace files,
  directories, symlinks, environment variables, shell configuration, or other
  user-controlled local state on the target machine. This includes `~/.pi`,
  `~/.pi/agent/models.json`, workspace files, `AGENTS.md`, skills, extensions,
  extension configuration, dotfiles, and files synchronized through NFS, roaming
  profiles, or dotfile managers, unless the report shows how Pi itself grants
  that access.
  以能够在目标机器上创建、修改、删除或替换文件、目录、符号链接、环境变量、shell
  配置或其他由用户掌控的本地状态为前提的报告。这包括 `~/.pi`、
  `~/.pi/agent/models.json`、工作区文件、`AGENTS.md`、技能、扩展、
  扩展配置、dotfiles，以及通过 NFS、漫游配置文件（roaming profile）或 dotfile
  管理器同步的文件；除非报告能说明 Pi 本身是如何授予该访问权限的。
- Issues caused by intentionally weakened user configuration.
  由用户有意削弱安全性的配置所导致的问题。
- Resource/DOS claims that require trusted local input/config against the pi coding agent.
  需要借助可信的本地输入/配置才能对 pi 编程智能体成立的资源耗尽/拒绝服务（DOS）类主张。
- Reports about malicious model output.
  关于模型输出恶意内容的报告。
- User-approved or user-initiated local actions presented as vulnerabilities.
  将用户批准或用户主动发起的本地操作包装成漏洞的报告。

## Notes for Reporters 给报告者的说明

The most useful reports show a current, reproducible security boundary bypass
with demonstrated impact.  Reports that only show expected local-agent behavior,
prompt injection, or a malicious trusted extension/skill are not security
vulnerabilities under this model.
最有价值的报告应展示一个当前存在、可复现且影响可证实的安全边界绕过。仅仅展示本地智能体的预期行为、提示注入，或一个恶意但被信任的扩展/技能的报告，在本安全模型下不属于安全漏洞。

For example, a report showing that malicious contents written to a trusted Pi
configuration file cause Pi to execute commands, load attacker-controlled tools,
send credentials to an attacker-controlled endpoint, or otherwise change behavior
is out of scope.
例如，某报告展示：将恶意内容写入受信任的 Pi 配置文件后，会导致 Pi 执行命令、加载受攻击者控制的工具、将凭据发送到攻击者控制的端点，或以其他方式改变行为——此类报告不在适用范围内。

When possible, include the exact affected path, package version or commit SHA,
configuration, and a proof of concept against the latest release or latest
`main`.  For dependency reports, include evidence that the shipped dependency is
affected and that the issue is reachable through Pi.  For exposed-secret reports,
include evidence that the credential is owned by Earendil or grants access to
Earendil-operated infrastructure or services.
如有可能，请提供确切的受影响路径、包版本或提交 SHA、相关配置，以及针对最新发布版本或最新 `main` 分支的概念验证。对于依赖相关的报告，请提供证据表明随包分发的依赖确实受影响，且该问题可通过 Pi 触达。对于密钥泄露类报告，请提供证据表明该凭据归 Earendil 所有，或可用于访问由 Earendil 运营的基础设施或服务。
