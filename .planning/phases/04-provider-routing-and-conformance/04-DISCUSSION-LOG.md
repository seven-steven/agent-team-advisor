# Phase 4: Provider Routing and Conformance - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 4-Provider Routing and Conformance
**Areas discussed:** Provider routing responsibility, Hook control surface, Reference route expression, Conformance validation scope, Provider/model visibility

---

## Provider routing responsibility

| Option     | Description                                                                                                     | Selected |
| ---------- | --------------------------------------------------------------------------------------------------------------- | -------- |
| 映射层     | provider routing 只负责把 semantic alias 映射到 provider + model，并暴露少量 route 元数据给 conformance / audit | ✓        |
| 映射+连接  | 除 alias→provider/model 外，还承载 endpoint、credential key 名称、必要请求参数等完整连接层信息                  |          |
| 一体化控制 | 把 routing、hook 触发、审计字段都绑进同一套 provider 配置                                                       |          |

**User's choice:** 映射层
**Notes:** 用户表示不太理解 provider routing 的具体职责，因此先收窄为薄映射层，避免 Phase 4 演变成总控层。

---

## Hook control surface

| Option    | Description                                                     | Selected |
| --------- | --------------------------------------------------------------- | -------- |
| 插件自带  | 把 hook 作为插件/skill 自带资产安装和管理，尽量不污染用户配置面 | ✓        |
| Repo 本地 | 继续以 `.claude/settings.json` + `.claude/hooks/` 作为主控制面  |          |
| 双层模式  | 插件自带优先，必要时再落到 repo 配置                            |          |

**User's choice:** 插件自带
**Notes:** 用户明确提出，如果项目定位是插件/skill，Claude 允许插件自己定义 hook，这种方式更优雅，也更少污染用户配置。

---

## Reference route expression

| Option       | Description                                                                 | Selected |
| ------------ | --------------------------------------------------------------------------- | -------- |
| 固定内置基线 | 直接锁定 `sonnet → GLM`、`opus → GPT-5.5`                                   |          |
| 可声明默认值 | 提供默认 reference route，但允许后续替换具体 provider/model 而不改 workflow | ✓        |
| 纯示例不预设 | 仅提供 schema 和示例，不内置默认 reference route                            |          |

**User's choice:** 可声明默认值
**Notes:** 用户还要求后续选择继续使用 AskUserQuestion。

---

## Conformance validation scope

| Option     | Description                                                                                                  | Selected |
| ---------- | ------------------------------------------------------------------------------------------------------------ | -------- |
| 关键兼容   | 验证 advisor-critical 依赖的 Anthropic-compatible 关键行为，如 message、streaming、tool use、usage、错误形状 | ✓        |
| 最小 smoke | 仅做最小运行性检查                                                                                           |          |
| 高覆盖     | 尽量完整覆盖更多异常分支与协议边角                                                                           |          |

**User's choice:** 关键兼容
**Notes:** 目标是证明“对 advisor-critical flow 足够安全”，不是做完整协议认证。

---

## Provider/model visibility

| Option   | Description                                             | Selected |
| -------- | ------------------------------------------------------- | -------- |
| 审计可见 | 在运行时事件/工件里记录每次命中的实际 provider 和 model | ✓        |
| 默认展示 | 也尽量在用户常见输出里直接展示                          |          |
| 按需显示 | 仅在 debug / doctor / conformance 输出里展示            |          |

**User's choice:** 审计可见
**Notes:** 用户偏向 operator/audit 可见，而不是把这类信息默认塞进所有日常输出。

---

## Claude's Discretion

- 路由配置格式、默认 route 元数据结构、conformance 命令形态可以由后续 planner 决定。

## Deferred Ideas

None.
