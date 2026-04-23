import type { ActivityRecord, ContactRecord, CoreServices, OrbitAuthContext } from '@orbit-ai/core'
import type { Prng } from '../prng.js'

const ACTIVITY_TYPES = ['email', 'call', 'meeting', 'note'] as const
const SUBJECTS: Record<(typeof ACTIVITY_TYPES)[number], readonly string[]> = {
  email: ['Intro follow-up', 'Proposal sent', 'Scheduling', 'Re: pricing', 'Thanks for the call'],
  call: ['Discovery call', 'Check-in', 'Technical review', 'Budget conversation'],
  meeting: ['Kickoff', 'Quarterly review', 'Demo', 'Contract walk-through'],
  note: ['Internal note', 'Account summary', 'Action items'],
}

export async function seedActivities(
  services: CoreServices,
  ctx: OrbitAuthContext,
  prng: Prng,
  contacts: ContactRecord[],
  count: number,
  historyDays: number,
  nowMs: number = Date.now(),
): Promise<ActivityRecord[]> {
  if (contacts.length === 0) throw new RangeError('seedActivities: need at least one contact')
  if (historyDays <= 0) throw new RangeError('seedActivities: historyDays must be > 0')
  const msInDay = 86_400_000
  const out: ActivityRecord[] = []
  for (let i = 0; i < count; i += 1) {
    const type = prng.pickOne(ACTIVITY_TYPES)
    const subject = prng.pickOne(SUBJECTS[type])
    const contact = prng.pickOne(contacts)
    const offsetMs = prng.intBetween(0, historyDays * msInDay)
    const occurredAt = new Date(nowMs - offsetMs)
    const activity = await services.activities.create(ctx, {
      type,
      subject,
      body: `${subject} with ${contact.name}`,
      contactId: contact.id,
      occurredAt,
    })
    out.push(activity)
  }
  return out
}
