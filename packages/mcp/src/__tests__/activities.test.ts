import { describe, it, expect, vi } from 'vitest'
import { handleLogActivity } from '../tools/activities.js'

describe('handleLogActivity', () => {
  it('passes body field (not description) to SDK', async () => {
    const mockLog = vi.fn().mockResolvedValue({ id: 'act_1', type: 'call', body: 'notes' })
    const client = { activities: { log: mockLog } } as unknown

    await handleLogActivity(client as never, {
      type: 'call',
      body: 'notes from the call',
      occurred_at: '2026-04-10T10:00:00Z',
    })

    const callArg = mockLog.mock.calls[0]![0]
    expect(callArg).toHaveProperty('body')
    expect(callArg).not.toHaveProperty('description')
  })

  it('passes logged_by_user_id field (not user_id) to SDK', async () => {
    const mockLog = vi.fn().mockResolvedValue({ id: 'act_2', type: 'call' })
    const client = { activities: { log: mockLog } } as unknown

    await handleLogActivity(client as never, {
      type: 'call',
      logged_by_user_id: 'usr_abc',
      occurred_at: '2026-04-10T10:00:00Z',
    })

    const callArg = mockLog.mock.calls[0]![0]
    expect(callArg).toHaveProperty('logged_by_user_id')
    expect(callArg).not.toHaveProperty('user_id')
  })

  it('returns error result for invalid input (safeParse)', async () => {
    const mockLog = vi.fn()
    const client = { activities: { log: mockLog } } as unknown

    const result = await handleLogActivity(client as never, { occurred_at: '2026-04-10T10:00:00Z' })

    expect(mockLog).not.toHaveBeenCalled()
    const text = (result as { content: Array<{ text: string }> }).content[0]?.text ?? ''
    const parsed = JSON.parse(text) as { ok: boolean; data: { error: string } }
    expect(parsed.data).toHaveProperty('error', 'Invalid input')
    const details = (parsed.data as { details?: string }).details
    expect(typeof details).toBe('string')
    expect(details).not.toMatch(/^\[{/) // must not be a raw JSON-encoded array
  })
})
