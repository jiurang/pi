# Termux (Android) Setup Termux（Android）配置

Pi runs on Android via [Termux](https://termux.dev/), a terminal emulator and Linux environment for Android.
Pi 可以通过 [Termux](https://termux.dev/) 在 Android 上运行，Termux 是一款面向 Android 的终端模拟器和 Linux 环境。

## Prerequisites 前置条件

1. Install [Termux](https://github.com/termux/termux-app#installation) from GitHub or F-Droid (not Google Play, that version is deprecated)
   从 GitHub 或 F-Droid 安装 [Termux](https://github.com/termux/termux-app#installation)（不要从 Google Play 安装，该版本已废弃）
2. Install [Termux:API](https://github.com/termux/termux-api#installation) from GitHub or F-Droid for clipboard and other device integrations
   从 GitHub 或 F-Droid 安装 [Termux:API](https://github.com/termux/termux-api#installation)，以获得剪贴板及其他设备集成能力

## Installation 安装

```bash
# Update packages
pkg update && pkg upgrade

# Install dependencies
pkg install nodejs termux-api git

# Install pi
npm install -g --ignore-scripts @earendil-works/pi-coding-agent

# Create config directory
mkdir -p ~/.pi/agent

# Run pi
pi
```

## Clipboard Support 剪贴板支持

Clipboard operations use `termux-clipboard-set` and `termux-clipboard-get` when running in Termux. The Termux:API app must be installed for these to work.
在 Termux 中运行时，剪贴板操作使用 `termux-clipboard-set` 和 `termux-clipboard-get`。必须安装 Termux:API 应用，这些命令才能正常工作。

Image clipboard is not supported on Termux (the `ctrl+v` image paste feature will not work).
Termux 不支持图片剪贴板（`ctrl+v` 粘贴图片的功能无法使用）。

## Example AGENTS.md for Termux 适用于 Termux 的 AGENTS.md 示例

Create `~/.pi/agent/AGENTS.md` to help the agent understand the Termux environment:
创建 `~/.pi/agent/AGENTS.md`，帮助代理理解 Termux 环境：

````markdown
# Agent Environment: Termux on Android

## Location
- **OS**: Android (Termux terminal emulator)
- **Home**: `/data/data/com.termux/files/home`
- **Prefix**: `/data/data/com.termux/files/usr`
- **Shared storage**: `/storage/emulated/0` (Downloads, Documents, etc.)

## Opening URLs
```bash
termux-open-url "https://example.com"
```

## Opening Files
```bash
termux-open file.pdf          # Opens with default app
termux-open --chooser image.jpg      # Choose app
```

## Clipboard
```bash
termux-clipboard-set "text"   # Copy
termux-clipboard-get          # Paste
```

## Notifications
```bash
termux-notification -t "Title" -c "Content"
```

## Device Info
```bash
termux-battery-status         # Battery info
termux-wifi-connectioninfo    # WiFi info
termux-telephony-deviceinfo   # Device info
```

## Sharing
```bash
termux-share -a send file.txt # Share file
```

## Other Useful Commands
```bash
termux-toast "message"        # Quick toast popup
termux-vibrate                # Vibrate device
termux-tts-speak "hello"      # Text to speech
termux-camera-photo out.jpg   # Take photo
```

## Notes
- Termux:API app must be installed for `termux-*` commands
- Use `pkg install termux-api` for the command-line tools
- Storage permission needed for `/storage/emulated/0` access
````

## Limitations 限制

- **No image clipboard**: Termux clipboard API only supports text
  **不支持图片剪贴板**：Termux 剪贴板 API 只支持文本
- **No native binaries**: Some optional native dependencies (like the clipboard module) are unavailable on Android ARM64 and are skipped during installation
  **无原生二进制文件**：某些可选的原生依赖（例如剪贴板模块）在 Android ARM64 上不可用，安装过程中会被跳过
- **Storage access**: To access files in `/storage/emulated/0` (Downloads, etc.), run `termux-setup-storage` once to grant permissions
  **存储访问**：要访问 `/storage/emulated/0` 中的文件（Downloads 等），需运行一次 `termux-setup-storage` 以授予权限

## Troubleshooting 故障排查

### Clipboard not working 剪贴板无法使用

Ensure both apps are installed:
确认两个应用都已安装：

1. Termux (from GitHub or F-Droid)
   Termux（来自 GitHub 或 F-Droid）
2. Termux:API (from GitHub or F-Droid)
   Termux:API（来自 GitHub 或 F-Droid）

Then install the CLI tools:
然后安装命令行工具：

```bash
pkg install termux-api
```

### Permission denied for shared storage 共享存储权限被拒绝

Run once to grant storage permissions:
运行一次以授予存储权限：

```bash
termux-setup-storage
```

### Node.js installation issues Node.js 安装问题

If npm fails, try clearing the cache:
如果 npm 失败，可尝试清理缓存：

```bash
npm cache clean --force
```
