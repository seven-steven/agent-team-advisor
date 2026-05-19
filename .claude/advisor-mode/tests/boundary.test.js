const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const claudeRoot = path.resolve(__dirname, '..', '..');
const executorPath = path.join(claudeRoot, 'agents', 'executor-guidance.md');
const boundaryHookPath = path.join(claudeRoot, 'hooks', 'advisor-boundary-check.js');
const { validateAdvisorBoundary } = require(boundaryHookPath);

function makeTempAdvisor(toolsLine) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'advisor-boundary-'));
  const agentsDir = path.join(root, '.claude', 'agents');
  fs.mkdirSync(agentsDir, { recursive: true });
  fs.writeFileSync(
    path.join(agentsDir, 'advisor-reviewer.md'),
    `---\nname: advisor-reviewer\nmodel: opus\ntools: ${toolsLine}\n---\n\nRead-only advisor.\n`,
  );
  return root;
}

test('executor guidance keeps implementation tools and workspace mutation with executor', () => {
  const source = fs.readFileSync(executorPath, 'utf8');

  assert.match(source, /executor owns implementation/i);
  assert.match(source, /workspace mutation/i);
  assert.match(source, /tool execution/i);
  assert.match(source, /final decisions/i);
  assert.match(source, /Bash/i);
  assert.match(source, /Write/i);
  assert.match(source, /Edit/i);
  assert.match(source, /MultiEdit/i);
  assert.match(source, /advisor mode consultations are advisory and read-only/i);
});

test('validateAdvisorBoundary reports mutating advisor tools', () => {
  assert.equal(typeof validateAdvisorBoundary, 'function');
  const root = makeTempAdvisor('Read, Grep, Glob, Write');

  const result = validateAdvisorBoundary(root);

  assert.equal(result.ok, false);
  assert.deepEqual(result.advisorTools, ['Read', 'Grep', 'Glob', 'Write']);
  assert.equal(result.findings.some((finding) => finding.includes('Write')), true);
});
