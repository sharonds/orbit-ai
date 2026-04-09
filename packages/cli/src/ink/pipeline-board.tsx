import React from 'react'
import { Box, Text } from 'ink'
import { isJsonMode } from '../program.js'

interface Deal {
  id: string
  title?: string
  name?: string
}

interface Stage {
  id: string
  name: string
  deals: Deal[]
}

interface PipelineBoardProps {
  stages: Stage[]
}

export function PipelineBoard({ stages }: PipelineBoardProps): React.JSX.Element | null {
  // Guard: do not render in JSON mode or non-TTY
  if (isJsonMode() || !process.stdout.isTTY) {
    return null
  }

  return (
    <Box flexDirection="row" gap={2}>
      {stages.map((stage) => (
        <Box key={stage.id} flexDirection="column" minWidth={20} borderStyle="single">
          <Text bold>{stage.name}</Text>
          {stage.deals.length === 0 ? (
            <Text dimColor>(empty)</Text>
          ) : (
            stage.deals.map((deal) => (
              <Text key={deal.id}>• {deal.title ?? deal.name ?? deal.id}</Text>
            ))
          )}
        </Box>
      ))}
    </Box>
  )
}
