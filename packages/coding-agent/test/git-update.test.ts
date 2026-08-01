/**
 * Tests for git-based extension updates, specifically handling force-push scenarios.
 * 针对基于 git 的扩展(extension)更新的测试，重点覆盖强制推送(force-push)场景的处理。
 *
 * These tests verify that DefaultPackageManager.update() handles:
 * 这些测试用于验证 DefaultPackageManager.update() 能够处理：
 * - Normal git updates (no force-push)
 *   常规的 git 更新(不涉及强制推送)
 * - Force-pushed remotes gracefully (currently fails, fix needed)
 *   优雅地处理被强制推送过的远端仓库(目前会失败，需要修复)
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DefaultPackageManager } from "../src/core/package-manager.ts";
import { SettingsManager } from "../src/core/settings-manager.ts";
import { allowNetwork } from "./test-network-env.ts";

// Helper to run git commands in a directory
// 用于在指定目录下执行 git 命令的辅助函数
function git(args: string[], cwd: string): string {
	const result = spawnSync("git", args, {
		cwd,
		encoding: "utf-8",
	});
	if (result.status !== 0) {
		throw new Error(`Command failed: git ${args.join(" ")}\n${result.stderr}`);
	}
	return result.stdout.trim();
}

function initGitRepo(repoDir: string): void {
	git(["init", "--initial-branch=main"], repoDir);
	git(["config", "--local", "user.email", "test@test.com"], repoDir);
	git(["config", "--local", "user.name", "Test"], repoDir);
}

// Helper to create a commit with a file
// 用于创建一次包含指定文件的提交(commit)的辅助函数
function createCommit(repoDir: string, filename: string, content: string, message: string): string {
	writeFileSync(join(repoDir, filename), content);
	git(["add", filename], repoDir);
	git(["commit", "-m", message], repoDir);
	return git(["rev-parse", "HEAD"], repoDir);
}

// Helper to get current commit hash
// 用于获取当前提交(commit)哈希值的辅助函数
function getCurrentCommit(repoDir: string): string {
	return git(["rev-parse", "HEAD"], repoDir);
}

// Helper to get file content
// 用于读取文件内容的辅助函数
function getFileContent(repoDir: string, filename: string): string {
	return readFileSync(join(repoDir, filename), "utf-8");
}

type GitSourceForTest = {
	type: "git";
	repo: string;
	host: string;
	path: string;
	pinned: boolean;
	ref?: string;
};

interface PackageManagerPathInternals {
	parseSource(source: string): GitSourceForTest;
	getGitInstallPath(source: GitSourceForTest, scope: "temporary"): string;
}

describe("DefaultPackageManager git update", () => {
	let tempDir: string;
	let remoteDir: string; // Simulates the "remote" repository 用于模拟“远端”仓库
	let agentDir: string; // The agent directory where extensions are installed 安装扩展所用的 agent 目录
	let installedDir: string; // The installed extension directory 已安装扩展所在的目录
	let settingsManager: SettingsManager;
	let packageManager: DefaultPackageManager;

	// Git source that maps to our installed directory structure.
	// 与我们的安装目录结构相对应的 git 源(source)。
	// Must use "git:" prefix so parseSource() treats it as a git source
	// 必须带上 "git:" 前缀，parseSource() 才会将其识别为 git 源
	// (bare "github.com/..." is not recognized as a git URL).
	// (裸写的 "github.com/..." 不会被识别为 git URL)。
	const gitSource = "git:github.com/test/extension";

	beforeEach(() => {
		allowNetwork();
		tempDir = join(tmpdir(), `git-update-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
		mkdirSync(tempDir, { recursive: true });
		remoteDir = join(tempDir, "remote");
		agentDir = join(tempDir, "agent");

		// This matches the path structure: agentDir/git/<host>/<path>
		// 这里与如下路径结构保持一致：agentDir/git/<host>/<path>
		installedDir = join(agentDir, "git", "github.com", "test", "extension");

		mkdirSync(agentDir, { recursive: true });

		settingsManager = SettingsManager.inMemory();
		packageManager = new DefaultPackageManager({
			cwd: tempDir,
			agentDir,
			settingsManager,
		});
	});

	afterEach(() => {
		if (tempDir && existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true, force: true });
		}
	});

	/**
	 * Sets up a "remote" repository and clones it to the installed directory.
	 * 创建一个“远端”仓库，并将其克隆到安装目录。
	 * This simulates what packageManager.install() would do.
	 * 以此模拟 packageManager.install() 所执行的操作。
	 * @param sourceOverride Optional source string to use instead of gitSource (e.g., with @ref for pinned tests)
	 *                       可选的源字符串，用于替代 gitSource(例如在固定版本(pinned)测试中带上 @ref)
	 */
	function setupRemoteAndInstall(sourceOverride?: string): void {
		// Create "remote" repository
		// 创建“远端”仓库
		mkdirSync(remoteDir, { recursive: true });
		initGitRepo(remoteDir);
		createCommit(remoteDir, "extension.ts", "// v1", "Initial commit");

		// Clone to installed directory (simulating what install() does)
		// 克隆到安装目录(模拟 install() 的行为)
		mkdirSync(join(agentDir, "git", "github.com", "test"), { recursive: true });
		git(["clone", remoteDir, installedDir], tempDir);
		git(["config", "--local", "user.email", "test@test.com"], installedDir);
		git(["config", "--local", "user.name", "Test"], installedDir);

		// Add to global packages so update() processes this source
		// 将其加入全局包列表，使 update() 会处理该源
		settingsManager.setPackages([sourceOverride ?? gitSource]);
	}

	describe("normal updates (no force-push)", () => {
		it("should skip reset, clean, and install when already up to date", async () => {
			mkdirSync(remoteDir, { recursive: true });
			initGitRepo(remoteDir);
			writeFileSync(join(remoteDir, "package.json"), JSON.stringify({ name: "test-extension", version: "1.0.0" }));
			createCommit(remoteDir, "extension.ts", "// v1", "Initial commit");

			mkdirSync(join(agentDir, "git", "github.com", "test"), { recursive: true });
			git(["clone", remoteDir, installedDir], tempDir);
			settingsManager.setPackages([gitSource]);

			const executedCommands: string[] = [];
			const managerWithInternals = packageManager as unknown as {
				runCommand: (command: string, args: string[], options?: { cwd?: string }) => Promise<void>;
			};
			managerWithInternals.runCommand = async (command, args, options) => {
				executedCommands.push(`${command} ${args.join(" ")}`);
				if (command === "npm") {
					return;
				}
				const result = spawnSync(command, args, {
					cwd: options?.cwd,
					encoding: "utf-8",
				});
				if (result.status !== 0) {
					throw new Error(`Command failed: ${command} ${args.join(" ")}\n${result.stderr}`);
				}
			};

			await packageManager.update();

			expect(executedCommands).toContain(
				"git fetch --prune --no-tags origin +refs/heads/main:refs/remotes/origin/main",
			);
			expect(executedCommands).not.toContain("git fetch --prune origin");
			expect(executedCommands).not.toContain("git reset --hard @{upstream}");
			expect(executedCommands).not.toContain("git reset --hard origin/HEAD");
			expect(executedCommands).not.toContain("git clean -fdx");
			expect(executedCommands).not.toContain("npm install");
		});

		it("should update to latest commit when remote has new commits", async () => {
			setupRemoteAndInstall();
			expect(getFileContent(installedDir, "extension.ts")).toBe("// v1");

			// Add a new commit to remote
			// 在远端仓库上新增一次提交
			const newCommit = createCommit(remoteDir, "extension.ts", "// v2", "Second commit");

			// Update via package manager (no args = uses settings)
			// 通过包管理器执行更新(不传参数 = 使用配置中的设置)
			await packageManager.update();

			// Verify update succeeded
			// 校验更新已成功
			expect(getCurrentCommit(installedDir)).toBe(newCommit);
			expect(getFileContent(installedDir, "extension.ts")).toBe("// v2");
		});

		it("should handle multiple commits ahead", async () => {
			setupRemoteAndInstall();

			// Add multiple commits to remote
			// 在远端仓库上新增多次提交
			createCommit(remoteDir, "extension.ts", "// v2", "Second commit");
			createCommit(remoteDir, "extension.ts", "// v3", "Third commit");
			const latestCommit = createCommit(remoteDir, "extension.ts", "// v4", "Fourth commit");

			await packageManager.update();

			expect(getCurrentCommit(installedDir)).toBe(latestCommit);
			expect(getFileContent(installedDir, "extension.ts")).toBe("// v4");
		});

		it("should update even when local checkout has no upstream", async () => {
			setupRemoteAndInstall();
			createCommit(remoteDir, "extension.ts", "// v2", "Second commit");
			const latestCommit = createCommit(remoteDir, "extension.ts", "// v3", "Third commit");

			const detachedCommit = getCurrentCommit(installedDir);
			git(["checkout", detachedCommit], installedDir);

			const executedCommands: string[] = [];
			const managerWithInternals = packageManager as unknown as {
				runCommand: (command: string, args: string[], options?: { cwd?: string }) => Promise<void>;
			};
			managerWithInternals.runCommand = async (command, args, options) => {
				executedCommands.push(`${command} ${args.join(" ")}`);
				const result = spawnSync(command, args, {
					cwd: options?.cwd,
					encoding: "utf-8",
				});
				if (result.status !== 0) {
					throw new Error(`Command failed: ${command} ${args.join(" ")}\n${result.stderr}`);
				}
			};

			await packageManager.update();

			expect(executedCommands).toContain(
				"git fetch --prune --no-tags origin +refs/heads/main:refs/remotes/origin/main",
			);
			expect(getCurrentCommit(installedDir)).toBe(latestCommit);
			expect(getFileContent(installedDir, "extension.ts")).toBe("// v3");
		});
	});

	describe("force-push scenarios", () => {
		it("should recover when remote history is rewritten", async () => {
			setupRemoteAndInstall();
			const initialCommit = getCurrentCommit(remoteDir);

			// Add commit to remote
			// 在远端仓库上新增一次提交
			createCommit(remoteDir, "extension.ts", "// v2", "Commit to keep");

			// Update to get the new commit
			// 执行更新以拉取该新提交
			await packageManager.update();
			expect(getFileContent(installedDir, "extension.ts")).toBe("// v2");

			// Now force-push to rewrite history on remote
			// 现在通过强制推送重写远端仓库的历史
			git(["reset", "--hard", initialCommit], remoteDir);
			const rewrittenCommit = createCommit(remoteDir, "extension.ts", "// v2-rewritten", "Rewritten commit");

			// Update should succeed despite force-push
			// 即便发生了强制推送，更新也应当成功
			await packageManager.update();

			expect(getCurrentCommit(installedDir)).toBe(rewrittenCommit);
			expect(getFileContent(installedDir, "extension.ts")).toBe("// v2-rewritten");
		});

		it("should recover when local commit no longer exists in remote", async () => {
			setupRemoteAndInstall();

			// Add commits to remote
			// 在远端仓库上新增若干提交
			createCommit(remoteDir, "extension.ts", "// v2", "Commit A");
			createCommit(remoteDir, "extension.ts", "// v3", "Commit B");

			// Update to get all commits
			// 执行更新以拉取全部提交
			await packageManager.update();
			expect(getFileContent(installedDir, "extension.ts")).toBe("// v3");

			// Force-push remote to remove commits A and B
			// 对远端仓库执行强制推送，移除提交 A 和 B
			git(["reset", "--hard", "HEAD~2"], remoteDir);
			const newCommit = createCommit(remoteDir, "extension.ts", "// v2-new", "New commit replacing A and B");

			// Update should succeed - the commits we had locally no longer exist
			// 更新应当成功 —— 此时本地原有的那些提交在远端已不复存在
			await packageManager.update();

			expect(getCurrentCommit(installedDir)).toBe(newCommit);
			expect(getFileContent(installedDir, "extension.ts")).toBe("// v2-new");
		});

		it("should handle complete history rewrite", async () => {
			setupRemoteAndInstall();

			// Remote gets several commits
			// 远端仓库新增了若干提交
			createCommit(remoteDir, "extension.ts", "// v2", "v2");
			createCommit(remoteDir, "extension.ts", "// v3", "v3");

			await packageManager.update();
			expect(getFileContent(installedDir, "extension.ts")).toBe("// v3");

			// Maintainer force-pushes completely different history
			// 维护者强制推送了一段完全不同的历史
			git(["reset", "--hard", "HEAD~2"], remoteDir);
			createCommit(remoteDir, "extension.ts", "// rewrite-a", "Rewrite A");
			const finalCommit = createCommit(remoteDir, "extension.ts", "// rewrite-b", "Rewrite B");

			// Should handle this gracefully
			// 应当能够优雅地处理这种情况
			await packageManager.update();

			expect(getCurrentCommit(installedDir)).toBe(finalCommit);
			expect(getFileContent(installedDir, "extension.ts")).toBe("// rewrite-b");
		});
	});

	describe("pinned sources", () => {
		it("should not move pinned git sources past their configured ref", async () => {
			// Create remote repo first to get the initial commit
			// 先创建远端仓库，以便获得初始提交
			mkdirSync(remoteDir, { recursive: true });
			initGitRepo(remoteDir);
			const initialCommit = createCommit(remoteDir, "extension.ts", "// v1", "Initial commit");

			// Install with pinned ref from the start - full clone to ensure commit is available
			// 一开始就以固定 ref(pinned ref)的方式安装 —— 采用完整克隆以确保该提交可用
			mkdirSync(join(agentDir, "git", "github.com", "test"), { recursive: true });
			git(["clone", remoteDir, installedDir], tempDir);
			git(["checkout", initialCommit], installedDir);
			git(["config", "--local", "user.email", "test@test.com"], installedDir);
			git(["config", "--local", "user.name", "Test"], installedDir);

			// Add to global packages with pinned ref
			// 以带固定 ref 的形式加入全局包列表
			settingsManager.setPackages([`${gitSource}@${initialCommit}`]);

			// Add new commit to remote
			// 在远端仓库上新增一次提交
			createCommit(remoteDir, "extension.ts", "// v2", "Second commit");

			await packageManager.update();

			// Should still be on initial commit
			// 应当仍然停留在初始提交上
			expect(getCurrentCommit(installedDir)).toBe(initialCommit);
			expect(getFileContent(installedDir, "extension.ts")).toBe("// v1");
		});

		it("should checkout the configured pinned git ref during full and targeted updates", async () => {
			mkdirSync(remoteDir, { recursive: true });
			initGitRepo(remoteDir);
			const v1Commit = createCommit(remoteDir, "extension.ts", "// v1", "Initial commit");
			git(["tag", "v1"], remoteDir);
			const v2Commit = createCommit(remoteDir, "extension.ts", "// v2", "Second commit");
			git(["tag", "v2"], remoteDir);

			mkdirSync(join(agentDir, "git", "github.com", "test"), { recursive: true });
			git(["clone", remoteDir, installedDir], tempDir);
			git(["checkout", "v1"], installedDir);
			expect(getCurrentCommit(installedDir)).toBe(v1Commit);

			const pinnedSource = `${gitSource}@v2`;
			settingsManager.setPackages([pinnedSource]);

			await packageManager.update();

			expect(getCurrentCommit(installedDir)).toBe(v2Commit);
			expect(getFileContent(installedDir, "extension.ts")).toBe("// v2");

			git(["checkout", "v1"], installedDir);

			await packageManager.update(pinnedSource);

			expect(getCurrentCommit(installedDir)).toBe(v2Commit);
			expect(getFileContent(installedDir, "extension.ts")).toBe("// v2");
		});

		it("should not reset an annotated tag checkout that already matches the configured ref", async () => {
			mkdirSync(remoteDir, { recursive: true });
			initGitRepo(remoteDir);
			const taggedCommit = createCommit(remoteDir, "extension.ts", "// v1", "Initial commit");
			git(["tag", "-a", "v1", "-m", "v1"], remoteDir);

			mkdirSync(join(agentDir, "git", "github.com", "test"), { recursive: true });
			git(["clone", remoteDir, installedDir], tempDir);
			git(["checkout", "v1"], installedDir);
			expect(getCurrentCommit(installedDir)).toBe(taggedCommit);

			settingsManager.setPackages([`${gitSource}@v1`]);

			const executedCommands: string[] = [];
			const managerWithInternals = packageManager as unknown as {
				runCommand: (command: string, args: string[], options?: { cwd?: string }) => Promise<void>;
			};
			managerWithInternals.runCommand = async (command, args, options) => {
				executedCommands.push(`${command} ${args.join(" ")}`);
				const result = spawnSync(command, args, {
					cwd: options?.cwd,
					encoding: "utf-8",
				});
				if (result.status !== 0) {
					throw new Error(`Command failed: ${command} ${args.join(" ")}\n${result.stderr}`);
				}
			};

			await packageManager.update();

			expect(executedCommands).toContain("git fetch origin v1");
			expect(executedCommands.some((command) => command.startsWith("git reset --hard"))).toBe(false);
			expect(executedCommands).not.toContain("git clean -fdx");
			expect(getCurrentCommit(installedDir)).toBe(taggedCommit);
		});
	});

	describe("temporary git sources", () => {
		it("should refresh cached temporary git sources when resolving", async () => {
			const managerWithPaths = packageManager as unknown as PackageManagerPathInternals;
			const cachedDir = managerWithPaths.getGitInstallPath(managerWithPaths.parseSource(gitSource), "temporary");
			const extensionFile = join(cachedDir, "pi-extensions", "session-breakdown.ts");

			rmSync(cachedDir, { recursive: true, force: true });
			mkdirSync(join(cachedDir, "pi-extensions"), { recursive: true });
			writeFileSync(
				join(cachedDir, "package.json"),
				JSON.stringify({ pi: { extensions: ["./pi-extensions"] } }, null, 2),
			);
			writeFileSync(extensionFile, "// stale");

			const executedCommands: string[] = [];
			const managerWithInternals = packageManager as unknown as {
				runCommand: (command: string, args: string[], options?: { cwd?: string }) => Promise<void>;
				runCommandCapture: (command: string, args: string[], options?: { cwd?: string }) => Promise<string>;
			};
			managerWithInternals.runCommand = async (command, args) => {
				executedCommands.push(`${command} ${args.join(" ")}`);
				if (command === "git" && args[0] === "reset") {
					writeFileSync(extensionFile, "// fresh");
				}
			};
			managerWithInternals.runCommandCapture = async (_command, args) => {
				if (args[0] === "rev-parse" && args[1] === "HEAD") {
					return "local-head";
				}
				if (args[0] === "rev-parse" && args[1] === "@{upstream}") {
					return "remote-head";
				}
				if (args[0] === "rev-parse" && args[1] === "--abbrev-ref") {
					return "origin/main";
				}
				return "";
			};

			await packageManager.resolveExtensionSources([gitSource], { temporary: true });

			expect(executedCommands).toContain(
				"git fetch --prune --no-tags origin +refs/heads/main:refs/remotes/origin/main",
			);
			expect(getFileContent(cachedDir, "pi-extensions/session-breakdown.ts")).toBe("// fresh");
		});

		it("should not refresh pinned temporary git sources", async () => {
			const managerWithPaths = packageManager as unknown as PackageManagerPathInternals;
			const cachedDir = managerWithPaths.getGitInstallPath(managerWithPaths.parseSource(gitSource), "temporary");
			const extensionFile = join(cachedDir, "pi-extensions", "session-breakdown.ts");

			rmSync(cachedDir, { recursive: true, force: true });
			mkdirSync(join(cachedDir, "pi-extensions"), { recursive: true });
			writeFileSync(
				join(cachedDir, "package.json"),
				JSON.stringify({ pi: { extensions: ["./pi-extensions"] } }, null, 2),
			);
			writeFileSync(extensionFile, "// pinned");

			const executedCommands: string[] = [];
			const managerWithInternals = packageManager as unknown as {
				runCommand: (command: string, args: string[], options?: { cwd?: string }) => Promise<void>;
			};
			managerWithInternals.runCommand = async (command, args) => {
				executedCommands.push(`${command} ${args.join(" ")}`);
			};

			await packageManager.resolveExtensionSources([`${gitSource}@main`], { temporary: true });

			expect(executedCommands).toEqual([]);
			expect(getFileContent(cachedDir, "pi-extensions/session-breakdown.ts")).toBe("// pinned");
		});
	});

	describe("scope-aware update", () => {
		it("should not install locally when source is only registered globally", async () => {
			setupRemoteAndInstall();

			// Add a new commit to remote
			// 在远端仓库上新增一次提交
			createCommit(remoteDir, "extension.ts", "// v2", "Second commit");

			// The project-scope install path should not exist before or after update
			// 项目级(project scope)安装路径在更新前后都不应存在
			const projectGitDir = join(tempDir, ".pi", "git", "github.com", "test", "extension");
			expect(existsSync(projectGitDir)).toBe(false);

			await packageManager.update(gitSource);

			// Global install should be updated
			// 全局安装的副本应当已被更新
			expect(getFileContent(installedDir, "extension.ts")).toBe("// v2");

			// Project-scope directory should NOT have been created
			// 项目级目录不应被创建
			expect(existsSync(projectGitDir)).toBe(false);
		});
	});
});
