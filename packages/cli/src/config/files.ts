import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { CliConfigError } from '../errors.js'

export interface OrbitConfig {
  mode?: 'api' | 'direct'
  apiKey?: string
  apiKeyEnv?: string
  baseUrl?: string
  orgId?: string
  userId?: string
  adapter?: string
  databaseUrl?: string
  profile?: string
  profiles?: Record<string, Partial<OrbitConfig>>
}

/**
 * Canonicalize a path via fs.realpathSync, rejecting paths outside allowed roots.
 * Allowed roots: ancestors of cwd and os.homedir().
 */
export function canonicalizePath(filePath: string, allowedRoots: string[]): string {
  let resolved = ''
  try {
    resolved = fs.realpathSync(filePath)
  } catch {
    // File doesn't exist yet — resolve symlinks in the deepest existing ancestor
    let resolved2 = path.resolve(filePath)
    let check = path.dirname(resolved2)
    while (check !== path.dirname(check)) {
      try {
        const realParent = fs.realpathSync(check)
        resolved2 = path.join(realParent, path.relative(check, resolved2))
        resolved = resolved2
        break
      } catch {
        check = path.dirname(check)
      }
    }
    if (!resolved) resolved = resolved2
  }
  const isAllowed = allowedRoots.some(
    (root) => resolved === root || resolved.startsWith(root + path.sep),
  )
  if (!isAllowed) {
    throw new CliConfigError(
      `Config path '${resolved}' is outside allowed directories.`,
      { code: 'CONFIG_PATH_OUTSIDE_ALLOWED' },
    )
  }
  return resolved
}

/**
 * Walk up from startDir looking for .orbit/config.json.
 * Returns null if not found.
 */
export function findProjectConfig(startDir: string): string | null {
  let current = startDir
  const home = os.homedir()
  while (true) {
    const candidate = path.join(current, '.orbit', 'config.json')
    if (fs.existsSync(candidate)) {
      return candidate
    }
    const parent = path.dirname(current)
    if (parent === current || current === home) break
    current = parent
  }
  return null
}

/**
 * Returns the user config path (~/.config/orbit/config.json).
 */
export function userConfigPath(): string {
  return path.join(os.homedir(), '.config', 'orbit', 'config.json')
}

/**
 * Read and parse a config file. Throws CliConfigError if malformed.
 * Returns null if file doesn't exist.
 */
export function readConfigFile(filePath: string): OrbitConfig | null {
  if (!fs.existsSync(filePath)) return null

  // Check permissions — warn if readable by group or world
  try {
    const stat = fs.statSync(filePath)
    const mode = stat.mode & 0o777
    if (mode & 0o077) {
      process.stderr.write(
        `Warning: config file '${filePath}' has permissions ${mode.toString(8)} — recommend 0600 (readable only by owner).\n`,
      )
    }
  } catch {
    // stat failed — not a blocker
  }

  let content: string
  try {
    content = fs.readFileSync(filePath, 'utf8')
  } catch (e) {
    throw new CliConfigError(`Cannot read config file '${filePath}': ${(e as Error).message}`, {
      code: 'CONFIG_READ_ERROR',
    })
  }

  try {
    return JSON.parse(content) as OrbitConfig
  } catch {
    throw new CliConfigError(`Malformed JSON in config file '${filePath}'.`, {
      code: 'CONFIG_PARSE_ERROR',
    })
  }
}

/**
 * Load merged config: project config overrides user config.
 * Applies profile if specified.
 */
function tryRealpath(p: string): string {
  try {
    return fs.realpathSync(p)
  } catch {
    return path.resolve(p)
  }
}

export function loadConfig(
  cwd: string = process.cwd(),
  overrideHome?: string,
): OrbitConfig {
  const home = overrideHome ?? os.homedir()
  // Resolve roots through symlinks so canonicalizePath comparisons work on
  // macOS where /tmp → /private/tmp (and similarly for /var/folders).
  const allowedRoots = [tryRealpath(cwd), tryRealpath(home)]

  // User config
  const userPath = path.join(home, '.config', 'orbit', 'config.json')
  const userConfig = fs.existsSync(userPath)
    ? readConfigFile(canonicalizePath(userPath, allowedRoots))
    : null

  // Project config (walk up from cwd)
  const projectConfigPath = findProjectConfig(cwd)
  const projectConfig = projectConfigPath
    ? readConfigFile(canonicalizePath(projectConfigPath, allowedRoots))
    : null

  // Merge: project overrides user
  return { ...userConfig, ...projectConfig }
}
