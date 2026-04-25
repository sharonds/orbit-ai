import { describe, it, expect } from 'vitest'
import { runCli } from '../harness/run-cli.js'
import { prepareCliWorkspace } from '../harness/prepare-cli-workspace.js'

// This journey is not a destructive-migration safety gate. The alpha migration
// engine is a passthrough stub until Plan C.5 implements executable diff/apply
// behavior. Release documentation must not claim Journey 8 proves destructive
// migration detection.
describe('Journey 8 - migration preview/apply alpha stub passthrough', () => {
  it('CLI returns the current stub response without claiming migration safety', async () => {
    const workspace = await prepareCliWorkspace({ tenant: 'acme' })
    try {
      const add = await runCli({
        args: ['--mode', 'direct', 'fields', 'create', 'contacts', '--name', 'region', '--type', 'text'],
        cwd: workspace.cwd,
        env: workspace.env,
      })
      expect(add.exitCode, `fields create exitCode (stderr: ${add.stderr})`).toBe(0)

      // Preview — orbit --json migrate --preview
      const preview = await runCli({
        args: ['--mode', 'direct', '--json', 'migrate', '--preview'],
        cwd: workspace.cwd,
        env: workspace.env,
      })
      expect(preview.exitCode, `migrate --preview exitCode (stderr: ${preview.stderr})`).toBe(0)
      expect(preview.json).toEqual({ operations: [], destructive: false, status: 'ok' })

      const apply = await runCli({
        args: ['--mode', 'direct', '--json', 'migrate', '--apply', '--yes'],
        cwd: workspace.cwd,
        env: workspace.env,
      })
      expect(apply.exitCode, `migrate --apply exitCode (stderr: ${apply.stderr})`).toBe(0)
      expect(apply.json).toEqual({ applied: [], status: 'ok' })
    } finally {
      await workspace.cleanup()
    }
  })
})
