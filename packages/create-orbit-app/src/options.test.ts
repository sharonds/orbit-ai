import { describe, it, expect } from 'vitest'
import { parseOptions, type Options } from './options.js'

describe('parseOptions', () => {
  it('accepts positional project name', () => {
    expect(parseOptions(['my-app'])).toMatchObject({ projectName: 'my-app' })
  })

  it('accepts --template flag', () => {
    expect(parseOptions(['my-app', '--template', 'default']))
      .toMatchObject({ projectName: 'my-app', template: 'default' })
  })

  it('--yes makes the flow non-interactive', () => {
    expect(parseOptions(['my-app', '--yes'])).toMatchObject({ yes: true })
  })

  it('--no-install skips npm install', () => {
    expect(parseOptions(['my-app', '--no-install'])).toMatchObject({ install: false })
  })

  it('--install-cmd accepts a custom installer', () => {
    expect(parseOptions(['my-app', '--install-cmd', 'pnpm install']))
      .toMatchObject({ installCmd: 'pnpm install' })
  })

  it('--help sets help=true', () => {
    expect(parseOptions(['--help'])).toMatchObject({ help: true })
  })

  it('rejects invalid template names', () => {
    expect(() => parseOptions(['my-app', '--template', 'nope'])).toThrow(/unknown template/i)
  })

  it('rejects unsafe or invalid project names', () => {
    expect(() => parseOptions(['../evil'])).toThrow(/invalid project name/i)
    expect(() => parseOptions(['my app'])).toThrow(/invalid project name/i)
    // npm requires lowercase for the generated unscoped package name.
    expect(() => parseOptions(['MyApp'])).toThrow(/invalid project name/i)
    expect(() => parseOptions(['CamelCase'])).toThrow(/invalid project name/i)
  })

  it('Options type is exported', () => {
    const opts: Options = { yes: true, install: true, help: false }
    expect(opts.yes).toBe(true)
  })
})
