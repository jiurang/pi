# Containerization 容器化

Pi runs with all permissions by default, but in some cases, you will want to have more control over what directories Pi can write to and which accesses it has.
Pi 默认以全部权限运行，但在某些场景下，你会希望更严格地控制 Pi 能写入哪些目录、拥有哪些访问权限。

There are two general options. You can either
总体上有两种方案，你可以：
1. run the whole `pi` process inside an isolated environment, or
   将整个 `pi` 进程运行在隔离环境中；或者
2. run `pi` on the host and route tool execution into an isolated environment.
   在宿主机上运行 `pi`，但把工具的执行路由到隔离环境中。

## Choose a pattern 选择方案

| Pattern | What is isolated | Best for | Notes |
| --- | --- | --- | --- |
| Gondolin extension<br>Gondolin 扩展 | Built-in tools and `!` commands<br>内置工具与 `!` 命令 | Local micro-VM isolation while keeping auth on host<br>使用本地微虚拟机隔离，同时把认证信息保留在宿主机上 | See [`examples/extensions/gondolin/`](../examples/extensions/gondolin/).<br>参见 [`examples/extensions/gondolin/`](../examples/extensions/gondolin/)。 |
| Plain Docker<br>纯 Docker | Whole `pi` process in a local container<br>整个 `pi` 进程运行在本地容器中 | Simple local isolation<br>简单的本地隔离 | Provider API keys enter the container.<br>提供方的 API key 会进入容器内部。 |
| OpenShell | Whole `pi` process in a policy-controlled sandbox<br>整个 `pi` 进程运行在受策略管控的沙箱中 | Local or remote managed sandbox<br>本地或远程的托管沙箱 | Requires an OpenShell gateway<br>需要一个 OpenShell 网关 |

Extensions run wherever the `pi` process runs. If you run host `pi` with a tool-routing extension, other custom extension tools still run on the host unless they also delegate their operations.
扩展总是运行在 `pi` 进程所在的位置。如果你在宿主机上运行 `pi` 并搭配一个工具路由扩展，其他自定义扩展工具仍会在宿主机上执行，除非它们也把自身操作委托出去。

## Gondolin

[Gondolin](https://github.com/earendil-works/gondolin) is a local Linux micro-VM.
[Gondolin](https://github.com/earendil-works/gondolin) 是一个本地 Linux 微虚拟机（micro-VM）。
Use the [example extension](../examples/extensions/gondolin) when you want `pi` on the host but all built-in tools routed into the VM.
如果你希望 `pi` 运行在宿主机上、而所有内置工具都路由进虚拟机执行，可以使用这个[示例扩展](../examples/extensions/gondolin)。

Setup:
安装配置：

```bash
cp -R packages/coding-agent/examples/extensions/gondolin ~/.pi/agent/extensions/gondolin
cd ~/.pi/agent/extensions/gondolin
npm install --ignore-scripts
```

Run from the project you want mounted:
在你想要挂载的项目目录下运行：

```bash
cd /path/to/project
pi -e ~/.pi/agent/extensions/gondolin
```

The extension mounts the host cwd at `/workspace` in the VM and overrides `read`, `write`, `edit`, `bash`, `grep`, `find`, and `ls`.
该扩展会把宿主机的当前工作目录挂载到虚拟机内的 `/workspace`，并覆盖 `read`、`write`、`edit`、`bash`、`grep`、`find` 和 `ls` 这些工具。
User `!` commands are routed into the VM, as well.
用户输入的 `!` 命令同样会被路由进虚拟机执行。
File changes under `/workspace` write through to the host.
`/workspace` 下的文件改动会直写回宿主机。

Requirements: Node.js >= 23.6.0 for `@earendil-works/gondolin`, plus QEMU (requires installation through your package manager).
环境要求：`@earendil-works/gondolin` 需要 Node.js >= 23.6.0，另外还需要 QEMU（需通过你的包管理器自行安装）。

## Plain Docker 纯 Docker

Run the whole `pi` process in Docker when you want the simplest local container boundary.
如果你只想要最简单的本地容器边界，可以把整个 `pi` 进程运行在 Docker 中。

`Dockerfile.pi`:

```dockerfile
FROM node:24-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends bash ca-certificates git ripgrep \
  && rm -rf /var/lib/apt/lists/*
RUN npm install -g --ignore-scripts @earendil-works/pi-coding-agent

WORKDIR /workspace
ENTRYPOINT ["pi"]
```

Build and run:
构建并运行：

```bash
docker build -t pi-sandbox -f Dockerfile.pi .

docker run --rm -it \
  -e ANTHROPIC_API_KEY \
  -v "$PWD:/workspace" \
  -v pi-agent-home:/root/.pi/agent \
  pi-sandbox
```

The `-v "$PWD:/workspace"` mounts your current directory into the container at /workspace such that reads and writes in `/workspace` inside Docker directly affect your host files, like in the Gondolin example.
`-v "$PWD:/workspace"` 会把当前目录挂载到容器内的 /workspace，因此在 Docker 内对 `/workspace` 的读写会直接作用于宿主机文件，与 Gondolin 示例中的行为一致。

Use a named volume for `/root/.pi/agent` if you want container-local settings and sessions. Mounting your host `~/.pi/agent` exposes host auth and session files to the container.
如果你希望设置和会话仅保存在容器本地，请为 `/root/.pi/agent` 使用具名卷（named volume）。直接挂载宿主机的 `~/.pi/agent` 会把宿主机的认证信息和会话文件暴露给容器。

## OpenShell

Use [NVIDIA OpenShell](https://docs.nvidia.com/openshell/about/overview) when you want a policy-controlled sandbox with filesystem, process, network, credential, and inference controls.
如果你需要一个可对文件系统、进程、网络、凭据和推理调用进行策略管控的沙箱，可以使用 [NVIDIA OpenShell](https://docs.nvidia.com/openshell/about/overview)。
OpenShell can run sandboxes through a local gateway backed by Docker, Podman, or a VM runtime, or through a remote Kubernetes gateway.
OpenShell 既可以通过由 Docker、Podman 或虚拟机运行时支撑的本地网关来运行沙箱，也可以通过远程 Kubernetes 网关运行。

Every sandbox requires an active gateway.
每个沙箱都需要一个处于活动状态的网关。
Register and select one before creating a sandbox:
创建沙箱前，请先注册并选定一个网关：

```bash
openshell gateway add <gateway-url> --name <name>
openshell gateway select <name>
```

Launch `pi` inside an OpenShell sandbox:
在 OpenShell 沙箱中启动 `pi`：

```bash
openshell sandbox create --name pi-sandbox --from pi -- pi
```

In this pattern, the whole `pi` process runs inside the sandbox.
在这种方案下，整个 `pi` 进程都运行在沙箱内部。
Built-in tools, `!` commands, and extension tools execute inside the OpenShell boundary.
内置工具、`!` 命令以及扩展工具都在 OpenShell 的隔离边界内执行。

If the gateway is remote, project files are not bind-mounted from the host, meaning writes in the sandbox are not reflected on your machine.
如果使用的是远程网关，项目文件不会从宿主机以 bind mount 方式挂载进来，也就是说沙箱内的写入不会反映到你本机上。
Clone the repository inside the sandbox or use OpenShell file transfer commands:
此时请在沙箱内克隆仓库，或使用 OpenShell 的文件传输命令：

```bash
openshell sandbox upload pi-sandbox ./repo /workspace
openshell sandbox download pi-sandbox /workspace/repo ./repo-out
```

OpenShell providers can keep raw model API keys outside the sandbox.
OpenShell 的 provider 机制可以把原始的模型 API key 保留在沙箱之外。
When inference routing is configured, code inside the sandbox can call `https://inference.local`, and the gateway injects the configured provider credentials upstream.
配置好推理路由后，沙箱内的代码可以调用 `https://inference.local`，由网关在上游注入所配置的提供方凭据。
Configure Pi to use the corresponding OpenAI-compatible or Anthropic-compatible endpoint if you want model traffic to use this route.
如果你希望模型流量走这条链路，请将 Pi 配置为使用相应的 OpenAI 兼容或 Anthropic 兼容端点。
