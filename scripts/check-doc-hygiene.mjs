import { execFileSync } from 'node:child_process'

const trackedFiles = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)

const blockedPatterns = [
  /^docs\/reports\//,
  /^docs\/superpowers\//,
  /^REVIEW-.*\.md$/,
  /^PLAN-.*-EXECUTION-LEDGER\.md$/,
  /^CODEX-PLAN-.*\.md$/,
]

const allowedFiles = new Set([
  'docs/internal-knowledge.md',
])

const violations = trackedFiles.filter((file) => {
  if (allowedFiles.has(file)) {
    return false
  }
  return blockedPatterns.some((pattern) => pattern.test(file))
})

if (violations.length > 0) {
  console.error('Operational documentation belongs in sharonds/orbit-ai-knowledge, not this repo.')
  console.error('Move or archive these tracked files:')
  for (const file of violations) {
    console.error(`- ${file}`)
  }
  process.exit(1)
}

console.log('Doc hygiene check passed.')
