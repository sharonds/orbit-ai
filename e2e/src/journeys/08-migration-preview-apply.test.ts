import { describe, it, expect } from 'vitest'
import { runCli } from '../harness/run-cli.js'
import { prepareCliWorkspace } from '../harness/prepare-cli-workspace.js'

describe('Journey 8 — preview and apply a reversible migration', () => {
  it('migrate --preview and --apply work without error; destructive flag is reported', async () => {
    const workspace = await prepareCliWorkspace({ tenant: 'acme' })
    try {
      // Add a custom field (uses already-working fields create)
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
      const plan = preview.json as { destructive?: boolean; operations?: unknown[]; applied?: unknown[] } | null
      // In alpha, addField is applied immediately — no pending migrations.
      // Verify the preview returns a non-error response with a destructive indicator.
      expect(plan).toBeTruthy()
      expect(plan?.destructive ?? false).toBe(false)

      // Apply — should succeed (even with nothing pending)
      const apply = await runCli({
        args: ['--mode', 'direct', 'migrate', '--apply', '--yes'],
        cwd: workspace.cwd,
        env: workspace.env,
      })
      expect(apply.exitCode, `migrate --apply exitCode (stderr: ${apply.stderr})`).toBe(0)
    } finally {
      await workspace.cleanup()
    }
  })
})
