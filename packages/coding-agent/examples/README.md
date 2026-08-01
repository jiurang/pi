# Examples 示例

Example code for pi-coding-agent SDK and extensions.
pi-coding-agent SDK 与扩展（extensions）的示例代码。

## Directories 目录

### [sdk/](sdk/)
Programmatic usage via `createAgentSession()`. Shows how to customize models, prompts, tools, extensions, and session management.
通过 `createAgentSession()` 进行编程式调用。演示如何自定义模型、提示词（prompt）、工具、扩展以及会话（session）管理。

### [extensions/](extensions/)
Example extensions demonstrating:
示例扩展，演示了：
- Lifecycle event handlers (tool interception, safety gates, context modifications)
  生命周期事件处理器（工具拦截、安全门禁、上下文修改）
- Custom tools (todo lists, questions, subagents, output truncation)
  自定义工具（待办列表、提问、子 Agent、输出截断）
- Commands and keyboard shortcuts
  命令与键盘快捷键
- Custom UI (footers, headers, editors, overlays)
  自定义 UI（页脚、页眉、编辑器、浮层）
- Git integration (checkpoints, auto-commit)
  Git 集成（检查点、自动提交）
- System prompt modifications and custom compaction
  系统提示词修改与自定义压缩（compaction）
- External integrations (SSH, file watchers, system theme sync)
  外部集成（SSH、文件监听器、系统主题同步）
- Custom providers (Anthropic with custom streaming, GitLab Duo)
  自定义 provider（带自定义流式输出的 Anthropic、GitLab Duo）

## Documentation 文档

- [SDK Reference](sdk/README.md)
  [SDK 参考](sdk/README.md)
- [Extensions Documentation](../docs/extensions.md)
  [扩展文档](../docs/extensions.md)
- [Skills Documentation](../docs/skills.md)
  [Skills 文档](../docs/skills.md)
