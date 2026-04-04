import { BaseResource } from './base-resource.js'
import type { OrbitTransport } from '../transport/index.js'

export interface ProductRecord {
  id: string
  object: 'product'
  organization_id: string
  name: string
  description: string | null
  price: number | null
  currency: string | null
  sku: string | null
  status: string
  custom_fields: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CreateProductInput {
  name: string
  description?: string
  price?: number
  currency?: string
  sku?: string
  status?: string
  custom_fields?: Record<string, unknown>
}

export interface UpdateProductInput extends Partial<CreateProductInput> {}

export class ProductResource extends BaseResource<ProductRecord, CreateProductInput, UpdateProductInput> {
  constructor(transport: OrbitTransport) {
    super(transport, '/v1/products')
  }
}
