import React from 'react'
import { Box, Text } from 'ink'
import { isJsonMode } from '../program.js'

interface StatusCheck {
  name: string
  pass: boolean
  detail?: string
}

interface StatusPanelProps {
  checks: StatusCheck[]
}

export function StatusPanel({ checks }: StatusPanelProps): React.JSX.Element | null {
  if (isJsonMode() || !process.stdout.isTTY) return null

  return (
    <Box flexDirection="column">
      {checks.map((check, i) => (
        <Box key={i}>
          <Text color={check.pass ? 'green' : 'red'}>{check.pass ? '✓' : '✗'} </Text>
          <Text>{check.name}</Text>
          {check.detail ? <Text dimColor> ({check.detail})</Text> : null}
        </Box>
      ))}
    </Box>
  )
}
