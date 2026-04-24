import { cancel, intro, isCancel, outro, select, text } from '@clack/prompts'
import { TEMPLATES, type Options, type TemplateName } from './options.js'

export interface PromptAnswers {
  readonly projectName: string
  readonly template: TemplateName
}

export interface ResolvedOptions extends Options {
  readonly projectName: string
  readonly template: TemplateName
}

export function mergeOptionsWithAnswers(
  opts: Options,
  answers: PromptAnswers,
): ResolvedOptions {
  return {
    ...opts,
    projectName: opts.projectName ?? answers.projectName,
    template: opts.template ?? answers.template,
  }
}

export async function runInteractivePrompts(opts: Options): Promise<ResolvedOptions> {
  intro('create-orbit-app')

  let projectName = opts.projectName
  if (!projectName) {
    const answer = await text({
      message: 'Project name',
      placeholder: 'my-orbit-app',
      validate(value) {
        if (!value) return 'Required'
        if (!/^[a-z0-9][a-z0-9-_]*$/.test(value)) return 'Lowercase letters, digits, - _ only'
        return undefined
      },
    })
    if (isCancel(answer)) { cancel('Cancelled'); process.exit(0) }
    projectName = answer as string
  }

  let template = opts.template
  if (!template) {
    if (opts.yes) {
      template = 'default'
    } else {
      const answer = await select({
        message: 'Template',
        options: TEMPLATES.map((t) => ({ value: t, label: t })),
        initialValue: 'default' as TemplateName,
      })
      if (isCancel(answer)) { cancel('Cancelled'); process.exit(0) }
      template = answer as TemplateName
    }
  }

  outro(`Creating ${projectName}…`)
  return { ...opts, projectName, template }
}
