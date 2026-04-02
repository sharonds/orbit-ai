import { relations } from 'drizzle-orm'
import {
  activities,
  apiKeys,
  companies,
  contracts,
  contacts,
  deals,
  notes,
  organizationMemberships,
  organizations,
  payments,
  pipelines,
  products,
  sequenceEnrollments,
  sequenceEvents,
  sequences,
  sequenceSteps,
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
  products: many(products),
  payments: many(payments),
  contracts: many(contracts),
  sequences: many(sequences),
  sequenceSteps: many(sequenceSteps),
  sequenceEnrollments: many(sequenceEnrollments),
  sequenceEvents: many(sequenceEvents),
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
  contracts: many(contracts),
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
  payments: many(payments),
  contracts: many(contracts),
  sequenceEnrollments: many(sequenceEnrollments),
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
  payments: many(payments),
  contracts: many(contracts),
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

export const productsRelations = relations(products, ({ one }) => ({
  organization: one(organizations, {
    fields: [products.organizationId],
    references: [organizations.id],
  }),
}))

export const paymentsRelations = relations(payments, ({ one }) => ({
  organization: one(organizations, {
    fields: [payments.organizationId],
    references: [organizations.id],
  }),
  deal: one(deals, {
    fields: [payments.dealId],
    references: [deals.id],
  }),
  contact: one(contacts, {
    fields: [payments.contactId],
    references: [contacts.id],
  }),
}))

export const contractsRelations = relations(contracts, ({ one }) => ({
  organization: one(organizations, {
    fields: [contracts.organizationId],
    references: [organizations.id],
  }),
  deal: one(deals, {
    fields: [contracts.dealId],
    references: [deals.id],
  }),
  contact: one(contacts, {
    fields: [contracts.contactId],
    references: [contacts.id],
  }),
  company: one(companies, {
    fields: [contracts.companyId],
    references: [companies.id],
  }),
}))

export const sequencesRelations = relations(sequences, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [sequences.organizationId],
    references: [organizations.id],
  }),
  steps: many(sequenceSteps),
  enrollments: many(sequenceEnrollments),
}))

export const sequenceStepsRelations = relations(sequenceSteps, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [sequenceSteps.organizationId],
    references: [organizations.id],
  }),
  sequence: one(sequences, {
    fields: [sequenceSteps.sequenceId],
    references: [sequences.id],
  }),
  events: many(sequenceEvents),
}))

export const sequenceEnrollmentsRelations = relations(sequenceEnrollments, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [sequenceEnrollments.organizationId],
    references: [organizations.id],
  }),
  sequence: one(sequences, {
    fields: [sequenceEnrollments.sequenceId],
    references: [sequences.id],
  }),
  contact: one(contacts, {
    fields: [sequenceEnrollments.contactId],
    references: [contacts.id],
  }),
  events: many(sequenceEvents),
}))

export const sequenceEventsRelations = relations(sequenceEvents, ({ one }) => ({
  organization: one(organizations, {
    fields: [sequenceEvents.organizationId],
    references: [organizations.id],
  }),
  enrollment: one(sequenceEnrollments, {
    fields: [sequenceEvents.sequenceEnrollmentId],
    references: [sequenceEnrollments.id],
  }),
  step: one(sequenceSteps, {
    fields: [sequenceEvents.sequenceStepId],
    references: [sequenceSteps.id],
  }),
}))
