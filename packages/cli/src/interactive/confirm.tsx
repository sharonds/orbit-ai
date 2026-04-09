import React, { useState } from 'react'
import { Text, useInput, useApp } from 'ink'

interface ConfirmProps {
  message: string
  onConfirm: (confirmed: boolean) => void
}

export function Confirm({ message, onConfirm }: ConfirmProps): React.JSX.Element {
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
