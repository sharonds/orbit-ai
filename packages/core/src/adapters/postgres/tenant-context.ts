import type { OrbitAuthContext } from '../interface.js'

export async function withTenantContext<T>(
  _db: unknown,
  _context: OrbitAuthContext,
  fn: (_tx: unknown) => Promise<T>,
): Promise<T> {
  return fn(_db)
}
