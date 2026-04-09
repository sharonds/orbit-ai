/**
 * Prompt the user for a yes/no confirmation on stderr.
 * Returns true for 'y', false for anything else (including stdin EOF).
 * Cleans up all stdin listeners after resolution to prevent event-listener leaks.
 */
export async function confirmAction(prompt: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    process.stderr.write(prompt)
    process.stdin.setEncoding('utf8')
    const onData = (data: Buffer | string) => { cleanup(); resolve(data.toString().trim().toLowerCase() === 'y') }
    const onEnd = () => { cleanup(); resolve(false) }
    const onError = (err: Error) => { cleanup(); reject(err) }
    const cleanup = () => {
      process.stdin.removeListener('data', onData)
      process.stdin.removeListener('end', onEnd)
      process.stdin.removeListener('error', onError)
    }
    process.stdin.once('data', onData)
    process.stdin.once('end', onEnd)
    process.stdin.once('error', onError)
  })
}
