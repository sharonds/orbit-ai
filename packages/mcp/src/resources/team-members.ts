import type { OrbitClient } from '@orbit-ai/sdk'
import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js'
import { truncateUnknownStrings } from '../output/truncation.js'

export async function readTeamMembers(client: OrbitClient): Promise<ReadResourceResult> {
  const result = await client.users.list({ limit: 100 })
  return {
    contents: [
      {
        uri: 'orbit://team-members',
        mimeType: 'application/json',
        text: JSON.stringify(
          {
            _type: 'orbit_resource',
            _untrusted: true,
            data: truncateUnknownStrings(result.data, 500),
          },
          null,
          2,
        ),
      },
    ],
  }
}
