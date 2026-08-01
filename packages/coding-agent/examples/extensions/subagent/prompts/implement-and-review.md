---
description: Worker implements, reviewer reviews, worker applies feedback
---
Use the subagent tool with the chain parameter to execute this workflow:
使用 subagent 工具并配合 chain 参数来执行此工作流：

1. First, use the "worker" agent to implement: $@
   首先，使用 "worker" 代理实现：$@
2. Then, use the "reviewer" agent to review the implementation from the previous step (use {previous} placeholder)
   然后，使用 "reviewer" 代理评审上一步的实现（使用 {previous} 占位符）
3. Finally, use the "worker" agent to apply the feedback from the review (use {previous} placeholder)
   最后，使用 "worker" 代理落实评审意见（使用 {previous} 占位符）

Execute this as a chain, passing output between steps via {previous}.
以链式（chain）方式执行，各步骤之间通过 {previous} 传递输出。
