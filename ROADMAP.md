# ReleaseProof Roadmap

This document outlines the evolutionary direction of ReleaseProof from MVP to ecosystem standard.

## 🏁 Phase 1: MVP & Core Verification (Completed)
- [x] Monorepo architecture with clean boundaries (`schemas`, `runner`, `sandbox`, `detector`, `browser`, `reporter`).
- [x] Zero-config framework detection (Next.js, Vite, Express, FastAPI, Generic Node/Python).
- [x] Clean-room sandbox with path traversal and symlink guards.
- [x] Dev vs prod dependency mismatch detection.
- [x] Client-exposed secret analysis (`NEXT_PUBLIC_`, `VITE_` server secrets).
- [x] Headless browser exploration with Playwright + HTTP fallback.
- [x] Nuanced blocker classification: 0 false blockers on 31 benchmark fixtures.
- [x] Standalone offline HTML dashboard with screenshot captures.
- [x] AI Handoff prompt generation (`.releaseproof/RELEASEPROOF_FIX.md`).
- [x] Self-contained CLI bundle published via npm.

---

## 🚀 Phase 2: Enhanced Runtime & Protocol Support (Next)
- [ ] **Docker Sandboxing Option**: Flag `--docker` to run installation and build inside a hardened container for untrusted agent code.
- [ ] **Python Runtimes**: Direct support for Poetry, Pipenv, and Conda environments alongside pip.
- [ ] **Go & Rust Services**: Out-of-the-box detection and startup verification for Go (`go build`) and Rust (`cargo run`) backends.
- [ ] **WebSocket & SSE Verification**: Automatic connection and keepalive testing for apps utilizing real-time events.
- [ ] **Interactive Form & Auth Filling**: Configurable auth credentials in `.releaseproof.json` allowing the crawler to log into protected sections and test deep authenticated views.

---

## 🌐 Phase 3: CI/CD & Agentic Integrations
- [ ] **Official GitHub Action Marketplace Release**: Pre-configured action with PR comments and status checks.
- [ ] **Model Context Protocol (MCP) Server**: Expose ReleaseProof verification tools directly to Claude Desktop, Cursor, and Windsurf via MCP.
- [ ] **Watch Mode (`--watch`)**: Continuously verifies production build artifacts in the background as you code.
- [ ] **Diff-Aware Incremental Verification**: Run verification specifically on routes and files modified in the current git changeset.
