import { describe, it, expect } from 'vitest'
import { OrbitApiError } from '@orbit-ai/sdk'
import { buildStack } from '../harness/build-stack.js'

const adapterType = () => (process.env.ORBIT_E2E_ADAPTER ?? 'sqlite') as 'sqlite' | 'postgres'

type RenameOperation = {
  type: 'custom_field.rename'
  entityType: 'contacts'
  fieldName: string
  newFieldName: string
}

type MigrationPreview = {
  checksum: string
  operations: RenameOperation[]
  destructive: boolean
  confirmationRequired: boolean
  confirmationInstructions: {
    required: boolean
    destructiveOperations: string[]
    checksum?: string
  }
}

type MigrationApplyResult = {
  migrationId: string
  checksum: string
  status: 'applied'
  appliedOperations: RenameOperation[]
  rollbackable: boolean
  rollbackDecision: { decision: 'rollbackable' } | { decision: 'non_rollbackable'; reason: string }
}

describe('Journey 16 - custom-field rename migration semantics', () => {
  it('renames custom-field metadata and preserves contact custom field values', async () => {
    const stack = await buildStack({ tenant: 'acme', adapter: adapterType() })
    try {
      const oldFieldName = uniqueFieldName('rename_from')
      const newFieldName = uniqueFieldName('rename_to')
      const operation: RenameOperation = {
        type: 'custom_field.rename',
        entityType: 'contacts',
        fieldName: oldFieldName,
        newFieldName,
      }

      await stack.sdkDirect.schema.addField('contacts', {
        name: oldFieldName,
        type: 'text',
        label: 'Rename source field',
      })
      const contact = await stack.sdkDirect.contacts.create({
        name: 'Journey 16 Rename',
        email: `${oldFieldName}@example.test`,
        custom_fields: { [oldFieldName]: 'preserve this value' },
      })

      const preview = await stack.sdkDirect.schema.previewMigration({ operations: [operation] }) as MigrationPreview
      expect(preview.operations).toEqual([operation])
      expect(preview.destructive).toBe(true)
      expect(preview.confirmationRequired).toBe(true)
      expect(preview.confirmationInstructions).toMatchObject({
        required: true,
        destructiveOperations: ['custom_field.rename'],
        checksum: preview.checksum,
      })

      await expect(stack.sdkDirect.schema.applyMigration({
        operations: [operation],
        checksum: preview.checksum,
      })).rejects.toMatchObject({
        status: 409,
        error: expect.objectContaining({ code: 'DESTRUCTIVE_CONFIRMATION_REQUIRED' }),
      } satisfies Partial<OrbitApiError>)

      const applied = await stack.sdkDirect.schema.applyMigration({
        operations: [operation],
        checksum: preview.checksum,
        confirmation: {
          destructive: true,
          checksum: preview.checksum,
          confirmedAt: new Date().toISOString(),
        },
      }) as MigrationApplyResult
      expect(applied).toMatchObject({
        checksum: preview.checksum,
        status: 'applied',
        appliedOperations: [operation],
        rollbackable: true,
        rollbackDecision: { decision: 'rollbackable' },
      })
      expect(applied.migrationId).toMatch(/^migration_/)

      const contactsSchema = await stack.sdkDirect.schema.describeObject('contacts')
      const fieldNames = contactsSchema.customFields.map((field) => field.fieldName)
      expect(fieldNames).not.toContain(oldFieldName)
      expect(fieldNames).toContain(newFieldName)

      const renamedContact = await stack.sdkDirect.contacts.get(contact.id)
      expect(renamedContact.custom_fields[oldFieldName]).toBeUndefined()
      expect(renamedContact.custom_fields[newFieldName]).toBe('preserve this value')
    } finally {
      await stack.teardown()
    }
  })
})

function uniqueFieldName(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
}
