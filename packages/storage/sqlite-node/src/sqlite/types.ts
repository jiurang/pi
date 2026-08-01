import type { FileSystem, SessionCreateOptions, SessionMetadata } from "@earendil-works/pi-agent-core";

/**
 * Result of a prepared SQLite statement execution.
 * 预编译（prepared）SQLite 语句执行后的结果。
 */
export interface SqliteRunResult {
	/**
	 * Number of rows changed by the statement.
	 * 该语句影响（变更）的行数。
	 */
	changes: number;
	/**
	 * Inserted row id when the backend exposes one.
	 * 当后端提供该信息时，表示插入行的 row id。
	 */
	lastInsertRowid?: number;
}

/**
 * Prepared SQLite statement capability used by the SQLite session backend.
 * SQLite 会话后端所使用的预编译（prepared）语句能力接口。
 */
export interface SqliteStatement {
	run(...params: unknown[]): Promise<SqliteRunResult>;
	get<TRow extends object>(...params: unknown[]): Promise<TRow | undefined>;
	all<TRow extends object>(...params: unknown[]): Promise<TRow[]>;
}

/**
 * SQLite database capability used by the SQLite session backend.
 * SQLite 会话后端所使用的数据库能力接口。
 */
export interface SqliteDatabase {
	exec(sql: string): Promise<void>;
	prepare(sql: string): SqliteStatement;
	transaction<T>(fn: () => Promise<T>): Promise<T>;
	close(): Promise<void>;
}

export interface SqliteDatabaseFactory {
	open(path: string): Promise<SqliteDatabase>;
}

export interface SqliteSessionMetadata extends SessionMetadata {
	cwd: string;
	path: string;
	parentSessionId?: string;
	metadata?: Record<string, unknown>;
}

export interface SqliteSessionCreateOptions extends SessionCreateOptions {
	cwd: string;
	parentSessionId?: string;
	metadata?: Record<string, unknown>;
}

export interface SqliteSessionListOptions {
	cwd?: string;
}

export type SqliteSessionStoreEnv = Pick<FileSystem, "absolutePath" | "createDir" | "exists">;
