import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

describe("export HTML skill block rendering", () => {
	const templateJs = readFileSync(new URL("../src/core/export-html/template.js", import.meta.url), "utf-8");

	it("strips skill wrapper XML from user message rendering", () => {
		// Skill commands store a structural wrapper in the raw user message:
		// 技能（skill）命令会在原始用户消息中存入一层结构化包装：
		//   <skill name="..." location="...">\n...\n</skill>\n\nactual prompt
		// The export renderer must detect that wrapper and render only the user-visible prompt,
		// not the Pi-generated <skill>...</skill> XML tags.
		// 导出渲染器必须识别出该包装，并且只渲染用户可见的提示词，
		// 而不渲染由 Pi 生成的 <skill>...</skill> XML 标签。
		expect(templateJs).toMatch(/parseSkillBlock/);
		expect(templateJs).toMatch(/skillBlock\.userMessage/);
	});

	it("renders skill invocation and user message as separate sibling blocks", () => {
		// The skill block and user message should render as separate entry-level elements,
		// matching the TUI layout where SkillInvocationMessageComponent and
		// UserMessageComponent are siblings, not nested.
		// 技能块与用户消息应渲染为各自独立的条目级元素，
		// 与 TUI 中的布局保持一致：SkillInvocationMessageComponent 与
		// UserMessageComponent 是兄弟关系，而非嵌套关系。
		expect(templateJs).toMatch(/skill-invocation/);

		// When a skill block has a userMessage, the user-message div must be emitted
		// as a separate block after the skill-invocation div, containing the user-authored text.
		// 当技能块带有 userMessage 时，必须在 skill-invocation div 之后
		// 单独输出一个 user-message div，其中包含用户撰写的文本。
		// Verify the code checks hasUserContent so the user-message div is only omitted
		// when the skill block has no user prompt and no images.
		// 验证代码会检查 hasUserContent，从而仅在技能块既无用户提示词也无图片时
		// 才省略 user-message div。
		expect(templateJs).toMatch(/hasUserContent/);
	});

	it("renders skill content as markdown, not raw text", () => {
		// The skill block body is markdown (from the SKILL.md file).
		// 技能块的正文是 markdown（来自 SKILL.md 文件）。
		// It should be rendered through safeMarkedParse, not escaped as raw text.
		// 它应当通过 safeMarkedParse 进行渲染，而不是作为原始文本被转义。
		expect(templateJs).toMatch(/safeMarkedParse\(skillBlock\.content\)/);
	});

	it("shows skill name and user message in the sidebar tree", () => {
		// The sidebar tree should display both the skill name and the user prompt,
		// not just one or the other.
		// 侧边栏树应同时展示技能名称和用户提示词，而不是只显示其中之一。
		expect(templateJs).toMatch(/tree-role-skill/);
	});
});
