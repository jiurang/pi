import type { ProviderEnv, ProviderHeaders } from "../types.ts";

/**
 * Request auth for a single model request. If a value cannot be expressed as
 * `apiKey`, `headers`, or `baseUrl`, it is provider config, not auth.
 * 单次模型请求所使用的请求鉴权（auth）信息。如果某个值无法表达为 `apiKey`、`headers`
 * 或 `baseUrl`，那它属于提供方（provider）配置，而不是鉴权信息。
 */
export interface ModelAuth {
	apiKey?: string;
	headers?: ProviderHeaders;
	baseUrl?: string;
}

/**
 * Stored api-key credential. `env` holds provider-scoped environment/config
 * values such as Cloudflare account/gateway ids.
 * 已存储的 api-key 凭据（credential）。`env` 保存提供方作用域内的环境/配置值，
 * 例如 Cloudflare 的 account/gateway id。
 */
export interface ApiKeyCredential {
	type: "api_key";
	key?: string;
	env?: ProviderEnv;
}

/**
 * OAuth token data returned by extension compatibility flows.
 * 由扩展兼容性流程返回的 OAuth 令牌（token）数据。
 */
export interface OAuthCredentials {
	refresh: string;
	access: string;
	expires: number;
	[key: string]: unknown;
}

/**
 * Stored canonical OAuth credential.
 * 已存储的标准 OAuth 凭据。
 */
export interface OAuthCredential extends OAuthCredentials {
	type: "oauth";
}

/**
 * One type-tagged credential per provider — the shape of today's auth.json.
 * 每个提供方对应一条带类型标签的凭据 —— 即当前 auth.json 的数据结构。
 */
export type Credential = ApiKeyCredential | OAuthCredential;

/**
 * Non-secret credential metadata for account/status enumeration.
 * 不含机密信息的凭据元数据，用于枚举账户/状态。
 */
export interface CredentialInfo {
	providerId: string;
	type: Credential["type"];
}

/**
 * App-owned credential storage, keyed by `Provider.id`, one credential per
 * provider. `modify` is the only write path, so every mutation is a
 * serialized read-modify-write; `Models.getAuth()` runs OAuth refresh inside
 * `modify` so concurrent requests cannot double-refresh a rotated token. The
 * app persists a credential after login via
 * `modify(provider.id, async () => credential)`. Login/logout orchestration
 * is app-owned.
 * 由应用（app）持有的凭据存储，以 `Provider.id` 为键，每个提供方一条凭据。`modify` 是唯一的
 * 写入路径，因此每次变更都是串行化的“读-改-写”；`Models.getAuth()` 在 `modify` 内部执行
 * OAuth 刷新（refresh），从而避免并发请求对已轮换的令牌重复刷新。应用在登录后通过
 * `modify(provider.id, async () => credential)` 持久化凭据。登录/登出的编排由应用负责。
 *
 * Error semantics: `read` resolves `undefined` for missing entries. Methods
 * reject only on storage failure; `Models` wraps such rejections in
 * `ModelsError` with code "auth". Best-effort stores that serve an in-memory
 * view and record persistence errors internally (like coding-agent's
 * AuthStorage) are valid implementations.
 * 错误语义：对于不存在的条目，`read` 会解析为 `undefined`。这些方法仅在存储失败时才 reject；
 * `Models` 会把此类 rejection 包装成 code 为 "auth" 的 `ModelsError`。采用尽力而为策略、
 * 对外提供内存视图并在内部记录持久化错误的存储实现（例如 coding-agent 的 AuthStorage）
 * 也是合法实现。
 */
export interface CredentialStore {
	/**
	 * Read the stored credential, possibly expired. Display/status use;
	 * resolved request auth comes from `Models.getAuth()`.
	 * 读取已存储的凭据，该凭据可能已过期。用于展示/状态显示；已解析的请求鉴权信息
	 * 来自 `Models.getAuth()`。
	 */
	read(providerId: string): Promise<Credential | undefined>;

	/**
	 * List stored credential metadata without resolving or exposing secrets.
	 * Implementations must not execute configured API-key commands while listing.
	 * 列出已存储凭据的元数据，且不解析或暴露任何机密信息。
	 * 实现方在列举过程中不得执行已配置的 API-key 命令。
	 */
	list(): Promise<readonly CredentialInfo[]>;

	/**
	 * Serialized write — the only write path. `fn` sees the current credential
	 * because correct writes (refresh, login-during-refresh) depend on it;
	 * return the new credential, or undefined to leave the entry unchanged.
	 * Mutual exclusion per provider id, cross-process too where the backing
	 * store supports it (e.g. a file lock). Resolves with the post-write
	 * credential. Rejections from `fn` propagate.
	 * 串行化写入 —— 唯一的写入路径。`fn` 能看到当前凭据，因为正确的写入（刷新、刷新期间登录）
	 * 依赖于它；返回新凭据，或返回 undefined 以保持该条目不变。
	 * 按提供方 id 实现互斥；在底层存储支持的情况下（例如文件锁）也支持跨进程互斥。
	 * 解析结果为写入后的凭据。`fn` 抛出的 rejection 会向外传播。
	 */
	modify(
		providerId: string,
		fn: (current: Credential | undefined) => Promise<Credential | undefined>,
	): Promise<Credential | undefined>;

	/**
	 * Remove a credential (logout). Implementations serialize this against `modify`.
	 * 移除一条凭据（登出）。实现方需将该操作与 `modify` 串行化执行。
	 */
	delete(providerId: string): Promise<void>;
}

/**
 * Environment access for auth resolution. Injectable for tests and browsers.
 * 用于鉴权解析的环境访问接口。可注入，以便在测试和浏览器环境中使用。
 */
export interface AuthContext {
	env(name: string): Promise<string | undefined>;
	/**
	 * Check whether a file exists. Supports a leading `~`. Always false in browsers.
	 * 检查文件是否存在。支持以 `~` 开头的路径。在浏览器中始终返回 false。
	 */
	fileExists(path: string): Promise<boolean>;
}

/**
 * Result of resolving auth for a model.
 * 为某个模型解析鉴权信息后的结果。
 */
export interface AuthResult {
	auth: ModelAuth;
	/**
	 * Provider-scoped environment/config values resolved from credentials and ambient context.
	 * 从凭据与环境上下文（ambient context）中解析出的、提供方作用域内的环境/配置值。
	 */
	env?: ProviderEnv;
	/**
	 * Human-readable label for status UI: "ANTHROPIC_API_KEY", "OAuth", "~/.aws/credentials".
	 * 用于状态界面展示的可读标签，例如："ANTHROPIC_API_KEY"、"OAuth"、"~/.aws/credentials"。
	 */
	source?: string;
}

export interface AuthCheck {
	source?: string;
	type: "api_key" | "oauth";
}

export type AuthType = "api_key" | "oauth";

/**
 * Prompt shown to the user during login. `signal` lets the flow cancel a
 * pending prompt when an out-of-band event resolves the step, e.g. a
 * `manual_code` prompt raced against a callback server, aborted when the
 * callback wins.
 * 登录过程中向用户展示的提示（prompt）。当某个带外（out-of-band）事件完成了该步骤时，
 * `signal` 允许流程取消尚未完成的提示；例如 `manual_code` 提示与回调服务器竞争，
 * 当回调先完成时该提示会被中止。
 */
export type AuthPrompt = { signal?: AbortSignal } & (
	| { type: "text"; message: string; placeholder?: string }
	| { type: "secret"; message: string; placeholder?: string }
	| { type: "select"; message: string; options: readonly { id: string; label: string; description?: string }[] }
	| { type: "manual_code"; message: string; placeholder?: string }
);

export interface AuthInfoLink {
	url: string;
	label?: string;
}

export type AuthEvent =
	| { type: "info"; message: string; links?: readonly AuthInfoLink[] }
	| { type: "auth_url"; url: string; instructions?: string }
	| {
			type: "device_code";
			userCode: string;
			verificationUri: string;
			intervalSeconds?: number;
			expiresInSeconds?: number;
	  }
	| { type: "progress"; message: string };

/**
 * Login interaction callbacks serving both api-key and OAuth flows.
 * 同时服务于 api-key 与 OAuth 两种流程的登录交互回调。
 *
 * `prompt()` returns the entered/selected string (`select` returns the option
 * id). Rejects on cancel/abort. `signal` aborts the whole login flow;
 * per-prompt cancellation uses `AuthPrompt.signal`.
 * `prompt()` 返回用户输入/选择的字符串（`select` 返回选项 id）。取消/中止时会 reject。
 * `signal` 用于中止整个登录流程；单个提示的取消则使用 `AuthPrompt.signal`。
 */
export interface AuthInteraction {
	signal?: AbortSignal;

	prompt(prompt: AuthPrompt): Promise<string>;
	notify(event: AuthEvent): void;
}

/**
 * Api-key auth: stored key/provider env plus ambient sources (env vars, AWS
 * profiles, ADC files). Ambient-only providers omit `login`.
 * Api-key 鉴权：已存储的 key/提供方环境变量，加上环境来源（环境变量、AWS profile、ADC 文件）。
 * 仅依赖环境来源的提供方会省略 `login`。
 */
export interface ApiKeyAuth {
	/**
	 * Display name, e.g. "Anthropic API key".
	 * 显示名称，例如 "Anthropic API key"。
	 */
	name: string;

	/**
	 * Interactive setup (prompt for key/provider env). Absent = ambient-only.
	 * 交互式配置（提示用户输入 key/提供方环境变量）。缺省表示仅依赖环境来源。
	 */
	login?(interaction: AuthInteraction): Promise<ApiKeyCredential>;

	/**
	 * Optional side-effect-free availability check. Use this when `resolve()` may
	 * execute commands or perform other request-time work. Missing means Models
	 * checks availability by resolving auth.
	 * 可选的无副作用可用性检查。当 `resolve()` 可能执行命令或进行其他请求期工作时使用本方法。
	 * 若未提供，Models 将通过解析鉴权信息来检查可用性。
	 */
	check?(input: { ctx: AuthContext; credential?: ApiKeyCredential }): Promise<AuthCheck | undefined>;

	/**
	 * Resolve auth from the stored credential and/or ambient sources, merging
	 * per field (`credential.key ?? env("...")`, `credential.env?.NAME ?? env("...")`).
	 * undefined = not configured. Resolution is provider-scoped; model-specific
	 * endpoint preparation happens after auth has been resolved.
	 * 从已存储的凭据和/或环境来源解析鉴权信息，按字段逐一合并
	 * （`credential.key ?? env("...")`、`credential.env?.NAME ?? env("...")`）。
	 * 返回 undefined 表示尚未配置。解析过程是提供方作用域的；模型专有的 endpoint 准备工作
	 * 会在鉴权信息解析完成之后进行。
	 */
	resolve(input: { ctx: AuthContext; credential?: ApiKeyCredential }): Promise<AuthResult | undefined>;
}

/**
 * OAuth auth. The `refresh`/`toAuth` split lets `Models` own the locked
 * refresh pattern: `refresh` produces a credential, `toAuth` derives request
 * auth from whatever credential ends up stored.
 * OAuth 鉴权。把 `refresh` 与 `toAuth` 拆开，使得 `Models` 可以掌控加锁刷新模式：
 * `refresh` 负责产出凭据，`toAuth` 则从最终存储下来的凭据推导出请求鉴权信息。
 */
export interface OAuthAuth {
	/**
	 * Display name, e.g. "Anthropic (Claude Pro/Max)".
	 * 显示名称，例如 "Anthropic (Claude Pro/Max)"。
	 */
	name: string;

	/**
	 * Selector label for the subscription login option, e.g. "Sign in with SuperGrok or X Premium".
	 * 订阅登录选项在选择器中的标签，例如 "Sign in with SuperGrok or X Premium"。
	 */
	loginLabel?: string;

	login(interaction: AuthInteraction): Promise<OAuthCredential>;

	/**
	 * Exchange the refresh token. Network call; throws on failure
	 * (invalid_grant etc.). `Models` runs this under the store lock.
	 * 用刷新令牌（refresh token）换取新令牌。这是一次网络调用；失败时抛出异常
	 * （如 invalid_grant 等）。`Models` 会在存储锁的保护下执行本方法。
	 */
	refresh(credential: OAuthCredential, signal?: AbortSignal): Promise<OAuthCredential>;

	/**
	 * Side-effect-free derivation of request auth from a valid credential.
	 * Covers per-credential baseUrl (GitHub Copilot). Async so lazy wrappers
	 * can load the implementation on first use.
	 * 从一份有效凭据无副作用地推导出请求鉴权信息。
	 * 涵盖按凭据区分的 baseUrl 场景（GitHub Copilot）。设计为异步，以便惰性包装器
	 * 可以在首次使用时再加载具体实现。
	 */
	toAuth(credential: OAuthCredential): Promise<ModelAuth>;
}

/**
 * Provider auth. At least one of `apiKey`/`oauth` must be present: even
 * ambient-credential providers and keyless local servers provide `apiKey`
 * auth whose `resolve()` reports whether the provider is configured.
 * 提供方鉴权。`apiKey`/`oauth` 至少要有其一：即使是使用环境凭据的提供方，
 * 以及无需 key 的本地服务器，也会提供 `apiKey` 鉴权，其 `resolve()` 用于报告
 * 该提供方是否已完成配置。
 */
export interface ProviderAuth {
	apiKey?: ApiKeyAuth;
	oauth?: OAuthAuth;
}
