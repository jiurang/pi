import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SettingsManager } from "../src/core/settings-manager.ts";

/**
 * Tests for the fix to a bug where external file changes to arrays were overwritten.
 * 针对某个缺陷修复的测试：该缺陷会导致外部对文件中数组所做的修改被覆盖。
 *
 * The bug scenario was:
 * 该缺陷的场景如下：
 * 1. Pi starts with settings.json containing packages: ["npm:some-pkg"]
 *    Pi 启动时，settings.json 中包含 packages: ["npm:some-pkg"]
 * 2. User externally edits file to packages: []
 *    用户在外部将文件编辑为 packages: []
 * 3. User changes an unrelated setting (e.g., theme) via UI
 *    用户通过 UI 更改一项无关的设置（例如主题）
 * 4. save() would overwrite packages back to ["npm:some-pkg"] from stale in-memory state
 *    save() 会依据过期的内存状态，把 packages 覆盖回 ["npm:some-pkg"]
 *
 * The fix tracks which fields were explicitly modified during the session, and only
 * those fields override file values during save().
 * 修复方案会跟踪会话期间被显式修改过的字段，并且在 save() 时只有这些字段才会覆盖文件中的值。
 */
describe("SettingsManager - External Edit Preservation", () => {
	const testDir = join(process.cwd(), "test-settings-bug-tmp");
	const agentDir = join(testDir, "agent");
	const projectDir = join(testDir, "project");

	beforeEach(() => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
		mkdirSync(agentDir, { recursive: true });
		mkdirSync(join(projectDir, ".pi"), { recursive: true });
	});

	afterEach(() => {
		if (existsSync(testDir)) {
			rmSync(testDir, { recursive: true });
		}
	});

	it("should preserve file changes to packages array when changing unrelated setting", async () => {
		const settingsPath = join(agentDir, "settings.json");

		// Initial state: packages has one item
		// 初始状态：packages 中有一个条目
		writeFileSync(
			settingsPath,
			JSON.stringify({
				theme: "dark",
				packages: ["npm:pi-mcp-adapter"],
			}),
		);

		// Pi starts up, loads settings into memory
		// Pi 启动，将设置加载到内存中
		const manager = SettingsManager.create(projectDir, agentDir);

		// At this point, globalSettings.packages = ["npm:pi-mcp-adapter"]
		// 此时，globalSettings.packages = ["npm:pi-mcp-adapter"]
		expect(manager.getPackages()).toEqual(["npm:pi-mcp-adapter"]);

		// User externally edits settings.json to remove the package
		// 用户在外部编辑 settings.json 以移除该扩展包
		const currentSettings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		currentSettings.packages = []; // User wants to remove this! / 用户想要移除它！
		writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 2));

		// Verify file was changed
		// 验证文件已被修改
		expect(JSON.parse(readFileSync(settingsPath, "utf-8")).packages).toEqual([]);

		// User changes an UNRELATED setting via UI (this triggers save)
		// 用户通过 UI 更改一项无关（UNRELATED）的设置（此举会触发保存）
		manager.setTheme("light");
		await manager.flush();

		// With the fix, packages should be preserved as [] (not reverted to startup value)
		// 应用修复后，packages 应保持为 []（而不是回退为启动时的值）
		const savedSettings = JSON.parse(readFileSync(settingsPath, "utf-8"));

		expect(savedSettings.packages).toEqual([]);
		expect(savedSettings.theme).toBe("light");
	});

	it("should preserve file changes to extensions array when changing unrelated setting", async () => {
		const settingsPath = join(agentDir, "settings.json");

		writeFileSync(
			settingsPath,
			JSON.stringify({
				theme: "dark",
				extensions: ["/old/extension.ts"],
			}),
		);

		const manager = SettingsManager.create(projectDir, agentDir);

		// User externally updates extensions
		// 用户在外部更新 extensions
		const currentSettings = JSON.parse(readFileSync(settingsPath, "utf-8"));
		currentSettings.extensions = ["/new/extension.ts"];
		writeFileSync(settingsPath, JSON.stringify(currentSettings, null, 2));

		// Change unrelated setting
		// 更改一项无关的设置
		manager.setDefaultThinkingLevel("high");
		await manager.flush();

		const savedSettings = JSON.parse(readFileSync(settingsPath, "utf-8"));

		// With the fix, extensions should be preserved (not reverted to startup value)
		// 应用修复后，extensions 应当被保留（而不是回退为启动时的值）
		expect(savedSettings.extensions).toEqual(["/new/extension.ts"]);
	});

	it("should preserve external project settings changes when updating unrelated project field", async () => {
		const projectSettingsPath = join(projectDir, ".pi", "settings.json");
		writeFileSync(
			projectSettingsPath,
			JSON.stringify({
				extensions: ["./old-extension.ts"],
				prompts: ["./old-prompt.md"],
			}),
		);

		const manager = SettingsManager.create(projectDir, agentDir);

		const currentProjectSettings = JSON.parse(readFileSync(projectSettingsPath, "utf-8"));
		currentProjectSettings.prompts = ["./new-prompt.md"];
		writeFileSync(projectSettingsPath, JSON.stringify(currentProjectSettings, null, 2));

		manager.setProjectExtensionPaths(["./updated-extension.ts"]);
		await manager.flush();

		const savedProjectSettings = JSON.parse(readFileSync(projectSettingsPath, "utf-8"));
		expect(savedProjectSettings.prompts).toEqual(["./new-prompt.md"]);
		expect(savedProjectSettings.extensions).toEqual(["./updated-extension.ts"]);
	});

	it("should let in-memory project changes override external changes for the same project field", async () => {
		const projectSettingsPath = join(projectDir, ".pi", "settings.json");
		writeFileSync(
			projectSettingsPath,
			JSON.stringify({
				extensions: ["./initial-extension.ts"],
			}),
		);

		const manager = SettingsManager.create(projectDir, agentDir);

		const currentProjectSettings = JSON.parse(readFileSync(projectSettingsPath, "utf-8"));
		currentProjectSettings.extensions = ["./external-extension.ts"];
		writeFileSync(projectSettingsPath, JSON.stringify(currentProjectSettings, null, 2));

		manager.setProjectExtensionPaths(["./in-memory-extension.ts"]);
		await manager.flush();

		const savedProjectSettings = JSON.parse(readFileSync(projectSettingsPath, "utf-8"));
		expect(savedProjectSettings.extensions).toEqual(["./in-memory-extension.ts"]);
	});
});
