# Windows Setup Windows 安装配置

Pi requires a bash shell on Windows. Checked locations (in order):
Pi 在 Windows 上需要一个 bash shell。检查的位置(按顺序):

1. Custom path from `~/.pi/agent/settings.json`
   来自 `~/.pi/agent/settings.json` 的自定义路径
2. Git Bash (`C:\Program Files\Git\bin\bash.exe`)
   Git Bash (`C:\Program Files\Git\bin\bash.exe`)
3. `bash.exe` on PATH (Cygwin, MSYS2, WSL)
   PATH 中的 `bash.exe`(Cygwin、MSYS2、WSL)

For most users, [Git for Windows](https://git-scm.com/download/win) is sufficient.
对大多数用户而言,[Git for Windows](https://git-scm.com/download/win) 就已足够。

## Custom Shell Path 自定义 Shell 路径

```json
{
  "shellPath": "C:\\cygwin64\\bin\\bash.exe"
}
```
