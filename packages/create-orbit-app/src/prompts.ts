import { cancel, intro, isCancel, outro, select, text } from '@clack/prompts'
import { PROJECT_NAME_RE, TEMPLATES, type Options, type TemplateName } from './options.js'

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

export function validateProjectNameAnswer(value: string): string | undefined {
  if (!value) return 'Required'
  if (!PROJECT_NAME_RE.test(value)) {
    return 'Must start with a lowercase letter or digit; lowercase letters, digits, - and _ only'
  }
  return undefined
}

export async function runInteractivePrompts(opts: Options): Promise<ResolvedOptions> {
  intro('create-orbit-app')

  let projectName = opts.projectName
  if (!projectName) {
    const answer = await text({
      message: 'Project name',
      placeholder: 'my-orbit-app',
      validate: validateProjectNameAnswer,
    })
    if (isCancel(answer)) { cancel('Cancelled'); process.exit(130) }
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
      if (isCancel(answer)) { cancel('Cancelled'); process.exit(130) }
      template = answer as TemplateName
    }
  }

  outro(`Creating ${projectName}…`)
  return { ...opts, projectName, template }
}
