import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const workflow = readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8')

test('publish job restores built package artifacts under packages/', () => {
  assert.match(
    workflow,
    /name: Download built package artifacts[\s\S]*?with:\n\s+name: package-dist\n\s+path: packages\n/,
  )
})

test('publish job verifies package entrypoints before publishing', () => {
  const verifyIndex = workflow.indexOf('name: Verify package artifacts')
  const publishIndex = workflow.indexOf('publish: pnpm release')

  assert.ok(verifyIndex > -1, 'missing package artifact verification step')
  assert.ok(publishIndex > -1, 'missing publish step')
  assert.ok(verifyIndex < publishIndex, 'artifact verification must happen before publish')
  assert.match(workflow, /run: node scripts\/verify-package-artifacts\.mjs/)
})
