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
5. The release workflow runs again on `main`. Only a commit associated with the
   merged same-repo `changeset-release/main` PR opened by `github-actions[bot]`
   is allowed to publish packages to npm with provenance enabled and create
   GitHub releases.

Do not publish from feature branches. The supported path is changeset PRs into
`main`, then the generated version PR, then publish after that PR is merged.

## Dry Runs

Before a sensitive release, verify from a fresh clone checked out to the
generated `chore(release): version packages` PR branch:

```bash
pnpm install --frozen-lockfile
pnpm release:dry-run
```

The dry run builds every package and runs `pnpm publish --dry-run` for each
public `@orbit-ai/*` package with lifecycle scripts disabled, matching the
credential-bearing publish step. CI builds in the read-only validation job and
the publish job downloads those built artifacts before exposing npm credentials.
The publish job also runs `pnpm release:verify-artifacts` before publishing to
confirm each publishable package has its declared `main`, `types`, `exports`,
and CLI `bin` files in `packages/*/dist`.
Use the dry run to confirm the packages, versions, files, registry auth, and
publish plan before merging the generated release PR. Running the dry run on
`main` before the version PR merges checks the pre-versioned state, not the
release candidate.

## Emergency Publish

Prefer fixing or rerunning the GitHub release workflow. npm provenance requires
OIDC from a supported CI provider, so a local publish from a maintainer laptop
cannot produce the same provenance metadata as the workflow.

If the workflow is broken but GitHub Actions still runs, use a temporary manual
workflow with `id-token: write`, run `pnpm -r build` before exposing npm
credentials, install publish dependencies with scripts disabled, then run
`NPM_CONFIG_IGNORE_SCRIPTS=true pnpm release`. Remove the temporary workflow
after the release.

Use a local publish only if maintainers explicitly accept a no-provenance
emergency release.

1. Start from a clean, fresh clone of `main`.
2. Install dependencies with `pnpm install --frozen-lockfile`.
3. Confirm the version PR changes are already merged, or run
   `pnpm changeset:version` and commit the resulting version changes to `main`.
4. Authenticate to npm with an automation token that can publish the
   `@orbit-ai` scope.
5. Run `pnpm release:dry-run` and inspect the output.
6. Build and publish without provenance:

   ```bash
   pnpm -r build
   export NPM_CONFIG_IGNORE_SCRIPTS=true
   pnpm release
   ```

7. Push any committed version changes and create the corresponding GitHub
   releases manually if the workflow did not create them.

Manual publish should leave the repository in the same state as the automated
workflow: versions and changelogs committed on `main`, npm packages published,
and GitHub releases present.

## Bad Publish Recovery

Use this path when a publish already reached npm but the release is incomplete,
broken, or has incorrect metadata. Prefer fix-forward releases over unpublish
whenever users may already have installed the version.

1. Stop further release attempts and record the affected package names,
   versions, workflow run, npm publish output, and GitHub release links.
2. Check the npm state for every fixed-group package:

   ```bash
   for package in api cli core demo-seed integrations mcp sdk; do
     npm view "@orbit-ai/${package}" dist-tags versions --json
   done
   ```

3. If only some packages published, do not manually publish the missing
   packages until maintainers decide whether the package group can remain at
   that version. Partial fixed-group releases should usually be replaced by a
   new alpha for every public package.
4. Prefer a fix-forward alpha when the version is public, the package contents
   are installable enough for users to have consumed, or more than a few minutes
   have passed. Land the fix, add a changeset, let the generated release PR bump
   all fixed-group packages, and publish the replacement through the normal
   workflow.
5. Use `npm unpublish` only for a just-published alpha that is clearly unusable
   and still within npm policy. Confirm no users or downstream automation have
   consumed it first. If unpublish is used, remove or reconcile the matching
   GitHub release and document why.
6. If the bad version stays on npm, deprecate every affected package version:

   ```bash
   npm deprecate "@orbit-ai/api@0.1.0-alpha.N" "Bad alpha release; use 0.1.0-alpha.N+1."
   ```

   Repeat for each affected fixed-group package.
7. Verify the `alpha` dist-tag points at the intended replacement version:

   ```bash
   npm dist-tag ls @orbit-ai/core
   npm dist-tag add @orbit-ai/core@0.1.0-alpha.N+1 alpha
   ```

   Repeat only when a tag is wrong. Do not move `latest` during alpha.
8. Reconcile GitHub Releases and changelogs. If the bad release remains visible,
   edit the GitHub release notes to point users at the replacement. If it was
   unpublished, delete or clearly mark the GitHub release as withdrawn.
9. Open a follow-up issue or incident note with the cause, affected versions,
   replacement version, npm dist-tag state, deprecation or unpublish actions,
   and prevention work.

## Troubleshooting

- Workflow fails with `E401 Unauthorized`: `NPM_TOKEN` is missing, expired, or
  not an automation token.
- Workflow fails with `E404 Not Found` on a workspace dependency: check fixed
  group membership and publish order.
- Version Packages PR never opens: no changesets exist on `main`, or the
  workflow was skipped.
- Provenance fails with OIDC exchange failed: check for missing
  `id-token: write`, or a fork/public repository issue.
- Published but `npm view` shows the old version: registry caching; wait, then
  retry with the registry specified.

## Exiting Alpha for GA

When maintainers are ready for the first stable release:

```bash
pnpm changeset pre exit
```

Commit the updated `.changeset/pre.json` file. After that commit reaches
`main`, the normal release workflow opens one more `chore(release): version
packages` PR. Review the generated versions before merging. Exiting pre-release
mode does not automatically mean `1.0.0`; maintainers must choose the intended
stable version through changesets and version review.

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
- npm account and organization policy allow automation-token publishing, or the
  workflow has been migrated to trusted publishing before GA.
- The repository is public at publish time so npm provenance can be generated.
