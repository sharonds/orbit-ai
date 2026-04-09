# PR #26 Security Review

Date: 2026-04-09
PR: `#26` `feat(cli): @orbit-ai/cli`
Reviewer: Codex + subagent cross-check

## Executive Summary

The main security weakness in PR #26 is that the new CLI trusts repo-local `.orbit/config.json` too much. In particular, project config can redirect authenticated API traffic to an arbitrary host and can influence which environment variable is used as the API credential. I also found a local file clobber risk in `orbit init` because it writes through symlinks without checking the target type.

I did not find command injection or obvious remote code execution in the CLI itself.

## Findings

### SEC-001

- Severity: High
- Rule ID: CLI-CONFIG-TRUST-001
- Location: `packages/cli/src/config/files.ts:163`, `packages/cli/src/config/files.ts:185`, `packages/cli/src/config/resolve-context.ts:151`, `packages/cli/src/config/resolve-context.ts:159`, `packages/cli/src/config/resolve-context.ts:204`, `packages/sdk/src/transport/http-transport.ts:17`, `packages/sdk/src/transport/http-transport.ts:26`
- Evidence:

```ts
// packages/cli/src/config/files.ts
export function loadConfig(
  cwd: string = process.cwd(),
  overrideHome?: string,
): OrbitConfig {
  ...
  const projectConfigPath = findProjectConfig(cwd)
  ...
  return { ...userConfig, ...projectConfig }
}
```

```ts
// packages/cli/src/config/resolve-context.ts
const apiKeyFromEnvName =
  mergedFileConfig.apiKeyEnv ? env[mergedFileConfig.apiKeyEnv] : undefined

const apiKey =
  flags.apiKey ?? env['ORBIT_API_KEY'] ?? apiKeyFromEnvName ?? mergedFileConfig.apiKey

const baseUrl = flags.baseUrl ?? env['ORBIT_BASE_URL'] ?? mergedFileConfig.baseUrl
...
const clientOpts: import('@orbit-ai/sdk').OrbitClientOptions = { apiKey: resolvedApiKey }
if (baseUrl !== undefined) clientOpts.baseUrl = baseUrl
```

```ts
// packages/sdk/src/transport/http-transport.ts
const url = new URL(input.path, this.options.baseUrl ?? 'http://localhost:3000')
...
authorization: `Bearer ${this.options.apiKey}`,
```

- Impact: A malicious repository can commit `.orbit/config.json` with an attacker-controlled `baseUrl`. If the developer runs `orbit status` or any other API-mode command in that repo, the CLI will send an authenticated `Authorization: Bearer ...` header to the attacker-controlled server. If `ORBIT_API_KEY` is unset, the same config can point `apiKeyEnv` at a different local secret and exfiltrate that instead.
- Fix: Treat repo-local config as untrusted for credential-bearing fields. At minimum, ignore `baseUrl`, `apiKey`, and `apiKeyEnv` from project config and only allow them from CLI flags, process env, or user-level config. If project-level overrides are required, gate them behind explicit trust/allow flags.
- Mitigation: Until fixed, avoid running `orbit` commands in untrusted repos and avoid keeping broad secrets in shell env when testing project-local CLI config.
- False positive notes: This depends on a user running the CLI inside a repo containing attacker-controlled `.orbit/config.json`, but that is exactly the trust model introduced by automatic config discovery.

### SEC-002

- Severity: Medium
- Rule ID: CLI-FILESYSTEM-001
- Location: `packages/cli/src/config/resolve-context.ts:36`, `packages/cli/src/config/resolve-context.ts:38`, `packages/cli/src/config/resolve-context.ts:56`, `packages/cli/src/config/resolve-context.ts:77`, `packages/cli/src/config/resolve-context.ts:80`, `packages/cli/src/commands/seed.ts:29`, `packages/cli/src/commands/seed.ts:43`
- Evidence:

```ts
// packages/cli/src/config/resolve-context.ts
const adapterName = flags.adapter ?? config.adapter ?? 'sqlite'
const dbUrl = flags.databaseUrl ?? config.databaseUrl ?? ''
...
if (dbUrl.startsWith('file:')) {
  ...
  dbPath = parsed.pathname
} else {
  dbPath = dbUrl || path.join(cwd, '.orbit', 'orbit.db')
}
...
const database =
  dbPath === ':memory:'
    ? new SqliteOrbitDatabase()
    : new SqliteOrbitDatabase({ filename: dbPath })
```

```ts
// packages/cli/src/commands/seed.ts
const fileConfig = loadConfig(cwd)
const effectiveMode = flags.mode ?? fileConfig.mode ?? 'api'
...
const client = resolveClient({ flags })
```

- Impact: Project config can force direct mode and point SQLite at an arbitrary local path. Running a seemingly harmless CLI command in that repo can open, create, or corrupt an attacker-chosen local file under the developer’s permissions.
- Fix: Treat project-configured `mode`, `adapter`, and `databaseUrl` as untrusted by default. Constrain repo-local SQLite paths to the project directory unless the user explicitly passes a flag, and reject symlinks, device files, and paths outside an allowlist.
- Mitigation: Prefer explicit `--mode` and `--database-url` flags when testing direct mode, and do not honor direct-mode settings from project config in untrusted repos.
- False positive notes: The exact damage depends on how the SQLite/database layer behaves for the chosen target file, but opening or creating arbitrary files is already an unsafe local side effect.

### SEC-003

- Severity: Medium
- Rule ID: CLI-SYMLINK-WRITE-001
- Location: `packages/cli/src/commands/init.ts:72`, `packages/cli/src/commands/init.ts:84`, `packages/cli/src/commands/init.ts:88`, `packages/cli/src/commands/init.ts:94`, `packages/cli/src/commands/init.ts:98`, `packages/cli/src/commands/init.ts:101`
- Evidence:

```ts
// packages/cli/src/commands/init.ts
if (fs.existsSync(configPath) && !overwrite) {
  ...
} else {
  ...
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 })
}

if (fs.existsSync(envExamplePath) && !overwrite) {
  ...
} else {
  fs.writeFileSync(envExamplePath, envExample)
}

if (fs.existsSync(gitignorePath)) {
  const content = fs.readFileSync(gitignorePath, 'utf8')
  if (!content.includes('.orbit/')) {
    fs.appendFileSync(gitignorePath, '\n.orbit/\n')
  }
}
```

- Impact: If a repository contains symlinks at `.orbit/config.json`, `.env.example`, or `.gitignore`, `orbit init` will write through the symlink target. That gives a malicious checkout a local file clobber primitive against any user-writable path.
- Fix: Before reading or writing these paths, use `lstatSync` and reject symlinks. For new files, create with exclusive open flags and verify the parent directory is not a symlink chain you do not trust.
- Mitigation: Avoid running `orbit init` in untrusted working trees until symlink handling is hardened.
- False positive notes: This requires the repo itself to contain the symlink, but that is a realistic supply-chain and malicious-template scenario for a bootstrap CLI.

## Residual Risks

- I did not find command execution, shell injection, or dynamic-code-evaluation paths in the CLI package.
- `--api-key` still exposes credentials at process-launch time; the warning is useful, but mutating `process.argv` after startup should not be relied on as real redaction.

