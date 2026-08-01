import { setKeybindings, type TUI } from "@earendil-works/pi-tui";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { KeybindingsManager } from "../../../src/core/keybindings.ts";
import { ModelSelectorComponent } from "../../../src/modes/interactive/components/model-selector.ts";
import { initTheme } from "../../../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../../../src/utils/ansi.ts";
import { createHarness, type Harness } from "../harness.ts";

function createFakeTui(): TUI {
	return { requestRender: () => {} } as unknown as TUI;
}

/**
 * Return the model id of the highlighted (→) row in the rendered selector.
 * 返回渲染后的选择器中高亮行(→)对应的模型 id。
 */
function selectedModelId(rendered: string): string | undefined {
	const line = rendered.split("\n").find((l) => l.startsWith("→ "));
	if (!line) return undefined;
	const rest = line.replace(/^→\s*/, "");
	const id = rest.split(" [")[0];
	return id?.trim() || undefined;
}

describe("model selector filter resets selection to top", () => {
	const harnesses: Harness[] = [];

	beforeAll(() => {
		initTheme("dark");
	});

	beforeEach(() => {
		setKeybindings(new KeybindingsManager());
	});

	afterAll(() => {
		while (harnesses.length > 0) {
			harnesses.pop()?.cleanup();
		}
	});

	it("moves selection to the first row in the All tab when typing a query", async () => {
		const harness = await createHarness({
			models: [
				{ id: "alpha-1", name: "Alpha One", reasoning: true },
				{ id: "alpha-2", name: "Alpha Two", reasoning: true },
				{ id: "alpha-3", name: "Alpha Three", reasoning: true },
				{ id: "beta-1", name: "Beta One", reasoning: true },
			],
		});
		harnesses.push(harness);

		const current = harness.getModel("alpha-1")!;
		const selector = new ModelSelectorComponent(
			createFakeTui(),
			current,
			harness.settingsManager,
			harness.session.modelRuntime,
			[],
			() => {},
			() => {},
		);

		await vi.waitFor(() => {
			const rendered = stripAnsi(selector.render(120).join("\n"));
			expect(rendered).toContain("Model catalogs refreshed.");
		});

		// Current model (alpha-1) is sorted first, so selection starts on row 0.
		// 当前模型(alpha-1)排在首位,因此选中项从第 0 行开始。
		expect(selectedModelId(stripAnsi(selector.render(120).join("\n")))).toBe("alpha-1");

		// Move selection down two rows to alpha-3.
		// 将选中项下移两行至 alpha-3。
		selector.handleInput("\x1b[B");
		selector.handleInput("\x1b[B");
		expect(selectedModelId(stripAnsi(selector.render(120).join("\n")))).toBe("alpha-3");

		// Type a query that matches the three alpha models. The selection must
		// move back to the top row (alpha-1), not stay clamped at index 2.
		// 输入一个能匹配三个 alpha 模型的查询。选中项必须回到首行(alpha-1),
		// 而不是被钳制(clamp)在索引 2 上。
		for (const char of "alpha") {
			selector.handleInput(char);
		}

		const rendered = stripAnsi(selector.render(120).join("\n"));
		expect(selectedModelId(rendered)).toBe("alpha-1");
		// Sanity: the filter actually narrowed the list.
		// 完整性检查:过滤确实缩小了列表范围。
		expect(rendered).not.toContain("beta-1");
	});

	it("moves selection to the first row in the Scoped tab when typing a query", async () => {
		const harness = await createHarness({
			models: [
				{ id: "alpha-1", name: "Alpha One", reasoning: true },
				{ id: "alpha-2", name: "Alpha Two", reasoning: true },
				{ id: "alpha-3", name: "Alpha Three", reasoning: true },
			],
		});
		harnesses.push(harness);

		const alpha1 = harness.getModel("alpha-1")!;
		const alpha2 = harness.getModel("alpha-2")!;
		const alpha3 = harness.getModel("alpha-3")!;

		// Scoped list is intentionally not in current-model-first order; the
		// current model (alpha-1) sits at index 2.
		// scoped 列表刻意未按"当前模型优先"排序;当前模型(alpha-1)位于索引 2。
		const selector = new ModelSelectorComponent(
			createFakeTui(),
			alpha1,
			harness.settingsManager,
			harness.session.modelRuntime,
			[{ model: alpha2 }, { model: alpha3 }, { model: alpha1 }],
			() => {},
			() => {},
		);

		await vi.waitFor(() => {
			const rendered = stripAnsi(selector.render(120).join("\n"));
			expect(rendered).toContain("Model catalogs refreshed.");
		});

		// Selection starts on the current model (alpha-1), which is row 2 here.
		// 选中项从当前模型(alpha-1)开始,此处即第 2 行。
		expect(selectedModelId(stripAnsi(selector.render(120).join("\n")))).toBe("alpha-1");

		// Type a query matching all three scoped models. Selection must move to
		// the top row (alpha-2), not stay clamped at index 2 (alpha-1).
		// 输入一个能匹配全部三个 scoped 模型的查询。选中项必须移动到首行(alpha-2),
		// 而不是被钳制(clamp)在索引 2(alpha-1)上。
		for (const char of "alpha") {
			selector.handleInput(char);
		}

		expect(selectedModelId(stripAnsi(selector.render(120).join("\n")))).toBe("alpha-2");
	});
});
