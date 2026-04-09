import { describe, expect, it, vi } from 'vitest'
import { executeTool } from '../tools/registry.js'
import { makeMockClient, parseTextResult } from './helpers.js'

describe('workflow tools', () => {
  it('move_deal_stage calls deals.move not deals.update', async () => {
    const client = makeMockClient()
    await executeTool(client, 'move_deal_stage', {
      deal_id: 'deal_01',
      stage_id: 'stage_02',
      occurred_at: '2026-04-10T00:00:00.000Z',
      note: 'advance',
    })
    expect(client.deals.move).toHaveBeenCalledWith('deal_01', { stage_id: 'stage_02' })
    expect(client.deals.update).not.toHaveBeenCalled()
  })

  it('enroll_in_sequence uses sequences.enroll', async () => {
    const client = makeMockClient()
    await executeTool(client, 'enroll_in_sequence', { sequence_id: 'seq_01', contact_id: 'contact_01' })
    expect(client.sequences.enroll).toHaveBeenCalledWith('seq_01', { contact_id: 'contact_01' })
  })

  it('unenroll_from_sequence uses sequenceEnrollments.unenroll', async () => {
    const client = makeMockClient()
    await executeTool(client, 'unenroll_from_sequence', { enrollment_id: 'enroll_01', reason: 'done' })
    expect(client.sequenceEnrollments.unenroll).toHaveBeenCalledWith('enroll_01')
  })

  it('assign_record patches assigned_to_user_id', async () => {
    const client = makeMockClient()
    await executeTool(client, 'assign_record', { object_type: 'contacts', record_id: 'contact_01', user_id: 'user_01' })
    expect(client.contacts.update).toHaveBeenCalledWith('contact_01', { assigned_to_user_id: 'user_01' })
  })

  it('assign_record rejects unsupported object types at validation time', async () => {
    const result = await executeTool(makeMockClient(), 'assign_record', { object_type: 'stages', record_id: 'stage_01', user_id: 'user_01' } as never)
    expect(result.isError).toBe(true)
    expect(parseTextResult(result).error.code).toBe('VALIDATION_FAILED')
  })

  it('log_activity calls activities.log', async () => {
    const client = makeMockClient()
    await executeTool(client, 'log_activity', { type: 'email', occurred_at: '2026-04-10T00:00:00.000Z' })
    expect(client.activities.log).toHaveBeenCalled()
    expect(client.activities.create).not.toHaveBeenCalled()
  })

  it('list_activities truncates long strings', async () => {
    const client = makeMockClient()
    vi.mocked(client.activities.list).mockResolvedValueOnce({
      data: [{ id: 'activity_01', subject: 'a'.repeat(6000), description: 'b'.repeat(6000) }],
    } as never)
    const result = await executeTool(client, 'list_activities', {})
    const text = JSON.stringify(parseTextResult(result))
    expect(text.length).toBeLessThan(12000)
    expect(text).toContain('[truncated]')
  })

  it('bulk_operation direct mode emits audit log before delete batch', async () => {
    const client = makeMockClient({ direct: true })
    const spy = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
    await executeTool(client, 'bulk_operation', {
      object_type: 'contacts',
      operations: [{ action: 'delete', record_id: 'contact_01', confirm: true }],
    })
    expect(spy).toHaveBeenCalled()
  })
})
