import { Hono } from 'hono'
import type { CreateApiOptions } from './config.js'

export function createApi(options: CreateApiOptions) {
  const app = new Hono()
  return app
}
