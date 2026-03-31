import type { OrbitAuthContext } from '../adapters/interface.js'
import type { CompanyRepository } from '../entities/companies/repository.js'
import type { CompanyRecord } from '../entities/companies/validators.js'
import type { ContactRepository } from '../entities/contacts/repository.js'
import type { ContactRecord } from '../entities/contacts/validators.js'
import type { DealRepository } from '../entities/deals/repository.js'
import type { DealRecord } from '../entities/deals/validators.js'

export interface ContactContextResult {
  contact: ContactRecord
  company: CompanyRecord | null
  openDeals: DealRecord[]
  openTasks: Record<string, never>[]
  recentActivities: Record<string, never>[]
  tags: Array<{ id: string; name: string; color: string | null }>
  lastContactDate: string | null
}

export interface ContactContextService {
  getContactContext(
    ctx: Pick<OrbitAuthContext, 'orgId'>,
    input: { contactId?: string; email?: string },
  ): Promise<ContactContextResult | null>
}

export function createContactContextService(deps: {
  contacts: ContactRepository
  companies: CompanyRepository
  deals: DealRepository
}): ContactContextService {
  return {
    async getContactContext(ctx, input) {
      let contact: ContactRecord | null = null

      if (input.contactId) {
        contact = await deps.contacts.get(ctx, input.contactId)
      } else if (input.email) {
        const matches = await deps.contacts.search(ctx, {
          query: input.email,
          limit: 100,
          sort: [{ field: 'updated_at', direction: 'desc' }],
        })
        contact = matches.data.find((candidate) => candidate.email?.toLowerCase() === input.email?.toLowerCase()) ?? null
      }

      if (!contact) {
        return null
      }

      const company = contact.companyId ? await deps.companies.get(ctx, contact.companyId) : null
      const openDeals = (
        await deps.deals.list(ctx, {
          filter: {
            contact_id: contact.id,
            status: 'open',
          },
          sort: [{ field: 'updated_at', direction: 'desc' }],
          limit: 100,
        })
      ).data

      const lastContactDate = contact.lastContactedAt ? contact.lastContactedAt.toISOString() : null

      return {
        contact,
        company,
        openDeals,
        openTasks: [],
        recentActivities: [],
        tags: [],
        lastContactDate,
      }
    },
  }
}
