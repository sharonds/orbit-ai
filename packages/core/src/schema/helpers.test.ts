import { describe, expect, it } from 'vitest'
import { getTableColumns } from 'drizzle-orm'
import { apiKeys, organizationMemberships, organizations, users } from './tables.js'

describe('bootstrap schema slice 1', () => {
  it('keeps organizations bootstrap-scoped', () => {
    const columns = getTableColumns(organizations)

    expect(Object.keys(columns)).toEqual([
      'id',
      'name',
      'slug',
      'plan',
      'isActive',
      'settings',
      'createdAt',
      'updatedAt',
    ])
  })

  it('keeps tenant tables org-scoped', () => {
    expect(Object.keys(getTableColumns(users))).toContain('organizationId')
    expect(Object.keys(getTableColumns(organizationMemberships))).toContain('organizationId')
    expect(Object.keys(getTableColumns(apiKeys))).toContain('organizationId')
  })

  it('defines tenant lookup columns for api keys', () => {
    const columns = getTableColumns(apiKeys)

    expect(Object.keys(columns)).toEqual([
      'id',
      'organizationId',
      'name',
      'keyHash',
      'keyPrefix',
      'scopes',
      'lastUsedAt',
      'expiresAt',
      'revokedAt',
      'createdByUserId',
      'createdAt',
      'updatedAt',
    ])
  })
})
