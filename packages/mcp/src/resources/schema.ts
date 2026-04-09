import type { OrbitClient } from '@orbit-ai/sdk'
import type { ReadResourceResult } from '@modelcontextprotocol/sdk/types.js'
import { truncateUnknownStrings } from '../output/truncation.js'

export async function readSchema(client: OrbitClient): Promise<ReadResourceResult> {
  const result = await client.schema.listObjects()
  return {
    contents: [
      {
        uri: 'orbit://schema',
        mimeType: 'application/json',
        text: JSON.stringify(
          {
            _type: 'orbit_resource',
            _untrusted: true,
            data: truncateUnknownStrings(result, 500),
          },
          null,
          2,
        ),
      },
    ],
  }
}
