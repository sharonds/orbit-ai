import { createInsertSchema, createSelectSchema, createUpdateSchema } from 'drizzle-zod'
import { z } from 'zod'

import { assertOrbitId } from '../ids/parse-id.js'
import {
  activities,
  apiKeys,
  auditLogs,
  companies,
  contracts,
  contacts,
  customFieldDefinitions,
  deals,
  entityTags,
  idempotencyKeys,
  imports,
  notes,
  organizationMemberships,
  organizations,
  payments,
  pipelines,
  products,
  schemaMigrations,
  sequenceEnrollments,
  sequenceEvents,
  sequences,
  sequenceSteps,
  stages,
  tags,
  tasks,
  users,
  webhookDeliveries,
  webhooks,
} from './tables.js'

const emailSchema = z.string().email().optional().nullable()
const phoneSchema = z.string().min(5).optional().nullable()
const websiteSchema = z.string().url().optional().nullable()
const orbitId = (kind: Parameters<typeof assertOrbitId>[1]) =>
  z.string().transform((value, ctx) => {
    try {
      return assertOrbitId(value, kind)
    } catch (error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: error instanceof Error ? error.message : `Invalid ${kind} id`,
      })

      return z.NEVER
    }
  })

export const organizationSelectSchema = createSelectSchema(organizations, {
  id: orbitId('organization'),
})
export const organizationInsertSchema = createInsertSchema(organizations)
export const organizationUpdateSchema = createUpdateSchema(organizations)

export const userSelectSchema = createSelectSchema(users, {
  id: orbitId('user'),
  organizationId: orbitId('organization'),
  email: z.string().email(),
})
export const userInsertSchema = createInsertSchema(users, {
  organizationId: orbitId('organization'),
  email: z.string().email(),
})
export const userUpdateSchema = createUpdateSchema(users, {
  organizationId: orbitId('organization').optional(),
  email: emailSchema,
})

export const organizationMembershipSelectSchema = createSelectSchema(organizationMemberships, {
  id: orbitId('membership'),
  organizationId: orbitId('organization'),
  userId: orbitId('user'),
  invitedByUserId: orbitId('user').optional().nullable(),
})
export const organizationMembershipInsertSchema = createInsertSchema(organizationMemberships, {
  organizationId: orbitId('organization'),
  userId: orbitId('user'),
  invitedByUserId: orbitId('user').optional().nullable(),
})
export const organizationMembershipUpdateSchema = createUpdateSchema(organizationMemberships, {
  organizationId: orbitId('organization').optional(),
  userId: orbitId('user').optional(),
  invitedByUserId: orbitId('user').optional().nullable(),
})

export const apiKeySelectSchema = createSelectSchema(apiKeys, {
  id: orbitId('apiKey'),
  organizationId: orbitId('organization'),
})
export const apiKeyInsertSchema = createInsertSchema(apiKeys, {
  organizationId: orbitId('organization'),
})
export const apiKeyUpdateSchema = createUpdateSchema(apiKeys, {
  organizationId: orbitId('organization').optional(),
})

export const companySelectSchema = createSelectSchema(companies, {
  id: orbitId('company'),
  organizationId: orbitId('organization'),
  assignedToUserId: orbitId('user').optional().nullable(),
  website: websiteSchema,
})
export const companyInsertSchema = createInsertSchema(companies, {
  organizationId: orbitId('organization'),
  assignedToUserId: orbitId('user').optional().nullable(),
  website: websiteSchema,
})
export const companyUpdateSchema = createUpdateSchema(companies, {
  organizationId: orbitId('organization').optional(),
  assignedToUserId: orbitId('user').optional().nullable(),
  website: websiteSchema,
})

export const contactSelectSchema = createSelectSchema(contacts, {
  id: orbitId('contact'),
  organizationId: orbitId('organization'),
  email: emailSchema,
  phone: phoneSchema,
  assignedToUserId: orbitId('user').optional().nullable(),
  companyId: orbitId('company').optional().nullable(),
})
export const contactInsertSchema = createInsertSchema(contacts, {
  organizationId: orbitId('organization'),
  email: emailSchema,
  phone: phoneSchema,
  assignedToUserId: orbitId('user').optional().nullable(),
  companyId: orbitId('company').optional().nullable(),
})
export const contactUpdateSchema = createUpdateSchema(contacts, {
  organizationId: orbitId('organization').optional(),
  email: emailSchema,
  phone: phoneSchema,
  assignedToUserId: orbitId('user').optional().nullable(),
  companyId: orbitId('company').optional().nullable(),
})

export const pipelineSelectSchema = createSelectSchema(pipelines, {
  id: orbitId('pipeline'),
  organizationId: orbitId('organization'),
})
export const pipelineInsertSchema = createInsertSchema(pipelines, {
  organizationId: orbitId('organization'),
})
export const pipelineUpdateSchema = createUpdateSchema(pipelines, {
  organizationId: orbitId('organization').optional(),
})

export const stageSelectBaseSchema = createSelectSchema(stages, {
  id: orbitId('stage'),
  organizationId: orbitId('organization'),
  pipelineId: orbitId('pipeline'),
})
export const stageSelectSchema = stageSelectBaseSchema.superRefine((value, ctx) => {
  const stage = value as { isWon?: boolean; isLost?: boolean }

  if (stage.isWon && stage.isLost) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Stage cannot be both won and lost',
      path: ['isLost'],
    })
  }
})

export const stageInsertBaseSchema = createInsertSchema(stages, {
  organizationId: orbitId('organization'),
  pipelineId: orbitId('pipeline'),
})
export const stageInsertSchema = stageInsertBaseSchema.superRefine((value, ctx) => {
  const stage = value as { isWon?: boolean; isLost?: boolean }

  if (stage.isWon && stage.isLost) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Stage cannot be both won and lost',
      path: ['isLost'],
    })
  }
})

export const stageUpdateBaseSchema = createUpdateSchema(stages, {
  organizationId: orbitId('organization').optional(),
  pipelineId: orbitId('pipeline').optional(),
})
export const stageUpdateSchema = stageUpdateBaseSchema.superRefine((value, ctx) => {
  const stage = value as { isWon?: boolean; isLost?: boolean }

  if (stage.isWon && stage.isLost) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Stage cannot be both won and lost',
      path: ['isLost'],
    })
  }
})

export const dealSelectBaseSchema = createSelectSchema(deals, {
  id: orbitId('deal'),
  organizationId: orbitId('organization'),
  stageId: orbitId('stage').optional().nullable(),
  pipelineId: orbitId('pipeline').optional().nullable(),
  contactId: orbitId('contact').optional().nullable(),
  companyId: orbitId('company').optional().nullable(),
  assignedToUserId: orbitId('user').optional().nullable(),
  currency: z.string().length(3).transform((value) => value.toUpperCase()),
})
export const dealSelectSchema = dealSelectBaseSchema.superRefine((value, ctx) => {
  const deal = value as { wonAt?: Date | null; status?: string }

  if (deal.wonAt && deal.status !== undefined && deal.status !== 'won') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Deal wonAt requires a won status in slice 2',
      path: ['wonAt'],
    })
  }
})

export const dealInsertBaseSchema = createInsertSchema(deals, {
  organizationId: orbitId('organization'),
  stageId: orbitId('stage').optional().nullable(),
  pipelineId: orbitId('pipeline').optional().nullable(),
  contactId: orbitId('contact').optional().nullable(),
  companyId: orbitId('company').optional().nullable(),
  assignedToUserId: orbitId('user').optional().nullable(),
  currency: z.string().length(3).transform((value) => value.toUpperCase()),
})
export const dealInsertSchema = dealInsertBaseSchema.superRefine((value, ctx) => {
  const deal = value as { wonAt?: Date | null; status?: string }

  if (deal.wonAt && deal.status !== undefined && deal.status !== 'won') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Deal wonAt requires a won status in slice 2',
      path: ['wonAt'],
    })
  }
})

export const dealUpdateBaseSchema = createUpdateSchema(deals, {
  organizationId: orbitId('organization').optional(),
  stageId: orbitId('stage').optional().nullable(),
  pipelineId: orbitId('pipeline').optional().nullable(),
  contactId: orbitId('contact').optional().nullable(),
  companyId: orbitId('company').optional().nullable(),
  assignedToUserId: orbitId('user').optional().nullable(),
  currency: z.string().length(3).transform((value) => value.toUpperCase()).optional(),
})
export const dealUpdateSchema = dealUpdateBaseSchema.superRefine((value, ctx) => {
  const deal = value as { wonAt?: Date | null; status?: string }

  if (deal.wonAt && deal.status !== undefined && deal.status !== 'won') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Deal wonAt requires a won status in slice 2',
      path: ['wonAt'],
    })
  }
})

export const activitySelectSchema = createSelectSchema(activities, {
  id: orbitId('activity'),
  organizationId: orbitId('organization'),
  contactId: orbitId('contact').optional().nullable(),
  dealId: orbitId('deal').optional().nullable(),
  companyId: orbitId('company').optional().nullable(),
  loggedByUserId: orbitId('user').optional().nullable(),
})
export const activityInsertSchema = createInsertSchema(activities, {
  organizationId: orbitId('organization'),
  contactId: orbitId('contact').optional().nullable(),
  dealId: orbitId('deal').optional().nullable(),
  companyId: orbitId('company').optional().nullable(),
  loggedByUserId: orbitId('user').optional().nullable(),
})
export const activityUpdateSchema = createUpdateSchema(activities, {
  organizationId: orbitId('organization').optional(),
  contactId: orbitId('contact').optional().nullable(),
  dealId: orbitId('deal').optional().nullable(),
  companyId: orbitId('company').optional().nullable(),
  loggedByUserId: orbitId('user').optional().nullable(),
})

export const taskSelectSchema = createSelectSchema(tasks, {
  id: orbitId('task'),
  organizationId: orbitId('organization'),
  contactId: orbitId('contact').optional().nullable(),
  dealId: orbitId('deal').optional().nullable(),
  companyId: orbitId('company').optional().nullable(),
  assignedToUserId: orbitId('user').optional().nullable(),
})
export const taskInsertSchema = createInsertSchema(tasks, {
  organizationId: orbitId('organization'),
  contactId: orbitId('contact').optional().nullable(),
  dealId: orbitId('deal').optional().nullable(),
  companyId: orbitId('company').optional().nullable(),
  assignedToUserId: orbitId('user').optional().nullable(),
})
export const taskUpdateSchema = createUpdateSchema(tasks, {
  organizationId: orbitId('organization').optional(),
  contactId: orbitId('contact').optional().nullable(),
  dealId: orbitId('deal').optional().nullable(),
  companyId: orbitId('company').optional().nullable(),
  assignedToUserId: orbitId('user').optional().nullable(),
})

export const noteSelectSchema = createSelectSchema(notes, {
  id: orbitId('note'),
  organizationId: orbitId('organization'),
  contactId: orbitId('contact').optional().nullable(),
  dealId: orbitId('deal').optional().nullable(),
  companyId: orbitId('company').optional().nullable(),
  createdByUserId: orbitId('user').optional().nullable(),
})
export const noteInsertSchema = createInsertSchema(notes, {
  organizationId: orbitId('organization'),
  contactId: orbitId('contact').optional().nullable(),
  dealId: orbitId('deal').optional().nullable(),
  companyId: orbitId('company').optional().nullable(),
  createdByUserId: orbitId('user').optional().nullable(),
})
export const noteUpdateSchema = createUpdateSchema(notes, {
  organizationId: orbitId('organization').optional(),
  contactId: orbitId('contact').optional().nullable(),
  dealId: orbitId('deal').optional().nullable(),
  companyId: orbitId('company').optional().nullable(),
  createdByUserId: orbitId('user').optional().nullable(),
})

export const productSelectSchema = createSelectSchema(products, {
  id: orbitId('product'),
  organizationId: orbitId('organization'),
  currency: z.string().length(3).transform((value) => value.toUpperCase()),
})
export const productInsertSchema = createInsertSchema(products, {
  organizationId: orbitId('organization'),
  currency: z.string().length(3).transform((value) => value.toUpperCase()).optional(),
})
export const productUpdateSchema = createUpdateSchema(products, {
  organizationId: orbitId('organization').optional(),
  currency: z.string().length(3).transform((value) => value.toUpperCase()).optional(),
})

export const paymentSelectSchema = createSelectSchema(payments, {
  id: orbitId('payment'),
  organizationId: orbitId('organization'),
  dealId: orbitId('deal').optional().nullable(),
  contactId: orbitId('contact').optional().nullable(),
  currency: z.string().length(3).transform((value) => value.toUpperCase()),
})
export const paymentInsertSchema = createInsertSchema(payments, {
  organizationId: orbitId('organization'),
  dealId: orbitId('deal').optional().nullable(),
  contactId: orbitId('contact').optional().nullable(),
  currency: z.string().length(3).transform((value) => value.toUpperCase()).optional(),
})
export const paymentUpdateSchema = createUpdateSchema(payments, {
  organizationId: orbitId('organization').optional(),
  dealId: orbitId('deal').optional().nullable(),
  contactId: orbitId('contact').optional().nullable(),
  currency: z.string().length(3).transform((value) => value.toUpperCase()).optional(),
})

export const contractSelectSchema = createSelectSchema(contracts, {
  id: orbitId('contract'),
  organizationId: orbitId('organization'),
  dealId: orbitId('deal').optional().nullable(),
  contactId: orbitId('contact').optional().nullable(),
  companyId: orbitId('company').optional().nullable(),
})
export const contractInsertSchema = createInsertSchema(contracts, {
  organizationId: orbitId('organization'),
  dealId: orbitId('deal').optional().nullable(),
  contactId: orbitId('contact').optional().nullable(),
  companyId: orbitId('company').optional().nullable(),
})
export const contractUpdateSchema = createUpdateSchema(contracts, {
  organizationId: orbitId('organization').optional(),
  dealId: orbitId('deal').optional().nullable(),
  contactId: orbitId('contact').optional().nullable(),
  companyId: orbitId('company').optional().nullable(),
})

export const sequenceSelectSchema = createSelectSchema(sequences, {
  id: orbitId('sequence'),
  organizationId: orbitId('organization'),
})
export const sequenceInsertSchema = createInsertSchema(sequences, {
  organizationId: orbitId('organization'),
})
export const sequenceUpdateSchema = createUpdateSchema(sequences, {
  organizationId: orbitId('organization').optional(),
})

export const sequenceStepSelectSchema = createSelectSchema(sequenceSteps, {
  id: orbitId('sequenceStep'),
  organizationId: orbitId('organization'),
  sequenceId: orbitId('sequence'),
})
export const sequenceStepInsertSchema = createInsertSchema(sequenceSteps, {
  organizationId: orbitId('organization'),
  sequenceId: orbitId('sequence'),
})
export const sequenceStepUpdateSchema = createUpdateSchema(sequenceSteps, {
  organizationId: orbitId('organization').optional(),
  sequenceId: orbitId('sequence').optional(),
})

export const sequenceEnrollmentSelectSchema = createSelectSchema(sequenceEnrollments, {
  id: orbitId('sequenceEnrollment'),
  organizationId: orbitId('organization'),
  sequenceId: orbitId('sequence'),
  contactId: orbitId('contact'),
})
export const sequenceEnrollmentInsertSchema = createInsertSchema(sequenceEnrollments, {
  organizationId: orbitId('organization'),
  sequenceId: orbitId('sequence'),
  contactId: orbitId('contact'),
  enrolledAt: z.date().optional(),
})
export const sequenceEnrollmentUpdateSchema = createUpdateSchema(sequenceEnrollments, {
  organizationId: orbitId('organization').optional(),
  sequenceId: orbitId('sequence').optional(),
  contactId: orbitId('contact').optional(),
})

export const sequenceEventSelectSchema = createSelectSchema(sequenceEvents, {
  id: orbitId('sequenceEvent'),
  organizationId: orbitId('organization'),
  sequenceEnrollmentId: orbitId('sequenceEnrollment'),
  sequenceStepId: orbitId('sequenceStep').optional().nullable(),
})
export const sequenceEventInsertSchema = createInsertSchema(sequenceEvents, {
  organizationId: orbitId('organization'),
  sequenceEnrollmentId: orbitId('sequenceEnrollment'),
  sequenceStepId: orbitId('sequenceStep').optional().nullable(),
  occurredAt: z.date().optional(),
})
// Exported for schema completeness; SequenceEventService intentionally omits update — events are immutable.
export const sequenceEventUpdateSchema = createUpdateSchema(sequenceEvents, {
  organizationId: orbitId('organization').optional(),
  sequenceEnrollmentId: orbitId('sequenceEnrollment').optional(),
  sequenceStepId: orbitId('sequenceStep').optional().nullable(),
})

// Tags
export const tagSelectSchema = createSelectSchema(tags, {
  id: orbitId('tag'),
  organizationId: orbitId('organization'),
})
export const tagInsertSchema = createInsertSchema(tags, {
  organizationId: orbitId('organization'),
})
export const tagUpdateSchema = createUpdateSchema(tags, {
  organizationId: orbitId('organization').optional(),
})

// Entity Tags
export const entityTagSelectSchema = createSelectSchema(entityTags, {
  id: orbitId('entityTag'),
  organizationId: orbitId('organization'),
  tagId: orbitId('tag'),
})
export const entityTagInsertSchema = createInsertSchema(entityTags, {
  organizationId: orbitId('organization'),
  tagId: orbitId('tag'),
})
export const entityTagUpdateSchema = createUpdateSchema(entityTags, {
  organizationId: orbitId('organization').optional(),
  tagId: orbitId('tag').optional(),
})

// Imports
export const importSelectSchema = createSelectSchema(imports, {
  id: orbitId('importJob'),
  organizationId: orbitId('organization'),
  startedByUserId: orbitId('user').optional().nullable(),
})
export const importInsertSchema = createInsertSchema(imports, {
  organizationId: orbitId('organization'),
  startedByUserId: orbitId('user').optional().nullable(),
})
export const importUpdateSchema = createUpdateSchema(imports, {
  organizationId: orbitId('organization').optional(),
  startedByUserId: orbitId('user').optional().nullable(),
})

// Webhooks
export const webhookSelectSchema = createSelectSchema(webhooks, {
  id: orbitId('webhook'),
  organizationId: orbitId('organization'),
})
export const webhookInsertSchema = createInsertSchema(webhooks, {
  organizationId: orbitId('organization'),
})
export const webhookUpdateSchema = createUpdateSchema(webhooks, {
  organizationId: orbitId('organization').optional(),
})

// Webhook Deliveries
export const webhookDeliverySelectSchema = createSelectSchema(webhookDeliveries, {
  id: orbitId('webhookDelivery'),
  organizationId: orbitId('organization'),
  webhookId: orbitId('webhook'),
})
export const webhookDeliveryInsertSchema = createInsertSchema(webhookDeliveries, {
  organizationId: orbitId('organization'),
  webhookId: orbitId('webhook'),
})
export const webhookDeliveryUpdateSchema = createUpdateSchema(webhookDeliveries, {
  organizationId: orbitId('organization').optional(),
  webhookId: orbitId('webhook').optional(),
})

// Custom Field Definitions
export const customFieldDefinitionSelectSchema = createSelectSchema(customFieldDefinitions, {
  id: orbitId('customField'),
  organizationId: orbitId('organization'),
})
export const customFieldDefinitionInsertSchema = createInsertSchema(customFieldDefinitions, {
  organizationId: orbitId('organization'),
})
export const customFieldDefinitionUpdateSchema = createUpdateSchema(customFieldDefinitions, {
  organizationId: orbitId('organization').optional(),
})

// Audit Logs
export const auditLogSelectSchema = createSelectSchema(auditLogs, {
  id: orbitId('auditLog'),
  organizationId: orbitId('organization'),
  actorUserId: orbitId('user').optional().nullable(),
  actorApiKeyId: orbitId('apiKey').optional().nullable(),
})
export const auditLogInsertSchema = createInsertSchema(auditLogs, {
  organizationId: orbitId('organization'),
  actorUserId: orbitId('user').optional().nullable(),
  actorApiKeyId: orbitId('apiKey').optional().nullable(),
})
export const auditLogUpdateSchema = createUpdateSchema(auditLogs, {
  organizationId: orbitId('organization').optional(),
  actorUserId: orbitId('user').optional().nullable(),
  actorApiKeyId: orbitId('apiKey').optional().nullable(),
})

// Schema Migrations
export const schemaMigrationSelectSchema = createSelectSchema(schemaMigrations, {
  id: orbitId('migration'),
  organizationId: orbitId('organization'),
  appliedByUserId: orbitId('user').optional().nullable(),
  approvedByUserId: orbitId('user').optional().nullable(),
})
export const schemaMigrationInsertSchema = createInsertSchema(schemaMigrations, {
  organizationId: orbitId('organization'),
  appliedByUserId: orbitId('user').optional().nullable(),
  approvedByUserId: orbitId('user').optional().nullable(),
})
export const schemaMigrationUpdateSchema = createUpdateSchema(schemaMigrations, {
  organizationId: orbitId('organization').optional(),
  appliedByUserId: orbitId('user').optional().nullable(),
  approvedByUserId: orbitId('user').optional().nullable(),
})

// Idempotency Keys
export const idempotencyKeySelectSchema = createSelectSchema(idempotencyKeys, {
  id: orbitId('idempotencyKey'),
  organizationId: orbitId('organization'),
})
export const idempotencyKeyInsertSchema = createInsertSchema(idempotencyKeys, {
  organizationId: orbitId('organization'),
})
export const idempotencyKeyUpdateSchema = createUpdateSchema(idempotencyKeys, {
  organizationId: orbitId('organization').optional(),
})
