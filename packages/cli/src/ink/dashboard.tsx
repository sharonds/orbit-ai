import React from 'react'
import { Box, Text } from 'ink'
import { isJsonMode } from '../program.js'

interface DashboardProps {
  orgName?: string
  stats?: {
    contacts: number
    deals: number
    openTasks: number
  }
}

export function Dashboard({ orgName, stats }: DashboardProps): React.JSX.Element | null {
  if (isJsonMode() || !process.stdout.isTTY) return null

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Orbit AI CRM — {orgName ?? 'Dashboard'}</Text>
      {stats ? (
        <Box flexDirection="column" marginTop={1}>
          <Text>Contacts: {stats.contacts}</Text>
          <Text>Open deals: {stats.deals}</Text>
          <Text>Open tasks: {stats.openTasks}</Text>
        </Box>
      ) : (
        <Text dimColor>No data</Text>
      )}
    </Box>
  )
}
