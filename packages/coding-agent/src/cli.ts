#!/usr/bin/env node
/**
 * CLI entry point for the refactored coding agent.
 * 重构后 coding agent 的 CLI 入口点。
 * Uses main.ts with AgentSession and new mode modules.
 * 使用 main.ts，配合 AgentSession 与新的模式(mode)模块。
 *
 * Test with: npx tsx src/cli-new.ts [args...]
 * 测试方式：npx tsx src/cli-new.ts [args...]
 */
import { APP_NAME } from "./config.ts";
import { configureHttpDispatcher } from "./core/http-dispatcher.ts";
import { main } from "./main.ts";

process.title = APP_NAME;
process.env.PI_CODING_AGENT = "true";
process.emitWarning = (() => {}) as typeof process.emitWarning;

// Configure undici's global dispatcher before provider SDKs issue requests.
// 在各 provider SDK 发起请求之前，先配置 undici 的全局 dispatcher。
// Runtime settings are applied once SettingsManager has loaded global/project settings.
// 一旦 SettingsManager 加载完全局/项目设置，运行时配置便会随之生效。
configureHttpDispatcher();

main(process.argv.slice(2));
