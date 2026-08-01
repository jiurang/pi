import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFindToolDefinition } from "../../../src/core/tools/find.ts";

/**
 * Regression test for https://github.com/earendil-works/pi-mono/issues/3302
 * 针对 https://github.com/earendil-works/pi-mono/issues/3302 的回归测试。
 *
 * The `find` tool advertises glob patterns like `src/**\/*.spec.ts`, but the
 * default fd-backed implementation used `fd --glob <pattern>` without
 * `--full-path`, which makes fd match only against the basename. Any pattern
 * containing a `/` therefore silently returned no matches.
 * `find` 工具声称支持形如 `src/**\/*.spec.ts` 的 glob 模式，但基于 fd 的默认实现
 * 使用的是 `fd --glob <pattern>`，并未带上 `--full-path`，这会让 fd 只匹配文件名
 * （basename）。因此任何包含 `/` 的模式都会静默地返回空结果。
 *
 * The fix switches fd into full-path mode when the pattern contains a `/`
 * and prepends `**\/` so the pattern can match against the absolute candidate
 * path that fd feeds to the matcher.
 * 修复方式是：当模式包含 `/` 时将 fd 切换为全路径（full-path）模式，并在模式前
 * 添加 `**\/`，使其能够匹配 fd 传给匹配器的绝对候选路径。
 */
describe("issue #3302 find returns no results for path-based glob patterns", () => {
	let tempRoot: string;

	beforeEach(() => {
		tempRoot = mkdtempSync(join(tmpdir(), "pi-3302-"));
		mkdirSync(join(tempRoot, "some", "parent", "child"), { recursive: true });
		mkdirSync(join(tempRoot, "src", "foo", "bar"), { recursive: true });
		writeFileSync(join(tempRoot, "some", "parent", "child", "file.ext"), "");
		writeFileSync(join(tempRoot, "some", "parent", "child", "test.spec.ts"), "");
		writeFileSync(join(tempRoot, "src", "foo", "bar", "example.spec.ts"), "");
	});

	afterEach(() => {
		rmSync(tempRoot, { recursive: true, force: true });
	});

	async function runFind(pattern: string): Promise<string[]> {
		const def = createFindToolDefinition(tempRoot);
		// The find tool implementation does not touch ctx; pass a minimal stub.
		// find 工具的实现不会使用 ctx，因此传入一个最小化的桩对象即可。
		const ctx = {} as Parameters<typeof def.execute>[4];
		const result = (await def.execute("call-1", { pattern }, undefined, undefined, ctx)) as {
			content: Array<{ type: string; text?: string }>;
		};
		const text = result.content[0]?.text ?? "";
		if (text === "No files found matching pattern") return [];
		return text
			.split("\n")
			.map((l) => l.trim())
			.filter((l) => l.length > 0 && !l.startsWith("["));
	}

	it("basename pattern still matches (regression-safe)", async () => {
		const files = await runFind("*.spec.ts");
		expect(files.sort()).toEqual(["some/parent/child/test.spec.ts", "src/foo/bar/example.spec.ts"]);
	});

	it("directory-prefixed pattern with ** tail matches subtree", async () => {
		const files = await runFind("some/parent/child/**");
		// Matches files (and possibly directories) under the subtree. Assert the two files are present.
		// 会匹配该子树下的文件（也可能包含目录）。此处断言这两个文件存在。
		expect(files).toContain("some/parent/child/file.ext");
		expect(files).toContain("some/parent/child/test.spec.ts");
	});

	it("leading ** wildcard with path segments matches", async () => {
		const files = await runFind("**/parent/child/*");
		expect(files.sort()).toContain("some/parent/child/file.ext");
		expect(files.sort()).toContain("some/parent/child/test.spec.ts");
	});

	it("src/**/*.spec.ts matches nested spec file", async () => {
		const files = await runFind("src/**/*.spec.ts");
		expect(files).toEqual(["src/foo/bar/example.spec.ts"]);
	});
});
