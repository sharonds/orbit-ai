import { describe, it, expect, vi } from 'vitest'
import { formatOutput } from '../output/formatter.js'
import { formatJson } from '../output/json.js'
import { createProgram, isJsonMode, _resetJsonMode } from '../program.js'

describe('JSON fidelity', () => {
  it('preserves request_id and next_cursor from SDK envelope', () => {
    const envelope = {
      data: [],
      meta: { request_id: 'req_known', next_cursor: 'cursor_abc', has_more: true, total: 0 },
      links: { next: '/v1/contacts?cursor=cursor_abc' },
    }
    const out = formatOutput(envelope, { format: 'json' })
    const parsed = JSON.parse(out)
    expect(parsed.meta.request_id).toBe('req_known')
    expect(parsed.meta.next_cursor).toBe('cursor_abc')
  })

  it('adds no extra keys beyond what SDK returned', () => {
    const envelope = { data: [{ id: 'cnt_1' }], meta: { request_id: 'r1' } }
    const out = formatOutput(envelope, { format: 'json' })
    const parsed = JSON.parse(out)
    expect(Object.keys(parsed)).toEqual(Object.keys(envelope))
  })

  it('pass-through for single-record envelope', () => {
    const envelope = { data: { id: 'cnt_123', name: 'Alice' }, meta: { request_id: 'r2' } }
    const out = formatJson(envelope)
    const parsed = JSON.parse(out)
    expect(parsed.data.id).toBe('cnt_123')
    expect(parsed.meta.request_id).toBe('r2')
  })

  it('formats error envelope correctly (no ANSI codes)', () => {
    const errEnvelope = { error: { code: 'AUTH_INVALID_API_KEY', message: 'Invalid API key', request_id: 'r3' } }
    const out = formatJson(errEnvelope)
    // No ANSI escape codes
    expect(out).not.toMatch(/\x1b\[/)
    const parsed = JSON.parse(out)
    expect(parsed.error.request_id).toBe('r3')
  })

  it('no ANSI codes in JSON output', () => {
    const envelope = { data: [{ id: 'x' }], meta: {} }
    const out = formatOutput(envelope, { format: 'json' })
    expect(out).not.toMatch(/\x1b\[/)
    JSON.parse(out) // must be valid JSON
  })

  it('--format json sets isJsonMode() via preAction hook', async () => {
    _resetJsonMode()
    const prog = createProgram()
    prog.exitOverride()
    prog.configureOutput({ writeOut: () => {}, writeErr: () => {} })
    // Intercept process.exit and stdout/stderr to prevent side effects
    const origExit = process.exit
    process.exit = (() => { throw new Error('exit') }) as typeof process.exit
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    try {
      // Use default from:'node' so argv[0]/[1] are stripped — matches how CLI is invoked
      await prog.parseAsync(['node', 'orbit', '--format', 'json', 'contacts', 'list'])
    } catch {
      // action errors (missing API key, etc.) are expected
    } finally {
      process.exit = origExit
      vi.restoreAllMocks()
    }
    expect(isJsonMode()).toBe(true)
  })
})
