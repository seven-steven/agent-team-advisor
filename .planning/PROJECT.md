# Advisor Mode

## What This Is

Advisor Mode 是一个基于 Claude Code Agent Teams 的纯客户端多模型编排项目。它让成本更低、响应更快的 executor model 负责主循环、工具调用和任务执行，在高风险、高不确定、失败诊断与最终验收阶段自动咨询更强的 advisor model。目标用户是希望在 Claude Code 中把多家第三方模型组合成生产级 coding agent 工作流的开发者或团队。

## Core Value

在不依赖 server_tool_use 的前提下，让 executor 能自主、可靠、可审计地自动触发 advisor，并据此提升复杂工程任务的质量。

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] 通过 Claude Code Agent Teams 实现纯客户端 Advisor Mode 工作流
- [ ] 通过 Anthropic-compatible Provider 将 sonnet / opus / haiku alias 路由到第三方模型
- [ ] executor 在高风险、高不确定、重复失败和任务完成前自动咨询 advisor
- [ ] advisor 保持只读角色，并输出结构化的风险评估、建议与验证清单
- [ ] 通过 hooks、prompt policy 和 provider observability 实现强制触发、审计、预算控制与回滚
- [ ] 提供可直接落地的项目资产：agent 定义、hook 脚本、settings、路由策略与灰度方案

### Out of Scope

- 直接依赖 Anthropic `advisor_20260301` 或其他 server-side tool 能力 — 项目目标是纯客户端实现
- 人工手动判断何时切换到顾问模型 — 核心价值是 agent 自主触发
- 让 advisor 直接修改代码或执行命令 — 顾问职责是审查和建议，不是执行
- 为每个第三方 provider 单独实现一套完全不同的工作流 — 优先通过统一 alias 与路由层抽象接入

## Context

- 已有研究结论表明，Anthropic 原生 advisor 是 server-side tool；第三方 provider 普遍没有协议等价物，但可以通过客户端编排复现大部分行为收益。
- 当前推荐架构是：Claude Code Teams 负责客户端编排，Anthropic-compatible Provider 负责 `claude-sonnet-*`、`claude-opus-*`、`claude-haiku-*` 到真实模型的语义路由。
- 当前重点落地方向是让 sonnet alias 路由到 GLM 作为 executor，让 opus alias 路由到 GPT-5.5 作为 advisor，同时保留对 DeepSeek、Qwen、MiniMax、Kimi 等模型的扩展路径。
- 项目需要把 advisor 触发条件做成工程化策略，包括高风险工具调用前门禁、重复失败后的升级咨询、以及完成前的最终审查。
- 研究文档已经整理了 hooks、agent 定义、provider 观测字段、成本控制和灰度回滚策略，可直接转化为初始项目结构与 phase 设计。

## Constraints

- **Architecture**: 必须是纯客户端方案 — 不依赖 Anthropic `server_tool_use` / `advisor_20260301`
- **Runtime**: 必须运行在 Claude Code / Claude Code Teams 语义下 — 以 subagent、hooks、SendMessage 和本地工具为主
- **Model Routing**: 必须兼容 Anthropic-compatible Provider — 通过 Claude alias 映射真实第三方模型
- **Safety**: advisor 必须保持只读 — 避免顾问直接执行高风险改动
- **Observability**: 必须可审计 — 需要记录触发原因、模型路由、token、延迟、成本和最终决策
- **Operational**: 必须支持预算控制与回滚 — 不能让 advisor 成本和延迟无限增长

## Key Decisions

| Decision                                                    | Rationale                                           | Outcome   |
| ----------------------------------------------------------- | --------------------------------------------------- | --------- |
| 采用 Claude Code Teams 作为客户端编排器                     | 原生支持 teammate / subagent 协作，最接近目标工作流 | — Pending |
| 采用 Anthropic-compatible Provider 做 alias 路由            | 让 Claude Code 保持 Claude 语义，同时接入第三方模型 | — Pending |
| 使用 GLM 作为 executor、GPT-5.5 作为 advisor 的参考落地组合 | 满足“弱模型执行、强模型顾问”的核心分工              | — Pending |
| 将 advisor 限定为只读角色                                   | 控制风险，保持 executor 对执行环节的最终控制权      | — Pending |
| 使用 hooks 强制触发高风险与最终审查咨询                     | 不能只依赖 executor 自觉请教顾问                    | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):

1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):

1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

_Last updated: 2026-05-19 after initialization_
