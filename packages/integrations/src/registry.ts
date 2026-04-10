import type { OrbitIntegrationPlugin } from './types.js'

export class IntegrationRegistry {
  private readonly plugins = new Map<string, OrbitIntegrationPlugin>()

  register(plugin: OrbitIntegrationPlugin): void {
    if (this.plugins.has(plugin.slug)) {
      throw new Error(`Integration plugin '${plugin.slug}' is already registered`)
    }
    this.plugins.set(plugin.slug, plugin)
  }

  get(slug: string): OrbitIntegrationPlugin | undefined {
    return this.plugins.get(slug)
  }

  list(): OrbitIntegrationPlugin[] {
    return Array.from(this.plugins.values())
  }

  has(slug: string): boolean {
    return this.plugins.has(slug)
  }

  unregister(slug: string): boolean {
    return this.plugins.delete(slug)
  }
}

// Singleton registry (module-level) — shared across the integrations package
export const defaultRegistry = new IntegrationRegistry()
