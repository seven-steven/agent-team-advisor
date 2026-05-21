# Phase 2: Enforced Trigger Gates - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-21
**Phase:** 2-Enforced Trigger Gates
**Areas discussed:** 风险触发规则, 重复失败升级, 人工审批边界, 受保护配置面

---

## 风险触发规则

| Option          | Description                                       | Selected |
| --------------- | ------------------------------------------------- | -------- |
| 组合规则 (推荐) | 按 tool class、path class、动作标签组合判定风险。 | ✓        |
| 仅按工具        | 只按 Bash / Edit / Write / MultiEdit 分层。       |          |
| 显式清单        | 维护显式 allow/deny 清单。                        |          |
| 交给 Claude     | 规划阶段再补齐。                                  |          |

**User's choice:** 组合规则 (推荐)
**Notes:** 规则源应放在策略文件中心，不写死在 hook 或 settings。用户还明确修正边界：宿主 Agent 负责 tool_use 权限控制，Advisor Mode 不复刻权限系统。Phase 2 需要拆成双边界：不做 tool permission gate，但可以做 critical/high-risk decision gate。

---

## 重复失败升级

| Option            | Description                                                 | Selected |
| ----------------- | ----------------------------------------------------------- | -------- |
| 归一化签名 (推荐) | 以工具类型 + 对象/路径类 + 归一化错误签名归并“同一种失败”。 | ✓        |
| 工具+退出码       | 只按工具名和退出码统计。                                    |          |
| 原文匹配          | 直接按原始错误文本匹配。                                    |          |
| 交给 Claude       | 先由 Claude 设默认归并法。                                  |          |

**User's choice:** 归一化签名 (推荐)
**Notes:** 同一失败签名连续 2 次就升级；达到阈值后必须产出显式信号并记录，但不直接阻断工具执行。executor 可以继续，不过后续必须带着“需要 advisor input”的标记和处置链路。

---

## 人工审批边界

| Option               | Description                                   | Selected |
| -------------------- | --------------------------------------------- | -------- |
| 审批信号 / 决策门禁  | 人工审批用于关键/高危决策，不接管 tool 权限。 | ✓        |
| 必须等人（工具门禁） | 对 critical action 自身做执行前拦截。         |          |
| 本 phase 不做        | 把 human approval 整体延后。                  |          |
| 我来重述             | 用户自行定义边界。                            |          |

**User's choice:** 用户重述后锁定为“tool 权限归宿主 Agent；关键/高危决策归人工参与或 workflow 控制”
**Notes:** 需要人工拍板的决策类包括：不可逆决策、安全边界决策、共享/生产决策、治理配置决策。workflow 应停在决策点，并向人呈现结构化决策包。审批结果态采用 approve / reject / revise / defer。

---

## 受保护配置面

| Option               | Description                                            | Selected |
| -------------------- | ------------------------------------------------------ | -------- |
| Policy / schema      | 策略文件、schema、risk rule 定义。                     | ✓        |
| Hooks / settings     | hook 实现与 wiring。                                   | ✓        |
| Agents / commands    | agent 定义、commands、workflow 资产。                  | ✓        |
| Routes / credentials | provider route、credential shape、conformance 控制面。 | ✓        |

**User's choice:** 四类全部纳入 protected surface
**Notes:** 默认控制强度是“先 advisor 再按需升人”；匹配方式以路径类为主；protected-surface change 要单独打结构化审计标签。

---

## Claude's Discretion

None.

## Deferred Ideas

None.
