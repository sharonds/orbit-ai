import { boolean, customFieldsColumn, index, integer, jsonb, metadata, money, orbit, text, timestamp, timestamps, uniqueIndex } from './helpers.js'

export const organizations = orbit.table(
  'organizations',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    plan: text('plan').notNull().default('community'),
    isActive: boolean('is_active').notNull().default(true),
    settings: jsonb('settings').$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
  },
  (table) => [uniqueIndex('organizations_slug_idx').on(table.slug)],
)

export const users = orbit.table(
  'users',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    email: text('email').notNull(),
    name: text('name').notNull(),
    role: text('role').notNull().default('viewer'),
    avatarUrl: text('avatar_url'),
    externalAuthId: text('external_auth_id'),
    isActive: boolean('is_active').notNull().default(true),
    metadata: metadata(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('users_org_email_idx').on(table.organizationId, table.email),
    index('users_external_auth_idx').on(table.externalAuthId),
  ],
)

export const organizationMemberships = orbit.table(
  'organization_memberships',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    userId: text('user_id').notNull().references(() => users.id),
    role: text('role').notNull(),
    invitedByUserId: text('invited_by_user_id').references(() => users.id),
    joinedAt: timestamp('joined_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [uniqueIndex('memberships_org_user_idx').on(table.organizationId, table.userId)],
)

export const apiKeys = orbit.table(
  'api_keys',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    name: text('name').notNull(),
    keyHash: text('key_hash').notNull(),
    keyPrefix: text('key_prefix').notNull(),
    scopes: jsonb('scopes').$type<string[]>().notNull().default([]),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdByUserId: text('created_by_user_id').references(() => users.id),
    ...timestamps,
  },
  (table) => [uniqueIndex('api_keys_hash_idx').on(table.keyHash), uniqueIndex('api_keys_prefix_idx').on(table.keyPrefix)],
)

export const companies = orbit.table(
  'companies',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    name: text('name').notNull(),
    domain: text('domain'),
    industry: text('industry'),
    size: integer('size'),
    website: text('website'),
    notes: text('notes'),
    assignedToUserId: text('assigned_to_user_id').references(() => users.id),
    customFields: customFieldsColumn,
    ...timestamps,
  },
  (table) => [
    uniqueIndex('companies_org_domain_idx').on(table.organizationId, table.domain),
    index('companies_assigned_to_idx').on(table.assignedToUserId),
  ],
)

export const contacts = orbit.table(
  'contacts',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    name: text('name').notNull(),
    email: text('email'),
    phone: text('phone'),
    title: text('title'),
    sourceChannel: text('source_channel'),
    status: text('status').notNull().default('lead'),
    assignedToUserId: text('assigned_to_user_id').references(() => users.id),
    companyId: text('company_id').references(() => companies.id),
    leadScore: integer('lead_score').notNull().default(0),
    isHot: boolean('is_hot').notNull().default(false),
    lastContactedAt: timestamp('last_contacted_at', { withTimezone: true }),
    customFields: customFieldsColumn,
    ...timestamps,
  },
  (table) => [
    uniqueIndex('contacts_org_email_idx').on(table.organizationId, table.email),
    index('contacts_company_idx').on(table.companyId),
    index('contacts_assigned_to_idx').on(table.assignedToUserId),
  ],
)

export const pipelines = orbit.table(
  'pipelines',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    name: text('name').notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    description: text('description'),
    ...timestamps,
  },
  (table) => [uniqueIndex('pipelines_org_name_idx').on(table.organizationId, table.name)],
)

export const stages = orbit.table(
  'stages',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    pipelineId: text('pipeline_id').notNull().references(() => pipelines.id),
    name: text('name').notNull(),
    stageOrder: integer('stage_order').notNull(),
    probability: integer('probability').notNull().default(0),
    color: text('color'),
    isWon: boolean('is_won').notNull().default(false),
    isLost: boolean('is_lost').notNull().default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('stages_pipeline_order_idx').on(table.pipelineId, table.stageOrder),
    uniqueIndex('stages_pipeline_name_idx').on(table.pipelineId, table.name),
  ],
)

export const deals = orbit.table(
  'deals',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    title: text('title').notNull(),
    value: money('value'),
    currency: text('currency').notNull().default('USD'),
    stageId: text('stage_id').references(() => stages.id),
    pipelineId: text('pipeline_id').references(() => pipelines.id),
    probability: integer('probability').notNull().default(0),
    expectedCloseDate: timestamp('expected_close_date', { withTimezone: true }),
    contactId: text('contact_id').references(() => contacts.id),
    companyId: text('company_id').references(() => companies.id),
    assignedToUserId: text('assigned_to_user_id').references(() => users.id),
    status: text('status').notNull().default('open'),
    wonAt: timestamp('won_at', { withTimezone: true }),
    lostAt: timestamp('lost_at', { withTimezone: true }),
    lostReason: text('lost_reason'),
    customFields: customFieldsColumn,
    ...timestamps,
  },
  (table) => [
    index('deals_stage_idx').on(table.stageId),
    index('deals_pipeline_idx').on(table.pipelineId),
    index('deals_contact_idx').on(table.contactId),
    index('deals_company_idx').on(table.companyId),
  ],
)

export const activities = orbit.table(
  'activities',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    type: text('type').notNull(),
    subject: text('subject'),
    body: text('body'),
    direction: text('direction').notNull().default('internal'),
    contactId: text('contact_id').references(() => contacts.id),
    dealId: text('deal_id').references(() => deals.id),
    companyId: text('company_id').references(() => companies.id),
    durationMinutes: integer('duration_minutes'),
    outcome: text('outcome'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    loggedByUserId: text('logged_by_user_id').references(() => users.id),
    metadata: metadata(),
    customFields: customFieldsColumn,
    ...timestamps,
  },
  (table) => [
    index('activities_contact_idx').on(table.contactId),
    index('activities_deal_idx').on(table.dealId),
    index('activities_company_idx').on(table.companyId),
    index('activities_occurred_at_idx').on(table.occurredAt),
  ],
)

export const tasks = orbit.table(
  'tasks',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    title: text('title').notNull(),
    description: text('description'),
    dueDate: timestamp('due_date', { withTimezone: true }),
    priority: text('priority').notNull().default('medium'),
    isCompleted: boolean('is_completed').notNull().default(false),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    contactId: text('contact_id').references(() => contacts.id),
    dealId: text('deal_id').references(() => deals.id),
    companyId: text('company_id').references(() => companies.id),
    assignedToUserId: text('assigned_to_user_id').references(() => users.id),
    customFields: customFieldsColumn,
    ...timestamps,
  },
  (table) => [
    index('tasks_due_date_idx').on(table.dueDate),
    index('tasks_assigned_to_idx').on(table.assignedToUserId),
  ],
)

export const notes = orbit.table(
  'notes',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull().references(() => organizations.id),
    content: text('content').notNull(),
    contactId: text('contact_id').references(() => contacts.id),
    dealId: text('deal_id').references(() => deals.id),
    companyId: text('company_id').references(() => companies.id),
    createdByUserId: text('created_by_user_id').references(() => users.id),
    customFields: customFieldsColumn,
    ...timestamps,
  },
  (table) => [
    index('notes_contact_idx').on(table.contactId),
    index('notes_deal_idx').on(table.dealId),
  ],
)
