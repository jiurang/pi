/**
 * Settings Configuration
 * 设置配置
 *
 * Override settings using SettingsManager.
 * 使用 SettingsManager 覆盖设置。
 */

import { createAgentSession, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";

const cwd = process.cwd();

// Load current settings (merged global + project)
// 加载当前设置(合并全局 + 项目级配置)
const settingsManagerFromDisk = SettingsManager.create(cwd);
console.log("Current settings:", JSON.stringify(settingsManagerFromDisk.getGlobalSettings(), null, 2));

// Override specific settings
// 覆盖特定设置项
const settingsManager = SettingsManager.create(cwd);
settingsManager.applyOverrides({
	compaction: { enabled: false },
	retry: { enabled: true, maxRetries: 5, baseDelayMs: 1000 },
});

const { session: customSettingsSession } = await createAgentSession({
	settingsManager,
	sessionManager: SessionManager.inMemory(),
});
console.log("Session created with custom settings");
customSettingsSession.dispose();

// Setters update memory immediately and queue persistence writes.
// setter 会立即更新内存,并将持久化写入排入队列。
// Call flush() when you need a durability boundary.
// 当你需要一个持久化(durability)边界时,调用 flush()。
settingsManager.setDefaultThinkingLevel("low");
await settingsManager.flush();

// Surface settings I/O errors at the app layer.
// 在应用层暴露设置的 I/O 错误。
const settingsErrors = settingsManager.drainErrors();
if (settingsErrors.length > 0) {
	for (const { scope, error } of settingsErrors) {
		console.warn(`Warning (${scope} settings): ${error.message}`);
	}
}

// For testing without file I/O:
// 用于无文件 I/O 的测试场景:
const inMemorySettings = SettingsManager.inMemory({
	compaction: { enabled: false },
	retry: { enabled: false },
});

const { session: testSession } = await createAgentSession({
	settingsManager: inMemorySettings,
	sessionManager: SessionManager.inMemory(),
});
console.log("Test session created with in-memory settings");
testSession.dispose();
