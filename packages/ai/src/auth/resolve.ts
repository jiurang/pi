import type { ProviderEnv } from "../types.ts";
import { formatThrownValue } from "../utils/diagnostics.ts";
import type {
	ApiKeyAuth,
	ApiKeyCredential,
	AuthContext,
	AuthResult,
	Credential,
	CredentialStore,
	OAuthAuth,
	OAuthCredential,
	ProviderAuth,
} from "./types.ts";

export type ModelsErrorCode = "model_source" | "model_validation" | "provider" | "stream" | "auth" | "oauth";

export interface AuthResolutionOverrides {
	apiKey?: string;
	env?: ProviderEnv;
	/**
	 * Require this much remaining OAuth-token validity; defaults to five minutes.
	 * 要求 OAuth token 至少还剩余这么长的有效期；默认为五分钟。
	 */
	minOAuthValidityMs?: number;
}

export class ModelsError extends Error {
	readonly code: ModelsErrorCode;

	constructor(code: ModelsErrorCode, message: string, options?: { cause?: unknown }) {
		super(withCauseDetail(message, options?.cause), options);
		this.name = "ModelsError";
		this.code = code;
	}
}

/**
 * Callers surface `error.message` only, so keep the underlying reason in it.
 * 调用方只会展示 `error.message`，因此需将底层原因保留在该消息中。
 */
function withCauseDetail(message: string, cause: unknown): string {
	if (cause === undefined || cause === null) return message;
	const detail = formatThrownValue(cause).trim();
	if (!detail || message.includes(detail)) return message;
	return `${message}: ${detail}`;
}

/**
 * Auth resolution shared by the `Models` and `ImagesModels` collections.
 * `Models` 与 `ImagesModels` 集合共用的鉴权解析逻辑。
 * A stored credential owns the provider: ambient/env is consulted only when
 * nothing is stored. No silent env fallback after a failed refresh or for a
 * credential type without a matching handler.
 * 已存储的凭据（credential）拥有该 provider 的归属权：仅当没有任何存储凭据时，
 * 才会查询环境（ambient/env）来源。刷新失败之后，或凭据类型没有对应处理器时，
 * 都不会静默回退到环境变量。
 */
export async function resolveProviderAuth(
	provider: { id: string; auth: ProviderAuth },
	credentials: CredentialStore,
	authContext: AuthContext,
	overrides?: AuthResolutionOverrides,
): Promise<AuthResult | undefined> {
	const requestAuthContext = overrides?.env ? overlayEnvAuthContext(authContext, overrides.env) : authContext;

	if (overrides?.apiKey !== undefined && provider.auth.apiKey) {
		return resolveApiKey(requestAuthContext, provider.auth.apiKey, provider.id, {
			type: "api_key",
			key: overrides.apiKey,
			env: overrides.env,
		});
	}

	const stored = await readCredential(credentials, provider.id);
	if (stored) {
		if (stored.type === "oauth" && provider.auth.oauth) {
			return resolveStoredOAuth(
				credentials,
				provider.id,
				provider.auth.oauth,
				stored,
				overrides?.minOAuthValidityMs,
			);
		}
		if (stored.type === "api_key" && provider.auth.apiKey) {
			const credential = overrides?.env ? { ...stored, env: { ...stored.env, ...overrides.env } } : stored;
			return resolveApiKey(requestAuthContext, provider.auth.apiKey, provider.id, credential);
		}
		return undefined;
	}

	// Ambient (env vars, AWS profiles, ADC files).
	// 环境来源（环境变量、AWS profile、ADC 文件）。
	return provider.auth.apiKey
		? resolveApiKey(requestAuthContext, provider.auth.apiKey, provider.id, undefined)
		: undefined;
}

function overlayEnvAuthContext(base: AuthContext, env: ProviderEnv): AuthContext {
	return {
		env: async (name) => env[name] || (await base.env(name)),
		fileExists: (path) => base.fileExists(path),
	};
}

const DEFAULT_OAUTH_MINIMUM_VALIDITY_MS = 5 * 60 * 1000;

/**
 * OAuth resolution with double-checked locking: tokens with less than five
 * minutes remaining lock, re-check expiry under the lock, refresh once
 * globally, and persist the rotated credential before release.
 * 采用双重检查加锁（double-checked locking）的 OAuth 解析：剩余有效期不足五分钟
 * 的 token 会先加锁，在锁内重新检查过期时间，在全局范围内只刷新一次，并在释放锁
 * 之前持久化轮换后的凭据（credential）。
 */
async function resolveStoredOAuth(
	credentials: CredentialStore,
	providerId: string,
	oauth: OAuthAuth,
	stored: OAuthCredential,
	minOAuthValidityMs?: number,
): Promise<AuthResult | undefined> {
	const minimumValidityMs = Math.max(DEFAULT_OAUTH_MINIMUM_VALIDITY_MS, minOAuthValidityMs ?? 0);
	const expiresSoon = (credential: OAuthCredential) => Date.now() + minimumValidityMs >= credential.expires;
	let credential = stored;

	if (expiresSoon(credential)) {
		// Optimistic check said expired; the authoritative check runs under the lock.
		// 乐观检查判定为已过期；权威性的检查将在锁内执行。
		let post: Credential | undefined;
		try {
			post = await credentials.modify(providerId, async (current) => {
				if (current?.type !== "oauth") return undefined; // logged out meanwhile
				// 期间已登出
				if (!expiresSoon(current)) return undefined; // another process/request refreshed
				// 其他进程/请求已完成刷新
				try {
					return await oauth.refresh(current);
				} catch (error) {
					throw new ModelsError("oauth", `OAuth refresh failed for ${providerId}`, { cause: error });
				}
			});
		} catch (error) {
			if (error instanceof ModelsError) throw error;
			throw new ModelsError("auth", `Credential store modify failed for ${providerId}`, { cause: error });
		}
		if (post?.type !== "oauth") return undefined; // logged out meanwhile
		// 期间已登出
		credential = post;
		// The normal five-minute window triggers a refresh but does not impose a
		// 常规的五分钟窗口只会触发刷新，并不构成对 provider 的约定（contract）。
		// provider contract. Explicit callers (such as bearer-token export) do
		// 显式指定了要求的调用方（例如 bearer-token 导出）在刷新之后确实要求
		// require the requested minimum after the refresh.
		// 满足其所请求的最小剩余有效期。
		if (minOAuthValidityMs !== undefined && expiresSoon(credential)) {
			throw new ModelsError("oauth", `OAuth refresh returned a token that expires too soon for ${providerId}`);
		}
	}

	try {
		return { auth: await oauth.toAuth(credential), source: "OAuth" };
	} catch (error) {
		throw new ModelsError("oauth", `OAuth auth derivation failed for ${providerId}`, { cause: error });
	}
}

async function resolveApiKey(
	authContext: AuthContext,
	apiKey: ApiKeyAuth,
	providerId: string,
	credential: ApiKeyCredential | undefined,
): Promise<AuthResult | undefined> {
	try {
		return await apiKey.resolve({ ctx: authContext, credential });
	} catch (error) {
		throw new ModelsError("auth", `API key auth failed for provider ${providerId}`, { cause: error });
	}
}

async function readCredential(credentials: CredentialStore, providerId: string): Promise<Credential | undefined> {
	try {
		return await credentials.read(providerId);
	} catch (error) {
		throw new ModelsError("auth", `Credential store read failed for ${providerId}`, { cause: error });
	}
}
