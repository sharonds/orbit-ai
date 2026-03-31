import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgSchema,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

export const orbit = pgSchema('orbit')

export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}

export const customFieldsColumn = jsonb('custom_fields').$type<Record<string, unknown>>().notNull().default({})

export const money = (name: string) => numeric(name, { precision: 18, scale: 2 })

export const metadata = () => jsonb('metadata').$type<Record<string, unknown>>().notNull().default({})

export { boolean, foreignKey, index, integer, jsonb, numeric, pgTable, primaryKey, text, timestamp, uniqueIndex }
