import { sql } from 'drizzle-orm'

import type { OrbitAuthContext, OrbitDatabase } from '../interface.js'
import { assertOrbitId } from '../../ids/parse-id.js'

export function buildSetTenantContextStatement(orgId: string) {
  return sql`select set_config('app.current_org_id', ${orgId}, true)`
}

export async function withTenantContext<T>(
  db: OrbitDatabase,
  context: OrbitAuthContext,
  fn: (tx: OrbitDatabase) => Promise<T>,
): Promise<T> {
  assertOrbitId(context.orgId, 'organization')

  return db.transaction(async (tx) => {
    await tx.execute(buildSetTenantContextStatement(context.orgId))
    return await fn(tx)
  })
}
