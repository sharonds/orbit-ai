import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'node:events'

// Import the module under test
import { confirmAction } from '../utils/prompt.js'

describe('confirmAction', () => {
  let stdinMock: EventEmitter
  let origStdin: NodeJS.ReadStream & { fd: 0 }
  let stderrOutput: string

  beforeEach(() => {
    stdinMock = new EventEmitter() as unknown as NodeJS.ReadStream
    // confirmAction calls process.stdin.setEncoding — add a no-op so the mock doesn't throw
    ;(stdinMock as unknown as { setEncoding: (enc: string) => void }).setEncoding = () => {}
    origStdin = process.stdin
    Object.defineProperty(process, 'stdin', { value: stdinMock, configurable: true })
    stderrOutput = ''
    vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
      stderrOutput += String(chunk)
      return true
    })
  })

  afterEach(() => {
    Object.defineProperty(process, 'stdin', { value: origStdin, configurable: true })
    vi.restoreAllMocks()
  })

  it('resolves true when user types "y"', async () => {
    const p = confirmAction('Confirm? ')
    stdinMock.emit('data', 'y\n')
    expect(await p).toBe(true)
  })

  it('resolves false when user types "n"', async () => {
    const p = confirmAction('Confirm? ')
    stdinMock.emit('data', 'n\n')
    expect(await p).toBe(false)
  })

  it('resolves false when user types anything other than y', async () => {
    const p = confirmAction('Confirm? ')
    stdinMock.emit('data', 'yes\n')
    expect(await p).toBe(false)
  })

  it('resolves false on stdin EOF (end event) — does not hang', async () => {
    const p = confirmAction('Confirm? ')
    stdinMock.emit('end')
    expect(await p).toBe(false)
  })

  it('rejects on stdin error event', async () => {
    const p = confirmAction('Confirm? ')
    stdinMock.emit('error', new Error('stdin broken'))
    await expect(p).rejects.toThrow('stdin broken')
  })

  it('writes the prompt to stderr', async () => {
    const p = confirmAction('Are you sure? ')
    stdinMock.emit('data', 'n')
    await p
    expect(stderrOutput).toContain('Are you sure?')
  })
})
