<div align="center">

# 🛡️ ReleaseProof

**Your AI says it's done. ReleaseProof checks if it actually ships.**

[![CI](https://github.com/releaseproof/releaseproof/actions/workflows/ci.yml/badge.svg)](https://github.com/releaseproof/releaseproof/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/releaseproof.svg)](https://www.npmjs.com/package/releaseproof)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)

Autonomous production-readiness verification engine for AI agents and vibe-coders.

[Key Features](#key-features) •
[Quickstart](#quickstart) •
[Verification Pipeline](#verification-pipeline) •
[The Proof Model](#the-proof-model) •
[CLI Reference](#cli-reference) •
[GitHub Action](#github-action)

</div>

---

## ⚡ Why ReleaseProof?

AI coding assistants (Claude Code, Cursor, Copilot, Codex, Devin) build features at incredible speeds. But **"it runs in dev" is not "it ships to production"**:

- **Dev vs Prod Mismatches**: A package imported at runtime was mistakenly installed under `devDependencies`. It works locally with full node_modules, but crashes with `MODULE_NOT_FOUND` in Docker or Vercel.
- **Client-Exposed Secrets**: An AI configured `NEXT_PUBLIC_STRIPE_SECRET_KEY` or `VITE_SUPABASE_SERVICE_ROLE`, broadcasting private keys straight to end-user browsers.
- **Silent 500 Crashes & Blank Pages**: Next.js App Router or Vite compiles, but navigating to `/dashboard` renders a React error boundary, an uncaught TypeError, or a blank DOM.
- **Stale Documentation**: The AI modified build arguments or ports, but left the README documenting non-existent commands.

**ReleaseProof is the reality check between AI code generation and deployment.** It doesn't give opinions—it extracts **verifiable proofs**: real builds, real clean-room sandboxes, real headless browser sessions, and real process lifecycles.

```
┌────────────────────────────────────┐
│            ReleaseProof            │
│                                    │
│        VIBE CHECK: 98 / 100        │
│                                    │
│  Install           PASS            │
│  Build             PASS            │
│  Production        PASS            │
│  Browser           PASS            │
│  Environment       PASS            │
│  Security          PASS            │
│                                    │
│           READY TO SHIP            │
└────────────────────────────────────┘
```

---

## 🚀 Quickstart

Run ReleaseProof instantly on any repository without installing:

```bash
# Run full verification pipeline on current directory
npx releaseproof

# Quick terminal vibe card for social sharing or chat
npx releaseproof vibe

# Check host environment capabilities (Node, Python, Docker)
npx releaseproof doctor
```

Or install globally:

```bash
npm install -g releaseproof
releaseproof verify
```

---

## ⏱️ The 15-Second Reality Check

```bash
# 1. You run dev mode — looks fine!
$ npm run dev
  SaaS Dashboard running at http://127.0.0.1:3000 (NODE_ENV=development)
  Ready in 150ms. (Looks like it works!)

# 2. You run ReleaseProof before deploying:
$ npx releaseproof
ReleaseProof v0.1.0
Project: saas-dashboard-ai
──────────────────────────────────────────────────
 NOT READY TO SHIP   50 / 100
4 blockers · 2 warnings · 4 passed · 4.7s
──────────────────────────────────────────────────
Verified Blockers (4):

  ✗ [environment] Server secrets exposed to client-side bundle
    Found 1 sensitive secret variable(s) with client-facing prefixes (NEXT_PUBLIC_STRIPE_SECRET_KEY).
    Variable: NEXT_PUBLIC_STRIPE_SECRET_KEY (used in: server.js)
    Fix: Do not prefix server-only credentials with client prefixes like NEXT_PUBLIC_ or VITE_. Access them on the server side.

  ✗ [runtime] Runtime dependency declared only in devDependencies
    Found 1 runtime package(s) mistakenly placed in devDependencies: jsonwebtoken. This works locally with full node_modules but will crash in production!
    File: server.js:4 — Package 'jsonwebtoken' is imported at runtime but only declared in devDependencies.
    Fix: Move packages to 'dependencies' via: npm install jsonwebtoken --save-prod

  ✗ [browser] HTTP 500 Internal Server Errors encountered
    Encountered 1 HTTP 500 error(s) during route exploration.
    Evidence: HTTP 500 on http://127.0.0.1:3000/dashboard
    Fix: Check server logs for the crashed handler and ensure required services or environment variables are available.

  ✗ [documentation] README documents non-existent script command(s)
    README instructions claim `npm run start:prod`, but this script does not exist in package.json.
    File: README.md — Documented missing script(s): start:prod
    Fix: Add the missing script to package.json "scripts" or update README.md instructions.

Warnings (2):
  ! [environment] Undocumented environment variables: Found 2 environment variable(s) used in code but missing from .env.example: STRIPE_SECRET_KEY, NEXT_PUBLIC_STRIPE_SECRET_KEY.
  ! [browser] Console errors logged during execution: Observed 1 route(s) logging console errors: /dashboard.

──────────────────────────────────────────────────
Artifacts:
  JSON Report:   .releaseproof/report.json
  HTML Report:   .releaseproof/report.html
  AI Fix Prompt: .releaseproof/RELEASEPROOF_FIX.md
```

---

## 🔍 Verification Pipeline

ReleaseProof executes a deterministic 9-phase audit:

```
1. Profile Detection       → Next.js, Vite, Express, FastAPI, Generic Node/Python
2. Secret & Env Audit      → Private keys, cloud tokens, client-side secret exposure
3. Clean-Room Sandbox      → Isolated temporary directory without stale artifacts
4. Dependency Install      → Clean installation simulating fresh CI/Docker build
5. Production Build        → `npm run build` / production bundler compilation
6. Production Startup      → Real daemon spawn with port detection and timeout guards
7. Headless Route Crawl    → Playwright Chromium route exploration & DOM verification
8. Contract Verification   → Validates README commands and port bindings match code
9. Score & AI Handoff      → 0-100 score, offline HTML report, `.releaseproof/RELEASEPROOF_FIX.md`
```

---

## 🎯 Supported Stacks

ReleaseProof includes zero-configuration detectors and runners for:

| Framework / Stack | Build Verification | Server Startup | Route Verification | Dev/Prod Validation |
| :--- | :---: | :---: | :---: | :---: |
| **Next.js** (App & Pages) | ✅ `next build` | ✅ `next start` | ✅ Playwright Crawler | ✅ Runtime imports |
| **React + Vite** | ✅ `vite build` | ✅ `vite preview` | ✅ Playwright Crawler | ✅ Client env prefixes |
| **Express.js** | ✅ Bundler check | ✅ Node cluster | ✅ HTTP / Browser | ✅ `devDependencies` check |
| **FastAPI** (Python) | ✅ Module imports | ✅ `uvicorn` | ✅ HTTP / OpenAPI | ✅ `requirements.txt` |
| **Generic Node / Web** | ✅ Configured build | ✅ Custom script | ✅ Route exploration | ✅ Symlink safety |

---

## 🛡️ Zero False Blockers: The Proof Model

ReleaseProof operates under a strict **Zero False Blockers** engineering mandate:

> **"If it ships, ReleaseProof will never block it. If it blocks, it delivers undeniable proof."**

- **No Mocking**: Every check runs real subprocesses with real network sockets and real DOM evaluation.
- **Nuanced Classifications**:
  - `401 Unauthorized` / `403 Forbidden` on protected routes are classified as **Info/Pass** (auth boundaries), never blockers.
  - Non-root `404` for missing favicons or decorative images are classified as **Low Warnings**, never blockers.
  - Console warnings (`console.warn`) and non-fatal logs are classified as **Warnings**, never blockers.
  - **Blockers require hard evidence**: process exit != 0, unhandled exceptions (`pageerror`), 5xx crashes, blank DOM (`<body>` with no content), or exposed production credentials.
- **Safe Sandboxing**: Copies source trees defensively, respecting symlink boundaries and preventing directory traversal.
- **Redacted Outputs**: All secrets, AWS keys, tokens, and credentials are automatically masked before appearing in terminal, JSON, HTML, or AI markdown reports.

---

## 🤖 AI Agent Handoff

When blockers are found, ReleaseProof automatically writes a structured AI remediation prompt to:

```
.releaseproof/RELEASEPROOF_FIX.md
```

You can feed this prompt directly back to Claude Code, Cursor, Copilot, or Devin:

```bash
# Feed directly to an agent
cat .releaseproof/RELEASEPROOF_FIX.md | claude
```

The handoff file contains exact file paths, line numbers, stderr snippets, reproduction commands, and required fix steps.

---

## 📊 Offline HTML Report

After verification, ReleaseProof compiles a standalone, zero-dependency HTML dashboard at `.releaseproof/report.html`:

- 🎨 **Visual Health Scores & Category Breakdown**
- 📸 **Automatic Failure Screenshots** (captured via Playwright on crashed routes)
- 📋 **One-Click "Copy AI Fix Prompt"** button
- 🔒 **Zero-leak Sanitization**: Safe JSON serialization preventing XSS and secret exposure

Open the report with:

```bash
npx releaseproof report
```

---

## ⚙️ Configuration (`.releaseproof.json`)

Optional configuration file in your project root:

```json
{
  "$schema": "https://raw.githubusercontent.com/releaseproof/releaseproof/main/packages/schemas/config.schema.json",
  "ignoreDirs": ["tests", "fixtures", "legacy"],
  "build": {
    "command": "npm run build",
    "timeoutMs": 120000
  },
  "start": {
    "command": "npm run start",
    "port": 3000,
    "timeoutMs": 30000,
    "healthCheckPath": "/api/health"
  },
  "browser": {
    "enabled": true,
    "headless": true,
    "maxPages": 15,
    "maxDepth": 3
  },
  "checks": {
    "install": true,
    "build": true,
    "startup": true,
    "browser": true,
    "secrets": true,
    "environment": true,
    "documentation": true,
    "devProd": true
  }
}
```

---

## 🛠️ Monorepo Development

To contribute or develop ReleaseProof locally:

```bash
# Clone the repository
git clone https://github.com/releaseproof/releaseproof.git
cd releaseproof

# Install all dependencies
pnpm install

# Build all packages
pnpm run build

# Run unit tests
pnpm run test

# Run full 31-fixture benchmark suite
pnpm run bench

# Verify ReleaseProof using ReleaseProof
pnpm run proof
```

---

## 🤝 Contributing

We welcome contributions! Please review [CONTRIBUTING.md](CONTRIBUTING.md) and our [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

---

## 📜 License

Apache License 2.0. See [LICENSE](LICENSE) for details.
