# DOOM Overlay Demo DOOM 浮层演示

Play DOOM as an overlay in pi. Demonstrates that the overlay system can handle real-time game rendering at 35 FPS.
在 pi 中以浮层(overlay)的方式游玩 DOOM。用于演示浮层系统能够以 35 FPS 处理实时游戏渲染。

## Usage 用法

```bash
pi --extension ./examples/extensions/doom-overlay
```

Then run:
然后运行:
```
/doom-overlay
```

The shareware WAD file (~4MB) is auto-downloaded on first run.
首次运行时会自动下载共享版(shareware) WAD 文件(约 4MB)。

## Controls 操作方式

| Action 操作 | Keys 按键 |
|--------|------|
| Move 移动 | WASD or Arrow Keys(WASD 或方向键) |
| Run 奔跑 | Shift + WASD |
| Fire 开火 | F or Ctrl(F 或 Ctrl) |
| Use/Open 使用/开门 | Space(空格) |
| Weapons 武器 | 1-7 |
| Map 地图 | Tab |
| Menu 菜单 | Escape |
| Pause/Quit 暂停/退出 | Q |

## How It Works 工作原理

DOOM runs as WebAssembly compiled from [doomgeneric](https://github.com/ozkl/doomgeneric). Each frame is rendered using half-block characters (▀) with 24-bit color, where the top pixel is the foreground color and the bottom pixel is the background color.
DOOM 以 WebAssembly 形式运行,由 [doomgeneric](https://github.com/ozkl/doomgeneric) 编译而来。每一帧都使用半块字符(▀)配合 24 位色彩渲染,其中上半个像素为前景色,下半个像素为背景色。

The overlay uses:
该浮层使用了:
- `width: "90%"` - 90% of terminal width
  `width: "90%"` - 终端宽度的 90%
- `maxHeight: "80%"` - Maximum 80% of terminal height
  `maxHeight: "80%"` - 最多为终端高度的 80%
- `anchor: "center"` - Centered in terminal
  `anchor: "center"` - 在终端中居中显示

Height is calculated from width to maintain DOOM's 3.2:1 aspect ratio (accounting for half-block rendering).
高度由宽度计算得出,以保持 DOOM 的 3.2:1 宽高比(已计入半块字符渲染的影响)。

## Credits 致谢

- [id Software](https://github.com/id-Software/DOOM) for the original DOOM
  [id Software](https://github.com/id-Software/DOOM) 提供了最初的 DOOM
- [doomgeneric](https://github.com/ozkl/doomgeneric) for the portable DOOM implementation
  [doomgeneric](https://github.com/ozkl/doomgeneric) 提供了可移植的 DOOM 实现
- [pi-doom](https://github.com/badlogic/pi-doom) for the original pi integration
  [pi-doom](https://github.com/badlogic/pi-doom) 提供了最初的 pi 集成
