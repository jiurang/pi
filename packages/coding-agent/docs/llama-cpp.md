# llama.cpp

Pi supports the [llama.cpp](https://github.com/ggml-org/llama.cpp) router server. The router discovers multiple GGUF models and loads or unloads them on demand.
Pi 支持 [llama.cpp](https://github.com/ggml-org/llama.cpp) 的 router（路由）服务器。router 会发现多个 GGUF 模型，并按需加载或卸载它们。

Use a current llama.cpp build with router support. Follow the [build instructions](https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md) or install a [prebuilt release](https://github.com/ggml-org/llama.cpp/releases) for your platform.
请使用支持 router 的较新 llama.cpp 版本。可参照[构建说明](https://github.com/ggml-org/llama.cpp/blob/master/docs/build.md)自行编译，或为你的平台安装[预编译发行版](https://github.com/ggml-org/llama.cpp/releases)。

## Start the router 启动 router

Start `llama-server` without `--model` or `-m`. Passing a model starts single-model mode instead of router mode.
启动 `llama-server` 时不要带 `--model` 或 `-m`。一旦传入模型，就会进入单模型模式而非 router 模式。

```bash
llama-server \
  --models-dir ~/models \
  --no-models-autoload \
  --jinja \
  --host 127.0.0.1 \
  --port 8080 \
  -ngl 999 \
  -c 32768
```

Important options:
重要选项：

- `--models-dir ~/models` discovers local GGUF files.
  `--models-dir ~/models` 用于发现本地的 GGUF 文件。
- `--no-models-autoload` keeps loading explicit through `/llama`.
  `--no-models-autoload` 保证模型只能通过 `/llama` 显式加载。
- `--jinja` enables compatible chat templates and tool calling.
  `--jinja` 启用兼容的聊天模板（chat template）与工具调用（tool calling）。
- `-ngl 999` offloads as many layers as possible to the GPU.
  `-ngl 999` 尽可能多地将模型层卸载到 GPU 上运行。
- `-c 32768` sets the context window for each loaded model. Omit it to use the model's native context, which may require substantially more memory.
  `-c 32768` 设置每个已加载模型的上下文窗口大小。省略该选项则使用模型原生的上下文长度，这可能需要多得多的内存。

A single-file model can sit directly in the model directory. Put multimodal and multi-shard models in separate subdirectories:
单文件模型可以直接放在模型目录下。多模态模型和多分片（multi-shard）模型请分别放入各自的子目录：

```text
~/models/
├── llama-3.2-1b-Q4_K_M.gguf
├── gemma-3-4b-it-Q4_K_M/
│   ├── gemma-3-4b-it-Q4_K_M.gguf
│   └── mmproj-F16.gguf
└── large-model-Q4_K_M/
    ├── large-model-Q4_K_M-00001-of-00003.gguf
    ├── large-model-Q4_K_M-00002-of-00003.gguf
    └── large-model-Q4_K_M-00003-of-00003.gguf
```

Restart the router after manually adding files. For per-model context sizes and other options, use [llama.cpp model presets](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md#model-presets).
手动添加文件后需要重启 router。若要为不同模型分别设置上下文大小及其他选项，请使用 [llama.cpp model presets](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md#model-presets)。

## Configure Pi 配置 Pi

Start Pi and configure the provider:
启动 Pi 并配置该提供方（provider）：

```text
/login llama.cpp
```

Enter the router URL and optional API key. The default URL is `http://127.0.0.1:8080`.
输入 router 的 URL 以及可选的 API key。默认 URL 是 `http://127.0.0.1:8080`。

Environment variables can configure the same values without `/login`:
也可以通过环境变量配置相同的值，无需使用 `/login`：

```bash
export LLAMA_BASE_URL=http://127.0.0.1:8080
export LLAMA_API_KEY=optional-secret
pi
```

If the server uses an API key, start `llama-server` with the matching `--api-key` value. Keep `--host 127.0.0.1` for local-only access.
如果服务器启用了 API key，请在启动 `llama-server` 时传入匹配的 `--api-key` 值。保持 `--host 127.0.0.1` 可将访问限制为仅本机。

## Manage models 管理模型

Run:
运行：

```text
/llama
```

- Select an unloaded model to load it.
  选择一个未加载的模型即可加载它。
- Select a loaded model to unload it.
  选择一个已加载的模型即可卸载它。
- Select **Download model…**, search Hugging Face, then choose a repository and quantization. Exact `owner/repository[:quant]` values also work.
  选择 **Download model…** 后可搜索 Hugging Face，然后选定仓库和量化版本。也可以直接输入精确的 `owner/repository[:quant]` 值。
- Press Escape during a load or download to confirm cancellation.
  在加载或下载过程中按 Escape 键可确认取消操作。

Hugging Face search uses `HF_TOKEN` when set, then checks `$HF_TOKEN_PATH`, `$HF_HOME/token`, `$XDG_CACHE_HOME/huggingface/token`, and `~/.cache/huggingface/token`. Search also works without authentication, subject to lower rate limits. Pi warns before downloading gated repositories and links to their access page. The llama.cpp server performs the download, so its process must also have `HF_TOKEN` when the selected repository requires access.
Hugging Face 搜索会优先使用已设置的 `HF_TOKEN`，然后依次检查 `$HF_TOKEN_PATH`、`$HF_HOME/token`、`$XDG_CACHE_HOME/huggingface/token` 和 `~/.cache/huggingface/token`。未认证时搜索同样可用，但速率限制更低。下载受限（gated）仓库前，Pi 会给出提示并附上其访问申请页面的链接。下载实际由 llama.cpp 服务器执行，因此当所选仓库需要授权时，该进程也必须拥有 `HF_TOKEN`。

If other models are loaded, Pi asks whether to unload them first or keep them loaded. Pi does not silently unload models and never deletes model files. The router may be shared with other clients, so `/llama` always displays the router's current state.
如果已经加载了其他模型，Pi 会询问是先卸载它们还是保持加载。Pi 不会静默卸载模型，也绝不会删除模型文件。router 可能被其他客户端共享，因此 `/llama` 始终显示 router 的当前实时状态。

Only loaded models appear in `/model`. After loading a model, run `/model` to select it for the current Pi session.
只有已加载的模型才会出现在 `/model` 中。加载模型后，运行 `/model` 将其选为当前 Pi 会话使用的模型。

If the router disconnects, `/llama` shows **Retry** and **Close**. Retry reconnects and refreshes model state without replaying the interrupted operation.
如果 router 断开连接，`/llama` 会显示 **Retry** 和 **Close**。Retry 会重新连接并刷新模型状态，但不会重放被中断的操作。

## Troubleshooting 故障排查

Check that the router is reachable:
检查 router 是否可访问：

```bash
curl http://127.0.0.1:8080/health
curl http://127.0.0.1:8080/models
```

- **No models in `/llama`:** Check `--models-dir`, the directory layout, and restart the router.
  **`/llama` 中没有任何模型：** 检查 `--models-dir` 及目录结构，然后重启 router。
- **Model missing from `/model`:** Load it with `/llama` first.
  **`/model` 中找不到模型：** 请先用 `/llama` 加载该模型。
- **Load fails or uses too much memory:** Lower `-c` or unload another model.
  **加载失败或内存占用过高：** 调低 `-c`，或先卸载其他模型。
- **Server is not in router mode:** Start it without `--model`, `-m`, or `-hf`.
  **服务器未处于 router 模式：** 启动时不要带 `--model`、`-m` 或 `-hf`。
