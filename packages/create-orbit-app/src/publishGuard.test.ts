import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { assertFixedVersionGroup } from './publishGuard.js'

describe('assertFixedVersionGroup', () => {
  it('fails when the changesets config is missing', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coa-guard-missing-'))
    try {
      expect(() => assertFixedVersionGroup({ repoRoot: root })).toThrow(/Plan B/i)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('passes when @orbit-ai/* is in the fixed-version group', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coa-guard-fixed-'))
    try {
      fs.mkdirSync(path.join(root, '.changeset'))
      fs.writeFileSync(
        path.join(root, '.changeset', 'config.json'),
        JSON.stringify({ fixed: [['@orbit-ai/*']] }),
      )
      expect(() => assertFixedVersionGroup({ repoRoot: root })).not.toThrow()
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('fails when the fixed-version group does not cover the scaffolder package', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coa-guard-unfixed-'))
    try {
      fs.mkdirSync(path.join(root, '.changeset'))
      fs.writeFileSync(
        path.join(root, '.changeset', 'config.json'),
        JSON.stringify({ fixed: [['@orbit-ai/core', '@orbit-ai/sdk']] }),
      )
      expect(() => assertFixedVersionGroup({ repoRoot: root })).toThrow(/fixed-version group/i)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
