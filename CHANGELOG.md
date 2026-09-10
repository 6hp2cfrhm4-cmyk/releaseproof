# Changelog

All notable changes to **ReleaseProof** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] - 2026-09-10 — Don't Trust Localhost

> **Your AI says it's done. ReleaseProof checks if it actually ships.**

ReleaseProof v0.1.0 is the first public Release Candidate. Built for vibe coders, autonomous AI coding agents, and modern engineering teams, ReleaseProof extracts verifiable reality checks between local AI code generation and actual production deployments.

### Highlights

- **Clean-Room Sandbox Isolation**: Copies code into an ephemeral temp workspace, isolating it from dirty local `node_modules`, cached builds (`.next`, `dist`), and undeclared environment variables.
- **Fresh Clean Installation**: Runs a fresh, isolated install using the project's native package manager (`npm`, `pnpm`, `yarn`, `pip`, `uv`).
- **Production Build Verification**: Executes the exact production compilation command (`next build`, `vite build`, etc.), catching type errors, bundler misconfigurations, and missing assets.
- **Production Startup & Lifecycle Defense**: Starts the production server, verifies port binding within timeout, and guarantees background process tree cleanup (`taskkill /T /F` on Windows, process group SIGKILL on POSIX).
- **Headless Browser & Route Verification**: Crawls application routes with headless Playwright (or high-speed native HTTP crawler fallback), catching React error boundaries, uncaught `pageerror` exceptions, and blank pages.
- **Environment & Secret Analysis**: Scans AST for `process.env.*` usages, ensuring variables are documented in `.env.example` and no private secrets are exposed to client-side bundles via `NEXT_PUBLIC_` or `VITE_` prefixes.
- **README as Contract**: Parses command blocks from `README.md` and verifies they match executable scripts in `package.json`.
- **Security & Secret Redaction**: Detects 12 sensitive credential formats (Stripe, GitHub PATs, AWS keys, JWTs) with automatic redaction and XSS-safe serialization (`serializeSafeJson`) in HTML reports.
- **AI Fix Handoff (`.releaseproof/RELEASEPROOF_FIX.md`)**: Generates an actionable, structured prompt specifically formatted for Claude Code, Cursor, Copilot, or Devin to fix only verified blockers without refactoring unrelated code.
- **Three-Tiered Verdict Model**:
  - `READY TO SHIP` (0 blockers, all checks passed)
  - `VERIFICATION INCOMPLETE` (external databases like PostgreSQL, MongoDB, Redis, or SaaS credentials like Stripe or Clerk are required for runtime smoke testing)
  - `NOT READY TO SHIP` (verified code, build, or security blockers)
- **Supported Stacks**: Next.js 14/15, React + Vite, Express.js, FastAPI, and Generic Node.js.
- **Benchmark Suite**: 42 automated fixtures (21 core scenarios, 15 negative controls, 6 environment-blocked tests) yielding 100% Blocker Precision and 100% Blocker Recall with **0 False Blockers**.
- **Real-World Validation**: Verified across 10 open-source repositories with 0 false blockers.

### Known Limitations

- Hard external database dependencies (e.g. apps that exit immediately if PostgreSQL or MongoDB is offline) are classified as `VERIFICATION INCOMPLETE`. Containerized ephemeral test databases are slated for v0.2.0.
- Monorepos that lack a root-level build script and require manual subpackage build orders will fail build verification.
- Full visual screenshot capture requires Playwright browser binaries (`npx playwright install`).
