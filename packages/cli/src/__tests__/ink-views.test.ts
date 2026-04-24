import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import React from 'react'
import { PassThrough } from 'node:stream'
import { render } from 'ink'

// Helper: render a React element to a string by capturing ink's debug output.
// Uses debug:true so each render frame is written as plain text (no ANSI escape sequences for cursor movement).
async function renderToString(element: React.ReactNode): Promise<string> {
  const stream = new PassThrough()
  const chunks: Buffer[] = []
  stream.on('data', (chunk: Buffer) => chunks.push(chunk))

  const instance = render(element, {
    stdout: stream as unknown as NodeJS.WriteStream,
    stdin: process.stdin,
    debug: true,
    patchConsole: false,
  })

  // Give React/Ink a tick to render
  await new Promise((r) => setTimeout(r, 50))
  instance.unmount()
  instance.cleanup()

  stream.end()
  return Buffer.concat(chunks).toString()
}

describe('Ink views', () => {
  let originalIsTTY: boolean | undefined

  beforeEach(() => {
    originalIsTTY = process.stdout.isTTY
    // Set isTTY true so components don't early-return null
    Object.defineProperty(process.stdout, 'isTTY', { value: true, writable: true, configurable: true })
  })

  afterEach(() => {
    Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, writable: true, configurable: true })
    vi.restoreAllMocks()
  })

  describe('PipelineBoard', () => {
    it('renders each deal title with two columns and three deals', async () => {
      const { PipelineBoard } = await import('../ink/pipeline-board.js')

      const output = await renderToString(
        React.createElement(PipelineBoard, {
          stages: [
            {
              id: 'stg1',
              name: 'Prospecting',
              deals: [
                { id: 'd1', title: 'Deal Alpha' },
                { id: 'd2', title: 'Deal Beta' },
              ],
            },
            {
              id: 'stg2',
              name: 'Closing',
              deals: [{ id: 'd3', title: 'Deal Gamma' }],
            },
          ],
        }),
      )

      expect(output).toContain('Deal Alpha')
      expect(output).toContain('Deal Beta')
      expect(output).toContain('Deal Gamma')
    }, 10_000)

    it('renders stage name but no deal bullet rows for empty stage', async () => {
      const { PipelineBoard } = await import('../ink/pipeline-board.js')

      const output = await renderToString(
        React.createElement(PipelineBoard, {
          stages: [{ id: 'stg1', name: 'Prospecting', deals: [] }],
        }),
      )

      expect(output).toContain('Prospecting')
      expect(output).not.toMatch(/•/)
    })

    it('returns empty output when isTTY is false', async () => {
      // Override to non-TTY before rendering
      Object.defineProperty(process.stdout, 'isTTY', { value: false, writable: true, configurable: true })

      const { PipelineBoard } = await import('../ink/pipeline-board.js')

      const output = await renderToString(
        React.createElement(PipelineBoard, { stages: [{ id: 's1', name: 'Stage', deals: [] }] }),
      )

      expect(output.trim()).toBe('')
    })

    it('returns empty output when isJsonMode is true', async () => {
      // Import the program module and spy on isJsonMode to return true
      const programModule = await import('../program.js')
      const spy = vi.spyOn(programModule, 'isJsonMode').mockReturnValue(true)

      const { PipelineBoard } = await import('../ink/pipeline-board.js')

      const output = await renderToString(
        React.createElement(PipelineBoard, {
          stages: [{ id: 's1', name: 'Test', deals: [{ id: 'd1', title: 'Deal X' }] }],
        }),
      )

      spy.mockRestore()
      expect(output.trim()).toBe('')
    })
  })

  describe('Confirm', () => {
    it('renders the message prompt text', async () => {
      const { Confirm } = await import('../interactive/confirm.js')

      const output = await renderToString(
        React.createElement(Confirm, {
          message: 'Are you sure?',
          onConfirm: (_v: boolean) => {},
        }),
      )

      expect(output).toContain('Are you sure?')
    })

    it('calls onConfirm(true) when y is pressed', async () => {
      const { Confirm } = await import('../interactive/confirm.js')

      const onConfirm = vi.fn()
      const stdinStream = new PassThrough() as PassThrough & {
        isTTY?: boolean
        setRawMode?: (raw: boolean) => void
        ref?: () => void
        unref?: () => void
      }
      stdinStream.isTTY = true
      stdinStream.setRawMode = () => {}
      stdinStream.ref = () => {}
      stdinStream.unref = () => {}
      const stdoutStream = new PassThrough()

      const instance = render(
        React.createElement(Confirm, { message: 'Confirm?', onConfirm }),
        {
          stdout: stdoutStream as unknown as NodeJS.WriteStream,
          stdin: stdinStream as unknown as NodeJS.ReadStream,
          debug: true,
          patchConsole: false,
        },
      )

      await new Promise((r) => setTimeout(r, 50))
      stdinStream.write('y')
      await new Promise((r) => setTimeout(r, 100))

      instance.unmount()
      instance.cleanup()

      expect(onConfirm).toHaveBeenCalledWith(true)
    })

    it('calls onConfirm(false) when n is pressed', async () => {
      const { Confirm } = await import('../interactive/confirm.js')

      const onConfirm = vi.fn()
      const stdinStream = new PassThrough() as PassThrough & {
        isTTY?: boolean
        setRawMode?: (raw: boolean) => void
        ref?: () => void
        unref?: () => void
      }
      stdinStream.isTTY = true
      stdinStream.setRawMode = () => {}
      stdinStream.ref = () => {}
      stdinStream.unref = () => {}
      const stdoutStream = new PassThrough()

      const instance = render(
        React.createElement(Confirm, { message: 'Confirm?', onConfirm }),
        {
          stdout: stdoutStream as unknown as NodeJS.WriteStream,
          stdin: stdinStream as unknown as NodeJS.ReadStream,
          debug: true,
          patchConsole: false,
        },
      )

      await new Promise((r) => setTimeout(r, 50))
      stdinStream.write('n')
      await new Promise((r) => setTimeout(r, 100))

      instance.unmount()
      instance.cleanup()

      expect(onConfirm).toHaveBeenCalledWith(false)
    })
  })
})
