import { Box, Markdown, type MarkdownTheme, Text } from "@earendil-works/pi-tui";
import type { ParsedSkillBlock } from "../../../core/agent-session.ts";
import { getMarkdownTheme, theme } from "../theme/theme.ts";
import { keyText } from "./keybinding-hints.ts";

/**
 * Component that renders a skill invocation message with collapsed/expanded state.
 * 用于渲染技能(skill)调用消息的组件，支持折叠/展开两种状态。
 * Uses same background color as custom messages for visual consistency.
 * 使用与自定义消息相同的背景色，以保持视觉一致性。
 * Only renders the skill block itself - user message is rendered separately.
 * 仅渲染技能块(skill block)本身 —— 用户消息由其他部分单独渲染。
 */
export class SkillInvocationMessageComponent extends Box {
	private expanded = false;
	private skillBlock: ParsedSkillBlock;
	private markdownTheme: MarkdownTheme;

	constructor(skillBlock: ParsedSkillBlock, markdownTheme: MarkdownTheme = getMarkdownTheme()) {
		super(1, 1, (t) => theme.bg("customMessageBg", t));
		this.skillBlock = skillBlock;
		this.markdownTheme = markdownTheme;
		this.updateDisplay();
	}

	setExpanded(expanded: boolean): void {
		this.expanded = expanded;
		this.updateDisplay();
	}

	override invalidate(): void {
		super.invalidate();
		this.updateDisplay();
	}

	private updateDisplay(): void {
		this.clear();

		if (this.expanded) {
			// Expanded: label + skill name header + full content
			// 展开态：标签 + 技能名称标题 + 完整内容
			const label = theme.fg("customMessageLabel", `\x1b[1m[skill]\x1b[22m`);
			this.addChild(new Text(label, 0, 0));
			const header = `**${this.skillBlock.name}**\n\n`;
			this.addChild(
				new Markdown(header + this.skillBlock.content, 0, 0, this.markdownTheme, {
					color: (text: string) => theme.fg("customMessageText", text),
				}),
			);
		} else {
			// Collapsed: single line - [skill] name (hint to expand)
			// 折叠态：单行显示 —— [skill] 名称（并附带展开提示）
			const line =
				theme.fg("customMessageLabel", `\x1b[1m[skill]\x1b[22m `) +
				theme.fg("customMessageText", this.skillBlock.name) +
				theme.fg("dim", ` (${keyText("app.tools.expand")} to expand)`);
			this.addChild(new Text(line, 0, 0));
		}
	}
}
