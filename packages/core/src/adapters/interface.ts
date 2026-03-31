export interface OrbitAuthContext {
  userId?: string
  orgId: string
  apiKeyId?: string
  scopes?: string[]
  requestId?: string
}

export interface StorageAdapter {
  readonly name: string
}
