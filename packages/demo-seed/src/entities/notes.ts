import type { ContactRecord, CoreServices, NoteRecord, OrbitAuthContext } from '@orbit-ai/core'
import type { Prng } from '../prng.js'

const NOTE_TEMPLATES: readonly string[] = [
  'Had a great chat with {name}. They are evaluating alternatives in Q2.',
  'Internal: {name} is the primary champion on the technical side.',
  'Follow up mid-May — budget decision expected then.',
  '{name} flagged concerns around pricing tiers. Need to circle back.',
  'Action items from today with {name}: (1) security review; (2) pricing.',
  '{name} asked for SOC2 evidence. Sending.',
  'Referral from {name}. Strong intro.',
]

export async function seedNotes(
  services: CoreServices,
  ctx: OrbitAuthContext,
  prng: Prng,
  contacts: ContactRecord[],
  count: number,
): Promise<NoteRecord[]> {
  if (contacts.length === 0) throw new RangeError('seedNotes: need at least one contact')
  const out: NoteRecord[] = []
  for (let i = 0; i < count; i += 1) {
    const template = prng.pickOne(NOTE_TEMPLATES)
    const contact = prng.pickOne(contacts)
    const content = template.replace('{name}', contact.name)
    const note = await services.notes.create(ctx, { content, contactId: contact.id })
    out.push(note)
  }
  return out
}
