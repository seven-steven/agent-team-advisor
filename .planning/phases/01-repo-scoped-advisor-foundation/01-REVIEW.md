---
phase: 01-repo-scoped-advisor-foundation
reviewed: 2026-05-19T12:05:07Z
depth: deep
files_reviewed: 14
files_reviewed_list:
  - .claude/advisor-mode/README.md
  - .claude/advisor-mode/init.js
  - .claude/advisor-mode/policy.example.json
  - .claude/advisor-mode/tests/advisor-agent.test.js
  - .claude/advisor-mode/tests/boundary.test.js
  - .claude/advisor-mode/tests/init.test.js
  - .claude/advisor-mode/tests/scaffold-layout.test.js
  - .claude/advisor-mode/verdict.schema.json
  - .claude/agents/advisor-reviewer.md
  - .claude/agents/executor-guidance.md
  - .claude/hooks/advisor-boundary-check.js
  - .claude/hooks/advisor-install-audit.js
  - .claude/settings.json
  - .gitignore
findings:
  critical: 2
  warning: 2
  info: 0
  total: 4
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-05-19T12:05:07Z
**Depth:** deep
**Files Reviewed:** 14
**Status:** issues_found

## Summary

本次 review 覆盖了 repo-scoped advisor scaffold、hook wiring、schema/文档契约以及对应测试。主要问题不在表层语法，而在跨文件契约没有真正落地：边界检查 hook 实际上不做任何边界校验，scaffold 也会无条件覆盖现有 agent/hook 文件，存在直接破坏现有仓库配置与只读边界失效的风险。

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: PreToolUse 边界 hook 被接入但从不执行边界校验

**File:** `.claude/hooks/advisor-boundary-check.js:43-80, 94-115`
**Issue:** `validateAdvisorBoundary()` 实现了 advisor frontmatter 校验，但 `main()` 从未调用它，也没有读取 `$CLAUDE_PROJECT_DIR` 或任何 root path。当前运行时路径只是在收到任意 `tool_name` 后无条件输出一段提醒文本并以 0 退出。结果是 `.claude/settings.json` 虽然把该脚本接到了 `PreToolUse`，但 advisor 一旦被误配为包含 `Write`/`Bash` 等变更工具，hook 不会阻止、也不会告警，项目要求的 “advisor 必须保持只读” 在运行时完全未被强制执行。
**Fix:** 在 `main()` 中解析项目根目录，调用 `validateAdvisorBoundary()`，发现异常时返回非零退出码并输出明确原因；只有校验通过时才输出附加上下文。例如：

```js
function main() {
  let input = "";
  const stdinTimeout = setTimeout(() => process.exit(0), 3000);

  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    input += chunk;
  });
  process.stdin.on("end", () => {
    clearTimeout(stdinTimeout);
    try {
      const data = input ? JSON.parse(input) : {};
      const rootDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
      const result = validateAdvisorBoundary(rootDir);
      if (!result.ok) {
        process.stderr.write(`${result.findings.join("; ")}\n`);
        process.exit(2);
      }
      if (data.tool_name || data.toolName) {
        writeHookContext();
      }
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
      process.exit(1);
    }
  });
}
```

### CR-02: init scaffold 会无条件覆盖已有 `.claude` 资产，存在数据丢失风险

**File:** `.claude/advisor-mode/init.js:305-309, 373-381`
**Issue:** `writeFile()` 对每个 scaffold 文件直接 `fs.writeFileSync(target, content)`，`scaffoldAdvisorMode()` 每次运行都会重写 `.claude/agents/advisor-reviewer.md`、`.claude/agents/executor-guidance.md`、两个 hooks、README、schema 和 policy。只要目标仓库已经有定制过的 agent/hook 内容，重新执行 init 就会静默抹掉本地修改。这不是幂等，而是 destructive overwrite；对真实仓库属于配置数据丢失风险。
**Fix:** 仅在文件不存在时创建；如已存在则保留并提示用户，或提供显式 `--force` 开关才允许覆盖。例如：

```js
function writeFile(rootDir, relativePath, content, { force = false } = {}) {
  const target = path.join(rootDir, relativePath);
  ensureDir(target);
  if (!force && fs.existsSync(target)) {
    return { written: false, skipped: true, target };
  }
  fs.writeFileSync(target, content, { flag: force ? "w" : "wx" });
  return { written: true, skipped: false, target };
}
```

并在 `main()` 中把覆盖行为绑定到显式参数，例如 `node init.js --force`。

## Warnings

### WR-01: 安装产物声明了 audit 目标和 baseline 事件，但运行时代码完全不记录任何事件

**File:** `.claude/advisor-mode/policy.example.json:7-22`, `.claude/hooks/advisor-install-audit.js:1-25`, `.claude/advisor-mode/README.md:24-30`
**Issue:** policy 明确暴露了 `auditTarget: .advisor/audit/events.jsonl` 和 baseline 事件 `scaffold.install` / `advisor.verdict.received` / `executor.followup.recorded`，README 也把 `.advisor/audit` 描述为 JSONL 审计目录；但实际唯一相关 hook `advisor-install-audit.js` 只输出一段 `additionalContext`，没有写入 `.advisor/audit/events.jsonl`，也没有任何地方产生这些 baseline 事件。这样会让下游集成方误以为安装后已具备最小可审计链路，实际没有任何持久化审计数据，跨文件契约不一致。
**Fix:** 要么收窄契约，把 policy/README 改成“预留 audit 路径，Phase 1 不产生日志”；要么真正实现最小事件落盘，例如在 init 完成时写入 `scaffold.install`，并让 hook 至少 append JSONL 到 `auditTarget`。

### WR-02: hook 命令硬编码 `/usr/bin/node`，与项目“可移植本地 Node 运行时”目标不一致

**File:** `.claude/advisor-mode/init.js:5-6`, `.claude/settings.json:65-67, 117-119`
**Issue:** scaffold 生成的 hook command 全部固定为 `"/usr/bin/node" ...`。这要求目标机器的 Node 必须恰好位于 `/usr/bin/node`，在非 Linux、NVM/asdf/Homebrew、容器裁剪镜像或企业受控环境下都可能失效。项目文档强调 Node 作为可移植本地 runtime，但这里把路径绑死到了单一文件系统位置，部署鲁棒性不足。
**Fix:** 使用环境中的 `node` 可执行文件，或在生成时解析 `process.execPath` 并写入当前真实路径。更稳妥的是：

```js
const NODE_COMMAND = "node";
const BOUNDARY_COMMAND = `${NODE_COMMAND} "$CLAUDE_PROJECT_DIR"/.claude/hooks/advisor-boundary-check.js`;
const AUDIT_COMMAND = `${NODE_COMMAND} "$CLAUDE_PROJECT_DIR"/.claude/hooks/advisor-install-audit.js`;
```

如果必须固定绝对路径，则至少应在 init 阶段基于 `process.execPath` 生成，而不是写死 `/usr/bin/node`。

---

_Reviewed: 2026-05-19T12:05:07Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
