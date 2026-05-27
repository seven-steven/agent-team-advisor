# Phase 3: Verdict Handoff and Verification Evidence - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 3-Verdict Handoff and Verification Evidence
**Areas discussed:** 最终复核触发, 最小上下文包, 执行者理由记录, 验证证据形状

---

## 最终复核触发

| Option       | Description                                                                                               | Selected |
| ------------ | --------------------------------------------------------------------------------------------------------- | -------- |
| 完成前必审   | 当 executor 准备把一个 non-trivial task 标记完成时，必须先拿 fresh advisor final review；最贴合 GATE-03。 | ✓        |
| 有改动就审   | 只要产生 changed files 或执行了会落盘的工作，就要求 final review；覆盖广，但可能太吵。                    |          |
| 仅计划节点审 | 只在 plan/phase 完成节点要求 final review；实现简单，但可能放过中途独立完成的非 trivial 工作。            |          |
| 高风险才审   | 只对高风险或被 gate 过的任务要求 final review；成本低，但不完全满足“完成前复核”的一致性。                 |          |

**User's choice:** 完成前必审
**Notes:** non-trivial task 采用状态驱动；completion 前 verdict 必须 fresh；只有 PASS 可以直接完成。

---

## 最小上下文包

| Option       | Description                                                                                                 | Selected |
| ------------ | ----------------------------------------------------------------------------------------------------------- | -------- |
| 精简四件套   | 默认带 changed files、relevant diff excerpts、relevant errors、explicit questions；信息够用且仍然是最小包。 | ✓        |
| 只带 diff    | 默认只带 changed files + diff；最省，但 advisor 常会缺少失败背景。                                          |          |
| 加文件大摘录 | 默认再加关键文件全文或大段摘录；判断更稳，但更容易滑向 full transcript。                                    |          |
| 分层档位     | 做成多档位，按风险动态增减；更灵活，但会把 Phase 3 推向策略系统。                                           |          |

**User's choice:** 精简四件套
**Notes:** 代码内容默认裁到相关 hunk + 短摘录；explicit questions 必须是结构化问题清单；信息不足时走显式补包。

---

## 执行者理由记录

| Option        | Description                                                                                                       | Selected |
| ------------- | ----------------------------------------------------------------------------------------------------------------- | -------- |
| 独立 artifact | 单独写 executor-decision artifact，专门记录 accepted / rejected / deferred、rationale、关联 verdict；边界最清楚。 | ✓        |
| 回写 verdict  | 直接回写到 advisor verdict artifact 上；文件更少，但会混淆 advisor 与 executor 的责任边界。                       |          |
| 仅 audit 事件 | 只记到 audit event，不保留专门 artifact；最轻，但不利于后续复盘。                                                 |          |
| 双写          | 同时写 verdict 和 audit；信息全，但容易重复和漂移。                                                               |          |

**User's choice:** 独立 artifact
**Notes:** 逐建议记录 disposition；每条都带短理由和证据链；收到 verdict 立刻写 decision artifact。

---

## 验证证据形状

| Option     | Description                                                                                               | Selected |
| ---------- | --------------------------------------------------------------------------------------------------------- | -------- |
| 单一证据包 | 每个 guarded task 产出一份 verification-evidence artifact，里面带 commands[] 和最终 summary；读取最直接。 | ✓        |
| 逐命令追加 | 每条命令单独追加一条 evidence record，不做汇总包；最接近日志，但读起来碎。                                |          |
| 双层保留   | 同时保留逐命令记录和最终汇总包；最全，但会增加重复。                                                      |          |
| 只留总结   | 只保留最终 summary，不存命令级证据；最轻，但不够可审计。                                                  |          |

**User's choice:** 单一证据包
**Notes:** 每条命令保留 command、exit status、concise result summary、timestamp；包级汇总 changed files 与 residual risks；只收验证命令；artifact 是不可变快照。

---

## Claude's Discretion

None.

## Deferred Ideas

None.
