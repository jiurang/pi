import type { Api, Model } from "./types.ts";

export interface ModelsStoreEntry {
	models: readonly Model<Api>[];
	/**
	 * Unix timestamp from the remote catalog's Last-Modified header.
	 * 来自远端模型目录 Last-Modified 响应头的 Unix 时间戳。
	 */
	lastModified?: number;
	/**
	 * Unix timestamp of the last completed remote check.
	 * 最近一次成功完成的远端检查的 Unix 时间戳。
	 */
	checkedAt?: number;
	/**
	 * Opaque validator from the remote catalog's ETag header, stored verbatim
	 * (quotes included) and echoed back as If-None-Match.
	 * 来自远端模型目录 ETag 响应头的不透明校验值，按原样存储
	 * （包含引号），并在请求时以 If-None-Match 原样回传。
	 */
	etag?: string;
}

/**
 * Persistent model catalogs keyed by provider ID.
 * 以提供方（provider）ID 为键的持久化模型目录。
 */
export interface ModelsStore {
	read(providerId: string): Promise<ModelsStoreEntry | undefined>;
	write(providerId: string, entry: ModelsStoreEntry): Promise<void>;
	delete(providerId: string): Promise<void>;
}

/**
 * ModelsStore scoped to one provider. Providers cannot access other providers' catalogs.
 * 限定在单个提供方（provider）范围内的 ModelsStore。提供方无法访问其他提供方的模型目录。
 */
export interface ProviderModelsStore {
	read(): Promise<ModelsStoreEntry | undefined>;
	write(entry: ModelsStoreEntry): Promise<void>;
	delete(): Promise<void>;
}

export class InMemoryModelsStore implements ModelsStore {
	private readonly entries = new Map<string, ModelsStoreEntry>();

	async read(providerId: string): Promise<ModelsStoreEntry | undefined> {
		const entry = this.entries.get(providerId);
		return entry ? structuredClone(entry) : undefined;
	}

	async write(providerId: string, entry: ModelsStoreEntry): Promise<void> {
		this.entries.set(providerId, structuredClone(entry));
	}

	async delete(providerId: string): Promise<void> {
		this.entries.delete(providerId);
	}
}
