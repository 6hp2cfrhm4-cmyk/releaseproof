# Contributing to ReleaseProof

Thank you for your interest in contributing to **ReleaseProof**! We are building an open, deterministic verification engine designed to bring rigor and truth to AI-assisted software delivery.

## 📜 Core Tenets

Before contributing code, please keep in mind our core engineering principles:

1. **Zero False Blockers**: A working production application must **never** be blocked by ReleaseProof. If an issue cannot be proven beyond reasonable doubt, it must be reported as a warning or info, never a blocker.
2. **Proof Over Opinion**: Every blocker must be backed by tangible evidence (exit code, stack trace, screenshot, failed network response).
3. **Real Over Synthetic**: We test against real runtimes, real subprocesses, real sockets, and real headless browser sessions. Avoid heavy mocking in end-to-end verifications.
4. **Local & Private by Default**: ReleaseProof runs entirely offline on the developer's machine or CI server. No telemetry, no cloud tokens, no external leaks.

---

## 🛠️ Development Setup

ReleaseProof is organized as a pnpm monorepo using TypeScript and ESM.

### Prerequisites

- **Node.js**: >= 20.0.0 (tested on v20, v22, v24)
- **pnpm**: >= 9.0.0
- **Python**: >= 3.10 (for FastAPI verification tests)

### Initializing the Monorepo

```bash
# Clone the repository
git clone https://github.com/releaseproof/releaseproof.git
cd releaseproof

# Install all workspace dependencies
pnpm install

# Build all packages
pnpm run build

# Run unit test suite
pnpm run test

# Run the 31-fixture benchmark suite
pnpm run bench

# Verify ReleaseProof using ReleaseProof (dogfooding)
pnpm run proof
```

---

## 📂 Repository Structure

- `packages/schemas`: Shared Zod models and TypeScript types (`CheckResult`, `Evidence`, `ProjectProfile`, `VerificationReport`).
- `packages/runner`: Cross-platform command execution, process group cleanup, binary resolution, socket health checkers.
- `packages/sandbox`: Clean-room temporary workspace isolation, symlink boundary guards, and exclusion rules.
- `packages/detector`: Zero-config framework detection (Next.js, Vite, Express, FastAPI, generic Node/Python).
- `packages/environment`: Scans code for environment variable usage, client-exposed secret keys, and `.env.example` mismatches.
- `packages/security`: Scans files for exposed private keys, AWS tokens, GitHub credentials, and provides centralized secret redaction.
- `packages/browser`: Headless Chromium crawl via Playwright + lightweight fallback HTTP crawler.
- `packages/core`: Engine orchestrator, dev vs prod dependency verification, README-as-contract checker, scoring algorithm.
- `packages/reporter`: Terminal reporting (`picocolors`), ASCII vibe card, AI handoff markdown, and self-contained HTML dashboard.
- `apps/cli`: Commander-based CLI binary (`releaseproof`).
- `benchmarks`: Automated 31-fixture benchmark harness for regression testing.
- `examples/broken-vibe-app`: Signature demo project with realistic AI-generated production pitfalls.

---

## 🧪 Testing Guidelines

- **Unit tests**: Fast unit tests live in `__tests__/` inside each package. Run with `pnpm run test`.
- **Benchmark tests**: Live in `benchmarks/`. Every change must maintain **0 False Blockers** on `pnpm run bench`.
- **Clean bundle test**: The published CLI bundle in `apps/cli` must remain fully self-contained and run cleanly via `npx releaseproof`.

---

## 📝 Pull Request Checklist

Before submitting a PR:

- [ ] All packages compile cleanly (`pnpm run build`)
- [ ] All unit tests pass (`pnpm run test`)
- [ ] Benchmark suite passes with 0 false blockers (`pnpm run bench`)
- [ ] Monorepo passes self-verification (`pnpm run proof`)
- [ ] New features or fixes include tests
- [ ] No credentials, secrets, or temporary files committed
