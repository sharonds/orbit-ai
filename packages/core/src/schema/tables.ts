import { boolean, index, jsonb, metadata, orbit, text, timestamp, timestamps, uniqueIndex } from './helpers.js'

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
