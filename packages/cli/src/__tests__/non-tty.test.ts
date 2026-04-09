import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { CliValidationError } from '../errors.js'
import { runInit } from '../commands/init.js'
import { makeTmpDir } from './setup.js'

describe('non-TTY / agent mode', () => {
  let originalIsTTY: boolean | undefined

  beforeEach(() => {
    originalIsTTY = process.stdout.isTTY
    Object.defineProperty(process.stdout, 'isTTY', { value: false, writable: true, configurable: true })
    Object.defineProperty(process.stdin, 'isTTY', { value: false, writable: true, configurable: true })
  })

  afterEach(() => {
    Object.defineProperty(process.stdout, 'isTTY', { value: originalIsTTY, writable: true, configurable: true })
  })

  it('orbit init without --yes in non-TTY mode throws CliValidationError', async () => {
    const cwd = makeTmpDir()
    await expect(runInit({ cwd, yes: false })).rejects.toThrow(CliValidationError)
  })

  it('orbit init with --yes in non-TTY mode succeeds', async () => {
    const cwd = makeTmpDir()
    await expect(runInit({ cwd, yes: true })).resolves.not.toThrow()
  })

  it('orbit init with --env-file .env throws CliValidationError regardless of TTY', async () => {
    const cwd = makeTmpDir()
    await expect(runInit({ cwd, yes: true, envFile: '.env' })).rejects.toThrow(CliValidationError)
  })

  it('orbit init rejects symlinked .env.example targets', async () => {
    const cwd = makeTmpDir()
    const externalTarget = path.join(makeTmpDir(), 'outside.env')
    fs.writeFileSync(externalTarget, 'SAFE=1\n')
    fs.symlinkSync(externalTarget, path.join(cwd, '.env.example'))

    await expect(runInit({ cwd, yes: true })).rejects.toThrow(CliValidationError)
  })

  it('orbit init rejects symlinked .gitignore targets', async () => {
    const cwd = makeTmpDir()
    const externalTarget = path.join(makeTmpDir(), 'outside.gitignore')
    fs.writeFileSync(externalTarget, '*.tmp\n')
    fs.symlinkSync(externalTarget, path.join(cwd, '.gitignore'))

    await expect(runInit({ cwd, yes: true })).rejects.toThrow(CliValidationError)
  })
})
