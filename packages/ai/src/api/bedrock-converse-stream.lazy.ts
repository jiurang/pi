import type { ProviderStreams } from "../types.ts";
import { lazyApi } from "./lazy.ts";

/**
 * Loads the bedrock implementation through a variable specifier so bundlers
 * 通过变量形式的模块说明符（specifier）加载 bedrock 实现，使打包器
 * (browser smoke, Bun compile) cannot follow the import into the Node-only
 * （浏览器冒烟测试、Bun 编译）无法顺着该导入进入仅支持 Node 的
 * AWS SDK. The `.ts`/`.js` rewrite keeps the trick working from both source
 * AWS SDK。`.ts`/`.js` 的重写让这一技巧在源码和构建产物中都能生效。
 * and built output.
 */
const importNodeOnlyApi = (specifier: string): Promise<unknown> => {
	const runtimeSpecifier = import.meta.url.endsWith(".js") ? specifier.replace(/\.ts$/, ".js") : specifier;
	return import(runtimeSpecifier);
};

let bedrockModuleOverride: ProviderStreams | undefined;

/**
 * Overrides the dynamically imported bedrock implementation. Used by the Bun
 * 覆盖动态导入的 bedrock 实现。用于 Bun 二进制构建场景，
 * binary build, where the variable-specifier import cannot be bundled; the
 * 因为其中变量说明符形式的导入无法被打包；该构建会改为
 * build registers a statically imported module instead.
 * 注册一个静态导入的模块。
 */
export function setBedrockProviderModule(module: ProviderStreams): void {
	bedrockModuleOverride = module;
}

export const bedrockConverseStreamApi = (): ProviderStreams =>
	lazyApi(
		async () =>
			bedrockModuleOverride ?? ((await importNodeOnlyApi("./bedrock-converse-stream.ts")) as ProviderStreams),
	);
