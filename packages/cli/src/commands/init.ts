import * as fs from 'node:fs'
import * as path from 'node:path'
import { Command } from 'commander'
import { isOrbitId } from '@orbit-ai/core'
import { CliValidationError } from '../errors.js'
import { isJsonMode } from '../program.js'

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Scaffold .orbit/config.json and .env.example')
    .option('--db <type>', 'Database type: sqlite|postgres', 'sqlite')
    .option('--org-id <id>', 'Organization id (required for direct-mode commands like integrations)')
    .option('--org-name <name>', 'Organization name')
    .option('--yes', 'Skip confirmation prompts (non-interactive)')
    .option('--overwrite', 'Overwrite existing files')
    .option('--env-file <path>', 'Write .env file (only .env.example is allowed)')
    .action(async (opts) => {
      await runInit({ ...opts, cwd: process.cwd() })
    })
}

interface InitOptions {
  db?: string
  orgId?: string
  orgName?: string
  yes?: boolean
  overwrite?: boolean
  envFile?: string
  cwd: string
}

function assertNotSymlink(targetPath: string, label: string): void {
  if (!fs.existsSync(targetPath)) return

  const stat = fs.lstatSync(targetPath)
  if (stat.isSymbolicLink()) {
    throw new CliValidationError(`${label} must not be a symlink: ${targetPath}`, {
      code: 'SYMLINK_NOT_ALLOWED',
      target: targetPath,
    })
  }
}

export async function runInit(opts: InitOptions): Promise<void> {
  const { db = 'sqlite', orgId, orgName, yes, overwrite, envFile, cwd } = opts

  // Security: never write to .env
  if (envFile) {
    const normalized = path.basename(envFile)
    if (normalized === '.env') {
      throw new CliValidationError(
        'orbit init cannot write to .env. Only .env.example is allowed.',
        { code: 'FORBIDDEN_ENV_FILE', target: envFile },
      )
    }
  }

  // Non-interactive mode requires --yes
  if (!yes && !process.stdout.isTTY) {
    throw new CliValidationError(
      'orbit init requires --yes in non-interactive mode.',
      { code: 'REQUIRES_CONFIRMATION' },
    )
  }

  if (orgId !== undefined) {
    if (!isOrbitId(orgId, 'organization')) {
      throw new CliValidationError(
        '--org-id must be a valid org ULID (org_...).',
        { code: 'INVALID_ORG_ID' },
      )
    }
  }

  // Validate org name
  if (orgName !== undefined) {
    if (orgName.length > 100 || !/^[\x20-\x7E]*$/.test(orgName)) {
      throw new CliValidationError(
        'org-name must contain only printable ASCII characters and be 100 characters or fewer.',
        { code: 'INVALID_ORG_NAME' },
      )
    }
  }

  const orbitDir = path.join(cwd, '.orbit')
  const configPath = path.join(orbitDir, 'config.json')
  const envExamplePath = path.join(cwd, '.env.example')
  const gitignorePath = path.join(cwd, '.gitignore')

  assertNotSymlink(orbitDir, '.orbit directory')
  assertNotSymlink(configPath, 'Config file')
  assertNotSymlink(envExamplePath, '.env.example')
  assertNotSymlink(gitignorePath, '.gitignore')

  // Create .orbit directory
  if (!fs.existsSync(orbitDir)) {
    fs.mkdirSync(orbitDir, { recursive: true })
  } else if (!fs.statSync(orbitDir).isDirectory()) {
    throw new CliValidationError(`.orbit path is not a directory: ${orbitDir}`, {
      code: 'INVALID_INIT_TARGET',
      target: orbitDir,
    })
  }

  // Write config.json
  if (fs.existsSync(configPath) && !overwrite) {
    if (!isJsonMode()) {
      process.stderr.write(`Skipping existing ${configPath} (use --overwrite to replace)\n`)
    }
  } else {
    const config = {
      mode: db === 'sqlite' ? 'direct' : 'api',
      adapter: db,
      apiKeyEnv: 'ORBIT_API_KEY', // never the literal key
      ...(orgId ? { orgId } : {}),
      ...(orgName ? { orgName } : {}),
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 })
  }

  // Write .env.example
  if (fs.existsSync(envExamplePath) && !overwrite) {
    if (!isJsonMode()) {
      process.stderr.write(`Skipping existing ${envExamplePath} (use --overwrite to replace)\n`)
    }
  } else {
    const envExample = `# Orbit AI — environment variables\nORBIT_API_KEY=your-key-here\n# DATABASE_URL=postgresql://user:pass@host/db\n`
    fs.writeFileSync(envExamplePath, envExample)
  }

  // Update .gitignore
  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, 'utf8')
    if (!content.includes('.orbit/')) {
      fs.appendFileSync(gitignorePath, '\n.orbit/\n')
    }
  } else {
    process.stderr.write(`Warning: .gitignore not found. Add '.orbit/' to your .gitignore manually.\n`)
  }

  if (isJsonMode()) {
    process.stdout.write(JSON.stringify({ success: true, configPath, envExamplePath }) + '\n')
  } else {
    process.stdout.write(`Initialized Orbit at ${configPath}\n`)
  }
}
