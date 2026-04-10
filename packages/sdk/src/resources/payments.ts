import { BaseResource } from './base-resource.js'
import type { OrbitTransport } from '../transport/index.js'

export interface PaymentRecord {
  id: string
  object: 'payment'
  organization_id: string
  amount: number
  currency: string
  status: string
  deal_id: string | null
  contact_id: string | null
  payment_method: string | null
  external_id?: string | null
  metadata?: Record<string, unknown> | null
  paid_at: string | null
  custom_fields: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface CreatePaymentInput {
  amount: number
  currency: string
  status?: string
  deal_id?: string
  contact_id?: string
  payment_method?: string
  external_id?: string
  metadata?: Record<string, unknown>
  paid_at?: string
  custom_fields?: Record<string, unknown>
}

export interface UpdatePaymentInput extends Partial<CreatePaymentInput> {}

export class PaymentResource extends BaseResource<PaymentRecord, CreatePaymentInput, UpdatePaymentInput> {
  constructor(transport: OrbitTransport) {
    super(transport, '/v1/payments')
  }
}
