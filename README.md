# Advisor Mode

本项目的目的是基于 ClaudeCode Agent Teams 实现 Advisor Mode（顾问模式），为 Agent 提供一种多模型协作的编排机制，支持多种第三方模型，例如 GLM、DeepSeek、MiniMax、Kimi、Qwen、Anthropic、ChatGPT 等。

## 什么是 Advisor Mode

Advisor Mode 是一种多模型 Agent 编排模式：由一个成本更低、响应更快的 executor model 负责主循环、工具调用和任务执行；当任务进入高不确定性、高风险决策、复杂规划、失败诊断或最终验收阶段时，executor 会自动咨询能力更强的 advisor model。

advisor model 负责提供架构判断、风险评估、方案审查和验证建议；executor model 则根据 advisor 的意见决定是否采纳，并继续执行任务。

它的核心不是人工手动切换模型，而是让 Agent 自主判断何时升级推理资源，从而在成本、速度与质量之间取得平衡。
