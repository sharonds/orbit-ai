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

  it('--version sets version=true', () => {
    expect(parseOptions(['--version'])).toMatchObject({ version: true })
  })

  it('-v sets version=true', () => {
    expect(parseOptions(['-v'])).toMatchObject({ version: true })
  })

  it('--help sets help=true', () => {
    expect(parseOptions(['--help'])).toMatchObject({ help: true })
  })

  it('rejects invalid template names', () => {
    expect(() => parseOptions(['my-app', '--template', 'nope'])).toThrow(/unknown template/i)
  })

  it('rejects template traversal or nested paths', () => {
    for (const template of ['../default', '/tmp/default', 'default/foo', 'default\\foo', './default']) {
      expect(() => parseOptions(['my-app', '--template', template])).toThrow(/unknown template/i)
    }
  })

  it('rejects --install-cmd when install is disabled', () => {
    expect(() => parseOptions(['my-app', '--no-install', '--install-cmd', 'pnpm install']))
      .toThrow(/--install-cmd cannot be used with --no-install/i)
  })

  it('rejects empty --install-cmd', () => {
    expect(() => parseOptions(['my-app', '--install-cmd', ''])).toThrow(/--install-cmd cannot be empty/i)
  })

  it('rejects whitespace-only --install-cmd', () => {
    expect(() => parseOptions(['my-app', '--install-cmd', '   \t'])).toThrow(/--install-cmd cannot be empty/i)
  })

  it('rejects unsafe or invalid project names', () => {
    expect(() => parseOptions(['../evil'])).toThrow(/invalid project name/i)
    expect(() => parseOptions(['my app'])).toThrow(/invalid project name/i)
    // npm requires lowercase for the generated unscoped package name.
    expect(() => parseOptions(['MyApp'])).toThrow(/invalid project name/i)
    expect(() => parseOptions(['CamelCase'])).toThrow(/invalid project name/i)
  })

  it('Options type is exported', () => {
    const opts: Options = { yes: true, install: true, help: false, version: false }
    expect(opts.yes).toBe(true)
  })
})
