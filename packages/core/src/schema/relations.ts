import { relations } from 'drizzle-orm'
import { apiKeys, organizationMemberships, organizations, users } from './tables.js'

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  memberships: many(organizationMemberships),
  apiKeys: many(apiKeys),
}))

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  memberships: many(organizationMemberships, {
    relationName: 'membershipUser',
  }),
  membershipInvites: many(organizationMemberships, {
    relationName: 'membershipInvitedBy',
  }),
  apiKeysCreated: many(apiKeys),
}))

export const organizationMembershipsRelations = relations(organizationMemberships, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMemberships.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    relationName: 'membershipUser',
    fields: [organizationMemberships.userId],
    references: [users.id],
  }),
  invitedBy: one(users, {
    relationName: 'membershipInvitedBy',
    fields: [organizationMemberships.invitedByUserId],
    references: [users.id],
  }),
}))

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  organization: one(organizations, {
    fields: [apiKeys.organizationId],
    references: [organizations.id],
  }),
  createdBy: one(users, {
    fields: [apiKeys.createdByUserId],
    references: [users.id],
  }),
}))
