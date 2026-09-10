# Changelog

All notable changes to **ReleaseProof** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-09-10

### Added
- **Core Engine**: Full 9-phase deterministic verification pipeline with weighted scoring (0-100).
- **Zero False Blockers Engine**: Validated across 31 benchmark fixtures with 0 false positives.
- **Framework Detection**: Zero-config detection for Next.js (App and Pages router), React+Vite, Express.js, FastAPI, and Generic Node/Python.
- **Clean-Room Sandbox**: Ephemeral execution environment preventing local artifact contamination, with symlink boundary containment and traversal defense.
- **Dev vs Prod Dependency Mismatch Checker**: Scans source imports against `package.json` to catch runtime dependencies mistakenly declared under `devDependencies`.
- **Environment & Secret Security**: Scans for uncommitted `.env`, exposed private keys, AWS tokens, GitHub PATs, and client-exposed server secrets (`NEXT_PUBLIC_`, `VITE_`).
- **Playwright Route Exploration**: Headless Chromium crawler capturing uncaught `pageerror` crashes, 500 status codes, error boundaries, and blank pages, with automatic full-page screenshot capture.
- **HTTP Fallback Crawler**: High-speed fallback when headless browser environments are unavailable.
- **Reporting System**:
  - ANSI colored terminal output with category summaries and blocker remediation.
  - Social ASCII Vibe Card (`releaseproof vibe`).
  - Offline self-contained HTML report with collapsible logs, XSS safety, and failure screenshots (`report.html`).
  - AI Remediation Prompt (`.releaseproof/RELEASEPROOF_FIX.md`) formatted for instant pasting into Claude, Cursor, or Devin.
- **CLI**:
  - `releaseproof verify [path]`
  - `releaseproof report [path]`
  - `releaseproof vibe [path]`
  - `releaseproof doctor`
  - `releaseproof clean [path]`
- **Benchmark Suite**: 31 automated test fixtures covering working stacks, deliberate production failures, and negative controls.
- **Signature Demo App**: `examples/broken-vibe-app` demonstrating 4 common AI vibe-coding deployment blockers.
