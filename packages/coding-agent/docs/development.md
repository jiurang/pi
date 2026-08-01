# Development 开发

See [AGENTS.md](https://github.com/earendil-works/pi-mono/blob/main/AGENTS.md) for additional guidelines.
更多规范请参见 [AGENTS.md](https://github.com/earendil-works/pi-mono/blob/main/AGENTS.md)。

## Setup 环境搭建

```bash
git clone https://github.com/earendil-works/pi-mono
cd pi-mono
npm install
npm run build
```

Run from source:
从源码运行：

```bash
/path/to/pi-mono/pi-test.sh
```

The script can be run from any directory. Pi keeps the caller's current working directory.
该脚本可以在任意目录下运行。Pi 会保持调用方的当前工作目录不变。

## Forking / Rebranding 复刻 / 品牌定制

Configure via `package.json`:
通过 `package.json` 进行配置：

```json
{
  "piConfig": {
    "name": "pi",
    "configDir": ".pi"
  }
}
```

Change `name`, `configDir`, and `bin` field for your fork. Affects CLI banner, config paths, and environment variable names.
为你的复刻版本修改 `name`、`configDir` 和 `bin` 字段。这会影响 CLI 启动横幅、配置文件路径以及环境变量名称。

## Path Resolution 路径解析

Three execution modes: npm install, standalone binary, tsx from source.
三种执行模式：npm 安装、独立二进制文件、通过 tsx 从源码运行。

**Always use `src/config.ts`** for package assets:
包内资源**一律使用 `src/config.ts`**：

```typescript
import { getPackageDir, getThemeDir } from "./config.js";
```

Never use `__dirname` directly for package assets.
切勿直接使用 `__dirname` 来定位包内资源。

## Debug Command 调试命令

`/debug` (hidden) writes to `~/.pi/agent/pi-debug.log`:
`/debug`（隐藏命令）会写入 `~/.pi/agent/pi-debug.log`：
- Rendered TUI lines with ANSI codes
  带 ANSI 转义码的 TUI 渲染行
- Last messages sent to the LLM
  最近一次发送给 LLM 的消息

## Testing 测试

```bash
./test.sh                         # Run non-LLM tests (no API keys needed)
npm test                          # Run all tests
npm test -- test/specific.test.ts # Run specific test
```

## Project Structure 项目结构

```
packages/
  ai/           # LLM provider abstraction
  agent/        # Agent loop and message types  
  tui/          # Terminal UI components
  coding-agent/ # CLI and interactive mode
```
