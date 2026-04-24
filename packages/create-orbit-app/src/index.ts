import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseOptions, type Options } from './options.js'
import { runInteractivePrompts } from './prompts.js'
import { copyTemplate } from './copy.js'
import { detectPackageManager, installCommandFor, runInstall, type PackageManager } from './install.js'
import { getOrbitVersion } from './version.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const HELP = `
Usage: create-orbit-app <project-name> [options]

Scaffold a new Orbit AI starter.

Options:
  --template <name>     Template to use (default: 'default')
  --yes, -y             Non-interactive; accept all defaults
  --no-install          Skip package-manager install after scaffold
  --install-cmd <cmd>   Custom install command (e.g., 'pnpm install')
  --help, -h            Show this help

Examples:
  npx create-orbit-app@alpha my-app
  npx create-orbit-app@alpha my-app --template default --yes
`.trim()

export async function run(argv: readonly string[] = process.argv.slice(2)): Promise<void> {
  let opts: Options
  try {
    opts = parseOptions(argv)
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err))
    process.exit(2)
  }
  if (opts.help) {
    console.log(HELP)
    return
  }

  const optsWithDefaults: Options = opts.yes
    ? { ...opts, template: opts.template ?? ('default' as const) }
    : opts

  // Guard against non-TTY environments (CI, piped stdin) — prompts would hang.
  const needsPrompting = !optsWithDefaults.yes && (!optsWithDefaults.projectName || !optsWithDefaults.template)
  if (needsPrompting && !process.stdin.isTTY) {
    console.error('No TTY detected. Rerun with --yes to use defaults, or provide all flags explicitly.')
    console.error('Example: create-orbit-app my-app --template default --yes')
    process.exit(1)
  }

  const resolved = optsWithDefaults.yes && optsWithDefaults.projectName && optsWithDefaults.template
    ? { ...optsWithDefaults, projectName: optsWithDefaults.projectName, template: optsWithDefaults.template }
    : await runInteractivePrompts(optsWithDefaults)

  const targetDir = path.resolve(process.cwd(), resolved.projectName)
  if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
    console.error(`Target directory ${targetDir} is not empty. Choose another name or clear it first.`)
    process.exit(1)
  }

  const sourceDir = path.resolve(__dirname, '..', 'templates', resolved.template)
  const version = getOrbitVersion()

  await copyTemplate({
    sourceDir,
    targetDir,
    replacements: {
      __APP_NAME__: resolved.projectName,
      __ORBIT_VERSION__: version,
    },
  })

  let packageManager = detectPackageManager(process.env)
  if (resolved.install) {
    console.log('\nInstalling dependencies…')
    try {
      packageManager = await runInstall({
        cwd: targetDir,
        ...(resolved.installCmd !== undefined ? { customCmd: resolved.installCmd } : {}),
      })
    } catch (err) {
      console.error('Install failed. You can run it manually:')
      console.error(`  cd ${resolved.projectName} && ${installCommandFor(packageManager)}`)
      console.error(err instanceof Error ? err.message : String(err))
      process.exit(1)
    }
  }

  printNextSteps(resolved.projectName, resolved.install, packageManager)
}

function printNextSteps(projectName: string, installed: boolean, packageManager: PackageManager): void {
  console.log(`\n✓ Created ${projectName}\n`)
  console.log('Next steps:')
  console.log(`  cd ${projectName}`)
  if (!installed) console.log(`  ${installCommandFor(packageManager)}`)
  console.log(`  ${packageManager} start`)
  console.log('\nDocs: https://orbit-ai.dev  (coming soon)\n')
}

// Note: no `import.meta.url === file://${process.argv[1]}` auto-run guard.
// The bin wrapper at bin/create-orbit-app.js explicitly calls `run()` after dynamic import.
