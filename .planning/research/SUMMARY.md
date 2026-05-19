# Project Research Summary

**Project:** Advisor Mode
**Domain:** Pure client-side advisor-mode orchestration for Claude Code Teams with Anthropic-compatible third-party model routing
**Researched:** 2026-05-19
**Confidence:** MEDIUM-HIGH

## Executive Summary

这类产品本质上不是再造一个通用 agent framework，而是围绕 Claude Code / Agent Teams 现有能力，构建一层纯客户端的编排、门禁与审计机制。研究结果一致指向同一个结论：executor 必须继续掌握主循环、工具调用和代码修改；advisor 必须是更强但只读的审查者，在高风险操作、重复失败、复杂判断和最终验收时被自动触发。

推荐路线是以 Claude Code 原生能力为底座：用 project-local subagent 定义 advisor，用 hooks 做强制触发与最终门禁，用 Anthropic-compatible provider 做 `sonnet` / `opus` / `haiku` 语义 alias 到真实第三方模型的路由，并从第一阶段就引入结构化审计与预算控制。最大的风险不是功能做不出来，而是做成“提示词约束 + 黑盒路由”的脆弱系统；规避方式是把策略、路由、审计、预算和回滚都做成明确、可验证的工程资产。

## Key Findings

### Recommended Stack

推荐技术栈强调“用 Claude Code 原语完成产品”，而不是引入额外托管控制平面。核心做法是：Claude Code Teams 负责客户端编排，Anthropic-compatible gateway 负责模型路由，TypeScript 脚本负责 hooks、策略和审计逻辑，Zod 用于结构化 advisor 输出与策略校验，JSONL 先作为本地审计事实源，后续再视需要接入 OpenTelemetry。

**Core technologies:**

- **Claude Code / Claude Code Teams**：编排底座 — 原生提供 subagents、hooks、settings、权限和模型语义位
- **Anthropic-compatible gateway（OpenRouter 起步，LiteLLM 进阶）**：模型路由层 — 保留 Claude 语义，同时接入第三方模型
- **TypeScript + Node.js**：本地策略与 hook 运行时 — 方便测试、分发、校验与脚本化
- **Zod**：结构化 contract 校验 — 约束 advisor 输出、预算策略与路由配置
- **Pino + JSONL 审计日志**：本地可审计事件流 — 记录触发原因、路由、成本、决策和验证证据

### Expected Features

研究把需求分成三层：table stakes、differentiators 和 anti-features。对这个项目而言，table stakes 就是产品成立所必须具备的系统能力；如果缺失，就只是一个“多模型提示词模板”，不是生产级 Advisor Mode。

**Must have (table stakes):**

- Advisor / executor 明确角色分离，且 advisor 只读
- 自动 advisor trigger policy，而不是人工决定何时升级到强模型
- 高风险工具调用门禁（尤其是 Bash/Edit/Write、配置、迁移、权限相关变更）
- 任务完成前的 final review gate
- 结构化 advisor 输出 contract
- Provider alias routing 与真实模型路由可观测性
- 预算控制、审计日志、失败循环检测、验证证据采集、kill switch / rollback

**Should have (competitive):**

- 风险评分触发器，而不是纯静态规则
- Advisor decision replay 与 policy dry-run / linter
- Explainable trigger reports 与 capability profiles
- Shadow/A-B route evaluation

**Defer (v2+):**

- Local dashboard / run viewer
- Multi-advisor quorum
- 跨 CLI 的泛化编排
- 基于历史接受结果的 learning loop

### Architecture Approach

推荐架构是“executor-owned mutation, advisor-owned judgment”。Executor 作为 team lead 持有 workspace 写权限、测试权限和最终执行权；advisor 作为只读 teammate / subagent，通过 Agent / SendMessage 获取范围化上下文并返回结构化风险报告。Hooks 与本地 policy 层负责在关键生命周期点触发或阻断动作，provider gateway 负责 alias 到真实模型的路由与成本/延迟观测。

**Major components:**

1. **Executor / Team Lead** — 主循环、工具调用、代码修改、验证与最终决策
2. **Advisor Agent** — 只读审查、失败诊断、风险评估、最终验收建议
3. **Hook + Policy Layer** — `PreToolUse` / `PostToolUse` / `Stop` / config guard 等强制门禁与状态机
4. **Provider Router** — Claude alias 到真实第三方模型的语义映射与观测
5. **Audit / Budget Layer** — JSONL 事件流、成本/延迟记录、advisor 配额与回滚开关

### Critical Pitfalls

最关键的坑不是“模型不够强”，而是系统边界不清、策略不可验证、路由不可观测。研究中特别突出的几个高风险点如下：

1. **把 prompt policy 当 enforcement** — 必须先做 hooks，再做提示词约束
2. **给 advisor 写权限或执行权限** — 必须结构性限制工具，而不是只在 prompt 里要求“只读”
3. **Anthropic-compatible 只做 HTTP 兼容，不做语义/工具/流式一致性验证** — 必须建设 conformance suite
4. **没有本地可审计事件流** — 触发原因、路由模型、成本、advisor 决策和 executor 采纳情况都必须可追溯
5. **成本控制后补** — 预算、cooldown、context minimization 必须作为一等约束尽早实现

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Hook Enforcement Skeleton

**Rationale:** 先把“必须请教 advisor”的规则变成可执行门禁，否则后续所有能力都不可靠
**Delivers:** 最小 `PreToolUse` / `PostToolUse` / `Stop` / config guard 骨架、基础 audit 事件、低风险放行策略
**Addresses:** Automatic advisor trigger policy, high-risk tool gate, final review gate, config safety
**Avoids:** Prompt-only enforcement, over-broad uncontrolled autonomy

### Phase 2: Advisor Contract and Boundaries

**Rationale:** 在强制触发之后，必须明确 advisor 的只读边界、输出格式和上下文交接协议
**Delivers:** Advisor agent 定义、结构化 verdict schema、handoff packet、final review contract
**Addresses:** Role separation, read-only advisor enforcement, structured output, cross-context handoff
**Avoids:** Advisor 直接执行、rubber-stamp final review、上下文丢失

### Phase 3: Provider Routing and Conformance

**Rationale:** 只有在本地门禁和 agent 边界稳定后，才适合把 `sonnet` / `opus` 语义映射到真实第三方模型
**Delivers:** Alias route policy、Anthropic-compatible gateway 集成、golden conformance suite、resolved-model logging
**Uses:** Gateway stack from STACK.md
**Implements:** Provider router + observability boundary

### Phase 4: Failure, Budget, and Observability Controls

**Rationale:** 项目价值高度依赖“失败时升级 + 可控成本 + 可解释审计”三者同时成立
**Delivers:** Failure-state machine、advisor cooldown / caps、context minimization、per-call usage/cost events、executor-decision journaling
**Addresses:** Failure loop detection, budget controls, routing observability, audit trail
**Avoids:** Cost runaway, blind spots, repeated unproductive escalations

### Phase 5: Hardening, Rollback, and Operator UX

**Rationale:** 在核心机制跑通后，再补齐 doctor、kill switch、灰度与文档，降低团队采用成本
**Delivers:** `doctor` / scaffold / rollback、policy validation、examples、graceful degradation、操作说明
**Addresses:** Installation scaffold, safe rollback, docs/examples, human escalation path
**Avoids:** 配置旁路、生产不可恢复、团队不可复现

### Phase Ordering Rationale

- 先做 hooks 和边界，再做模型路由；否则无法判断问题来自策略还是模型
- 先做本地审计事实源，再做预算和 dashboard；否则没有可靠观测基础
- 把高价值 P1 能力按“可靠触发 → 安全边界 → 真实模型 → 成本与审计 → 可运维化”顺序落地，最符合依赖关系

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 3:** 不同 Anthropic-compatible provider 的工具调用、流式输出、usage 字段与错误格式一致性需要实测
- **Phase 4:** 各 provider 的成本字段、cache 字段与 advisor cooldown 策略需要结合真实数据校准

Phases with standard patterns (skip research-phase):

- **Phase 1:** Hook skeleton、risk taxonomy、基础 JSONL audit 都是成熟模式
- **Phase 2:** Read-only advisor、structured verdict schema、handoff packet 设计模式清晰

## Confidence Assessment

| Area         | Confidence | Notes                                                                                     |
| ------------ | ---------- | ----------------------------------------------------------------------------------------- |
| Stack        | HIGH       | Claude Code hooks/subagents/settings 与 Anthropic-compatible gateway 路线都有较强文档依据 |
| Features     | HIGH       | Table stakes 与 anti-features 与项目目标高度一致，边界清晰                                |
| Architecture | HIGH       | Executor / advisor / hook / router / audit 分层清楚，依赖顺序明确                         |
| Pitfalls     | MEDIUM     | 风险模式明确，但具体 provider 行为仍需在实现阶段实测验证                                  |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Selected gateway/provider conformance:** 规划阶段必须补做真实路由目标的兼容性验证
- **Resolved-model observability:** 需要确认所选 gateway 是否稳定返回 concrete model / usage / request-id
- **Executor model baseline:** GLM 作为 executor 的实际工具调用稳定性需要通过 golden tasks 验证

## Sources

### Primary (HIGH confidence)

- Context7 `/websites/code_claude` — hooks, subagents, settings, llm-gateway, agent-teams 相关主题
- `.planning/research/STACK.md` — 推荐栈与兼容性策略
- `.planning/research/FEATURES.md` — table stakes / differentiators / anti-features
- `.planning/research/ARCHITECTURE.md` — 分层架构、数据流与 build order
- `.planning/research/PITFALLS.md` — 关键失败模式与 phase 映射

### Secondary (MEDIUM confidence)

- 官方 Claude Code 文档搜索结果 — hooks / subagents / settings / gateway / monitoring-usage
- LiteLLM 文档与 Anthropic-compatible 代理资料 — alias、budget、virtual keys、pass-through 模式
- OpenRouter Claude Code Anthropic-compatible 集成资料

### Tertiary (LOW confidence)

- 竞品与生态资料（Dispatch、Armada、AgentPipe、crewswarm 等）— 仅作为 feature/ops 参考，不作为核心设计依据

---

_Research completed: 2026-05-19_
_Ready for roadmap: yes_
