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
  orgName?: string
  profiles?: Record<string, Omit<OrbitConfig, 'profiles' | 'profile'>>
}

/** Config fields valid inside a named profile — profiles cannot be nested. */
type ProfileEntry = Omit<OrbitConfig, 'profiles' | 'profile'>

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
  } catch (e) {
    process.stderr.write(
      `Warning: could not check permissions on config file '${filePath}': ${(e as Error).message}\n`,
    )
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

/**
 * Apply a named profile on top of a base config.
 * Returns the base config unchanged if the profile doesn't exist.
 * Note: `profiles` keys inside a profile entry are not supported and are excluded by type.
 */
export function applyProfile(base: OrbitConfig, profileName: string): OrbitConfig {
  const profile: ProfileEntry | undefined = base.profiles?.[profileName]
  if (!profile) return base
  return { ...base, ...profile }
}

function sanitizeProjectProfile(profile: ProfileEntry): ProfileEntry {
  return {
    ...(profile.orgId !== undefined ? { orgId: profile.orgId } : {}),
    ...(profile.userId !== undefined ? { userId: profile.userId } : {}),
  }
}

function sanitizeProjectConfig(config: OrbitConfig | null): OrbitConfig | null {
  if (!config) return null

  const profiles =
    config.profiles && typeof config.profiles === 'object'
      ? Object.fromEntries(
          Object.entries(config.profiles).map(([profileName, profile]) => {
            if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
              throw new CliConfigError(
                `Profile '${profileName}' must be a JSON object in Orbit config.`,
                { code: 'CONFIG_PARSE_ERROR', profile: profileName },
              )
            }

            return [profileName, sanitizeProjectProfile(profile as ProfileEntry)]
          }),
        )
      : undefined

  return {
    ...(config.orgId !== undefined ? { orgId: config.orgId } : {}),
    ...(config.userId !== undefined ? { userId: config.userId } : {}),
    ...(config.profile !== undefined ? { profile: config.profile } : {}),
    ...(profiles !== undefined ? { profiles } : {}),
  }
}

/** Collect real paths of all ancestors of dir up to and including home (inclusive). */
function ancestorRoots(dir: string, home: string): string[] {
  const roots: string[] = []
  let current = tryRealpath(dir)
  const realHome = tryRealpath(home)
  while (true) {
    roots.push(current)
    if (current === realHome) break
    const parent = path.dirname(current)
    if (parent === current) break // filesystem root
    current = parent
  }
  if (!roots.includes(realHome)) roots.push(realHome)
  return roots
}

export function loadConfig(
  cwd: string = process.cwd(),
  overrideHome?: string,
): OrbitConfig {
  const home = overrideHome ?? os.homedir()
  // Resolve roots through symlinks so canonicalizePath comparisons work on
  // macOS where /tmp → /private/tmp (and similarly for /var/folders).
  // Include all ancestors of cwd so configs found by walking up are allowed.
  const allowedRoots = ancestorRoots(cwd, home)

  // User config
  const userPath = path.join(home, '.config', 'orbit', 'config.json')
  const userConfig = fs.existsSync(userPath)
    ? readConfigFile(canonicalizePath(userPath, allowedRoots))
    : null

  // Project config (walk up from cwd)
  const projectConfigPath = findProjectConfig(cwd)
  const projectConfig = projectConfigPath
    ? sanitizeProjectConfig(readConfigFile(canonicalizePath(projectConfigPath, allowedRoots)))
    : null

  // Merge: project overrides user
  return { ...userConfig, ...projectConfig }
}
