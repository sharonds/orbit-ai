import type { OrbitAuthContext } from '@orbit-ai/core'

export interface OrbitApiVariables {
  requestId: string
  orbitVersion: string
  orbit: OrbitAuthContext
}

declare module 'hono' {
  interface ContextVariableMap extends OrbitApiVariables {}
}
