# Security Tooling Recommendation

_Last researched: 2026-04-24_

Orbit AI is a public TypeScript monorepo with a small maintainer surface, pinned
GitHub Actions, Dependabot, branch protection, secret scanning, and private
vulnerability reporting already enabled. The next security tools should add
coverage without turning CI into a large maintenance burden.

## Recommendation

Adopt two free tools first:

1. **Socket** for dependency and software supply-chain security.
2. **GitHub CodeQL** for native TypeScript static analysis and GitHub code
   scanning alerts.

Do not add CodeRabbit as a primary security control yet. It is useful for PR review
quality and may catch security-adjacent issues, but it is not a dedicated SCA/SAST
control. Consider it later if PR volume grows.

## Why Socket

Socket is the best fit for Orbit's dependency risk because this repo is a
publishable npm workspace with multiple packages, a lockfile, GitHub Actions, and
release automation.

Socket's current public pricing page says:

- The free plan includes unlimited developers and repos, 1,000 scans per month,
  malicious dependency blocking, license/vulnerability signals, GitHub Actions
  scanning, AI model scanning, and related supply-chain checks.
- Socket says it is free for open-source projects and that open-source projects can
  contact them for a free Team account.
- Socket says private source code does not leave the computer or CI environment;
  dependency manifests and lockfiles are what get sent to Socket.

Orbit-specific value:

- Catches dependency confusion, suspicious install scripts, typo-squatting,
  maintainer/account risk, and newly malicious packages earlier than ordinary CVE
  scanning.
- Complements Dependabot, which is good for known vulnerabilities but does not
  fully cover malicious-package behavior.
- Helps review package additions in PRs without adding a heavy test matrix.

Recommended setup:

- Install the Socket GitHub app for `sharonds/orbit-ai`.
- Start in PR comment/check mode.
- Do not fail all PRs immediately. First tune noise for 1-2 weeks.
- After tuning, block only high-confidence malware, known compromised packages,
  severe supply-chain risk, and unacceptable license findings.

## Why GitHub CodeQL

CodeQL is the lowest-friction SAST option because Orbit is already on GitHub and is
a public repository.

GitHub's current docs say:

- CodeQL code scanning is available for public repositories on GitHub.com.
- CodeQL identifies vulnerabilities and errors and shows results as GitHub code
  scanning alerts.
- CodeQL supports JavaScript/TypeScript and GitHub Actions workflows.
- GitHub's security pricing page lists CodeQL as free for public repositories.

Orbit-specific value:

- Finds code-level security bugs in TypeScript that dependency scanners will not
  catch.
- Keeps alerts in GitHub's Security tab beside Dependabot and secret scanning.
- Avoids another vendor dashboard for the first SAST pass.
- Can be enabled with GitHub's default setup before adding custom workflow logic.

Recommended setup:

- Enable CodeQL default setup for JavaScript/TypeScript and GitHub Actions.
- Use default query suites first.
- Review alerts manually; do not immediately make CodeQL a required branch check.
- Once signal quality is understood, consider requiring only high-severity alerts
  to be resolved before release.

## Tools Considered But Not Chosen First

### CodeRabbit

CodeRabbit's pricing page says public repositories can receive free reviews
forever after installing it on a public repository.

Reason to defer:

- It is primarily an AI code-review assistant, not a dedicated security scanner.
- It may be useful for maintainability, test gaps, and PR explanations, but it
  should not replace Socket, CodeQL, or maintainer review for AppSec decisions.

When to revisit:

- PR volume increases.
- External contributions become common.
- We want automated review comments for style, tests, docs, and possible security
  smells.

### Semgrep

Semgrep's free tier currently includes code and supply-chain scanning for up to 50
repositories and 10 contributors.

Reason to defer:

- It overlaps with CodeQL for first-pass TypeScript SAST.
- It adds another dashboard and policy surface before Orbit has enough alert volume
  to justify it.

When to revisit:

- CodeQL misses framework-specific Hono/API patterns we care about.
- We want custom rules for Orbit-specific tenant isolation, DirectTransport, auth,
  or logging invariants.

### OpenSSF Scorecard

OpenSSF Scorecard is useful for public repo security posture and can run as a
GitHub Action. It is a good later addition for measuring practices like branch
protection, pinned dependencies, token permissions, and security policy coverage.

Reason to defer:

- It is a posture score, not direct vulnerability detection.
- Orbit has already addressed several high-value Scorecard-style controls:
  branch protection, pinned Actions, explicit workflow permissions, Dependabot,
  security policy, and CODEOWNERS.

When to revisit:

- Before a larger public launch.
- Before npm publish.
- When adding a security badge or public security posture report.

### StepSecurity Harden-Runner

StepSecurity's Community Tier is free for public repositories and provides
Harden-Runner monitoring/protection for GitHub Actions.

Reason to defer:

- It is most valuable once CI secrets, deployment credentials, or publish
  credentials are routinely exposed to workflows.
- Orbit's current CI is intentionally small, and release workflow hardening already
  reduces token exposure.

When to revisit:

- Before npm publish automation starts using real `NPM_TOKEN` regularly.
- If the release workflow grows or starts touching cloud credentials.

## Practical Rollout

1. **Week 1: enable Socket.**
   Watch dependency and lockfile findings, tune alert thresholds, and document
   what should block a PR.

2. **Week 1: enable CodeQL default setup.**
   Let alerts collect in GitHub code scanning without making it a required check.

3. **Week 2: triage findings.**
   Fix real high-confidence issues, suppress false positives with justification,
   and decide whether any check should become merge-blocking.

4. **Before npm publish: revisit Harden-Runner and OpenSSF Scorecard.**
   Release workflows deserve another pass once credentials and provenance are live.

## Sources

- Socket pricing: <https://socket.dev/pricing>
- Socket FAQ: <https://docs.socket.dev/docs/faq>
- GitHub CodeQL docs: <https://docs.github.com/en/code-security/concepts/code-scanning/codeql/about-code-scanning-with-codeql>
- GitHub security plans: <https://github.com/security/plans>
- CodeRabbit pricing: <https://www.coderabbit.ai/pricing>
- Semgrep pricing: <https://semgrep.dev/pricing/>
- OpenSSF Scorecard: <https://scorecard.dev/>
- StepSecurity Community Tier: <https://docs.stepsecurity.io/getting-started/quickstart-community-tier>
