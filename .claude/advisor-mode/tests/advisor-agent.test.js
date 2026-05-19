const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const claudeRoot = path.resolve(__dirname, '..', '..');
const advisorPath = path.join(claudeRoot, 'agents', 'advisor-reviewer.md');

function readFrontmatter(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const match = source.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(match, `${filePath} should start with frontmatter`);

  return Object.fromEntries(
    match[1]
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf(':');
        assert.notEqual(separator, -1, `frontmatter line should be key/value: ${line}`);
        return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
      }),
  );
}

test('advisor reviewer uses the locked read-only role frontmatter', () => {
  const frontmatter = readFrontmatter(advisorPath);

  assert.equal(frontmatter.name, 'advisor-reviewer');
  assert.equal(frontmatter.model, 'opus');
  assert.equal(frontmatter.tools, 'Read, Grep, Glob');

  const tools = frontmatter.tools.split(',').map((tool) => tool.trim());
  assert.deepEqual(tools, ['Read', 'Grep', 'Glob']);
  assert.equal(tools.some((tool) => ['Bash', 'Write', 'Edit', 'MultiEdit'].includes(tool)), false);
});

test('advisor reviewer response contract is verdict-first and advisory', () => {
  const source = fs.readFileSync(advisorPath, 'utf8');

  assert.match(source, /verdict-first/i);
  assert.match(source, /status: PASS, CONCERNS, FAIL, or BLOCKED/);
  assert.match(source, /risk level and confidence/i);
  assert.match(source, /blocking findings/i);
  assert.match(source, /recommended executor actions/i);
  assert.match(source, /verification guidance/i);
  assert.match(source, /read-only/i);
  assert.match(source, /executor retains all workspace mutation/i);
});
