import React, { useState } from 'react'
import { Text, useInput, useApp } from 'ink'
import { isJsonMode } from '../program.js'

interface ConfirmProps {
  message: string
  onConfirm: (confirmed: boolean) => void
}

export function Confirm({ message, onConfirm }: ConfirmProps): React.JSX.Element | null {
  // Guard: skip in JSON mode or non-TTY — must be before any hooks
  if (isJsonMode() || !process.stdout.isTTY) {
    return null
  }
  return <ConfirmInner message={message} onConfirm={onConfirm} />
}

function ConfirmInner({ message, onConfirm }: ConfirmProps): React.JSX.Element {
  const [answered, setAnswered] = useState(false)
  const { exit } = useApp()

  useInput((input, key) => {
    if (answered) return
    if (key.return || input.toLowerCase() === 'y') {
      setAnswered(true)
      onConfirm(true)
      exit()
    } else if (key.escape || input.toLowerCase() === 'n') {
      setAnswered(true)
      onConfirm(false)
      exit()
    }
  })

  return <Text>{message} [y/N] </Text>
}
