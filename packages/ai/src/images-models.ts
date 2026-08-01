import { defaultProviderAuthContext as defaultAuthContext } from "./auth/context.ts";
import { InMemoryCredentialStore } from "./auth/credential-store.ts";
import { type AuthResolutionOverrides, ModelsError, resolveProviderAuth } from "./auth/resolve.ts";
import type { AuthContext, AuthResult, CredentialStore, ProviderAuth } from "./auth/types.ts";
import type { CreateModelsOptions } from "./models.ts";
import type { AssistantImages, ImagesApi, ImagesContext, ImagesModel, ImagesOptions, ProviderImages } from "./types.ts";

/**
 * An image-generation provider: the image-side counterpart of `Provider`.
 * 图像生成提供方（provider）：`Provider` 在图像侧的对应物。
 * Owns id/name metadata, auth, model listing, and generation behavior.
 * 负责 id/name 元数据、认证、模型列表以及图像生成行为。
 */
export interface ImagesProvider {
	readonly id: string;
	readonly name: string;

	/**
	 * Required: at least one of `apiKey`/`oauth`. Same semantics as chat
	 * providers; `ImagesModels.getAuth()` returns undefined when the provider
	 * is unconfigured.
	 * 必填：`apiKey`/`oauth` 至少提供其一。语义与对话类提供方（provider）相同；
	 * 当提供方未配置时，`ImagesModels.getAuth()` 返回 undefined。
	 */
	readonly auth: ProviderAuth;

	/**
	 * Current known models, sync. Static providers return their catalog;
	 * dynamic providers return the list as of the last `refreshModels()`
	 * (empty before the first). Must not throw; `ImagesModels` treats a
	 * throwing implementation as having no models.
	 * 同步返回当前已知的模型。静态提供方（provider）返回其自身目录；
	 * 动态提供方返回截至上一次 `refreshModels()` 的列表
	 * （首次刷新之前为空）。该方法不得抛错；若实现抛错，
	 * `ImagesModels` 会将其视为没有任何模型。
	 */
	getModels(): readonly ImagesModel<ImagesApi>[];

	/**
	 * Dynamic providers only: fetch and update the model list. May reject
	 * (network); on rejection the model list stays at its last-known state
	 * and a later call retries.
	 * 仅动态提供方（provider）需要：拉取并更新模型列表。可能被拒绝
	 * （网络原因）；被拒绝时模型列表保持在最近一次已知状态，
	 * 后续调用会重试。
	 */
	refreshModels?(): Promise<void>;

	generateImages(
		model: ImagesModel<ImagesApi>,
		context: ImagesContext,
		options?: ImagesOptions,
	): Promise<AssistantImages>;
}

/**
 * Runtime collection of image-generation providers plus auth application and
 * generation convenience: the image-side counterpart of `Models`.
 * 图像生成提供方（provider）的运行时集合，并附带认证应用与便捷的生成方法：
 * 即 `Models` 在图像侧的对应物。
 */
export interface ImagesModels {
	getProviders(): readonly ImagesProvider[];
	getProvider(id: string): ImagesProvider | undefined;

	/**
	 * Sync read of last-known models from one provider or all providers.
	 * 同步读取单个提供方（provider）或全部提供方的最近已知模型列表。
	 * Best-effort: a provider whose `getModels()` throws yields no models.
	 * 尽力而为：若某个提供方的 `getModels()` 抛错，则视其为没有模型。
	 */
	getModels(provider?: string): readonly ImagesModel<ImagesApi>[];

	/**
	 * Sync runtime model lookup against last-known lists.
	 * 基于最近已知的列表进行同步的运行时模型查找。
	 */
	getModel(provider: string, id: string): ImagesModel<ImagesApi> | undefined;

	/**
	 * Ask dynamic providers to re-fetch their model lists. With a provider id,
	 * rejects with `ModelsError` ("model_source") on that provider's fetch
	 * failure; without one, refreshes all providers concurrently best-effort.
	 * Static providers (no `refreshModels`) are no-ops.
	 * 请求动态提供方（provider）重新拉取其模型列表。若传入提供方 id，
	 * 则该提供方拉取失败时以 `ModelsError`（"model_source"）拒绝；
	 * 若不传，则以尽力而为的方式并发刷新所有提供方。
	 * 静态提供方（没有 `refreshModels`）为空操作。
	 */
	refresh(provider?: string): Promise<void>;

	/**
	 * Resolve request auth by provider id or image model. Same contract as
	 * `Models.getAuth()`: undefined when unknown/unconfigured, rejects with
	 * `ModelsError` ("oauth"/"auth") on real failures.
	 * 按提供方（provider）id 或图像模型解析请求认证。契约与
	 * `Models.getAuth()` 相同：提供方未知/未配置时返回 undefined，
	 * 出现真实错误时以 `ModelsError`（"oauth"/"auth"）拒绝。
	 */
	getAuth(providerId: string, overrides?: AuthResolutionOverrides): Promise<AuthResult | undefined>;
	getAuth(model: ImagesModel<ImagesApi>, overrides?: AuthResolutionOverrides): Promise<AuthResult | undefined>;

	/**
	 * Generate images through the owning provider with auth resolved and
	 * merged (explicit options win per field). Never rejects; failures are
	 * returned as an `AssistantImages` with `stopReason: "error"`.
	 * 通过模型所属的提供方（provider）生成图像，认证信息会被解析并合并
	 * （显式传入的选项按字段优先）。该方法永不拒绝；失败会以
	 * `stopReason: "error"` 的 `AssistantImages` 形式返回。
	 */
	generateImages(
		model: ImagesModel<ImagesApi>,
		context: ImagesContext,
		options?: ImagesOptions,
	): Promise<AssistantImages>;
}

export interface MutableImagesModels extends ImagesModels {
	/**
	 * Upsert/replace by provider.id. Provider ids are unique.
	 * 按 provider.id 进行插入或替换（upsert）。提供方（provider）id 是唯一的。
	 */
	setProvider(provider: ImagesProvider): void;
	deleteProvider(id: string): void;
	clearProviders(): void;
}

class ImagesModelsImpl implements MutableImagesModels {
	private providers = new Map<string, ImagesProvider>();
	private credentials: CredentialStore;
	private authContext: AuthContext;

	constructor(options?: CreateModelsOptions) {
		this.credentials = options?.credentials ?? new InMemoryCredentialStore();
		this.authContext = options?.authContext ?? defaultAuthContext();
	}

	setProvider(provider: ImagesProvider): void {
		this.providers.set(provider.id, provider);
	}

	deleteProvider(id: string): void {
		this.providers.delete(id);
	}

	clearProviders(): void {
		this.providers.clear();
	}

	getProviders(): readonly ImagesProvider[] {
		return Array.from(this.providers.values());
	}

	getProvider(id: string): ImagesProvider | undefined {
		return this.providers.get(id);
	}

	getModels(provider?: string): readonly ImagesModel<ImagesApi>[] {
		if (provider !== undefined) {
			const entry = this.providers.get(provider);
			if (!entry) return [];
			try {
				return entry.getModels();
			} catch {
				return [];
			}
		}

		const models: ImagesModel<ImagesApi>[] = [];
		for (const entry of this.providers.values()) {
			try {
				models.push(...entry.getModels());
			} catch {
				// Best-effort: ill-behaved providers yield no models.
				// 尽力而为：行为异常的提供方（provider）视为没有模型。
			}
		}
		return models;
	}

	getModel(provider: string, id: string): ImagesModel<ImagesApi> | undefined {
		return this.getModels(provider).find((model) => model.id === id);
	}

	async refresh(provider?: string): Promise<void> {
		if (provider !== undefined) {
			const entry = this.providers.get(provider);
			if (!entry?.refreshModels) return;
			try {
				await entry.refreshModels();
			} catch (error) {
				if (error instanceof ModelsError) throw error;
				throw new ModelsError("model_source", `Model refresh failed for ${provider}`, { cause: error });
			}
			return;
		}

		// Cannot reject: the async mapper turns even sync throws from ill-behaved
		// 不会被拒绝：这个 async 映射函数会把行为异常的提供方（provider）
		// providers into rejections, and allSettled captures all of them.
		// 抛出的同步异常也转成 rejection，而 allSettled 会捕获全部这些 rejection。
		await Promise.allSettled(Array.from(this.providers.values(), async (entry) => entry.refreshModels?.()));
	}

	getAuth(providerId: string, overrides?: AuthResolutionOverrides): Promise<AuthResult | undefined>;
	getAuth(model: ImagesModel<ImagesApi>, overrides?: AuthResolutionOverrides): Promise<AuthResult | undefined>;
	async getAuth(
		providerOrModel: string | ImagesModel<ImagesApi>,
		overrides?: AuthResolutionOverrides,
	): Promise<AuthResult | undefined> {
		const providerId = typeof providerOrModel === "string" ? providerOrModel : providerOrModel.provider;
		const provider = this.providers.get(providerId);
		if (!provider) return undefined;
		return resolveProviderAuth(provider, this.credentials, this.authContext, overrides);
	}

	async generateImages(
		model: ImagesModel<ImagesApi>,
		context: ImagesContext,
		options?: ImagesOptions,
	): Promise<AssistantImages> {
		try {
			const provider = this.providers.get(model.provider);
			if (!provider) {
				throw new ModelsError("provider", `Unknown provider: ${model.provider}`);
			}

			const resolution = await this.getAuth(model, {
				apiKey: options?.apiKey,
				env: options?.env,
			});
			const auth = resolution?.auth;
			if (!auth) {
				return provider.generateImages(model, context, options);
			}

			const requestModel = auth.baseUrl ? { ...model, baseUrl: auth.baseUrl } : model;

			// Explicit request options win per-field; headers/env merge per key.
			// 显式传入的请求选项按字段优先；headers/env 按键逐项合并。
			const apiKey = options?.apiKey ?? auth.apiKey;
			const headers = auth.headers || options?.headers ? { ...auth.headers, ...options?.headers } : undefined;
			const env =
				resolution.env || options?.env ? { ...(resolution.env ?? {}), ...(options?.env ?? {}) } : undefined;

			return await provider.generateImages(requestModel, context, { ...options, apiKey, headers, env });
		} catch (error) {
			return {
				api: model.api,
				provider: model.provider,
				model: model.id,
				output: [],
				stopReason: "error",
				errorMessage: error instanceof Error ? error.message : String(error),
				timestamp: Date.now(),
			};
		}
	}
}

export function createImagesModels(options?: CreateModelsOptions): MutableImagesModels {
	return new ImagesModelsImpl(options);
}

export interface CreateImagesProviderOptions {
	id: string;
	/**
	 * Display name. Default: `id`.
	 * 展示名称。默认值：`id`。
	 */
	name?: string;
	/**
	 * Required — every provider has auth semantics, even ambient/keyless ones.
	 * 必填 —— 每个提供方（provider）都有认证语义，即便是依赖环境凭据或无需密钥的提供方。
	 */
	auth: ProviderAuth;
	/**
	 * Initial model list (empty for purely dynamic providers).
	 * 初始模型列表（纯动态提供方（provider）为空）。
	 */
	models: readonly ImagesModel<ImagesApi>[];
	/**
	 * Dynamic providers: fetch the current list. Stored on success; concurrent
	 * calls share one in-flight fetch. May reject: the stored list then stays
	 * at its last-known state, the rejection propagates to the caller of
	 * `refreshModels()` (wrapped as ModelsError "model_source" by
	 * `ImagesModels.refresh(provider)`), and a later call retries.
	 * 动态提供方（provider）：拉取当前列表。成功后会被存储；并发调用
	 * 共享同一次进行中的拉取。可能被拒绝：此时已存储的列表保持在
	 * 最近一次已知状态，拒绝原因会传播给 `refreshModels()` 的调用方
	 * （由 `ImagesModels.refresh(provider)` 包装为 ModelsError "model_source"），
	 * 后续调用会重试。
	 */
	refreshModels?: () => Promise<readonly ImagesModel<ImagesApi>[]>;
	api: ProviderImages;
}

/**
 * Builds an image-generation provider from parts.
 * 由各组成部分构建出一个图像生成提供方（provider）。
 */
export function createImagesProvider(input: CreateImagesProviderOptions): ImagesProvider {
	let models = input.models;
	let inflightRefresh: Promise<void> | undefined;
	const refreshModels = input.refreshModels;

	return {
		id: input.id,
		name: input.name ?? input.id,
		auth: input.auth,
		getModels: () => models,
		refreshModels: refreshModels
			? () => {
					inflightRefresh ??= (async () => {
						try {
							models = await refreshModels();
						} finally {
							inflightRefresh = undefined;
						}
					})();
					return inflightRefresh;
				}
			: undefined,
		generateImages: (model, context, options) => input.api.generateImages(model, context, options),
	};
}
