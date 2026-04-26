import { beforeEach, describe, expect, it, vi } from 'vitest'
import { execa } from 'execa'
import { INSTALL_TIMEOUT_MS, runInstall } from './install.js'

vi.mock('execa', () => ({
  execa: vi.fn(),
}))

const execaMock = vi.mocked(execa)

describe('runInstall (execa options and failures)', () => {
  beforeEach(() => {
    execaMock.mockReset()
    execaMock.mockResolvedValue({} as Awaited<ReturnType<typeof execa>>)
  })

  it('passes timeout and shell:false to execa', async () => {
    await expect(runInstall({ cwd: '/tmp/project', customCmd: 'pnpm install' })).resolves.toBe('pnpm')

    expect(execaMock).toHaveBeenCalledWith('pnpm', ['install'], {
      cwd: '/tmp/project',
      stdio: 'inherit',
      timeout: INSTALL_TIMEOUT_MS,
      shell: false,
    })
  })

  it('maps timeout failures to a readable 5-minute message', async () => {
    execaMock.mockRejectedValueOnce(Object.assign(new Error('timed out'), { timedOut: true }))

    await expect(runInstall({ cwd: '/tmp/project', customCmd: 'pnpm install' })).rejects.toThrow(
      'Install timed out after 5 minutes.',
    )
  })

  it('rethrows non-timeout failures unchanged', async () => {
    const error = Object.assign(new Error('install failed'), { exitCode: 1 })
    execaMock.mockRejectedValueOnce(error)

    await expect(runInstall({ cwd: '/tmp/project', customCmd: 'pnpm install' })).rejects.toBe(error)
  })
})
