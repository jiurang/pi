/**
 * Context Files (AGENTS.md)
 * 上下文文件(Context Files, AGENTS.md)
 *
 * Context files provide project-specific instructions loaded into the system prompt.
 * 上下文文件提供被加载进系统提示词的项目专属指令。
 */

import {
	createAgentSession,
	DefaultResourceLoader,
	getAgentDir,
	SessionManager,
} from "@earendil-works/pi-coding-agent";

// Disable context files entirely by returning an empty list in agentsFilesOverride.
// 若要完全禁用上下文文件，可在 agentsFilesOverride 中返回一个空列表。
const loader = new DefaultResourceLoader({
	cwd: process.cwd(),
	agentDir: getAgentDir(),
	agentsFilesOverride: (current) => ({
		agentsFiles: [
			...current.agentsFiles,
			{
				path: "/virtual/AGENTS.md",
				content: `# Project Guidelines

## Code Style
- Use TypeScript strict mode
- No any types
- Prefer const over let`,
			},
		],
	}),
});
await loader.reload();

// Discover AGENTS.md files walking up from cwd
// 从 cwd 开始逐级向上遍历，发现 AGENTS.md 文件
const discovered = loader.getAgentsFiles().agentsFiles;
console.log("Discovered context files:");
for (const file of discovered) {
	console.log(`  - ${file.path} (${file.content.length} chars)`);
}

const { session } = await createAgentSession({
	resourceLoader: loader,
	sessionManager: SessionManager.inMemory(),
});
console.log(`Session created with ${discovered.length + 1} context files`);
session.dispose();
