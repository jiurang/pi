---
description: Scout gathers context, planner creates implementation plan (no implementation)
---
Use the subagent tool with the chain parameter to execute this workflow:
使用 subagent 工具并配合 chain 参数来执行此工作流：

1. First, use the "scout" agent to find all code relevant to: $@
   首先，使用 "scout" 代理找出与以下内容相关的所有代码：$@
2. Then, use the "planner" agent to create an implementation plan for "$@" using the context from the previous step (use {previous} placeholder)
   然后，使用 "planner" 代理，基于上一步的上下文为 "$@" 制定实施计划（使用 {previous} 占位符）

Execute this as a chain, passing output between steps via {previous}. Do NOT implement - just return the plan.
以链式（chain）方式执行，各步骤之间通过 {previous} 传递输出。不要进行实现 —— 只返回计划。
