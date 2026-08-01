# Shell Aliases Shell 别名

Pi runs bash in non-interactive mode (`bash -c`), which doesn't expand aliases by default.
Pi 以非交互模式（`bash -c`）运行 bash，默认不会展开别名（alias）。

To enable your shell aliases, add to `~/.pi/agent/settings.json`:
若要启用你的 shell 别名，请在 `~/.pi/agent/settings.json` 中添加：

```json
{
  "shellCommandPrefix": "shopt -s expand_aliases\neval \"$(grep '^alias ' ~/.zshrc)\""
}
```

Adjust the path (`~/.zshrc`, `~/.bashrc`, etc.) to match your shell config.
请将路径（`~/.zshrc`、`~/.bashrc` 等）调整为与你的 shell 配置文件一致。
