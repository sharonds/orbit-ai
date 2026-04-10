import { describe, expect, it } from 'vitest'
import { readTeamMembers } from '../resources/team-members.js'
import { readSchema } from '../resources/schema.js'
import { getTextContent, makeMockClient } from './helpers.js'

describe('resources', () => {
  it('readTeamMembers returns the expected envelope', async () => {
    const result = await readTeamMembers(makeMockClient())
    expect(result.contents[0]?.uri).toBe('orbit://team-members')
    expect(result.contents[0]?.mimeType).toBe('application/json')
    expect(getTextContent(result)).toContain('"_untrusted": true')
  })

  it('readTeamMembers truncates long strings', async () => {
    const client = makeMockClient()
    client.users.list = async () => ({
      data: [{ id: 'user_01', name: 'x'.repeat(700) }],
    } as never)
    const result = await readTeamMembers(client)
    expect(getTextContent(result)).toContain('[truncated]')
  })

  it('readSchema wraps data as untrusted', async () => {
    const result = await readSchema(makeMockClient())
    expect(result.contents[0]?.uri).toBe('orbit://schema')
    expect(getTextContent(result)).toContain('"_untrusted": true')
  })
})
