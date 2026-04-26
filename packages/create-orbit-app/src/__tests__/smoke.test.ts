import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { run } from '../index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const packageDir = path.resolve(__dirname, '..', '..')
const repoRoot = path.resolve(packageDir, '..', '..')
const templatePackageJsonPath = path.resolve(__dirname, '..', '..', 'templates', 'default', 'package.json')
const execFileAsync = promisify(execFile)

async function runCommand(file: string, args: string[], options: { cwd: string; env?: NodeJS.ProcessEnv }) {
  return execFileAsync(file, args, {
    cwd: options.cwd,
    env: { ...process.env, CI: '1', ...options.env },
    maxBuffer: 1024 * 1024 * 10,
  })
}

function createPnpmShim(workDir: string) {
  const binDir = path.join(workDir, 'bin')
  fs.mkdirSync(binDir)
  const pnpmShim = path.join(binDir, 'pnpm')
  fs.writeFileSync(pnpmShim, '#!/bin/sh\nexec corepack pnpm "$@"\n')
  fs.chmodSync(pnpmShim, 0o755)
  return { PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ''}` }
}

async function packCreateOrbitApp(packDir: string, workDir: string) {
  const env = createPnpmShim(workDir)
  try {
    return await runCommand(
      'corepack',
      ['pnpm', '--filter', '@orbit-ai/create-orbit-app', 'pack', '--pack-destination', packDir],
      { cwd: repoRoot, env },
    )
  } catch (err) {
    const output = err && typeof err === 'object' && 'stderr' in err ? String((err as { stderr?: unknown }).stderr ?? '') : ''
    if (!output.includes("Unknown option: 'recursive'")) {
      throw err
    }

    return runCommand('corepack', ['pnpm', '--dir', packageDir, 'pack', '--pack-destination', packDir], {
      cwd: repoRoot,
      env,
    })
  }
}

function readJson(file: string) {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown
}

describe('create-orbit-app smoke', () => {
  it('scaffolds a default project from argv without prompting', async () => {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coa-smoke-'))
    const cwd = process.cwd()
    try {
      process.chdir(workDir)
      await run(['my-app', '--yes', '--no-install'])
      const projectDir = path.join(workDir, 'my-app')
      expect(fs.existsSync(path.join(projectDir, 'package.json'))).toBe(true)
      expect(fs.existsSync(path.join(projectDir, 'src', 'index.ts'))).toBe(true)
      expect(fs.existsSync(path.join(projectDir, '.gitignore'))).toBe(true)

      const pkg = JSON.parse(fs.readFileSync(path.join(projectDir, 'package.json'), 'utf8'))
      expect(pkg.name).toBe('my-app')
      // `--yes` defaults the template to `default`, and the version placeholder was replaced with a real semver.
      expect(pkg.dependencies['@orbit-ai/core']).toMatch(/^\d+\.\d+\.\d+(-[a-z0-9.]+)?$/)
      // No placeholders remain anywhere.
      const content = fs.readFileSync(path.join(projectDir, 'package.json'), 'utf8')
      expect(content).not.toContain('__APP_NAME__')
      expect(content).not.toContain('__ORBIT_VERSION__')
    } finally {
      process.chdir(cwd)
      fs.rmSync(workDir, { recursive: true, force: true })
    }
  }, 60_000)

  it('keeps Orbit starter dependencies on the exact version placeholder', () => {
    const pkg = JSON.parse(fs.readFileSync(templatePackageJsonPath, 'utf8')) as {
      dependencies: Record<string, string>
    }

    expect(pkg.dependencies['@orbit-ai/core']).toBe('__ORBIT_VERSION__')
    expect(pkg.dependencies['@orbit-ai/sdk']).toBe('__ORBIT_VERSION__')
    expect(pkg.dependencies['@orbit-ai/demo-seed']).toBe('__ORBIT_VERSION__')
  })

  it('packs a publishable tarball and runs the packed bin smoke path', async () => {
    const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coa-packed-smoke-'))
    const packDir = path.join(workDir, 'pack')
    const extractDir = path.join(workDir, 'extract')
    const scaffoldDir = path.join(workDir, 'scaffold')
    fs.mkdirSync(packDir)
    fs.mkdirSync(extractDir)
    fs.mkdirSync(scaffoldDir)

    try {
      await packCreateOrbitApp(packDir, workDir)

      const tarballs = fs.readdirSync(packDir).filter((entry) => entry.endsWith('.tgz'))
      expect(tarballs).toHaveLength(1)
      const tarballPath = path.join(packDir, tarballs[0])

      const { stdout: tarListStdout } = await runCommand('tar', ['-tzf', tarballPath], { cwd: workDir })
      const tarEntries = tarListStdout.trim().split('\n').filter(Boolean)
      expect(tarEntries).toContain('package/bin/create-orbit-app.js')
      expect(tarEntries).toContain('package/dist/index.js')
      expect(tarEntries).toContain('package/templates/default/package.json')
      expect(tarEntries).toContain('package/README.md')
      expect(tarEntries).toContain('package/LICENSE')

      expect(tarEntries.every((entry) => entry.startsWith('package/'))).toBe(true)
      expect(tarEntries.some((entry) => entry === 'package/src/' || entry.startsWith('package/src/'))).toBe(false)
      expect(tarEntries.some((entry) => entry === 'package/node_modules/' || entry.startsWith('package/node_modules/'))).toBe(false)
      expect(tarEntries.some((entry) => entry.endsWith('.tsbuildinfo'))).toBe(false)
      expect(tarEntries.some((entry) => path.basename(entry) === '.env')).toBe(false)

      await runCommand('tar', ['-xzf', tarballPath, '-C', extractDir], { cwd: workDir })

      const packedBin = path.join(extractDir, 'package', 'bin', 'create-orbit-app.js')
      const createOrbitAppPkg = readJson(path.join(packageDir, 'package.json')) as { version: string }
      const { stdout: versionStdout } = await runCommand(process.execPath, [packedBin, '--version'], { cwd: workDir })
      expect(versionStdout.trim()).toBe(`@orbit-ai/create-orbit-app ${createOrbitAppPkg.version}`)

      await runCommand(process.execPath, [packedBin, 'my-app', '--yes', '--no-install'], { cwd: scaffoldDir })
      const generatedPackageJsonPath = path.join(scaffoldDir, 'my-app', 'package.json')
      const generatedPackageJsonContent = fs.readFileSync(generatedPackageJsonPath, 'utf8')
      const generatedPackageJson = JSON.parse(generatedPackageJsonContent) as {
        dependencies: Record<string, string>
      }

      expect(generatedPackageJson.dependencies['@orbit-ai/core']).toBe(createOrbitAppPkg.version)
      expect(generatedPackageJson.dependencies['@orbit-ai/sdk']).toBe(createOrbitAppPkg.version)
      expect(generatedPackageJson.dependencies['@orbit-ai/demo-seed']).toBe(createOrbitAppPkg.version)
      expect(generatedPackageJsonContent).not.toContain('__APP_NAME__')
      expect(generatedPackageJsonContent).not.toContain('__ORBIT_VERSION__')
    } finally {
      fs.rmSync(workDir, { recursive: true, force: true })
    }
  }, 120_000)
})
