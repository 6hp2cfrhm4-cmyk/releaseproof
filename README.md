# ReleaseProof

Your AI says it's done.  
ReleaseProof checks if it actually ships.

**Vibe code. Verify before you ship.**

```bash
npx releaseproof
```

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

## 2. Quick Start

Run ReleaseProof in any repository with zero configuration:

```bash
# Run full clean-room verification pipeline on current directory
npx releaseproof

# Run verification on a specific project directory
npx releaseproof verify ./path/to/project

# View the interactive HTML report in your browser
npx releaseproof report

# Generate a shareable terminal card
npx releaseproof vibe

# Check your environment prerequisites (Node, Python, Docker)
npx releaseproof doctor
```

Or install globally:

```bash
npm install -g releaseproof
releaseproof verify
```

---

## 3. What ReleaseProof Checks

ReleaseProof operates an isolated 9-phase verification pipeline:

| Phase | What ReleaseProof Proves |
| :--- | :--- |
| **Clean-Room Isolation** | Copies project into an ephemeral sandbox, stripping dirty `node_modules`, `.next`, `dist`, and uncommitted build artifacts. |
| **Clean Installation** | Runs a fresh install using the detected package manager (`npm`, `pnpm`, `yarn`, `pip`, `uv`). |
| **Production Build** | Executes the exact production compilation command (`next build`, `vite build`, etc.). |
| **Production Startup** | Launches the production server, verifies port binding within timeout, and ensures background process tree cleanup. |
| **Browser & HTTP Crawl** | Crawls entrypoints using headless Playwright (or native HTTP crawler fallback), checking for HTTP 500s, console errors, and blank pages. |
| **Environment Audit** | Scans AST for `process.env.*` usages, verifying variables are documented in `.env.example` and no private server secrets use client prefixes. |
| **Security Secrets** | Scans for 12 hardcoded credential patterns (Stripe, GitHub tokens, AWS keys, JWTs) with automatic redaction. |
| **README as Contract** | Parses command blocks in `README.md` and verifies documented commands match actual scripts in `package.json`. |
| **Scoring & AI Handoff** | Computes a weighted 0-100 score, determines verdict, and generates `.releaseproof/RELEASEPROOF_FIX.md`. |

---

## 4. Understanding Verdicts

ReleaseProof never gives a false pass, and crucially, **it does not falsely accuse working code of being broken when external cloud infrastructure is missing**:

- 🟢 **`READY TO SHIP`**: All checks passed. Zero blockers, zero unverified dependencies. Clean to deploy.
- 🟡 **`VERIFICATION INCOMPLETE`**: Application code, build, and configuration are valid, but runtime smoke testing requires external infrastructure (e.g. PostgreSQL, MongoDB, Redis, or live SaaS credentials like Stripe or Clerk) that was not configured locally.
- 🔴 **`NOT READY TO SHIP`**: Verified code, build, dependency, or security failure. Production deployment will fail.

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

- **Next.js**: App Router, Pages Router, standalone output, static export (`npm`, `pnpm`, `yarn`).
- **React + Vite**: Single-page applications, client routing, preview servers.
- **Express.js / Node.js**: REST APIs, full-stack monoliths, custom microservices.
- **FastAPI / Python**: Uvicorn servers, ASGI endpoints, virtual environments (`pip`, `uv`).
- **Generic Node.js / HTML**: Any application declaring standard `build` or `start` scripts.

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
        uses: 6hp2cfrhm4-cmyk/releaseproof@v0.1.0
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

ReleaseProof is continuously validated against a corpus of 42 benchmark fixtures and 10 real-world open source repositories:

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

- **Clean-Room Isolation**: All commands execute in an isolated sandbox directory (`.temp/rp-sandbox-*`).
- **Secret Redaction**: 12 credential formats (`sk_live_*`, `ghp_*`, AWS keys, JWTs) are scrubbed before writing reports.
- **Process Tree Cleanup**: Background servers are killed using process tree signals (`taskkill /T /F` on Windows, process group SIGTERM/SIGKILL on POSIX).
- **XSS Sanitization**: HTML reports serialize JSON payloads through `serializeSafeJson`, neutralizing `</script>` injection attacks.
- **Zero Telemetry**: ReleaseProof sends zero telemetry or analytics. All computation is 100% local.

---

## 10. Limitations (v0.1.0)

- **External Databases**: Applications that hard-crash on startup if PostgreSQL or MongoDB is unreachable are classified as `VERIFICATION INCOMPLETE`. Containerized ephemeral test databases are planned for v0.2.
- **Monorepos without Top-Level Scripts**: Monorepos requiring subpackages to be built in manual order without a root build script will fail build verification.
- **Headless Browser Binaries**: Visual screenshot capture requires Playwright browser binaries (`npx playwright install`). When absent, ReleaseProof falls back automatically to its native HTTP crawler.

---

## 11. Roadmap

- **v0.1.0 (Current)**: Local clean-room sandbox, 5 web stacks, zero false blockers, AI handoff markdown, HTML reports.
- **v0.2.0**: Ephemeral Docker service sidecars (PostgreSQL, Redis, MongoDB), Model Context Protocol (MCP) server integration.
- **v0.3.0**: Synthetic authenticated test sessions, automatic mock API response generators.

---

## 12. License

ReleaseProof is licensed under the [Apache-2.0 License](LICENSE).
