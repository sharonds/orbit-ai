import { describe, it, expect } from 'vitest'
import { mergeOptionsWithAnswers } from './prompts.js'
import type { Options } from './options.js'

describe('mergeOptionsWithAnswers', () => {
  it('prefers explicit options over prompt answers', () => {
    const opts: Options = {
      projectName: 'explicit', template: 'default', yes: false, install: true, help: false,
    }
    const answers = { projectName: 'from-prompt', template: 'default' as const }
    const merged = mergeOptionsWithAnswers(opts, answers)
    expect(merged.projectName).toBe('explicit')
  })

  it('falls back to prompt answers for missing options', () => {
    const opts: Options = { yes: false, install: true, help: false }
    const answers = { projectName: 'from-prompt', template: 'default' as const }
    const merged = mergeOptionsWithAnswers(opts, answers)
    expect(merged.projectName).toBe('from-prompt')
    expect(merged.template).toBe('default')
  })
})
