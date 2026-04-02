import { relations } from 'drizzle-orm'
import {
  activities,
  apiKeys,
  companies,
  contacts,
  deals,
  notes,
  organizationMemberships,
  organizations,
  pipelines,
  stages,
  tasks,
  users,
} from './tables.js'

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  memberships: many(organizationMemberships),
  apiKeys: many(apiKeys),
  companies: many(companies),
  contacts: many(contacts),
  pipelines: many(pipelines),
  stages: many(stages),
  deals: many(deals),
  activities: many(activities),
  tasks: many(tasks),
  notes: many(notes),
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
  assignedCompanies: many(companies),
  assignedContacts: many(contacts),
  assignedDeals: many(deals),
  loggedActivities: many(activities),
  assignedTasks: many(tasks),
  createdNotes: many(notes),
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

export const companiesRelations = relations(companies, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [companies.organizationId],
    references: [organizations.id],
  }),
  assignedTo: one(users, {
    fields: [companies.assignedToUserId],
    references: [users.id],
  }),
  contacts: many(contacts),
  deals: many(deals),
  activities: many(activities),
  tasks: many(tasks),
  notes: many(notes),
}))

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [contacts.organizationId],
    references: [organizations.id],
  }),
  assignedTo: one(users, {
    fields: [contacts.assignedToUserId],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [contacts.companyId],
    references: [companies.id],
  }),
  deals: many(deals),
  activities: many(activities),
  tasks: many(tasks),
  notes: many(notes),
}))

export const pipelinesRelations = relations(pipelines, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [pipelines.organizationId],
    references: [organizations.id],
  }),
  stages: many(stages),
  deals: many(deals),
}))

export const stagesRelations = relations(stages, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [stages.organizationId],
    references: [organizations.id],
  }),
  pipeline: one(pipelines, {
    fields: [stages.pipelineId],
    references: [pipelines.id],
  }),
  deals: many(deals),
}))

export const dealsRelations = relations(deals, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [deals.organizationId],
    references: [organizations.id],
  }),
  stage: one(stages, {
    fields: [deals.stageId],
    references: [stages.id],
  }),
  pipeline: one(pipelines, {
    fields: [deals.pipelineId],
    references: [pipelines.id],
  }),
  contact: one(contacts, {
    fields: [deals.contactId],
    references: [contacts.id],
  }),
  company: one(companies, {
    fields: [deals.companyId],
    references: [companies.id],
  }),
  assignedTo: one(users, {
    fields: [deals.assignedToUserId],
    references: [users.id],
  }),
  activities: many(activities),
  tasks: many(tasks),
  notes: many(notes),
}))

export const activitiesRelations = relations(activities, ({ one }) => ({
  organization: one(organizations, {
    fields: [activities.organizationId],
    references: [organizations.id],
  }),
  contact: one(contacts, {
    fields: [activities.contactId],
    references: [contacts.id],
  }),
  deal: one(deals, {
    fields: [activities.dealId],
    references: [deals.id],
  }),
  company: one(companies, {
    fields: [activities.companyId],
    references: [companies.id],
  }),
  loggedBy: one(users, {
    fields: [activities.loggedByUserId],
    references: [users.id],
  }),
}))

export const tasksRelations = relations(tasks, ({ one }) => ({
  organization: one(organizations, {
    fields: [tasks.organizationId],
    references: [organizations.id],
  }),
  contact: one(contacts, {
    fields: [tasks.contactId],
    references: [contacts.id],
  }),
  deal: one(deals, {
    fields: [tasks.dealId],
    references: [deals.id],
  }),
  company: one(companies, {
    fields: [tasks.companyId],
    references: [companies.id],
  }),
  assignedTo: one(users, {
    fields: [tasks.assignedToUserId],
    references: [users.id],
  }),
}))

export const notesRelations = relations(notes, ({ one }) => ({
  organization: one(organizations, {
    fields: [notes.organizationId],
    references: [organizations.id],
  }),
  contact: one(contacts, {
    fields: [notes.contactId],
    references: [contacts.id],
  }),
  deal: one(deals, {
    fields: [notes.dealId],
    references: [deals.id],
  }),
  company: one(companies, {
    fields: [notes.companyId],
    references: [companies.id],
  }),
  createdBy: one(users, {
    fields: [notes.createdByUserId],
    references: [users.id],
  }),
}))
