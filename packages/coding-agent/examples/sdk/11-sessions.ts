/**
 * Session Management
 * 会话（Session）管理
 *
 * Control session persistence: in-memory, new file, continue, or open specific.
 * 控制会话的持久化方式：仅存于内存、新建文件、继续上一次会话，或打开指定会话。
 */

import { createAgentSession, SessionManager } from "@earendil-works/pi-coding-agent";

// In-memory (no persistence)
// 仅存于内存（不做持久化）
const { session: inMemory } = await createAgentSession({
	sessionManager: SessionManager.inMemory(),
});
console.log("In-memory session:", inMemory.sessionFile ?? "(none)");
inMemory.dispose();

// New persistent session
// 新建持久化会话
const { session: newSession } = await createAgentSession({
	sessionManager: SessionManager.create(process.cwd()),
});
console.log("New session file:", newSession.sessionFile);
newSession.dispose();

// Continue most recent session (or create new if none)
// 继续最近一次的会话（若不存在则新建）
const { session: continued, modelFallbackMessage } = await createAgentSession({
	sessionManager: SessionManager.continueRecent(process.cwd()),
});
if (modelFallbackMessage) console.log("Note:", modelFallbackMessage);
console.log("Continued session:", continued.sessionFile);
continued.dispose();

// List and open specific session
// 列出会话并打开指定会话
const sessions = await SessionManager.list(process.cwd());
console.log(`\nFound ${sessions.length} sessions:`);
for (const info of sessions.slice(0, 3)) {
	console.log(`  ${info.id.slice(0, 8)}... - "${info.firstMessage.slice(0, 30)}..."`);
}

if (sessions.length > 0) {
	const { session: opened } = await createAgentSession({
		sessionManager: SessionManager.open(sessions[0].path),
	});
	console.log(`\nOpened: ${opened.sessionId}`);
	opened.dispose();
}

// Custom session directory (no cwd encoding)
// 自定义会话目录（不对 cwd 进行编码）
// const customDir = "/path/to/my-sessions";
// const { session } = await createAgentSession({
//   sessionManager: SessionManager.create(process.cwd(), customDir),
// });
// SessionManager.list(process.cwd(), customDir);
// SessionManager.continueRecent(process.cwd(), customDir);
