import { parseArgs } from 'node:util'

export const TEMPLATES = ['default'] as const
export type TemplateName = (typeof TEMPLATES)[number]

export interface Options {
  readonly projectName?: string
  readonly template?: TemplateName
  readonly yes: boolean
  readonly install: boolean
  readonly installCmd?: string
  readonly help: boolean
}

// Lowercase-only — npm rejects uppercase in unscoped package names.
export const PROJECT_NAME_RE = /^[a-z0-9][a-z0-9-_]*$/

export function parseOptions(argv: readonly string[]): Options {
  // `allowNegative: true` means `--no-install` automatically negates `install` to false.
  // Do NOT declare a separate `no-install` option — that breaks the built-in negation.
  const { values, positionals } = parseArgs({
    args: argv as string[],
    allowPositionals: true,
    allowNegative: true,
    options: {
      template: { type: 'string' },
      yes: { type: 'boolean', default: false, short: 'y' },
      install: { type: 'boolean', default: true },
      'install-cmd': { type: 'string' },
      help: { type: 'boolean', default: false, short: 'h' },
    },
    strict: true,
  })

  const projectName = positionals[0]
  if (projectName !== undefined && !PROJECT_NAME_RE.test(projectName)) {
    throw new Error(
      `Invalid project name '${projectName}'. Use lowercase letters, digits, hyphens, underscores; must start with a letter or digit.`,
    )
  }
  const template = values.template as string | undefined
  if (template !== undefined && !TEMPLATES.includes(template as TemplateName)) {
    throw new Error(`Unknown template '${template}'. Available: ${TEMPLATES.join(', ')}`)
  }
  const result: Options = {
    ...(projectName !== undefined ? { projectName } : {}),
    ...(template !== undefined ? { template: template as TemplateName } : {}),
    yes: Boolean(values.yes),
    install: values.install ?? true,
    ...(values['install-cmd'] !== undefined ? { installCmd: values['install-cmd'] as string } : {}),
    help: Boolean(values.help),
  }
  return result
}
