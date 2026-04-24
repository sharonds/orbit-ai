# Release Playbook

This playbook is for Orbit AI maintainers cutting npm releases.

Orbit uses [Changesets](https://github.com/changesets/changesets) for package
versioning and npm publishing. All public `@orbit-ai/*` packages are configured
as one fixed release group, so `@orbit-ai/api`, `@orbit-ai/cli`,
`@orbit-ai/core`, `@orbit-ai/demo-seed`, `@orbit-ai/integrations`,
`@orbit-ai/mcp`, and `@orbit-ai/sdk` bump together.

The repo is currently in alpha pre-release mode. Published versions use the
alpha tag, for example `0.1.0-alpha.1`.

## Per-PR Workflow

Add a changeset for every public-facing package change:

```bash
pnpm changeset
```

When prompted:

1. Choose the affected package or packages. Because Orbit packages are in a
   fixed group, choose all fixed-group packages when the change affects the
   shared public release.
2. Choose the semver bump: `patch`, `minor`, or `major`.
3. Write a short summary users can understand from the changelog.
4. Commit the generated `.changeset/*.md` file with the code change.

Skip the changeset for docs-only changes, CI-only changes, test-only changes,
or internal refactors that do not affect public behavior, package APIs, CLI
output, published metadata, or runtime behavior.

## Cutting an Alpha Release

Releases are driven from `main`.

1. Merge PRs that include changesets.
2. The release workflow runs on `main`. When unpublished changesets exist,
   Changesets opens a PR titled `chore(release): version packages`.
3. Review that PR carefully. It should remove consumed changesets, update
   package versions, update changelogs, and refresh the lockfile.
4. Merge the version PR.
5. The release workflow runs again on `main`. With no pending changesets, it
   publishes the packages to npm with provenance enabled and creates GitHub
   releases.

Do not publish from feature branches. The supported path is changeset PRs into
`main`, then the generated version PR, then publish after that PR is merged.

## Dry Runs

Before a sensitive release, verify from a fresh clone:

```bash
pnpm install --frozen-lockfile
pnpm release:dry-run
```

The dry run builds every package and runs `changeset publish --dry-run`. Use it
to confirm the packages, versions, files, registry auth, and publish plan before
merging the generated release PR.

## Manual Emergency Publish

Use this only if the GitHub release workflow is unavailable and maintainers have
agreed to publish manually.

1. Start from a clean, fresh clone of `main`.
2. Install dependencies with `pnpm install --frozen-lockfile`.
3. Confirm the version PR changes are already merged, or run
   `pnpm changeset:version` and commit the resulting version changes to `main`.
4. Authenticate to npm with an automation token that can publish the
   `@orbit-ai` scope.
5. Run `pnpm release:dry-run` and inspect the output.
6. Publish with provenance:

   ```bash
   NPM_CONFIG_PROVENANCE=true pnpm release
   ```

7. Push any committed version changes and create the corresponding GitHub
   releases manually if the workflow did not create them.

Manual publish should leave the repository in the same state as the automated
workflow: versions and changelogs committed on `main`, npm packages published,
and GitHub releases present.

## Exiting Alpha for GA

When maintainers are ready for the first stable release:

```bash
pnpm changeset pre exit
```

Commit the updated `.changeset/pre.json` file. After that commit reaches
`main`, the normal release workflow opens one more `chore(release): version
packages` PR. Review and merge it to produce the GA release, expected to be
`1.0.0` for the fixed `@orbit-ai/*` group.

## Setup Checklist

Before the first publish, verify:

- GitHub secret `NPM_TOKEN` exists for the repository.
- The release workflow has `contents: write`, `pull-requests: write`, and
  `id-token: write` permissions.
- Repository settings allow GitHub Actions to create and approve pull requests.
- The npm `@orbit-ai` scope is owned by the publishing maintainers or
  organization.
- `NPM_TOKEN` is an npm automation token with publish access to the
  `@orbit-ai` scope.
- The repository is public at publish time so npm provenance can be generated.
