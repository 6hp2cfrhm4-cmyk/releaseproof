# ReleaseProof CLI

The CLI is the bundled interface to the shared ReleaseProof core. The current development version is `0.2.0-dev.0`; the historical `v0.1.0` tag and release assets are immutable and do not include current core hardening.

Until the next release is published, build from the repository root:

```bash
corepack pnpm install --frozen-lockfile
pnpm run build
node apps/cli/dist/index.js verify ./path/to/project
```

Commands:

```text
releaseproof verify [path] [--port N] [--timeout MS] [--python-interpreter PATH] [--json] [--ci] [--verbose] [--skip-sandbox]
releaseproof report [path]
releaseproof vibe [path]
releaseproof doctor
releaseproof clean [path]
```

Exit codes are `0` for READY, `1` for NOT_READY, `2` for VERIFICATION INCOMPLETE, and `3` for a ReleaseProof internal error.

Configuration precedence is defaults, then project `.releaseproof.json`, then only CLI flags explicitly supplied by the user. Route checks cover discovered routes plus `criticalRoutes`; they do not prove every business flow. Browser capability is reported explicitly as `VERIFIED`, `HTTP_FALLBACK`, `UNAVAILABLE`, or `SKIPPED`. Browser applications do not receive READY when only HTTP fallback was available.

The verification workspace excludes `.env`, `.env.local`, `.env.production`, and related secret-bearing variants by default. Child processes receive a minimal host environment. Projects can opt in via `environment.allowHost`, provide fixed values through `environment.provide`, or explicitly enable copying env files with `environment.includeEnvFiles`. Explicit values are registered for output redaction.

See the repository [README](../../README.md), [Architecture](../../ARCHITECTURE.md), and [Security Policy](../../SECURITY.md) for the complete contract.
