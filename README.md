# ReleaseProof

[![CI](https://github.com/6hp2cfrhm4-cmyk/releaseproof/actions/workflows/ci.yml/badge.svg)](https://github.com/6hp2cfrhm4-cmyk/releaseproof/actions/workflows/ci.yml)
[![GitHub Release](https://img.shields.io/github/v/release/6hp2cfrhm4-cmyk/releaseproof?label=release&color=blue)](https://github.com/6hp2cfrhm4-cmyk/releaseproof/releases/tag/v0.1.0)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

Your AI says it's done.  
ReleaseProof checks if it actually ships.

**Vibe code. Verify before you ship.**

> **Development status:** This checkout contains the unreleased `0.2.0-dev.0` core-hardening line. The historical `v0.1.0` tag and assets are immutable and are not the source of the fixes described below. Build from source until a new release is published.

```
ReleaseProof v0.1.0
Project: my-saas-app
Stack:   Next.js 14 (pnpm)
──────────────────────────────────────────────────
 NOT READY TO SHIP   50 / 100
2 blockers · 1 warnings · 5 passed · 6.2s
──────────────────────────────────────────────────
Categories:
  install         PASS   15/15
  build           PASS   15/15
  runtime         FAIL    0/20
  browser         FAIL    0/15
  api             PASS   10/10
  environment     FAIL    0/10
  documentation   PASS     5/5
  security        PASS   10/10

Verified Blockers (2):
  ✗ [environment] Server secrets exposed to client-side bundle
    NEXT_PUBLIC_STRIPE_SECRET_KEY leaks live payment credentials into client JS.
    Fix: Rename to STRIPE_SECRET_KEY and consume exclusively in server routes.

  ✗ [runtime] Production server crashed on startup
    Error: Cannot find module 'jsonwebtoken' (in production NODE_ENV).
    Fix: Move 'jsonwebtoken' from devDependencies to dependencies in package.json.

Artifacts:
  JSON Report:   .releaseproof/report.json
  HTML Report:   .releaseproof/report.html
  AI Fix Prompt: .releaseproof/RELEASEPROOF_FIX.md
```

---

## 1. Why

AI coding agents (Claude Code, Cursor, Copilot, Codex, Devin) build working prototypes in minutes. But **"it works in local dev mode" does not mean "it ships to production"**:

- **Dev vs Prod Mismatches**: A package imported by runtime server code was placed in `devDependencies`. It runs locally because `node_modules` is dirty, but crashes with `MODULE_NOT_FOUND` in production containers.
- **Client-Exposed Secrets**: An AI created `NEXT_PUBLIC_STRIPE_SECRET_KEY` or `VITE_SUPABASE_SERVICE_ROLE`, baking private backend keys directly into browser JavaScript bundles.
- **Silent Runtime Crashes**: The build succeeded, but the production server crashes on startup or renders a React error boundary when accessed via headless browser.
- **README Drift**: The AI updated CLI arguments or ports, but left contradictory instructions in `README.md`.

**ReleaseProof is the production readiness verifier for AI-built and traditionally-built applications.**

AI coding agent:  
> *"Your app is done."*

ReleaseProof:  
> *"Let's prove it."*

---

## 2. Installation & Quick Start

The hardened development build is currently available from source. Do not treat the historical `v0.1.0` artifact as containing the hardening work.

### Method 1: Build from source

Install with the lockfile and build the bundled CLI:

```bash
corepack pnpm install --frozen-lockfile
pnpm run build
node apps/cli/dist/index.js verify ./path/to/project
```

For machines with multiple Python installations, use project config `python.interpreter` or the explicit `--python-interpreter PATH` CLI option.

Then run `releaseproof` in any repository:

```bash
# Run full clean-room verification pipeline on the current directory
releaseproof

# Run verification on a specific project directory
releaseproof verify ./path/to/project

# View the interactive HTML report in your browser
releaseproof report

# Generate a shareable terminal card
releaseproof vibe

# Check your environment prerequisites (Node, Python, Playwright)
releaseproof doctor
```

> A versioned tarball command will be documented after the next artifact is built from its tag commit and published with `SHA256SUMS.txt`.

---

### Method 2: Clone & Build from Source

Clone the repository and build the standalone CLI bundle:

```bash
# 1. Clone the repository
git clone https://github.com/6hp2cfrhm4-cmyk/releaseproof.git
cd releaseproof

# 2. Install dependencies & build all packages
pnpm install
pnpm build

# 3. Link globally so the 'releaseproof' binary is available system-wide
npm link ./apps/cli

# Run verification from anywhere:
releaseproof verify /path/to/project
```

*Alternatively, execute directly via Node without global linking:*
```bash
node apps/cli/dist/index.js verify /path/to/project
# or via pnpm from repository root:
pnpm proof /path/to/project
```

---

### Distribution Channels

| Channel | Status | Installation / Run Command |
| :--- | :--- | :--- |
| **GitHub Releases** | 🟡 **Historical only** | `v0.1.0` does not contain current core hardening; the next release is pending re-audit. |
| **Source Clone** | 🟢 **Available** | `git clone https://github.com/6hp2cfrhm4-cmyk/releaseproof.git && pnpm build` |
| **npm Registry** | ⚪ *Not published* | Do not rely on `npx releaseproof` until registry publication is completed. |

---

## 3. What ReleaseProof Checks

ReleaseProof operates a 9-phase verification pipeline in an isolated clean verification workspace. This is filesystem hygiene, not a security boundary for untrusted code.

| Phase | What ReleaseProof Proves |
| :--- | :--- |
| **Clean Workspace** | Copies project into an ephemeral directory, stripping dirty dependencies/build output and secret-bearing `.env*` files by default. |
| **Clean Installation** | Runs a fresh install using the detected package manager (`npm`, `pnpm`, `yarn`, `pip`, `uv`). |
| **Production Build** | Executes the exact production compilation command (`next build`, `vite build`, etc.). |
| **Production Startup** | Rejects preoccupied ports, launches the production server, repeats HTTP probes during a stability window, and cleans up the owned process tree. |
| **Browser & HTTP Crawl** | Uses Playwright for browser applications and records `VERIFIED`, `HTTP_FALLBACK`, `UNAVAILABLE`, or `SKIPPED`; HTTP fallback never claims client-runtime coverage. |
| **Environment Audit** | Scans AST for `process.env.*` usages, verifying variables are documented in `.env.example` and no private server secrets use client prefixes. |
| **Security Secrets** | Scans for 12 hardcoded credential patterns (Stripe, GitHub tokens, AWS keys, JWTs) with automatic redaction. |
| **README as Contract** | Parses command blocks in `README.md` and verifies documented commands match actual scripts in `package.json`. |
| **Scoring & AI Handoff** | Computes a weighted 0-100 score, determines verdict, and generates `.releaseproof/RELEASEPROOF_FIX.md`. |

---

## 4. Understanding Verdicts

ReleaseProof separates verified application failures from unavailable verification capabilities and external infrastructure. No finite corpus can prove that false positives or false negatives are impossible.

- 🟢 **`READY TO SHIP`**: All checks passed. Zero blockers, zero unverified dependencies. Clean to deploy.
- 🟡 **`VERIFICATION INCOMPLETE`**: Application code, build, and configuration are valid, but runtime smoke testing requires external infrastructure (e.g. PostgreSQL, MongoDB, Redis, or live SaaS credentials like Stripe or Clerk) that was not configured locally.
- 🔴 **`NOT READY TO SHIP`**: Verified code, build, dependency, or security failure. Production deployment will fail.

CLI exit codes are stable: `0` READY, `1` NOT_READY, `2` INCOMPLETE, and `3` ReleaseProof internal error.

Route verification covers statically discovered routes plus explicitly configured `criticalRoutes`; it does not prove every parameterized route or business flow. Example:

```json
{
  "criticalRoutes": ["/", "/critical", "/api/health"],
  "start": { "stabilityWindowMs": 5000 },
  "browser": { "observationWindowMs": 2000 },
  "python": { "interpreter": "C:/Python312/python.exe" },
  "environment": {
    "allowHost": ["MY_REQUIRED_HOST_VALUE"],
    "provide": { "APP_MODE": "verification" },
    "includeEnvFiles": false
  }
}
```

---

## 5. Example Finding: AI Fix Handoff

When verification encounters issues, ReleaseProof automatically writes `.releaseproof/RELEASEPROOF_FIX.md` formatted specifically for AI coding agents:

```markdown
# ReleaseProof Fix Task
The application failed production-readiness verification.
Your job is to fix ONLY the verified issues below. Do not refactor unrelated code.

## Issue 1: Server secrets exposed to client-side bundle
**Severity**: BLOCKER
**Category**: environment
### Problem
Found 1 sensitive secret variable with client-facing prefix: NEXT_PUBLIC_STRIPE_SECRET_KEY
### Verified Evidence
```
Variable: NEXT_PUBLIC_STRIPE_SECRET_KEY
Used in: src/app/api/checkout/route.ts:4
Documented in: .env.example
Exposed to client: true
```
### Fix
Rename to STRIPE_SECRET_KEY and consume only on server side.
```

Feed this directly back into Claude Code, Cursor, or Devin:
```bash
claude "Read .releaseproof/RELEASEPROOF_FIX.md and fix only the verified issues."
```

---

## 6. Supported Stacks

ReleaseProof automatically detects and adapts to:

- **Next.js**: App Router and Pages Router projects with standard build/start commands (`npm`, `pnpm`, `yarn`). Standalone output and static export may need an explicit start command.
- **React + Vite**: Single-page applications, client routing, preview servers.
- **Express.js / Node.js**: REST APIs, full-stack monoliths, custom microservices.
- **FastAPI / Python**: Uvicorn servers, ASGI endpoints, workspace-local virtual environments, and pip installation. `uv` lockfile installation is not yet implemented.
- **Generic Node.js**: Projects with `package.json` and standard `build` or `start` scripts. Static HTML without a package manifest needs an explicit verification setup.

---

## 7. GitHub Action

Add ReleaseProof to your CI pipeline in `.github/workflows/releaseproof.yml`:

```yaml
name: ReleaseProof Verification

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Run ReleaseProof
        uses: 6hp2cfrhm4-cmyk/releaseproof@v0.2.0 # after that immutable tag is published
        with:
          fail-on-blocker: true

      - name: Upload Verification Report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: releaseproof-report
          path: .releaseproof/
```

The action automatically posts an interactive status summary to `$GITHUB_STEP_SUMMARY`.

---

## 8. Benchmark Matrix

The benchmark has `FAST` and `AUTHORITATIVE` modes. Release gates use the latter, including clean workspace creation and lockfile-enforcing installs. Results below must be regenerated for the exact release candidate; historical numbers are not evidence for current `main`.

```
═══════════════════════════════════════════════════════════
               RELEASEPROOF BENCHMARK SUITE                
═══════════════════════════════════════════════════════════
  Total Fixtures:        42
  True Positives (TP):   13
  True Negatives (TN):   29
  False Positives (FP):  0  (TARGET MET: ZERO FALSE BLOCKERS)
  False Negatives (FN):  0
  Blocker Precision:     100.0%
  Blocker Recall:        100.0%
  External Dependencies: 6  (Correctly marked INCOMPLETE)
  Known False Blockers:  0
═══════════════════════════════════════════════════════════
```

---

## 9. Security & Hardening

- **Clean Workspace**: Commands execute in an ephemeral copied workspace. This is not an OS/container sandbox and verified project code must be trusted accordingly.
- **Environment Isolation**: Child processes receive a minimal runtime allowlist plus explicitly allowed/provided values, not the entire host environment.
- **Secret Redaction**: Known credential formats and explicitly provided/allowed values are scrubbed before writing terminal, JSON, HTML, or AI handoff output.
- **Process Tree Cleanup**: Background servers are killed using process tree signals (`taskkill /T /F` on Windows, process group SIGTERM/SIGKILL on POSIX).
- **XSS Sanitization**: HTML reports serialize JSON payloads through `serializeSafeJson`, neutralizing `</script>` injection attacks.
- **Zero Telemetry**: ReleaseProof sends zero telemetry or analytics. All computation is 100% local.

---

## 10. Limitations (0.2 development)

- **External Databases**: Applications that hard-crash on startup if PostgreSQL or MongoDB is unreachable are classified as `VERIFICATION INCOMPLETE`. Containerized ephemeral test databases are planned for v0.2.
- **Monorepos without Top-Level Scripts**: Monorepos requiring subpackages to be built in manual order without a root build script will fail build verification.
- **Headless Browser Binaries**: Playwright absence is reported as `HTTP_FALLBACK`; browser applications receive `VERIFICATION INCOMPLETE` because HTTP crawling cannot prove client-side runtime behavior.
- **Route coverage**: Only discovered and configured critical routes are checked; authenticated stateful flows require project-specific tests.
- **Execution boundary**: ReleaseProof runs project install/build/start commands and is not a sandbox for hostile repositories.

---

## 11. Roadmap

- **v0.1.0 (Historical)**: First published artifact; tag and assets remain immutable.
- **v0.2.0 (In development)**: Core correctness hardening, explicit capability status, environment isolation, reproducible installs, and authoritative benchmark gates.
- **Future work**: Ephemeral Docker service sidecars (PostgreSQL, Redis, MongoDB) and Model Context Protocol (MCP) server integration.
- **v0.3.0**: Synthetic authenticated test sessions, automatic mock API response generators.

---

## 12. License

ReleaseProof is licensed under the [Apache-2.0 License](LICENSE).
