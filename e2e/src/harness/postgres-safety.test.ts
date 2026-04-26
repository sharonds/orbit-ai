import { describe, expect, it } from 'vitest'
import { assertSafePostgresE2eUrl } from './postgres-safety.js'

describe('assertSafePostgresE2eUrl', () => {
  it('allows only explicit local Postgres e2e databases', () => {
    expect(() => assertSafePostgresE2eUrl('postgres://localhost:5432/orbit_e2e')).not.toThrow()
    expect(() => assertSafePostgresE2eUrl('postgresql://127.0.0.1:5432/orbit_e2e_test')).not.toThrow()
    expect(() => assertSafePostgresE2eUrl('postgres://[::1]:5432/orbit_ai_test')).not.toThrow()
  })

  it('rejects remote hosts, non-test databases, and unsupported protocols', () => {
    expect(() => assertSafePostgresE2eUrl('postgres://db.example.com:5432/orbit_e2e')).toThrow(/Refusing/)
    expect(() => assertSafePostgresE2eUrl('postgres://localhost:5432/prod')).toThrow(/Refusing/)
    expect(() => assertSafePostgresE2eUrl('mysql://localhost:3306/orbit_e2e')).toThrow(/unsupported/)
  })

  it('rejects query params that can override pg connection targets', () => {
    expect(() => assertSafePostgresE2eUrl('postgres://localhost:5432/orbit_e2e?host=prod.example.com')).toThrow(
      /query parameters/,
    )
    expect(() => assertSafePostgresE2eUrl('postgres://localhost:5432/orbit_e2e?dbname=prod')).toThrow(
      /query parameters/,
    )
  })
})
