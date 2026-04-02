import type { OrbitAuthContext } from '../adapters/interface.js'
import type { ActivityRecord } from '../entities/activities/validators.js'
import type { ActivityRepository } from '../entities/activities/repository.js'
import type { CompanyRepository } from '../entities/companies/repository.js'
import type { CompanyRecord } from '../entities/companies/validators.js'
import type { ContactRepository } from '../entities/contacts/repository.js'
import type { ContactRecord } from '../entities/contacts/validators.js'
import type { DealRepository } from '../entities/deals/repository.js'
import type { DealRecord } from '../entities/deals/validators.js'
import type { TaskRepository } from '../entities/tasks/repository.js'
import type { TaskRecord } from '../entities/tasks/validators.js'

export interface ContactContextResult {
  contact: ContactRecord
  company: CompanyRecord | null
  openDeals: DealRecord[]
  openTasks: TaskRecord[]
  recentActivities: ActivityRecord[]
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
  activities?: ActivityRepository
  tasks?: TaskRepository
}): ContactContextService {
  return {
    async getContactContext(ctx, input) {
      let contact: ContactRecord | null = null

      if (input.contactId) {
        contact = await deps.contacts.get(ctx, input.contactId)
      } else if (input.email) {
        const exactEmail = input.email.trim()
        if (exactEmail.length === 0) {
          return null
        }

        const matches = await deps.contacts.list(ctx, {
          filter: {
            email: exactEmail,
          },
          sort: [{ field: 'updated_at', direction: 'desc' }],
          limit: 1,
        })
        contact = matches.data[0] ?? null
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
      const openTasks = deps.tasks
        ? (
            await deps.tasks.list(ctx, {
              filter: {
                contact_id: contact.id,
                is_completed: false,
              },
              sort: [
                { field: 'due_date', direction: 'asc' },
                { field: 'created_at', direction: 'desc' },
              ],
              limit: 100,
            })
          ).data
        : []
      const recentActivities = deps.activities
        ? (
            await deps.activities.list(ctx, {
              filter: {
                contact_id: contact.id,
              },
              sort: [{ field: 'occurred_at', direction: 'desc' }],
              limit: 10,
            })
          ).data
        : []

      const latestActivityDate = recentActivities[0]?.occurredAt ?? null
      const maxDate =
        latestActivityDate && contact.lastContactedAt
          ? new Date(Math.max(latestActivityDate.getTime(), contact.lastContactedAt.getTime()))
          : latestActivityDate ?? contact.lastContactedAt
      const lastContactDate = maxDate ? maxDate.toISOString() : null

      return {
        contact,
        company,
        openDeals,
        openTasks,
        recentActivities,
        tags: [],
        lastContactDate,
      }
    },
  }
}
