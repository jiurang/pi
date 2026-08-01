# Terminal Setup 终端配置

Pi uses the [Kitty keyboard protocol](https://sw.kovidgoyal.net/kitty/keyboard-protocol/) for reliable modifier key detection. Most modern terminals support this protocol, but some require configuration.
Pi 使用 [Kitty keyboard protocol](https://sw.kovidgoyal.net/kitty/keyboard-protocol/) 来可靠地检测修饰键（modifier key）。大多数现代终端都支持该协议，但部分终端需要额外配置。

## Kitty, iTerm2

Work out of the box.
开箱即用，无需配置。

## Apple Terminal

Pi enables enhanced key reporting when available. If Terminal.app still sends plain Return for `Shift+Enter`, pi uses a local macOS modifier fallback to treat that Return as `Shift+Enter`.
在可用时，pi 会启用增强按键上报（enhanced key reporting）。如果 Terminal.app 对 `Shift+Enter` 仍然只发送普通的 Return，pi 会使用 macOS 本地修饰键回退方案，把该 Return 当作 `Shift+Enter` 处理。

This fallback only works when pi runs on the same Mac as Terminal.app. It cannot detect the local keyboard over remote SSH.
该回退方案仅在 pi 与 Terminal.app 运行于同一台 Mac 上时有效。它无法通过远程 SSH 检测本地键盘。

## Ghostty

Add to your Ghostty config (`~/Library/Application Support/com.mitchellh.ghostty/config` on macOS, `~/.config/ghostty/config` on Linux):
在你的 Ghostty 配置文件中添加（macOS 上为 `~/Library/Application Support/com.mitchellh.ghostty/config`，Linux 上为 `~/.config/ghostty/config`）：

```
keybind = alt+backspace=text:\x1b\x7f
```

Older Claude Code versions may have added this Ghostty mapping:
较旧版本的 Claude Code 可能添加过下面这条 Ghostty 映射：

```
keybind = shift+enter=text:\n
```

That mapping sends a raw linefeed byte. Inside pi, that is indistinguishable from `Ctrl+J`, so tmux and pi no longer see a real `shift+enter` key event.
该映射会发送一个原始换行（linefeed）字节。在 pi 内部，它与 `Ctrl+J` 无法区分，因此 tmux 和 pi 再也收不到真正的 `shift+enter` 按键事件。

If Claude Code 2.x or newer is the only reason you added that mapping, you can remove it, unless you want to use Claude Code in tmux, where it still requires that Ghostty mapping.
如果你添加该映射的唯一原因是 Claude Code 2.x 或更新版本，那么可以将其移除；除非你想在 tmux 中使用 Claude Code——在这种情况下它仍然需要这条 Ghostty 映射。

Pi binds `Ctrl+J` as a default newline alias, so `Shift+Enter` keeps working in tmux via that remap without extra pi configuration.
Pi 默认将 `Ctrl+J` 绑定为换行的别名，因此通过上述重映射，`Shift+Enter` 在 tmux 中依然可用，无需对 pi 做额外配置。

## WezTerm

WezTerm usually works out of the box for `Shift+Enter` via xterm modifyOtherKeys. To use the Kitty keyboard protocol explicitly, create `~/.wezterm.lua`:
WezTerm 通常可以借助 xterm modifyOtherKeys 开箱即用地支持 `Shift+Enter`。若要显式启用 Kitty 键盘协议，请创建 `~/.wezterm.lua`：

```lua
local wezterm = require 'wezterm'
local config = wezterm.config_builder()
config.enable_kitty_keyboard = true
return config
```

On macOS, WezTerm binds `Option+Enter` to fullscreen by default. To use `Option+Enter` for pi follow-up queueing, add this key override:
在 macOS 上，WezTerm 默认将 `Option+Enter` 绑定为全屏。若要将 `Option+Enter` 用于 pi 的后续消息排队（follow-up queueing），请添加下面的按键覆盖配置：

```lua
local wezterm = require 'wezterm'
local config = wezterm.config_builder()
config.keys = {
  {
    key = 'Enter',
    mods = 'ALT',
    action = wezterm.action.SendString('\x1b[13;3u'),
  },
}
return config
```

If you already have a `config.keys` table, add the entry to it.
如果你已经有 `config.keys` 表，把这个条目加进去即可。

On WSL, WezTerm may require a visible hardware cursor for IME candidate window positioning. If CJK IME candidates do not follow the text cursor, set `PI_HARDWARE_CURSOR=1` before running pi or set `showHardwareCursor` to `true` in settings.
在 WSL 上，WezTerm 可能需要可见的硬件光标来定位输入法（IME）候选窗口。如果中日韩输入法候选框没有跟随文本光标，请在运行 pi 之前设置 `PI_HARDWARE_CURSOR=1`，或在设置中将 `showHardwareCursor` 设为 `true`。

## Alacritty

Alacritty usually works out of the box for `Shift+Enter`. On macOS, `Option+Enter` may arrive as plain `Enter`. To use `Option+Enter` for pi follow-up queueing, add to `~/.config/alacritty/alacritty.toml`:
Alacritty 通常可以开箱即用地支持 `Shift+Enter`。在 macOS 上，`Option+Enter` 可能会被识别为普通的 `Enter`。若要将 `Option+Enter` 用于 pi 的后续消息排队，请在 `~/.config/alacritty/alacritty.toml` 中添加：

```toml
[[keyboard.bindings]]
key = "Enter"
mods = "Alt"
chars = "\u001b[13;3u"
```

Restart Alacritty after changing the config.
修改配置后请重启 Alacritty。

## VS Code (Integrated Terminal) VS Code（集成终端）

VS Code 1.109.5 and newer enable Kitty keyboard protocol in the integrated terminal by default, so `Shift+Enter` should work out of the box.
VS Code 1.109.5 及更新版本在集成终端中默认启用 Kitty 键盘协议，因此 `Shift+Enter` 应当开箱即用。

VS Code versions older than 1.109.5 need an explicit terminal keybinding for `Shift+Enter`.
早于 1.109.5 的 VS Code 版本需要为 `Shift+Enter` 显式配置终端快捷键。

`keybindings.json` locations:
`keybindings.json` 的位置：

- macOS: `~/Library/Application Support/Code/User/keybindings.json`
- Linux: `~/.config/Code/User/keybindings.json`
- Windows: `%APPDATA%\\Code\\User\\keybindings.json`

Add to `keybindings.json`:
在 `keybindings.json` 中添加：

```json
{
  "key": "shift+enter",
  "command": "workbench.action.terminal.sendSequence",
  "args": { "text": "\u001b[13;2u" },
  "when": "terminalFocus"
}
```

## Windows Terminal

Add to `settings.json` (Ctrl+Shift+, or Settings → Open JSON file) to forward the modified Enter keys pi uses:
在 `settings.json` 中添加以下内容（按 Ctrl+Shift+, 或依次选择 Settings → Open JSON file），以转发 pi 使用的带修饰键 Enter：

```json
{
  "actions": [
    {
      "command": { "action": "sendInput", "input": "\u001b[13;2u" },
      "keys": "shift+enter"
    },
    {
      "command": { "action": "sendInput", "input": "\u001b[13;3u" },
      "keys": "alt+enter"
    }
  ]
}
```

- `Shift+Enter` inserts a new line.
  `Shift+Enter` 插入换行。
- Windows Terminal binds `Alt+Enter` to fullscreen by default. That prevents pi from receiving `Alt+Enter` for follow-up queueing.
  Windows Terminal 默认将 `Alt+Enter` 绑定为全屏，这会导致 pi 无法接收到用于后续消息排队的 `Alt+Enter`。
- Remapping `Alt+Enter` to `sendInput` forwards the real key chord to pi instead.
  将 `Alt+Enter` 重映射为 `sendInput`，即可把真实的组合键转发给 pi。

If you already have an `actions` array, add the objects to it. If the old fullscreen behavior persists, fully close and reopen Windows Terminal.
如果你已经有 `actions` 数组，把这些对象加进去即可。如果旧的全屏行为仍然存在，请彻底关闭并重新打开 Windows Terminal。

## xfce4-terminal, terminator

These terminals have limited escape sequence support. Modified Enter keys like `Ctrl+Enter` and `Shift+Enter` cannot be distinguished from plain `Enter`, preventing custom keybindings such as `submit: ["ctrl+enter"]` from working.
这些终端对转义序列的支持有限。像 `Ctrl+Enter` 和 `Shift+Enter` 这样的带修饰键 Enter 无法与普通 `Enter` 区分，导致诸如 `submit: ["ctrl+enter"]` 之类的自定义快捷键无法生效。

For the best experience, use a terminal that supports the Kitty keyboard protocol:
为获得最佳体验，请使用支持 Kitty 键盘协议的终端：

- [Kitty](https://sw.kovidgoyal.net/kitty/)
- [Ghostty](https://ghostty.org/)
- [WezTerm](https://wezfurlong.org/wezterm/)
- [iTerm2](https://iterm2.com/)
- [Alacritty](https://github.com/alacritty/alacritty) (requires compilation with Kitty protocol support)
  [Alacritty](https://github.com/alacritty/alacritty)（需要在编译时启用 Kitty 协议支持）

## IntelliJ IDEA (Integrated Terminal) IntelliJ IDEA（集成终端）

The built-in terminal has limited escape sequence support. Shift+Enter cannot be distinguished from Enter in IntelliJ's terminal.
其内置终端对转义序列的支持有限。在 IntelliJ 的终端中，Shift+Enter 无法与 Enter 区分。

If you want the hardware cursor visible, set `PI_HARDWARE_CURSOR=1` before running pi (disabled by default for compatibility).
如果你希望显示硬件光标，请在运行 pi 之前设置 `PI_HARDWARE_CURSOR=1`（出于兼容性考虑，该功能默认关闭）。

Consider using a dedicated terminal emulator for the best experience.
为获得最佳体验，建议使用专门的终端模拟器。
