# Implementation status ledger

This ledger tracks Stage B against [17_ACCEPTANCE_CRITERIA.md](17_ACCEPTANCE_CRITERIA.md) and [20_FINAL_CHECKLIST.md](20_FINAL_CHECKLIST.md). `DONE` requires evidence; code presence or an older green run is insufficient.

**Snapshot:** 2026-09-27

**Branch:** `codex/core-hardening-before-desktop`

**Current revision:** `2357e457d7a2f1a1337c42b18277e525511206a` (`test(desktop): cover evidence logs doctor and themes`).

**Current worktree:** based on `2357e45`, with pending packaged-Desktop E2E, light-theme contrast styling, and refreshed corpus/status documentation. No Core/CLI code or package lock changes; frozen install not changed.

**Starting implementation SHA:** `6455c5028de4d82f15a8220ae7ed2b1826ce046e`

**PR:** [Draft #1](https://github.com/6hp2cfrhm4-cmyk/releaseproof/pull/1), not merged.

**Historical release:** `v0.1.0` still points to `060bbbf43381f94b4bc041ab9290a3439030c5ce`; existing release remains published and untouched.

## Verified evidence

| Gate | Evidence | Status / boundary |
| --- | --- | --- |
| Workspace build, typecheck/lint, tests | CI [`36291968124`](https://github.com/6hp2cfrhm4-cmyk/releaseproof/actions/runs/36291968124) on `2357e45`: 24 files, 85 passed, 1 skipped; build/typecheck/lint passed | VERIFIED on current revision |
| Desktop worker crash | `apps/desktop/src/main/worker-exit.test.ts`: real Node child exits with code 23; one terminal error, no `finished`; cancellation exit also covered; CI run `36291968124` passed | VERIFIED on current revision |
| Desktop packaged flow | Run `36291968124` on `2357e45`: installed app launched without Node/pnpm/Corepack, verified fixture via worker/Core, copied full/finding handoff, inspected Evidence/Logs/Doctor empty state and theme switching, cancelled run, closed during run, and uninstalled. `ReleaseProof-Setup-0.2.0-dev.0.exe`, 95,798,072 bytes, SHA-256 `5b40de5f4539a5a2b7e527822f9164a8ba96cb000d3e015baf6f41d336cef6c4` | VERIFIED on current revision |
| CLI/Desktop parity | Run `36291968124`: five-case worker/Core parity completed successfully on Windows desktop job | VERIFIED on current revision |
| GitHub Action / CLI tarball | Run `36291968124`: Composite Action E2E and bundled CLI tarball E2E passed | VERIFIED on current revision |
| Cross-platform matrix | Run `36291968124`: Windows/Ubuntu/macOS × Node 20/22 all passed | VERIFIED on current revision |
| Authoritative benchmark | Run `36291968124`: 42 fixtures, TP 12 / TN 30 / FP 0 / FN 0, 7 external, zero mismatch/error, precision/recall 100% | VERIFIED on current revision |
| Real-world corpus | Ten repositories / 11 targets rerun using current CLI from `2357e45`; see [`docs/REAL_WORLD_VALIDATION.md`](../REAL_WORLD_VALIDATION.md) | VERIFIED on current revision; refreshed pins and older SHA results are separate |
| Current working-tree regression suite | `pnpm test`: 24 files, 85 passed, 1 skipped; `pnpm build`, `pnpm lint`, and `node --check apps/desktop/e2e/installed-app.mjs` pass after running the test suite without a concurrent build | VERIFIED on the pending working tree; earlier two timing assertions failed only while build and tests were competing for local resources, then passed isolated |
| Current working-tree parity / benchmark | Desktop `e2e/parity.mjs`: five classes matched; AUTHORITATIVE 42 fixtures TP12/TN30/FP0/FN0, 7 external, zero mismatch/errors, precision/recall 100%, 890.2 s | VERIFIED on the pending working tree; scope changes since `2357e45` are Desktop UX/test and docs only |
| Current Windows installer / packaged app | Built `ReleaseProof-Setup-0.2.0-dev.0.exe`, 95,794,074 bytes, SHA-256 `e90b47c9c0ecb8611c6e9fba77eabba3c52d5f289d669d32c98f0b52c5760187`; installed app launched without Node/pnpm/Corepack, verified `nc-unusual-start-command` as READY 90, exercised Doctor available/missing remediation, keyboard focus, light-theme contrast >=4.5 for sampled roles, persisted theme, Evidence/Logs, cancel, close cleanup, then uninstalled | VERIFIED locally on pending working tree. The workflow's original Express E2E hit npm registry install timeout (correctly INCOMPLETE); zero-dependency real verification passed. Re-run the full Windows workflow on pushed SHA |
| Desktop accessibility/full UI coverage | Packaged E2E now asserts keyboard-visible focus, sampled WCAG AA light-theme contrast, required Node missing remediation and installed Node version; app still lacks a full independent accessibility audit for every component/surface | PARTIALLY VERIFIED; full audit NOT VERIFIED |
| Release safety | `v0.1.0` tag SHA checked; no merge, new release, or npm publish performed | VERIFIED; keep unchanged |

## Requirement group status

| Requirement group | Status | Remaining evidence / note |
| --- | --- | --- |
| `PROD-*`, `CORE-*`, `DETECT-*`, `RUNTIME-*` | IN PROGRESS | Core regression suite, 42-fixture benchmark and current-source real-world corpus pass; final acceptance review remains |
| `CLI-*`, `REPORT-*`, `ACTION-001` | IN PROGRESS | Binary, exit/config tests, reports and Action/tarball E2E pass; full atomic-artifact/schema/redaction contract still needs final consolidated evidence |
| `SEC-*` | IN PROGRESS | Minimal environment, redaction and Electron boundaries have regression tests; packaged report/redaction and complete path/trust audit remain |
| `DESKTOP-PARITY-001`, `DESKTOP-IPC-001`, `DESKTOP-SELECT-001`, `DESKTOP-VERIFY-001`, `DESKTOP-PROGRESS-001`, `DESKTOP-RESULT-001`, `DESKTOP-LIFE-001`, `DESKTOP-WORKER-001` | IN PROGRESS | Five-case parity, actual install/verify, cancel, close and worker-crash regression pass on `2357e45`; full accessibility/UI matrix remains |
| `DESKTOP-FINDING-*`, `DESKTOP-EVIDENCE-*`, `DESKTOP-LOGS-*`, `DESKTOP-DOCTOR-*`, `DESKTOP-SETTINGS-*`, `DESIGN-A11Y-*` | IN PROGRESS | Evidence/Logs, available and missing-Node Doctor behavior, System/Dark/Light persistence, keyboard focus and sampled light contrast pass in local packaged E2E; broader per-component contrast/accessibility audit remains |
| `PKG-WIN-001`, `PKG-CLI-001` | IN PROGRESS | Local installer was built, installed, launched without Node, verified a project, and uninstalled; CI on pushed exact SHA must recheck metadata/Start Menu and original Express verification. CLI tarball E2E passed on `2357e45`; release-style artifact provenance remains pre-release work |
| `TEST-*`, `BENCH-*`, `CI-*` | IN PROGRESS | Full local suite/build/lint, five-case parity and 42-case authoritative benchmark pass on pending working tree; required exact-SHA CI rerun remains |
| `TEST-REALWORLD-001` | DONE | All ten pinned repositories / 11 targets rerun on `2357e45`; historical pins remain immutable records |
| `RELEASE-PROV-001` | IN PROGRESS | `v0.1.0` is unchanged; Stage C review must occur before any merge or release |

## Status rules

- **NOT STARTED** — no meaningful implementation/evidence.
- **IN PROGRESS** — work exists, but an acceptance gate is missing.
- **DONE** — all owning acceptance evidence is on the applicable final source SHA.
- **BLOCKED** — a specific external dependency prevents a named gate; continue unrelated work.
- **NOT APPLICABLE** — explicitly permitted by the owning specification and evidence supports it.

Do not merge PR #1, move `v0.1.0`, publish npm, create a GitHub Release, or claim overall completion until the full acceptance pass is complete and Stage C review is handed the result.
