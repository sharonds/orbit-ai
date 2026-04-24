# @orbit-ai/create-orbit-app

Scaffold a new Orbit AI starter in under 60 seconds.

**Status**: `0.1.0-alpha`.

## Usage

```bash
# Alpha (current):
npx @orbit-ai/create-orbit-app@alpha my-app

# Non-interactive:
npx @orbit-ai/create-orbit-app@alpha my-app --template default --yes
```

Requires **Node.js 22+**.

The scaffolder copies a starter template, substitutes the project name and the current `@orbit-ai/*` version into the template's `package.json`, and (by default) runs the install command for your detected package manager. After install it prints the package-manager-specific command to start the demo (`npm start`, `pnpm start`, `yarn start`, or `bun start`).

The default template boots an in-memory SQLite adapter, seeds the Acme Events demo tenant (200 contacts, 40 companies, 15 deals), and runs a handful of SDK queries — giving you a working CRM to query within seconds.

## Flags

| Flag | Description |
|---|---|
| `--template <name>` | Template to use (default: `default`) |
| `--yes`, `-y` | Non-interactive; accept all defaults |
| `--no-install` | Skip package-manager install after scaffolding |
| `--install-cmd <cmd>` | Custom install command (e.g. `pnpm install`) |
| `--help`, `-h` | Show help |

## License

MIT — see [LICENSE](LICENSE).
