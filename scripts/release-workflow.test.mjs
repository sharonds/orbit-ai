import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const workflow = readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8')
const ciWorkflow = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8')
const changesetConfig = JSON.parse(readFileSync(new URL('../.changeset/config.json', import.meta.url), 'utf8'))
const createOrbitAppManifest = JSON.parse(
  readFileSync(new URL('../packages/create-orbit-app/package.json', import.meta.url), 'utf8'),
)

const VERIFY_PACKAGE_ARTIFACTS = fileURLToPath(new URL('./verify-package-artifacts.mjs', import.meta.url))
const RELEASE_DRY_RUN = fileURLToPath(new URL('./release-dry-run.mjs', import.meta.url))

test('publish job restores built package artifacts under packages/', () => {
  assert.match(
    workflow,
    /name: Download built package artifacts[\s\S]*?with:\n\s+name: package-dist\n\s+path: packages\n/,
  )
})

test('publish job verifies package entrypoints before publishing', () => {
  const verifyIndex = workflow.indexOf('name: Verify package artifacts')
  const publishIndex = workflow.indexOf('publish: pnpm release')

  assert.ok(verifyIndex > -1, 'missing package artifact verification step')
  assert.ok(publishIndex > -1, 'missing publish step')
  assert.ok(verifyIndex < publishIndex, 'artifact verification must happen before publish')
  assert.match(workflow, /run: node scripts\/verify-package-artifacts\.mjs/)
})

test('release validate runs launch-gate e2e before package test sweep', () => {
  const releaseWorkflowIndex = workflow.indexOf('name: Test release workflow')
  const e2eIndex = workflow.indexOf('name: Test launch-gate E2E journeys')
  const packageTestIndex = workflow.indexOf("pnpm -r --filter '!@orbit-ai/e2e' test")
  const versionJobIndex = workflow.indexOf('\n  version:')
  const publishJobIndex = workflow.indexOf('\n  publish:')

  assert.ok(releaseWorkflowIndex > -1, 'missing release-workflow test step')
  assert.ok(e2eIndex > -1, 'missing launch-gate E2E test step')
  assert.ok(packageTestIndex > -1, 'missing generic package test sweep')
  assert.ok(versionJobIndex > -1, 'missing version job')
  assert.ok(publishJobIndex > -1, 'missing publish job')
  assert.ok(releaseWorkflowIndex < e2eIndex, 'E2E gate must run after workflow tests')
  assert.ok(e2eIndex < packageTestIndex, 'E2E gate must run before package test sweep')
  assert.ok(packageTestIndex < versionJobIndex, 'all validation tests must run before versioning')
  assert.ok(versionJobIndex < publishJobIndex, 'publish must remain after versioning')
  assert.match(workflow, /ORBIT_E2E_ADAPTER: sqlite/)
  assert.match(workflow, /run: pnpm --filter @orbit-ai\/e2e test/)
})

test('publish job checks repository visibility before npm provenance publish', () => {
  const downloadIndex = workflow.indexOf('name: Download built package artifacts')
  const publicRepoIndex = workflow.indexOf('name: Verify repository is public for npm provenance')
  const verifyIndex = workflow.indexOf('name: Verify package artifacts')
  const publishIndex = workflow.indexOf('publish: pnpm release')

  assert.ok(downloadIndex > -1, 'missing artifact download step')
  assert.ok(publicRepoIndex > -1, 'missing public repository provenance precondition')
  assert.ok(verifyIndex > -1, 'missing package artifact verifier')
  assert.ok(publishIndex > -1, 'missing publish action')
  assert.ok(downloadIndex < publicRepoIndex, 'public repo check should run after artifacts are restored')
  assert.ok(publicRepoIndex < verifyIndex, 'public repo check should run before artifact verification')
  assert.ok(verifyIndex < publishIndex, 'artifact verification should still run before publish')
  assert.match(workflow, /shell: bash/)
  assert.match(workflow, /gh api -H "Accept: application\/vnd\.github\+json" "\/repos\/\$\{GITHUB_REPOSITORY\}" --jq '\.private'/)
  assert.match(workflow, /set -euo pipefail[\s\S]*could not verify repository visibility/)
  assert.match(workflow, /case "\$is_private" in[\s\S]*unexpected repository visibility response/)
  assert.match(workflow, /NPM_CONFIG_PROVENANCE: "true"/)
})

test('workflow action pin comments match pinned action SHAs', () => {
  const workflows = `${workflow}\n${ciWorkflow}`
  assert.doesNotMatch(workflows, /Pinned from pnpm\/action-setup v4\.4\.0/)
  assert.doesNotMatch(workflows, /Pinned from actions\/setup-node v4\.4\.0/)
  assert.match(
    workflows,
    /# Pinned from pnpm\/action-setup v6\.0\.3\.\n\s+uses: pnpm\/action-setup@903f9c1a6ebcba6cf41d87230be49611ac97822e/,
  )
  assert.match(
    workflows,
    /# Pinned from actions\/setup-node v6\.4\.0\.\n\s+uses: actions\/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e/,
  )
})

test('changesets ignores private e2e package', () => {
  assert.ok(changesetConfig.ignore.includes('orbit-ai-nodejs-quickstart'))
  assert.ok(changesetConfig.ignore.includes('@orbit-ai/e2e'))
})

test('ci e2e-scope regexes cover release-sensitive paths', () => {
  const scopeStart = ciWorkflow.indexOf('id: e2e-scope')
  const scopeEnd = ciWorkflow.indexOf('Verify no manual package.json version bumps')
  assert.ok(scopeStart > -1, 'missing e2e-scope step')
  assert.ok(scopeEnd > scopeStart, 'missing end of e2e-scope step')
  const e2eScope = ciWorkflow.slice(scopeStart, scopeEnd)
  const patterns = [...e2eScope.matchAll(/grep -E '([^']+)'/g)].map((match) => new RegExp(match[1]))
  assert.equal(patterns.length, 2, 'expected exactly two e2e-scope grep -E filters')
  const [sqlitePattern, postgresPattern] = patterns

  for (const path of [
    'package.json',
    'pnpm-workspace.yaml',
    'packages/demo-seed/package.json',
    'packages/demo-seed/src/index.ts',
    'packages/create-orbit-app/package.json',
    'packages/cli/package.json',
    'packages/cli/src/index.ts',
    'packages/mcp/src/server.ts',
    'packages/core/src/index.ts',
    'packages/api/src/routes/objects.ts',
    'packages/sdk/src/client.ts',
    'e2e/README.md',
    'e2e/src/harness/build-stack.ts',
    'examples/nodejs-quickstart/package.json',
    'pnpm-lock.yaml',
    '.github/workflows/ci.yml',
    '.github/workflows/release.yml',
    'scripts/release-workflow.test.mjs',
    'scripts/release-dry-run.mjs',
    'scripts/release/checks.mjs',
    'scripts/verify-package-artifacts.mjs',
    '.changeset/plan-b-codex-followups.md',
    'docs/product/release-definition-v2.md',
  ]) {
    assert.match(path, sqlitePattern, `${path} should trigger SQLite E2E`)
  }

  for (const path of [
    'package.json',
    'pnpm-workspace.yaml',
    'packages/core/package.json',
    'packages/create-orbit-app/package.json',
    'packages/api/src/routes/objects.ts',
    'packages/sdk/package.json',
    'packages/cli/src/index.ts',
    'packages/mcp/src/server.ts',
    'packages/demo-seed/src/index.ts',
    'e2e/src/harness/build-stack.ts',
    'e2e/src/journeys/_crud-matrix.ts',
    'e2e/src/journeys/07-custom-field.test.ts',
    'e2e/src/journeys/12-sdk-helpers.test.ts',
    'e2e/src/journeys/15-tenant-isolation.test.ts',
    'pnpm-lock.yaml',
    '.github/workflows/ci.yml',
    '.github/workflows/release.yml',
    'scripts/release-workflow.test.mjs',
    'scripts/release/checks.mjs',
    '.changeset/plan-b-codex-followups.md',
    'docs/product/release-definition-v2.md',
  ]) {
    assert.match(path, postgresPattern, `${path} should trigger Postgres E2E`)
  }

  assert.doesNotMatch('docs/releasing.md', sqlitePattern)
  assert.doesNotMatch('packages/create-orbit-app/src/index.ts', postgresPattern)
})

test('Postgres E2E CI job covers adapter-aware journeys and harness safety tests', () => {
  const postgresJobIndex = ciWorkflow.indexOf('journeys-postgres:')
  assert.ok(postgresJobIndex > -1, 'missing Postgres E2E job')
  const postgresJob = ciWorkflow.slice(postgresJobIndex)
  const requiredPostgresCommand =
    'pnpm -F @orbit-ai/e2e test src/journeys/02 src/journeys/03 src/journeys/04 src/journeys/05 src/journeys/06 src/journeys/07 src/journeys/08 src/journeys/09 src/journeys/10 src/journeys/11 src/journeys/12 src/journeys/15'

  assert.match(postgresJob, new RegExp(escapeRegExp(requiredPostgresCommand)), 'Postgres E2E job must run the required journey subset')
  assert.match(
    postgresJob,
    /pnpm -F @orbit-ai\/e2e test src\/harness\/build-stack\.test\.ts/,
    'Postgres E2E job must run the build-stack harness safety test',
  )
})

test('E2E API listener exists for CLI API-mode journeys', () => {
  const src = readFileSync(new URL('../e2e/src/harness/api-server.ts', import.meta.url), 'utf8')
  const testSrc = readFileSync(new URL('../e2e/src/harness/api-server.test.ts', import.meta.url), 'utf8')
  assert.match(src, /createServer/, 'api-server must use a real Node HTTP listener')
  assert.match(src, /api\.fetch\(new Request/, 'api-server must route requests through the Hono API fetch handler')
  assert.match(src, /127\.0\.0\.1/, 'api-server must bind locally for CLI child processes')
  assert.match(testSrc, /startApiServer/, 'api-server must have runtime coverage')
  assert.match(testSrc, /server\.baseUrl/, 'api-server runtime test must assert the bound URL')
  assert.match(testSrc, /server\.close\(\)/, 'api-server runtime test must close the listener')
})

test('CLI workspace helper is adapter-aware with shared Postgres safety', () => {
  const src = readFileSync(new URL('../e2e/src/harness/prepare-cli-workspace.ts', import.meta.url), 'utf8')
  const safetySrc = readFileSync(new URL('../e2e/src/harness/postgres-safety.ts', import.meta.url), 'utf8')
  const buildStackSrc = readFileSync(new URL('../e2e/src/harness/build-stack.ts', import.meta.url), 'utf8')
  assert.match(src, /ORBIT_E2E_ADAPTER/, 'prepare-cli-workspace must read ORBIT_E2E_ADAPTER')
  assert.match(src, /adapterType === 'postgres'/, 'prepare-cli-workspace must have a Postgres branch')
  assert.match(src, /adapter: 'postgres'/, 'prepare-cli-workspace must return adapter metadata')
  assert.match(src, /verifiedBy: 'metadata'/, 'prepare-cli-workspace must return proof metadata')
  assert.match(src, /assertSafePostgresE2eUrl\(databaseUrl\)/, 'prepare-cli-workspace must call shared safety helper')
  assert.match(buildStackSrc, /assertSafePostgresE2eUrl\(databaseUrl\)/, 'buildStack must call shared safety helper')
  assert.match(safetySrc, /orbit_e2e/, 'shared safety helper must allow only local e2e databases')
})

test('Postgres buildStack API key insert cannot reassign existing keys', () => {
  const src = readFileSync(new URL('../e2e/src/harness/build-stack.ts', import.meta.url), 'utf8')
  const testSrc = readFileSync(new URL('../e2e/src/harness/build-stack.test.ts', import.meta.url), 'utf8')
  assert.match(src, /ON CONFLICT \(key_hash\) DO NOTHING/)
  assert.doesNotMatch(src, /ON CONFLICT \(key_hash\) DO UPDATE SET organization_id/)
  assert.doesNotMatch(src, /ON CONFLICT \(key_prefix\)/)
  assert.match(testSrc, /hash collision belongs to a different organization/)
  assert.match(testSrc, /key_prefix/)
})

test('E2E config keeps shared Postgres journeys serial', () => {
  const src = readFileSync(new URL('../e2e/vitest.config.ts', import.meta.url), 'utf8')
  assert.match(src, /fileParallelism:\s*false/, 'shared Postgres e2e database requires serial journey files')
})

test('create-orbit-app package declares publish metadata and prepack build hook', () => {
  assert.equal(createOrbitAppManifest.name, '@orbit-ai/create-orbit-app')
  assert.equal(createOrbitAppManifest.license, 'MIT')
  assert.equal(createOrbitAppManifest.author, 'Orbit AI Contributors')
  assert.equal(createOrbitAppManifest.repository?.directory, 'packages/create-orbit-app')
  assert.equal(createOrbitAppManifest.homepage, 'https://github.com/sharonds/orbit-ai#readme')
  assert.equal(createOrbitAppManifest.bugs?.url, 'https://github.com/sharonds/orbit-ai/issues')
  assert.ok(Array.isArray(createOrbitAppManifest.keywords))
  assert.ok(createOrbitAppManifest.keywords.includes('orbit-ai'))
  assert.equal(createOrbitAppManifest.scripts?.prepack, 'pnpm run build')
  assert.equal(createOrbitAppManifest.scripts?.prepublishOnly, 'pnpm run build && node dist/publishGuard.js')
})

test('verifier accepts string-form bin entries', () => {
  const fixture = makePackageFixture({
    manifest: publishableManifest({ bin: 'dist/cli.js' }),
    files: { 'dist/index.js': '', 'dist/index.d.ts': '', 'dist/cli.js': '' },
  })
  try {
    const result = runNodeScript(VERIFY_PACKAGE_ARTIFACTS, fixture.root)
    assert.equal(result.status, 0, output(result))
  } finally {
    fixture.cleanup()
  }
})

test('verifier accepts object-form bin entries', () => {
  const fixture = makePackageFixture({
    manifest: publishableManifest({ bin: { fixture: 'dist/cli.js' }, files: ['dist', 'README.md', 'LICENSE'] }),
    files: { 'dist/index.js': '', 'dist/index.d.ts': '', 'dist/cli.js': '' },
  })
  try {
    const result = runNodeScript(VERIFY_PACKAGE_ARTIFACTS, fixture.root)
    assert.equal(result.status, 0, output(result))
  } finally {
    fixture.cleanup()
  }
})

test('verifier fails invalid object-form bin entries', () => {
  const fixture = makePackageFixture({
    manifest: publishableManifest({ bin: { fixture: 123 } }),
    files: { 'dist/index.js': '', 'dist/index.d.ts': '' },
  })
  try {
    const result = runNodeScript(VERIFY_PACKAGE_ARTIFACTS, fixture.root)
    assert.notEqual(result.status, 0)
    assert.match(output(result), /bin\.fixture/)
    assert.match(output(result), /non-empty string/)
  } finally {
    fixture.cleanup()
  }
})

test('verifier fails when license field is missing', () => {
  const fixture = makePackageFixture({
    manifest: publishableManifest({ license: undefined }),
    files: { 'dist/index.js': '', 'dist/index.d.ts': '' },
  })
  try {
    const result = runNodeScript(VERIFY_PACKAGE_ARTIFACTS, fixture.root)
    assert.notEqual(result.status, 0)
    assert.match(output(result), /license/i)
  } finally {
    fixture.cleanup()
  }
})

test('verifier fails when README is missing', () => {
  const fixture = makePackageFixture({
    manifest: publishableManifest(),
    files: { 'dist/index.js': '', 'dist/index.d.ts': '' },
    includeReadme: false,
  })
  try {
    const result = runNodeScript(VERIFY_PACKAGE_ARTIFACTS, fixture.root)
    assert.notEqual(result.status, 0)
    assert.match(output(result), /README\.md/)
  } finally {
    fixture.cleanup()
  }
})

test('verifier fails when LICENSE is missing', () => {
  const fixture = makePackageFixture({
    manifest: publishableManifest(),
    files: { 'dist/index.js': '', 'dist/index.d.ts': '' },
    includeLicense: false,
  })
  try {
    const result = runNodeScript(VERIFY_PACKAGE_ARTIFACTS, fixture.root)
    assert.notEqual(result.status, 0)
    assert.match(output(result), /LICENSE/)
  } finally {
    fixture.cleanup()
  }
})

test('verifier fails when package readiness metadata is incomplete', () => {
  const fixture = makePackageFixture({
    manifest: publishableManifest({ description: '', files: [] }),
    files: { 'dist/index.js': '', 'dist/index.d.ts': '' },
  })
  try {
    const result = runNodeScript(VERIFY_PACKAGE_ARTIFACTS, fixture.root)
    assert.notEqual(result.status, 0)
    assert.match(output(result), /description/i)
    assert.match(output(result), /files/i)
  } finally {
    fixture.cleanup()
  }
})

test('verifier fails when files field is missing', () => {
  const fixture = makePackageFixture({
    manifest: publishableManifest({ files: undefined }),
    files: { 'dist/index.js': '', 'dist/index.d.ts': '' },
  })
  try {
    const result = runNodeScript(VERIFY_PACKAGE_ARTIFACTS, fixture.root)
    assert.notEqual(result.status, 0)
    assert.match(output(result), /files/i)
  } finally {
    fixture.cleanup()
  }
})

test('verifier fails when package files allowlist omits declared artifacts', () => {
  const fixture = makePackageFixture({
    manifest: publishableManifest({ files: ['README.md', 'LICENSE'] }),
    files: { 'dist/index.js': '', 'dist/index.d.ts': '' },
  })
  try {
    const result = runNodeScript(VERIFY_PACKAGE_ARTIFACTS, fixture.root)
    assert.notEqual(result.status, 0)
    assert.match(output(result), /dist\/index\.js is not covered/)
    assert.match(output(result), /dist\/index\.d\.ts is not covered/)
  } finally {
    fixture.cleanup()
  }
})

test('verifier rejects package artifact paths that escape the package root', () => {
  const fixture = makePackageFixture({
    manifest: publishableManifest({
      main: '/dist/index.js',
      types: '../index.d.ts',
      bin: { fixture: 'bin/../fixture.js' },
      exports: {
        './unsafe': './dist/../../unsafe.js',
      },
    }),
    files: {
      'dist/index.js': '',
      'dist/index.d.ts': '',
      'bin/fixture.js': '',
    },
  })
  try {
    const result = runNodeScript(VERIFY_PACKAGE_ARTIFACTS, fixture.root)
    assert.notEqual(result.status, 0)
    assert.match(output(result), /invalid package artifact path "\/dist\/index\.js"/)
    assert.match(output(result), /invalid package artifact path "\.\.\/index\.d\.ts"/)
    assert.match(output(result), /invalid package artifact path "bin\/\.\.\/fixture\.js"/)
    assert.match(output(result), /invalid package artifact path "\.\/dist\/\.\.\/\.\.\/unsafe\.js"/)
  } finally {
    fixture.cleanup()
  }
})

test('verifier accepts npm glob patterns in package files allowlist', () => {
  const fixture = makePackageFixture({
    manifest: publishableManifest({
      files: ['dist/**/*.{js,d.ts}', 'bin/*.js', 'README.md', 'LICENSE'],
      main: 'dist/browser/index.js',
      types: 'dist/browser/index.d.ts',
      bin: { fixture: './bin/fixture.js' },
    }),
    files: {
      'dist/browser/index.js': '',
      'dist/browser/index.d.ts': '',
      'bin/fixture.js': '',
    },
  })
  try {
    const result = runNodeScript(VERIFY_PACKAGE_ARTIFACTS, fixture.root)
    assert.equal(result.status, 0, output(result))
  } finally {
    fixture.cleanup()
  }
})

test('verifier fails when package files allowlist negates a declared artifact', () => {
  const fixture = makePackageFixture({
    manifest: publishableManifest({
      files: ['dist', '!dist/vercel.js', 'README.md', 'LICENSE'],
      exports: {
        '.': './dist/index.js',
        './vercel': './dist/vercel.js',
      },
    }),
    files: {
      'dist/index.js': '',
      'dist/index.d.ts': '',
      'dist/vercel.js': '',
    },
  })
  try {
    const result = runNodeScript(VERIFY_PACKAGE_ARTIFACTS, fixture.root)
    assert.notEqual(result.status, 0)
    assert.match(output(result), /dist\/vercel\.js is not covered/)
  } finally {
    fixture.cleanup()
  }
})

test('verifier fails empty and invalid bin forms', () => {
  for (const bin of ['', {}, []]) {
    const fixture = makePackageFixture({
      manifest: publishableManifest({ bin }),
      files: { 'dist/index.js': '', 'dist/index.d.ts': '' },
    })
    try {
      const result = runNodeScript(VERIFY_PACKAGE_ARTIFACTS, fixture.root)
      assert.notEqual(result.status, 0)
      assert.match(output(result), /"bin"/)
    } finally {
      fixture.cleanup()
    }
  }
})

test('verifier skips private and non-orbit packages', () => {
  const root = mkdtempSync(join(tmpdir(), 'orbit-verify-skip-'))
  try {
    writePackage(root, 'private-fixture', {
      name: '@orbit-ai/private-fixture',
      private: true,
      main: 'dist/missing.js',
    })
    writePackage(root, 'external-fixture', {
      name: 'external-fixture',
      main: 'dist/missing.js',
    })
    const result = runNodeScript(VERIFY_PACKAGE_ARTIFACTS, root)
    assert.equal(result.status, 0, output(result))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('verifier accumulates multiple failures', () => {
  const fixture = makePackageFixture({
    manifest: publishableManifest({
      license: undefined,
      main: 'dist/missing.js',
      types: 'dist/missing.d.ts',
    }),
    includeLicense: false,
  })
  try {
    const result = runNodeScript(VERIFY_PACKAGE_ARTIFACTS, fixture.root)
    assert.notEqual(result.status, 0)
    assert.match(output(result), /license/i)
    assert.match(output(result), /LICENSE/)
    assert.match(output(result), /dist\/missing\.js/)
    assert.match(output(result), /dist\/missing\.d\.ts/)
  } finally {
    fixture.cleanup()
  }
})

test('verifier accumulates malformed manifests with other failures', () => {
  const root = mkdtempSync(join(tmpdir(), 'orbit-verify-mixed-failures-'))
  try {
    const badJsonDir = join(root, 'packages', 'bad-json')
    mkdirSync(badJsonDir, { recursive: true })
    writeFileSync(join(badJsonDir, 'package.json'), '{')
    writePackage(root, 'bad-metadata', publishableManifest({ license: undefined }), {
      files: { 'dist/index.js': '', 'dist/index.d.ts': '' },
    })
    const result = runNodeScript(VERIFY_PACKAGE_ARTIFACTS, root)
    assert.notEqual(result.status, 0)
    assert.match(output(result), /packages\/bad-json\/package\.json/)
    assert.match(output(result), /license/i)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('verifier reports malformed manifest path', () => {
  const root = mkdtempSync(join(tmpdir(), 'orbit-verify-bad-json-'))
  try {
    const packageDir = join(root, 'packages', 'bad-json')
    mkdirSync(packageDir, { recursive: true })
    writeFileSync(join(packageDir, 'package.json'), '{')
    const result = runNodeScript(VERIFY_PACKAGE_ARTIFACTS, root)
    assert.notEqual(result.status, 0)
    assert.match(output(result), /packages\/bad-json\/package\.json/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('release dry-run reports spawn errors distinctly', () => {
  const fixture = makeDryRunFixture()
  try {
    const result = runNodeScript(RELEASE_DRY_RUN, fixture.root, {
      ORBIT_RELEASE_DRY_RUN_PNPM_BIN: join(fixture.root, 'missing-pnpm'),
    })
    assert.notEqual(result.status, 0)
    assert.match(output(result), /failed to spawn/i)
    assert.match(output(result), /@orbit-ai\/fixture/)
  } finally {
    fixture.cleanup()
  }
})

test('release dry-run reports signal terminations distinctly', () => {
  const fixture = makeDryRunFixture()
  const fakePnpm = writeExecutable(fixture.root, 'fake-pnpm-signal', '#!/bin/sh\nkill -TERM "$$"\n')
  try {
    const result = runNodeScript(RELEASE_DRY_RUN, fixture.root, {
      ORBIT_RELEASE_DRY_RUN_PNPM_BIN: fakePnpm,
    })
    assert.notEqual(result.status, 0)
    assert.match(output(result), /signal SIGTERM/i)
    assert.match(output(result), /@orbit-ai\/fixture/)
  } finally {
    fixture.cleanup()
  }
})

test('release dry-run reports non-zero statuses distinctly', () => {
  const fixture = makeDryRunFixture()
  const fakePnpm = writeExecutable(fixture.root, 'fake-pnpm-status', '#!/bin/sh\nexit 7\n')
  try {
    const result = runNodeScript(RELEASE_DRY_RUN, fixture.root, {
      ORBIT_RELEASE_DRY_RUN_PNPM_BIN: fakePnpm,
    })
    assert.equal(result.status, 7)
    assert.match(output(result), /exited with status 7/i)
    assert.match(output(result), /@orbit-ai\/fixture/)
  } finally {
    fixture.cleanup()
  }
})

test('release dry-run reports malformed manifest path', () => {
  const root = mkdtempSync(join(tmpdir(), 'orbit-dry-run-bad-json-'))
  try {
    const packageDir = join(root, 'packages', 'bad-json')
    mkdirSync(packageDir, { recursive: true })
    writeFileSync(join(packageDir, 'package.json'), '{')
    const result = runNodeScript(RELEASE_DRY_RUN, root)
    assert.notEqual(result.status, 0)
    assert.match(output(result), /packages\/bad-json\/package\.json/)
    assert.match(output(result), /Release dry-run failed:/)
    assert.doesNotMatch(output(result), /\n\s+at /)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('release dry-run reports missing packages directory without stack trace', () => {
  const root = mkdtempSync(join(tmpdir(), 'orbit-dry-run-no-packages-'))
  try {
    const result = runNodeScript(RELEASE_DRY_RUN, root)
    assert.notEqual(result.status, 0)
    assert.match(output(result), /Release dry-run failed:/)
    assert.match(output(result), /packages/)
    assert.doesNotMatch(output(result), /\n\s+at /)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('release dry-run reports no publishable packages without stack trace', () => {
  const root = mkdtempSync(join(tmpdir(), 'orbit-dry-run-no-publishable-'))
  try {
    writePackage(root, 'private-fixture', {
      name: '@orbit-ai/private-fixture',
      private: true,
      version: '0.0.0',
    })
    writePackage(root, 'external-fixture', {
      name: 'external-fixture',
      version: '0.0.0',
    })
    const result = runNodeScript(RELEASE_DRY_RUN, root)
    assert.notEqual(result.status, 0)
    assert.match(output(result), /No publishable @orbit-ai packages/)
    assert.doesNotMatch(output(result), /\n\s+at /)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

function publishableManifest(overrides = {}) {
  const manifest = {
    name: '@orbit-ai/fixture',
    version: '0.0.0',
    description: 'Fixture package',
    license: 'MIT',
    files: ['dist', 'README.md', 'LICENSE'],
    main: 'dist/index.js',
    types: 'dist/index.d.ts',
    ...overrides,
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete manifest[key]
    }
  }

  return manifest
}

function makePackageFixture({ manifest, files = {}, includeLicense = true, includeReadme = true }) {
  const root = mkdtempSync(join(tmpdir(), 'orbit-verify-'))
  writePackage(root, 'fixture', manifest, { files, includeLicense, includeReadme })
  return {
    root,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  }
}

function makeDryRunFixture() {
  const root = mkdtempSync(join(tmpdir(), 'orbit-dry-run-'))
  writePackage(root, 'fixture', publishableManifest(), {
    files: { 'dist/index.js': '', 'dist/index.d.ts': '' },
  })
  return {
    root,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  }
}

function writePackage(root, packageName, manifest, options = {}) {
  const packageDir = join(root, 'packages', packageName)
  mkdirSync(packageDir, { recursive: true })
  writeFileSync(join(packageDir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)

  if (options.includeLicense !== false) {
    writeFileSync(join(packageDir, 'LICENSE'), 'MIT fixture')
  }

  if (options.includeReadme !== false) {
    writeFileSync(join(packageDir, 'README.md'), '# Fixture')
  }

  for (const [relativePath, contents] of Object.entries(options.files ?? {})) {
    const fullPath = join(packageDir, relativePath)
    mkdirSync(dirname(fullPath), { recursive: true })
    writeFileSync(fullPath, contents)
  }

  return packageDir
}

function writeExecutable(root, name, contents) {
  const fullPath = join(root, name)
  writeFileSync(fullPath, contents)
  chmodSync(fullPath, 0o755)
  return fullPath
}

function runNodeScript(script, cwd, extraEnv = {}) {
  return spawnSync(process.execPath, [script], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...extraEnv },
  })
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function output(result) {
  return `${result.stdout ?? ''}${result.stderr ?? ''}`
}
