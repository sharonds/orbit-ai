export interface ContactContextResult {
  status: 'pending'
}

export async function getContactContext(): Promise<ContactContextResult> {
  throw new Error('Contact context is not implemented yet')
}
