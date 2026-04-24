# Security Tools Playbook

This playbook describes a practical security stack for open source and private projects. The tools are complementary: each covers a different class of risk.

## Recommended Stack

| Layer | Tooling | Purpose |
| --- | --- | --- |
| Repository control | GitHub branch protection, CODEOWNERS, required checks | Protect `main` and make merges reviewable |
| Secret protection | GitHub secret scanning and push protection | Block accidental credential leaks |
| Code scanning | CodeQL | Detect code-level security issues |
| Known dependency vulnerabilities | Dependabot alerts and security updates | Track CVEs and vulnerable versions |
| Dependency behavior | Socket | Detect risky package behavior and supply-chain signals |
| Package-manager hardening | DepsGuard | Check safer install and update defaults |
| Review support | CodeRabbit, Copilot review, human review | Advisory feedback and maintainability checks |
| Release safety | Changesets, provenance, OIDC, publish-token isolation | Make releases auditable and reduce credential exposure |

## GitHub Native Security

Use GitHub's built-in protections as the baseline:

- protected default branch
- required CI
- secret scanning
- push protection
- Dependabot alerts
- Dependabot security updates
- CodeQL
- private vulnerability reporting

These should be enabled before adding third-party tools.

## Socket

Socket helps with dependency behavior and supply-chain risk. It is useful because it can flag risks that normal CVE scanning may miss.

Use Socket for:

- suspicious install scripts
- malware-like package behavior
- risky package capabilities
- package reputation changes
- unexpected new dependency behavior
- dependency confusion and typosquatting-style risk

Recommended rollout:

1. Install Socket in non-blocking mode.
2. Watch a few dependency PRs.
3. Tune noise before requiring it.
4. Block only high-confidence malware, compromise, or severe supply-chain findings.

Socket should complement Dependabot and CodeQL, not replace them.

## DepsGuard

DepsGuard scans package-manager configuration and recommends supply-chain hardening.

It can help with:

- minimum release age for new packages
- disabled install scripts
- stricter pnpm dependency builds
- provenance downgrade protections where supported
- Dependabot or Renovate cooldowns
- package-manager-specific hardening across npm, pnpm, yarn, bun, and uv

Recommended rollout:

1. Run `depsguard scan` read-only.
2. Separate repo-level findings from user-level findings.
3. Apply low-risk repo settings first.
4. Defer settings that require package-manager upgrades.

Orbit AI scan result on 2026-04-24:

- `depsguard` was not installed globally.
- A verified temporary `depsguard` v0.1.33 macOS arm64 binary was used.
- Result: 16 checks total, 4 missing files, 2 unset settings, 10 unsupported, 0 OK.
- Most pnpm hardening settings are unsupported until pnpm 10+ because Orbit AI currently uses pnpm 9.12.3.
- The most actionable repo-level finding was missing Dependabot cooldowns.

## Dependabot

Dependabot is useful for known vulnerable dependencies and routine updates, but it should be configured to reduce noise.

Recommended settings:

- group related updates carefully
- limit open PR count
- add cooldowns where appropriate
- avoid auto-merging major updates
- separate runtime dependencies from dev-toolchain migrations

When closing a Dependabot PR, leave a comment explaining why.

## CodeQL

CodeQL should be enabled for code scanning. It is a good baseline for public repositories.

Recommended rollout:

1. Enable default setup.
2. Let it run on a few PRs.
3. Triage initial alerts.
4. Consider making it required only after tuning and alert cleanup.

## CodeRabbit And Copilot Review

Use these as advisory tools, not as primary security gates.

Good uses:

- code quality feedback
- maintainability suggestions
- catching obvious mistakes
- review assistance for public PRs

Do not automatically block merges on every comment. Decide whether each finding is:

- real issue to fix
- false positive to dismiss with reason
- follow-up issue
- non-blocking suggestion

## CI Security Defaults

Recommended CI patterns:

- use `pnpm install --frozen-lockfile`
- use `--ignore-scripts` where practical
- run required build/typecheck/lint/test on every PR
- scope E2E tests by changed paths
- run full E2E on `main`
- use minimal workflow permissions
- pin GitHub Actions to commit SHAs where practical
- keep publish credentials out of build steps

## Cross-Project Adoption Plan

For any new project:

1. Add `SECURITY.md`, license, and contribution guidance.
2. Protect the default branch.
3. Require CI.
4. Enable GitHub secret scanning, push protection, Dependabot, and CodeQL.
5. Install Socket in non-blocking mode.
6. Run DepsGuard read-only.
7. Add cooldowns and safe package-manager hardening.
8. Document dependency triage rules.
9. Track major toolchain upgrades in public issues.
10. Review the setup quarterly.

For private projects, keep the same model. The artifacts can live in internal docs instead of public issues, but the discipline is the same.

