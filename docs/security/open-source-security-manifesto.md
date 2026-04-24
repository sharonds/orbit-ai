# Open Source Security Manifesto

Security for an open source project is not one tool, one badge, or one CI job. It is a layered operating model: reduce what can enter, inspect what does enter, make changes reviewable, and keep the process transparent enough that contributors can trust it.

The goal is not maximum friction. The goal is secure velocity.

## Principles

### 1. Security Must Be Layered

No single product catches everything. Use overlapping defenses:

- GitHub native protections for repository control
- CodeQL for code scanning
- Dependabot for known vulnerable dependencies
- Socket or similar tools for dependency behavior and supply-chain risk
- DepsGuard or package-manager hardening for safer install defaults
- human review for context

Each layer should catch a different class of risk.

### 2. Protect The Path To Main

The most important security boundary is what can land in `main`.

Every public repository should have:

- protected default branch
- required CI
- no force pushes
- no branch deletion
- secret scanning and push protection
- CODEOWNERS where useful
- clear merge ownership
- private vulnerability reporting where available

If `main` is protected, mistakes are recoverable. If `main` is open, every other tool is weaker.

### 3. Treat Dependencies As Code

Dependencies are not passive metadata. They execute code, run install scripts, change transitive trees, and can affect production behavior.

For every project:

- review dependency PRs
- avoid blind automerge for major updates
- use lockfiles
- use frozen installs in CI
- prefer dependency cooldowns
- watch for new maintainers, new install scripts, new binaries, and unusual package behavior

Dependency updates are code review work.

### 4. Delay Brand-New Packages When Possible

Many supply-chain attacks depend on speed: a malicious package version is published, installed quickly, then removed later.

Use tools and settings that delay brand-new versions:

- Dependabot cooldowns
- Renovate minimum release age
- package-manager minimum release age where supported
- DepsGuard as a scanner and checklist

A short delay can block many fast-burn poisoned release attacks.

### 5. Disable Install Scripts Where Practical

Install scripts are powerful and risky.

In CI:

- use frozen lockfiles
- use `--ignore-scripts` where possible
- explicitly allow scripts only when needed

This limits what dependencies can execute during install.

### 6. Separate Security Patches From Migrations

Not every dependency PR is equal.

Classify updates:

- patch security fix: fast path, focused review
- minor update: normal review
- major toolchain or framework update: planned migration
- failed bot PR: investigate, document, defer or fix intentionally

Do not bury TypeScript, React, test runner, package manager, and lockfile changes in one giant dependency update.

### 7. Keep CI Strong But Not Wasteful

Slow CI becomes ignored CI.

Use tiered validation:

- every PR: build, typecheck, lint, unit tests
- relevant PRs: scoped integration or E2E tests
- `main` and release paths: full deep test suite
- manual workflow: full validation on demand

Security improves when checks are fast enough that maintainers actually wait for them.

### 8. Make Security Decisions Public

Open source security requires trust.

Use public artifacts:

- `SECURITY.md`
- issue trackers
- PR comments
- security operations docs
- migration plans
- clear explanations when closing Dependabot PRs

If a major update is deferred, explain why. If a tool is advisory, say so. If a warning is a false positive, document the reason.

### 9. Use Advisory Tools As Advisory Tools

AI, code review, and security tools are useful, but they are not maintainers.

Use tools like CodeRabbit, Copilot review, Socket, CodeQL, and Dependabot as signal sources. Human maintainers still decide:

- severity
- exploitability
- user impact
- compatibility risk
- timing

Do not let noisy tools become automatic blockers without tuning.

### 10. Prefer Small, Reversible Changes

Security work should be easy to audit.

Prefer:

- one setting per PR
- one dependency class per PR
- one migration phase per PR
- clear rollback path
- explicit validation checklist

Small security PRs are safer than heroic rewrites.

## Baseline Checklist

### Repository

- Add `SECURITY.md`.
- Add a license.
- Add CODEOWNERS if ownership is clear.
- Enable private vulnerability reporting where available.
- Protect `main`.
- Require CI before merge.
- Disable force pushes and branch deletion.

### GitHub Security

- Enable Dependabot alerts.
- Enable Dependabot security updates.
- Enable secret scanning.
- Enable push protection.
- Enable CodeQL.
- Review branch protection after every major workflow change.

### Dependencies

- Keep lockfiles committed.
- Use frozen installs in CI.
- Avoid blind automerge.
- Add Dependabot or Renovate cooldowns where practical.
- Use Socket or an equivalent supply-chain scanner.
- Run DepsGuard read-only and apply safe recommendations.
- Defer risky major upgrades into public migration issues.

### CI

- Require build, typecheck, lint, and tests.
- Scope E2E to risky paths on PRs.
- Run full E2E on `main`.
- Provide a manual full validation workflow.
- Use minimal workflow permissions.
- Pin GitHub Actions to commit SHAs where practical.

### Release

- Separate release PRs from feature PRs.
- Verify generated release PR provenance.
- Use npm provenance and OIDC where possible.
- Protect publish tokens.
- Do not expose publish credentials during build steps.
- Document release rollback steps.

### Community

- Explain how to report vulnerabilities.
- Label dependency and security issues clearly.
- Document why bot PRs are closed or deferred.
- Keep migration plans public.
- Avoid security theater; explain tradeoffs plainly.

## Operating Rule

Every project should be able to answer:

- Who can merge?
- What must pass before merge?
- How are secrets blocked?
- How are dependency risks reviewed?
- What happens when a security tool flags something?
- What happens when a major dependency upgrade fails?
- How does someone report a vulnerability privately?

If those answers are written down and enforced in GitHub, the project has a real security posture.

## One-Sentence Philosophy

Secure open source is not about blocking every change; it is about making risky changes visible, reviewable, delayed when appropriate, tested at the right depth, and merged only through protected paths.

