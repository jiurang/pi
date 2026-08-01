import { existsSync } from "node:fs";
import { delimiter } from "node:path";
import { spawn, spawnSync } from "child_process";
import { getBinDir } from "../config.ts";

export interface ShellConfig {
	shell: string;
	args: string[];
	commandTransport?: "argv" | "stdin";
}

/**
 * Find bash executable on PATH (cross-platform)
 * 在 PATH 中查找 bash 可执行文件（跨平台）
 */
function isLegacyWslBashPath(path: string): boolean {
	const normalized = path.replace(/\//g, "\\").toLowerCase();
	return /^[a-z]:\\windows\\(?:system32|sysnative)\\bash\.exe$/.test(normalized);
}

function getBashShellConfig(shell: string): ShellConfig {
	return isLegacyWslBashPath(shell) ? { shell, args: ["-s"], commandTransport: "stdin" } : { shell, args: ["-c"] };
}

function findBashOnPath(): string | null {
	if (process.platform === "win32") {
		// Windows: Use 'where' and verify file exists (where can return non-existent paths)
		// Windows：使用 'where' 命令并验证文件确实存在（where 可能返回并不存在的路径）
		try {
			const result = spawnSync("where", ["bash.exe"], {
				encoding: "utf-8",
				timeout: 5000,
				windowsHide: true,
			});
			if (result.status === 0 && result.stdout) {
				const firstMatch = result.stdout.trim().split(/\r?\n/)[0];
				if (firstMatch && existsSync(firstMatch)) {
					return firstMatch;
				}
			}
		} catch {
			// Ignore errors
			// 忽略错误
		}
		return null;
	}

	// Unix: Use 'which' and trust its output (handles Termux and special filesystems)
	// Unix：使用 'which' 命令并信任其输出（可兼容 Termux 及特殊文件系统）
	try {
		const result = spawnSync("which", ["bash"], { encoding: "utf-8", timeout: 5000 });
		if (result.status === 0 && result.stdout) {
			const firstMatch = result.stdout.trim().split(/\r?\n/)[0];
			if (firstMatch) {
				return firstMatch;
			}
		}
	} catch {
		// Ignore errors
		// 忽略错误
	}
	return null;
}

/**
 * Resolve shell configuration based on platform and an optional explicit shell path.
 * 根据平台以及可选的显式 shell 路径解析 shell 配置。
 * Resolution order:
 * 解析顺序：
 * 1. User-specified shellPath
 *    用户指定的 shellPath
 * 2. On Windows: Git Bash in known locations, then bash on PATH
 *    在 Windows 上：先查找已知位置的 Git Bash，再查找 PATH 中的 bash
 * 3. On Unix: /bin/bash, then bash on PATH, then fallback to sh
 *    在 Unix 上：先查找 /bin/bash，再查找 PATH 中的 bash，最后回退到 sh
 */
export function getShellConfig(customShellPath?: string): ShellConfig {
	// 1. Check user-specified shell path
	// 1. 检查用户指定的 shell 路径
	if (customShellPath) {
		if (existsSync(customShellPath)) {
			return getBashShellConfig(customShellPath);
		}
		throw new Error(`Custom shell path not found: ${customShellPath}`);
	}

	if (process.platform === "win32") {
		// 2. Try Git Bash in known locations
		// 2. 尝试在已知位置查找 Git Bash
		const paths: string[] = [];
		const programFiles = process.env.ProgramFiles;
		if (programFiles) {
			paths.push(`${programFiles}\\Git\\bin\\bash.exe`);
		}
		const programFilesX86 = process.env["ProgramFiles(x86)"];
		if (programFilesX86) {
			paths.push(`${programFilesX86}\\Git\\bin\\bash.exe`);
		}

		for (const path of paths) {
			if (existsSync(path)) {
				return getBashShellConfig(path);
			}
		}

		// 3. Fallback: search bash.exe on PATH (Cygwin, MSYS2, WSL, etc.)
		// 3. 回退方案：在 PATH 中搜索 bash.exe（Cygwin、MSYS2、WSL 等）
		const bashOnPath = findBashOnPath();
		if (bashOnPath) {
			return getBashShellConfig(bashOnPath);
		}

		throw new Error(
			`No bash shell found. Options:\n` +
				`  1. Install Git for Windows: https://git-scm.com/download/win\n` +
				`  2. Add your bash to PATH (Cygwin, MSYS2, etc.)\n` +
				"  3. Set shellPath in settings.json\n\n" +
				`Searched Git Bash in:\n${paths.map((p) => `  ${p}`).join("\n")}`,
		);
	}

	// Unix: try /bin/bash, then bash on PATH, then fallback to sh
	// Unix：先尝试 /bin/bash，再尝试 PATH 中的 bash，最后回退到 sh
	if (existsSync("/bin/bash")) {
		return getBashShellConfig("/bin/bash");
	}

	const bashOnPath = findBashOnPath();
	if (bashOnPath) {
		return getBashShellConfig(bashOnPath);
	}

	return { shell: "sh", args: ["-c"] };
}

export function getShellEnv(): NodeJS.ProcessEnv {
	const binDir = getBinDir();
	const pathKey = Object.keys(process.env).find((key) => key.toLowerCase() === "path") ?? "PATH";
	const currentPath = process.env[pathKey] ?? "";
	const pathEntries = currentPath.split(delimiter).filter(Boolean);
	const hasBinDir = pathEntries.includes(binDir);
	const updatedPath = hasBinDir ? currentPath : [binDir, currentPath].filter(Boolean).join(delimiter);

	return {
		...process.env,
		[pathKey]: updatedPath,
	};
}

/**
 * Sanitize binary output for display/storage.
 * 对二进制输出进行净化处理，以便展示/存储。
 * Removes characters that crash string-width or cause display issues:
 * 移除会导致 string-width 崩溃或引发显示问题的字符：
 * - Control characters (except tab, newline, carriage return)
 *   控制字符（制表符、换行符、回车符除外）
 * - Lone surrogates
 *   孤立代理项（lone surrogates）
 * - Unicode Format characters (crash string-width due to a bug)
 *   Unicode 格式字符（因一个缺陷会导致 string-width 崩溃）
 * - Characters with undefined code points
 *   码点（code point）未定义的字符
 */
export function sanitizeBinaryOutput(str: string): string {
	// Use Array.from to properly iterate over code points (not code units)
	// 使用 Array.from 以正确地按码点（而非码元 code unit）遍历
	// This handles surrogate pairs correctly and catches edge cases where
	// 这样能正确处理代理对（surrogate pair），并覆盖
	// codePointAt() might return undefined
	// codePointAt() 可能返回 undefined 的边界情况
	return Array.from(str)
		.filter((char) => {
			// Filter out characters that cause string-width to crash
			// 过滤掉会导致 string-width 崩溃的字符
			// This includes:
			// 包括：
			// - Unicode format characters
			//   Unicode 格式字符
			// - Lone surrogates (already filtered by Array.from)
			//   孤立代理项（已由 Array.from 过滤）
			// - Control chars except \t \n \r
			//   除 \t \n \r 之外的控制字符
			// - Characters with undefined code points
			//   码点未定义的字符

			const code = char.codePointAt(0);

			// Skip if code point is undefined (edge case with invalid strings)
			// 若码点为 undefined 则跳过（非法字符串的边界情况）
			if (code === undefined) return false;

			// Allow tab, newline, carriage return
			// 允许制表符、换行符、回车符
			if (code === 0x09 || code === 0x0a || code === 0x0d) return true;

			// Filter out control characters (0x00-0x1F, except 0x09, 0x0a, 0x0x0d)
			// 过滤掉控制字符（0x00-0x1F，0x09、0x0a、0x0x0d 除外）
			if (code <= 0x1f) return false;

			// Filter out Unicode format characters
			// 过滤掉 Unicode 格式字符
			if (code >= 0xfff9 && code <= 0xfffb) return false;

			return true;
		})
		.join("");
}

/**
 * Detached child processes must be tracked so they can be killed on parent
 * shutdown signals (SIGHUP/SIGTERM).
 * 必须跟踪已分离（detached）的子进程，以便在父进程收到关闭信号
 * （SIGHUP/SIGTERM）时将它们终止。
 */
const trackedDetachedChildPids = new Set<number>();

export function trackDetachedChildPid(pid: number): void {
	trackedDetachedChildPids.add(pid);
}

export function untrackDetachedChildPid(pid: number): void {
	trackedDetachedChildPids.delete(pid);
}

export function killTrackedDetachedChildren(): void {
	for (const pid of trackedDetachedChildPids) {
		killProcessTree(pid);
	}
	trackedDetachedChildPids.clear();
}

/**
 * Kill a process and all its children (cross-platform)
 * 终止一个进程及其所有子进程（跨平台）
 */
export function killProcessTree(pid: number): void {
	if (process.platform === "win32") {
		// Use taskkill on Windows to kill process tree
		// 在 Windows 上使用 taskkill 终止整个进程树
		try {
			spawn("taskkill", ["/F", "/T", "/PID", String(pid)], {
				stdio: "ignore",
				detached: true,
				windowsHide: true,
			});
		} catch {
			// Ignore errors if taskkill fails
			// 若 taskkill 执行失败则忽略错误
		}
	} else {
		// Use SIGKILL on Unix/Linux/Mac
		// 在 Unix/Linux/Mac 上使用 SIGKILL
		try {
			process.kill(-pid, "SIGKILL");
		} catch {
			// Fallback to killing just the child if process group kill fails
			// 若终止进程组失败，则回退为仅终止该子进程
			try {
				process.kill(pid, "SIGKILL");
			} catch {
				// Process already dead
				// 进程已经结束
			}
		}
	}
}
