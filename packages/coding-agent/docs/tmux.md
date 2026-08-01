# tmux Setup tmux 配置

Pi works inside tmux, but tmux strips modifier information from certain keys by default. Without configuration, `Shift+Enter` and `Ctrl+Enter` are usually indistinguishable from plain `Enter`.
Pi 可以在 tmux 中运行，但 tmux 默认会剥离某些按键的修饰键（modifier）信息。若不进行配置，`Shift+Enter` 和 `Ctrl+Enter` 通常无法与普通的 `Enter` 区分开。

## Recommended Configuration 推荐配置

Add to `~/.tmux.conf`:
在 `~/.tmux.conf` 中添加：

```tmux
set -g extended-keys on
set -g extended-keys-format csi-u
```

Then restart tmux fully:
然后完全重启 tmux：

```bash
tmux kill-server
tmux
```

Pi requests extended key reporting automatically when Kitty keyboard protocol is not available. With `extended-keys-format csi-u`, tmux forwards modified keys in CSI-u format, which is the most reliable configuration. The `extended-keys-format` option requires tmux 3.5 or later.
当 Kitty 键盘协议不可用时，pi 会自动请求扩展按键上报（extended key reporting）。启用 `extended-keys-format csi-u` 后，tmux 会以 CSI-u 格式转发带修饰键的按键，这是最可靠的配置。`extended-keys-format` 选项需要 tmux 3.5 或更高版本。

## Why `csi-u` Is Recommended 为什么推荐 `csi-u`

With only:
如果只配置：

```tmux
set -g extended-keys on
```

tmux defaults to `extended-keys-format xterm`. When an application requests extended key reporting, modified keys are forwarded in xterm `modifyOtherKeys` format such as:
tmux 会默认使用 `extended-keys-format xterm`。当应用程序请求扩展按键上报时，带修饰键的按键会以 xterm `modifyOtherKeys` 格式转发，例如：

- `Ctrl+C` → `\x1b[27;5;99~`
- `Ctrl+D` → `\x1b[27;5;100~`
- `Ctrl+Enter` → `\x1b[27;5;13~`

With `extended-keys-format csi-u`, the same keys are forwarded as:
使用 `extended-keys-format csi-u` 时，同样的按键会被转发为：

- `Ctrl+C` → `\x1b[99;5u`
- `Ctrl+D` → `\x1b[100;5u`
- `Ctrl+Enter` → `\x1b[13;5u`

Pi supports both formats, but `csi-u` is the recommended tmux setup.
Pi 同时支持这两种格式，但推荐在 tmux 中使用 `csi-u`。

## What This Fixes 这能解决什么问题

Without tmux extended keys, modified Enter keys collapse to legacy sequences:
若不启用 tmux 扩展按键，带修饰键的 Enter 会退化为传统转义序列：

| Key<br>按键 | Without extkeys<br>未启用扩展按键 | With `csi-u`<br>启用 `csi-u` |
|-----|-----------------|--------------|
| Enter | `\r` | `\r` |
| Shift+Enter | `\r` | `\x1b[13;2u` |
| Ctrl+Enter | `\r` | `\x1b[13;5u` |
| Alt/Option+Enter | `\x1b\r` | `\x1b[13;3u` |

This affects the default keybindings (`Enter` to submit, `Shift+Enter` for newline) and any custom keybindings using modified Enter.
这会影响默认快捷键（`Enter` 提交、`Shift+Enter` 换行），以及任何使用带修饰键 Enter 的自定义快捷键。

## Requirements 环境要求

- tmux 3.5 or later for `extended-keys-format csi-u` (run `tmux -V` to check)
  使用 `extended-keys-format csi-u` 需要 tmux 3.5 或更高版本（运行 `tmux -V` 查看）
- A terminal emulator that supports extended keys (Ghostty, Kitty, iTerm2, WezTerm, Windows Terminal)
  一个支持扩展按键的终端模拟器（Ghostty、Kitty、iTerm2、WezTerm、Windows Terminal）

With tmux 3.2 through 3.4, omit `extended-keys-format csi-u`; Pi still supports tmux's default xterm `modifyOtherKeys` format.
在 tmux 3.2 至 3.4 上，请省略 `extended-keys-format csi-u`；Pi 仍然支持 tmux 默认的 xterm `modifyOtherKeys` 格式。
