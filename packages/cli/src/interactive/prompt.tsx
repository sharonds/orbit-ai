import React from 'react'
import { Text, Box } from 'ink'

interface PromptProps {
  label: string
  onSubmit: (value: string) => void
  placeholder?: string
}

// Ink v5 does not include TextInput — display label and hint only.
// Actual input is collected via readlinePrompt() helper below.
export function Prompt({ label, placeholder }: PromptProps): React.JSX.Element {
  return (
    <Box>
      <Text>{label}{placeholder ? ` (${placeholder})` : ''}: </Text>
      {placeholder ? <Text dimColor>{placeholder}</Text> : null}
    </Box>
  )
}

/**
 * Read a single line from stdin (non-Ink, plain readline).
 * Only call this in a TTY context.
 */
export async function readlinePrompt(question: string): Promise<string> {
  const { createInterface } = await import('node:readline')
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer)
    })
  })
}
