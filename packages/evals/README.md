# Pi evals Pi 评测

Pi evals are behavioral, model-backed checks for Pi workflows. They adapt a real `AgentSession` to `vitest-evals`, run
it in isolated temporary project and agent directories, and attach native Pi session artifacts.
Use them to measure end-to-end behavior and compare prompts, tools, skills, models, or other harness configurations.
Pi evals 是针对 Pi 工作流的、由模型驱动的行为性检查。它们将真实的 `AgentSession` 适配到 `vitest-evals`，在隔离的临时项目目录与智能体目录中运行，并附加原生的 Pi 会话产物（artifact）。
可用它们来度量端到端行为，并对比不同的提示词、工具、技能、模型或其他 harness 配置。

## Running evals 运行评测

Run from the repository root with a default provider and model:
在仓库根目录下运行，并指定默认的服务商与模型：

```bash
npm run eval -- --provider openai --model gpt-5.6-sol
```

The equivalent environment variables are:
等价的环境变量写法为：

```bash
PI_PROVIDER=openai PI_MODEL=gpt-5.6-sol npm run eval
```

CLI values take precedence and become defaults for harnesses that do not select a model explicitly. Provider and model must be supplied together. The runner also allows no default when every executed harness configures its own model.
命令行参数优先级更高，并会作为那些未显式选择模型的 harness 的默认值。服务商与模型必须同时提供。当所有被执行的 harness 都各自配置了模型时，运行器也允许不设置默认值。
Authentication comes from Pi's normal `ModelRuntime`, including Pi subscription credentials and provider API-key
environment variables.
认证信息来自 Pi 常规的 `ModelRuntime`，包括 Pi 订阅凭据以及各服务商的 API key 环境变量。

Additional arguments are forwarded to Vitest:
其余参数会被转发给 Vitest：

```bash
npm run eval -- src/extensions.eval.ts
npm run eval -- -t "creates, reloads, and uses"
```

Each invocation prints an ignored `.eval/` artifact directory. `runs.jsonl` indexes completed harness runs and their
native Pi session JSONL attachments under `sessions/`. These files may contain prompts, responses, source code, and tool
output.
每次调用都会输出一个被 git 忽略的 `.eval/` 产物目录。`runs.jsonl` 会索引已完成的 harness 运行及其位于 `sessions/` 下的原生 Pi 会话 JSONL 附件。这些文件可能包含提示词、响应、源代码以及工具输出。

## Writing evals 编写评测

Follow [`vitest-evals`](https://github.com/getsentry/vitest-evals) for general suite, judge, assertion, and normalized
trace guidance. Pi-specific evals use `createPiCodingAgentHarness(...)` from `src/pi-harness.ts`, with one harness bound
to each `describeEval(...)` suite:
关于测试套件、评判器（judge）、断言以及标准化轨迹（trace）的通用指引，请参考 [`vitest-evals`](https://github.com/getsentry/vitest-evals)。Pi 专用的评测使用来自 `src/pi-harness.ts` 的 `createPiCodingAgentHarness(...)`，每个 `describeEval(...)` 套件绑定一个 harness：

```ts
import { expect } from "vitest";
import { describeEval } from "vitest-evals";
import { createPiCodingAgentHarness } from "./pi-harness.ts";

const harness = createPiCodingAgentHarness({ noTools: "all" });

describeEval("Pi smoke", { harness }, (it) => {
	it("answers a factual question", async ({ run }) => {
		const result = await run("What is the capital of France? Reply with only the city name.");
		expect(result.output).toBe("Paris");
	});
});
```

### Configuring the Pi harness 配置 Pi harness

`createPiCodingAgentHarness(...)` accepts:
`createPiCodingAgentHarness(...)` 接受以下参数：

- `name`: stable harness identity used by reports and comparisons.
  稳定的 harness 标识，供报告与对比使用。
- `model`: optional `{ provider, id }` selection. It overrides the runner's default model.
  可选的 `{ provider, id }` 模型选择，会覆盖运行器的默认模型。
- `noTools`: Pi's tool-disable configuration.
  Pi 的工具禁用配置。
- `transformSystemPrompt`: transforms the complete default prompt before the eval starts.
  在评测开始前对完整的默认提示词进行变换。
- `output`: transforms the final response and `AgentSession` into a JSON-safe domain result.
  将最终响应与 `AgentSession` 转换为 JSON 安全的领域结果。

An explicitly selected model makes model-comparison harnesses independent of the runner default:
显式选择模型可以让用于模型对比的 harness 不受运行器默认值影响：

```ts
const harness = createPiCodingAgentHarness({
	name: "claude-opus-4-6",
	model: { provider: "anthropic", id: "claude-opus-4-6" },
});
```

A run accepts either one prompt or a sequence of prompt and reload steps. Reload steps are useful when the preceding
prompt creates or changes Pi resources:
一次运行既可以接受单个提示词，也可以接受由提示词步骤与重载（reload）步骤组成的序列。当前一个提示词创建或修改了 Pi 资源时，重载步骤会很有用：

```ts
const result = await run([
	{ type: "prompt", content: "Create a Pi extension." },
	{ type: "reload" },
	{ type: "prompt", content: "Use the extension." },
]);
```

### Transforming harness output 变换 harness 输出

Use `output` to expose scenario-specific, JSON-safe behavior without adding that behavior to the generic Pi adapter:
使用 `output` 可以暴露特定场景所需的、JSON 安全的行为，而无需把这些行为加入通用的 Pi 适配器：

```ts
const harness = createPiCodingAgentHarness({
	output: ({ response, session }) => ({
		response,
		activeTools: session.getActiveToolNames(),
		extensionErrors: session.resourceLoader.getExtensions().errors,
	}),
});
```

Assert application behavior on `result.output`. Assert model and tool traces on `result.session`, using
`vitest-evals` helpers such as `toolCalls(...)`.
针对 `result.output` 断言应用行为；针对 `result.session` 断言模型与工具调用轨迹，可使用 `vitest-evals` 提供的辅助函数，例如 `toolCalls(...)`。

### Writing comparative eval sets 编写对比评测集

Use `evalHarnessTable(...)` with Vitest's native `describe.for(...)` to run the same inputs against multiple harnesses.
Harnesses may differ by prompt, tools, skills, model, or any other Pi configuration:
将 `evalHarnessTable(...)` 与 Vitest 原生的 `describe.for(...)` 结合使用，可以用相同的输入运行多个 harness。这些 harness 之间可以在提示词、工具、技能、模型或任何其他 Pi 配置上存在差异：

```ts
import { describe } from "vitest";
import { createJudge, describeEval } from "vitest-evals";
import { evalHarnessTable } from "./vitest-evals/harness-table.ts";

const TargetTaskJudge = createJudge<string, string>("TargetTaskJudge", ({ output }) => ({
	score: output === "expected result" ? 1 : 0,
}));

const harnessTable = evalHarnessTable(
	"target skill effectiveness",
	{
		baseline: withoutTargetSkillHarness,
		candidate: withTargetSkillHarness,
		repetitions: 6,
	},
);

describe.for(harnessTable)("$name repetition $repetition", ({ harness }) => {
	describeEval("target skill effectiveness", { harness, judges: [TargetTaskJudge], judgeThreshold: null }, (it) => {
		it("completes the target task", async ({ run }) => {
			await run("Complete the target task.");
		});
	});
});
```

Comparative suites should record correctness with deterministic or model-backed judges and set `judgeThreshold: null`.
This keeps a low score as an observation instead of making the Vitest invocation fail. Use hard assertions only for
suite invariants and infrastructure contracts. `expect.soft(...)` still fails the test and is not a scoring mechanism.
对比类测试套件应使用确定性或模型驱动的评判器记录正确性，并设置 `judgeThreshold: null`。这样低分只会被当作一次观测记录，而不会导致 Vitest 运行失败。硬性断言应仅用于套件不变量与基础设施契约。`expect.soft(...)` 仍会使测试失败，它并不是一种评分机制。

The Pi harness snapshots native session JSONL before deleting its temporary workspace. An eval-only `afterEach` hook
registers that snapshot against the explicit Vitest test task before reporters run.
Pi harness 会在删除其临时工作区之前对原生会话 JSONL 做快照。一个仅用于评测的 `afterEach` 钩子会在报告器（reporter）运行之前，把该快照登记到对应的 Vitest 测试任务上。

Harness names must be stable and unique within an eval set. The grouping key combines repetition with a non-empty string
`input.id` when available, otherwise with a SHA-256 hash of strict canonical JSON input. Use `candidate` for one treatment
or `candidates` for multiple treatments. Each candidate is compared only with the declared baseline. For each matched
input and repetition, the reporter computes pass-rate lift from each run's recorded average judge score, treating a score
of at least `1` as passing. Lift is the candidate pass rate minus the baseline pass rate, in percentage points. Missing
judge scores are reported as incomplete observations. Tokens, latency, and estimated cost remain separate
candidate-minus-baseline paired deltas; missing telemetry remains unavailable. If execution-order randomization becomes
necessary, use Vitest's built-in sequence shuffling.
harness 名称在同一评测集内必须稳定且唯一。分组键由重复次数（repetition）与非空字符串 `input.id`（若存在）组合而成；否则改用严格规范化 JSON 输入的 SHA-256 哈希。单个实验组使用 `candidate`，多个实验组使用 `candidates`。每个候选项只与声明的基线（baseline）进行比较。对于每一组匹配的输入与重复次数，报告器会依据各次运行记录的平均评判分数计算通过率提升（lift），并将分数不低于 `1` 视为通过。lift 即候选项通过率减去基线通过率，以百分点表示。缺失的评判分数会作为不完整观测上报。token 数、延迟与估算成本仍作为独立的“候选项减基线”配对差值；缺失的遥测数据仍标记为不可用。若确有必要随机化执行顺序，请使用 Vitest 内置的序列打乱功能。

See the [`skill-eval-harness`](https://github.com/adewale/skill-eval-harness/) guidance for comparative-eval methodology,
repetition strategy, trustworthy judges, and telemetry interpretation.
关于对比评测方法论、重复策略、可信评判器以及遥测数据解读，请参见 [`skill-eval-harness`](https://github.com/adewale/skill-eval-harness/) 的相关指引。
