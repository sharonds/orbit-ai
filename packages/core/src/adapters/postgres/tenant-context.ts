import { sql } from 'drizzle-orm'

import type { OrbitAuthContext, OrbitDatabase } from '../interface.js'

export function buildSetTenantContextStatement(orgId: string) {
  return sql`select set_config('app.current_org_id', ${orgId}, true)`
}

export function buildClearTenantContextStatement() {
  return sql`select set_config('app.current_org_id', '', true)`
}

export async function withTenantContext<T>(
  db: OrbitDatabase,
  context: OrbitAuthContext,
  fn: (tx: OrbitDatabase) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    try {
      await tx.execute(buildSetTenantContextStatement(context.orgId))
      return await fn(tx)
    } finally {
      await tx.execute(buildClearTenantContextStatement())
    }
  })
}
