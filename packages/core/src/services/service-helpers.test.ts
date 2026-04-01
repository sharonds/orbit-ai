import { describe, expect, it } from 'vitest'

import { runArrayQuery } from './service-helpers.js'

describe('service helpers', () => {
  it('rejects filters on blocked fields', () => {
    expect(() =>
      runArrayQuery(
        [
          {
            id: 'user_01ARYZ6S41YYYYYYYYYYYYYYYY',
            email: 'owner@orbit.test',
            name: 'Orbit Owner',
            role: 'owner',
            externalAuthId: 'auth_owner_secret',
            createdAt: new Date('2026-03-31T09:00:00.000Z'),
          },
          {
            id: 'user_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
            email: 'agent@orbit.test',
            name: 'Agent User',
            role: 'member',
            externalAuthId: 'auth_agent_secret',
            createdAt: new Date('2026-03-31T10:00:00.000Z'),
          },
        ],
        {
          query: '',
          filter: {
            externalAuthId: 'auth_agent_secret',
          },
        },
        {
          searchableFields: ['email', 'name', 'role'],
          filterableFields: ['email', 'name', 'role'],
        },
      ),
    ).toThrowError('Filter field "externalAuthId" is not allowed')
  })

  it('still supports exact matches on allowed fields', () => {
    const result = runArrayQuery(
      [
        {
          id: 'user_01ARYZ6S41YYYYYYYYYYYYYYYY',
          email: 'owner@orbit.test',
          name: 'Orbit Owner',
          role: 'owner',
          externalAuthId: 'auth_owner_secret',
          createdAt: new Date('2026-03-31T09:00:00.000Z'),
        },
        {
          id: 'user_01ARYZ6S41ZZZZZZZZZZZZZZZZ',
          email: 'agent@orbit.test',
          name: 'Agent User',
          role: 'member',
          externalAuthId: 'auth_agent_secret',
          createdAt: new Date('2026-03-31T10:00:00.000Z'),
        },
      ],
      {
        query: '',
        filter: {
          name: 'Agent User',
        },
      },
      {
        searchableFields: ['email', 'name', 'role'],
        filterableFields: ['email', 'name', 'role'],
      },
    )

    expect(result.data).toHaveLength(1)
    expect(result.data[0]?.name).toBe('Agent User')
  })
})
