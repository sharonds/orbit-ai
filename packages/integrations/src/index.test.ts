import { describe, it, expect } from 'vitest'
import { INTEGRATIONS_VERSION } from './index.js'

describe('@orbit-ai/integrations', () => {
  it('exports INTEGRATIONS_VERSION', () => {
    expect(INTEGRATIONS_VERSION).toBe('0.1.0-alpha.0')
  })
})
