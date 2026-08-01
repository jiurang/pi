# Keybindings 快捷键绑定

All keyboard shortcuts can be customized via `~/.pi/agent/keybindings.json`. Each action can be bound to one or more keys.
所有键盘快捷键都可以通过 `~/.pi/agent/keybindings.json` 进行自定义。每个动作可以绑定一个或多个按键。

The config file uses the same namespaced keybinding ids that pi uses internally and that extension authors use in `keyHint()` and injected `keybindings` managers.
该配置文件使用与 pi 内部一致的带命名空间的快捷键 id，扩展作者在 `keyHint()` 以及注入的 `keybindings` 管理器中也使用同样的 id。

Older configs using pre-namespaced ids such as `cursorUp` or `expandTools` are migrated automatically to the namespaced ids on startup.
使用旧式（未加命名空间）id 的配置，例如 `cursorUp` 或 `expandTools`，会在启动时自动迁移为带命名空间的 id。

After editing `keybindings.json`, run `/reload` in pi to apply the changes without restarting the session.
编辑 `keybindings.json` 之后，在 pi 中执行 `/reload` 即可应用改动，无需重启会话。

## Key Format 按键格式

`modifier+key` where modifiers are `ctrl`, `shift`, `alt` (combinable) and keys are:
格式为 `modifier+key`，其中修饰键为 `ctrl`、`shift`、`alt`（可组合使用），按键包括：

- **Letters:** `a-z`
  **字母：** `a-z`
- **Digits:** `0-9`
  **数字：** `0-9`
- **Special:** `escape`, `esc`, `enter`, `return`, `tab`, `space`, `backspace`, `delete`, `insert`, `clear`, `home`, `end`, `pageUp`, `pageDown`, `up`, `down`, `left`, `right`
  **特殊键：** `escape`、`esc`、`enter`、`return`、`tab`、`space`、`backspace`、`delete`、`insert`、`clear`、`home`、`end`、`pageUp`、`pageDown`、`up`、`down`、`left`、`right`
- **Function:** `f1`-`f12`
  **功能键：** `f1`-`f12`
- **Symbols:** `` ` ``, `-`, `=`, `[`, `]`, `\`, `;`, `'`, `,`, `.`, `/`, `!`, `@`, `#`, `$`, `%`, `^`, `&`, `*`, `(`, `)`, `_`, `+`, `|`, `~`, `{`, `}`, `:`, `<`, `>`, `?`
  **符号键：** `` ` ``、`-`、`=`、`[`、`]`、`\`、`;`、`'`、`,`、`.`、`/`、`!`、`@`、`#`、`$`、`%`、`^`、`&`、`*`、`(`、`)`、`_`、`+`、`|`、`~`、`{`、`}`、`:`、`<`、`>`、`?`

Modifier combinations: `ctrl+shift+x`, `alt+ctrl+x`, `ctrl+shift+alt+x`, `ctrl+1`, etc.
修饰键组合示例：`ctrl+shift+x`、`alt+ctrl+x`、`ctrl+shift+alt+x`、`ctrl+1` 等。

## All Actions 全部动作

### TUI Editor Cursor Movement TUI 编辑器光标移动

| Keybinding id | Default | Description<br>说明 |
|--------|---------|-------------|
| `tui.editor.cursorUp` | `up` | Move cursor up<br>光标上移 |
| `tui.editor.cursorDown` | `down` | Move cursor down<br>光标下移 |
| `tui.editor.cursorLeft` | `left`, `ctrl+b` | Move cursor left<br>光标左移 |
| `tui.editor.cursorRight` | `right`, `ctrl+f` | Move cursor right<br>光标右移 |
| `tui.editor.cursorWordLeft` | `alt+left`, `ctrl+left`, `alt+b` | Move cursor word left<br>光标按词左移 |
| `tui.editor.cursorWordRight` | `alt+right`, `ctrl+right`, `alt+f` | Move cursor word right<br>光标按词右移 |
| `tui.editor.cursorLineStart` | `home`, `ctrl+a` | Move to line start<br>移动到行首 |
| `tui.editor.cursorLineEnd` | `end`, `ctrl+e` | Move to line end<br>移动到行尾 |
| `tui.editor.jumpForward` | `ctrl+]` | Jump forward to character<br>向前跳转到指定字符 |
| `tui.editor.jumpBackward` | `ctrl+alt+]` | Jump backward to character<br>向后跳转到指定字符 |
| `tui.editor.pageUp` | `pageUp` | Scroll up by page<br>按页向上滚动 |
| `tui.editor.pageDown` | `pageDown` | Scroll down by page<br>按页向下滚动 |

### TUI Editor Deletion TUI 编辑器删除

| Keybinding id | Default | Description<br>说明 |
|--------|---------|-------------|
| `tui.editor.deleteCharBackward` | `backspace` | Delete character backward<br>向前（左）删除一个字符 |
| `tui.editor.deleteCharForward` | `delete`, `ctrl+d` | Delete character forward<br>向后（右）删除一个字符 |
| `tui.editor.deleteWordBackward` | `ctrl+w`, `alt+backspace` | Delete word backward<br>向前（左）删除一个词 |
| `tui.editor.deleteWordForward` | `alt+d`, `alt+delete` | Delete word forward<br>向后（右）删除一个词 |
| `tui.editor.deleteToLineStart` | `ctrl+u` | Delete to line start<br>删除到行首 |
| `tui.editor.deleteToLineEnd` | `ctrl+k` | Delete to line end<br>删除到行尾 |

### TUI Input TUI 输入

| Keybinding id | Default | Description<br>说明 |
|--------|---------|-------------|
| `tui.input.newLine` | `shift+enter`, `ctrl+j` | Insert new line<br>插入换行 |
| `tui.input.submit` | `enter` | Submit input<br>提交输入 |
| `tui.input.tab` | `tab` | Tab / autocomplete<br>制表符 / 自动补全 |

### TUI Kill Ring TUI 删除环（Kill Ring）

| Keybinding id | Default | Description<br>说明 |
|--------|---------|-------------|
| `tui.editor.yank` | `ctrl+y` | Paste most recently deleted text<br>粘贴最近一次删除的文本 |
| `tui.editor.yankPop` | `alt+y` | Cycle through deleted text after yank<br>在 yank 之后循环切换历史删除文本 |
| `tui.editor.undo` | `ctrl+-` | Undo last edit<br>撤销上一次编辑 |

### TUI Clipboard and Selection TUI 剪贴板与选择

| Keybinding id | Default | Description<br>说明 |
|--------|---------|-------------|
| `tui.input.copy` | `ctrl+c` | Copy selection<br>复制选中内容 |
| `tui.select.up` | `up` | Move selection up<br>向上移动选择项 |
| `tui.select.down` | `down` | Move selection down<br>向下移动选择项 |
| `tui.select.pageUp` | `pageUp` | Page up in list<br>在列表中向上翻页 |
| `tui.select.pageDown` | `pageDown` | Page down in list<br>在列表中向下翻页 |
| `tui.select.confirm` | `enter` | Confirm selection<br>确认选择 |
| `tui.select.cancel` | `escape`, `ctrl+c` | Cancel selection<br>取消选择 |

### TUI Alternate-Screen Viewport TUI 备用屏幕视口

These actions apply when interactive mode is started with `--alt` and target the primary transcript scroll region. Two-finger trackpad and mouse-wheel input scroll the region under the pointer, falling back to the transcript over the fixed editor/status/footer dock. Clicking an OSC 8 hyperlink opens it in the default handler. Dragging with the primary mouse button selects text and copies it to the clipboard; holding at the transcript's top or bottom edge auto-scrolls into off-screen content.
这些动作在以 `--alt` 启动交互模式时生效，作用于主对话记录（transcript）滚动区域。双指触控板与鼠标滚轮会滚动指针所在的区域；当指针位于固定的编辑器/状态栏/页脚区域上方时，则回退为滚动对话记录。点击 OSC 8 超链接会用系统默认处理程序打开。按住鼠标主键拖动可选中文本并复制到剪贴板；在对话记录顶部或底部边缘按住不放会自动滚动以显示屏幕外的内容。

| Keybinding id | Default | Description<br>说明 |
|--------|---------|-------------|
| `tui.altScreen.pageUp` | `shift+pageUp` | Scroll the transcript up by one page<br>将对话记录向上滚动一页 |
| `tui.altScreen.pageDown` | `shift+pageDown` | Scroll the transcript down by one page<br>将对话记录向下滚动一页 |
| `tui.altScreen.top` | `ctrl+home` | Scroll to the beginning of the transcript<br>滚动到对话记录开头 |
| `tui.altScreen.bottom` | `ctrl+end` | Scroll to the transcript end and follow new output<br>滚动到对话记录末尾并跟随新输出 |

### Application 应用程序

| Keybinding id | Default | Description<br>说明 |
|--------|---------|-------------|
| `app.interrupt` | `escape` | Cancel / abort<br>取消 / 中止 |
| `app.clear` | `ctrl+c` | Clear editor<br>清空编辑器 |
| `app.exit` | `ctrl+d` | Exit (when editor empty)<br>退出（编辑器为空时） |
| `app.suspend` | `ctrl+z` (none on Windows) | Suspend to background<br>挂起到后台（Windows 上无默认绑定） |
| `app.editor.external` | `ctrl+g` | Open in external editor (`externalEditor`, `$VISUAL`, `$EDITOR`, Notepad on Windows, or `nano` elsewhere)<br>在外部编辑器中打开（依次为 `externalEditor`、`$VISUAL`、`$EDITOR`，Windows 上为 Notepad，其他平台为 `nano`） |
| `app.clipboard.pasteImage` | `ctrl+v` (`alt+v` on Windows) | Paste image from clipboard<br>从剪贴板粘贴图片（Windows 上为 `alt+v`） |

### Sessions 会话

| Keybinding id | Default | Description<br>说明 |
|--------|---------|-------------|
| `app.session.new` | *(none)* | Start a new session (`/new`)<br>开始一个新会话（`/new`） |
| `app.session.tree` | *(none)* | Open session tree navigator (`/tree`)<br>打开会话树导航器（`/tree`） |
| `app.session.fork` | *(none)* | Fork current session (`/fork`)<br>派生当前会话（`/fork`） |
| `app.session.resume` | *(none)* | Open session resume picker (`/resume`)<br>打开会话恢复选择器（`/resume`） |
| `app.session.togglePath` | `ctrl+p` | Toggle path display<br>切换路径显示 |
| `app.session.toggleSort` | `ctrl+s` | Toggle sort mode<br>切换排序模式 |
| `app.session.toggleNamedFilter` | `ctrl+n` | Toggle named-only filter<br>切换“仅显示已命名”过滤器 |
| `app.session.rename` | `ctrl+r` | Rename session<br>重命名会话 |
| `app.session.delete` | `ctrl+d` | Delete session<br>删除会话 |
| `app.session.deleteNoninvasive` | `ctrl+backspace` | Delete session when query is empty<br>当搜索内容为空时删除会话 |

### Models and Thinking 模型与思考

| Keybinding id | Default | Description<br>说明 |
|--------|---------|-------------|
| `app.model.select` | `ctrl+l` | Open model selector<br>打开模型选择器 |
| `app.model.cycleForward` | `ctrl+p` | Cycle to next model<br>切换到下一个模型 |
| `app.model.cycleBackward` | `shift+ctrl+p` | Cycle to previous model<br>切换到上一个模型 |
| `app.thinking.cycle` | `shift+tab` | Cycle thinking level<br>循环切换思考级别 |
| `app.thinking.toggle` | `ctrl+t` | Collapse or expand thinking blocks<br>折叠或展开思考内容块 |

### Display and Message Queue 显示与消息队列

| Keybinding id | Default | Description<br>说明 |
|--------|---------|-------------|
| `app.tools.expand` | `ctrl+o` | Collapse or expand tool output<br>折叠或展开工具输出 |
| `app.message.copy` | `ctrl+x` | Copy the last assistant message, or the selected message in `/tree`<br>复制最后一条助手消息，或在 `/tree` 中复制选中的消息 |
| `app.message.followUp` | `alt+enter` | Queue follow-up message<br>将后续消息加入队列 |
| `app.message.dequeue` | `alt+up` | Restore queued messages to editor<br>将排队中的消息恢复到编辑器 |

### Tree Navigation 树导航

| Keybinding id | Default | Description<br>说明 |
|--------|---------|-------------|
| `app.tree.foldOrUp` | `ctrl+left`, `alt+left` | Fold current branch segment, or jump to the previous segment start<br>折叠当前分支片段，或跳转到上一个片段的起点 |
| `app.tree.unfoldOrDown` | `ctrl+right`, `alt+right` | Unfold current branch segment, or jump to the next segment start or branch end<br>展开当前分支片段，或跳转到下一个片段起点或分支末尾 |
| `app.tree.editLabel` | `shift+l` | Edit the label on the selected tree node<br>编辑选中树节点的标签 |
| `app.tree.toggleLabelTimestamp` | `shift+t` | Toggle label timestamps in the tree<br>切换树中标签的时间戳显示 |
| `app.tree.filter.default` | `ctrl+d` | Set tree filter to default view<br>将树过滤器设置为默认视图 |
| `app.tree.filter.noTools` | `ctrl+t` | Toggle tree filter that hides tool results<br>切换隐藏工具结果的树过滤器 |
| `app.tree.filter.userOnly` | `ctrl+u` | Toggle tree filter that shows only user messages<br>切换仅显示用户消息的树过滤器 |
| `app.tree.filter.labeledOnly` | `ctrl+l` | Toggle tree filter that shows only labeled entries<br>切换仅显示带标签条目的树过滤器 |
| `app.tree.filter.all` | `ctrl+a` | Toggle tree filter that shows all entries<br>切换显示全部条目的树过滤器 |
| `app.tree.filter.cycleForward` | `ctrl+o` | Cycle tree filter forward<br>向前循环切换树过滤器 |
| `app.tree.filter.cycleBackward` | `shift+ctrl+o` | Cycle tree filter backward<br>向后循环切换树过滤器 |

### Scoped Models Selector 作用域模型选择器

Used inside the scoped models selector (opened via `/scoped-models`).
在作用域模型选择器（通过 `/scoped-models` 打开）中使用。

| Keybinding id | Default | Description<br>说明 |
|--------|---------|-------------|
| `app.models.save` | `ctrl+s` | Save current model selection to settings<br>将当前模型选择保存到设置 |
| `app.models.enableAll` | `ctrl+a` | Enable all models (or all matching the current search)<br>启用全部模型（或全部匹配当前搜索的模型） |
| `app.models.clearAll` | `ctrl+x` | Clear all models (or all matching the current search)<br>清除全部模型（或全部匹配当前搜索的模型） |
| `app.models.toggleProvider` | `ctrl+p` | Toggle all models for the current provider<br>切换当前提供方（provider）下的所有模型 |
| `app.models.reorderUp` | `alt+up` | Move the selected model up in the cycle order<br>在循环顺序中将选中模型上移 |
| `app.models.reorderDown` | `alt+down` | Move the selected model down in the cycle order<br>在循环顺序中将选中模型下移 |

## Custom Configuration 自定义配置

Create `~/.pi/agent/keybindings.json`:
创建 `~/.pi/agent/keybindings.json`：

```json
{
  "tui.editor.cursorUp": ["up", "ctrl+p"],
  "tui.editor.cursorDown": ["down", "ctrl+n"],
  "tui.editor.deleteWordBackward": ["ctrl+w", "alt+backspace"]
}
```

Each action can have a single key or an array of keys. User config overrides defaults.
每个动作既可以配置单个按键，也可以配置按键数组。用户配置会覆盖默认值。

On native Windows, `app.suspend` has no default binding because Windows terminals do not support Unix job control. If you bind it manually, pi shows a status message instead of suspending. In WSL, the normal Linux `ctrl+z`/`fg` behavior still applies.
在原生 Windows 上，`app.suspend` 没有默认绑定，因为 Windows 终端不支持 Unix 作业控制（job control）。若手动绑定该动作，pi 只会显示一条状态提示而不会真正挂起。在 WSL 中，仍然适用常规的 Linux `ctrl+z`/`fg` 行为。

### Emacs Example Emacs 示例

```json
{
  "tui.editor.cursorUp": ["up", "ctrl+p"],
  "tui.editor.cursorDown": ["down", "ctrl+n"],
  "tui.editor.cursorLeft": ["left", "ctrl+b"],
  "tui.editor.cursorRight": ["right", "ctrl+f"],
  "tui.editor.cursorWordLeft": ["alt+left", "alt+b"],
  "tui.editor.cursorWordRight": ["alt+right", "alt+f"],
  "tui.editor.deleteCharForward": ["delete", "ctrl+d"],
  "tui.editor.deleteCharBackward": ["backspace", "ctrl+h"],
  "tui.input.newLine": ["shift+enter", "ctrl+j"]
}
```

### Vim Example Vim 示例

```json
{
  "tui.editor.cursorUp": ["up", "alt+k"],
  "tui.editor.cursorDown": ["down", "alt+j"],
  "tui.editor.cursorLeft": ["left", "alt+h"],
  "tui.editor.cursorRight": ["right", "alt+l"],
  "tui.editor.cursorWordLeft": ["alt+left", "alt+b"],
  "tui.editor.cursorWordRight": ["alt+right", "alt+w"]
}
```
