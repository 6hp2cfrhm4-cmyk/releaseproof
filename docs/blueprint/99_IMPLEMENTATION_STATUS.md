# Implementation status ledger

This ledger tracks the execution contract in [00_README_FIRST.md](00_README_FIRST.md), [15_IMPLEMENTATION_ROADMAP.md](15_IMPLEMENTATION_ROADMAP.md), [17_ACCEPTANCE_CRITERIA.md](17_ACCEPTANCE_CRITERIA.md), and [20_FINAL_CHECKLIST.md](20_FINAL_CHECKLIST.md). Status is evidence-based; code present in a dirty tree is not DONE until its required tests pass on the relevant final source SHA.

**Current phase:** Phase 6/7 — Desktop packaging and CI integration (IN PROGRESS)  
**Branch / baseline SHA:** `codex/core-hardening-before-desktop` / `c371dea505f32df07e25ae5b4f271f9b47fd69ef`  
**Working tree:** pre-existing Core hardening changes and three untracked regression tests preserved; `docs/blueprint/` is untracked. Do not reset or overwrite.  
**Last verified (working tree, 2026-09-26):** `pnpm run build`, `pnpm run lint`, and `pnpm test` passed (22 files / 77 tests, 1 skipped). Authoritative benchmark passed 42 fixtures with TP 13, TN 29, FP 0, FN 0, zero expectation/error mismatches, 6 external-dependency cases, using the explicit bundled Python 3.12.14 interpreter; runtime 675.0s. Desktop package build passed and electron-builder produced `apps/desktop/release/ReleaseProof-Setup-0.2.0-dev.0.exe` (95,740,432 bytes). CI now contains a Windows desktop build/installer smoke job. These are working-tree results, not CI and not a committed SHA.

## Status definitions

- **NOT STARTED** — no implementation or validating evidence yet.
- **IN PROGRESS** — work exists or is being investigated; exit evidence is incomplete.
- **DONE** — requirement's complete acceptance evidence is linked or recorded below on the applicable source SHA.
- **BLOCKED** — a specific external dependency prevents progress; independent work continues.
- **NOT APPLICABLE** — only when the owning spec explicitly allows it and evidence supports the exclusion.

## Requirement ledger

| Requirement ID | Status | Evidence / next gate |
| --- | --- | --- |
| PROD-EVIDENCE-001 | IN PROGRESS | Dirty Core candidate fixes; full benchmark/regression evidence pending. |
| PROD-UNCERTAINTY-001 | IN PROGRESS | Dirty Core candidate fixes; authoritative benchmark still running at ledger creation. |
| PROD-SHARED-001 | IN PROGRESS | Desktop worker calls shared `@releaseproof/core`; parity suite remains to be added. |
| PROD-LOCAL-001 | IN PROGRESS | Existing local-first behavior must be audited against completed Desktop and release build. |
| PROD-SCOPE-001 | NOT STARTED | Final report schema/target scope not yet implemented. |
| ARCH-SESSION-001 | NOT STARTED | AbortSignal session lifecycle and concurrency isolation required. |
| ARCH-LIFE-001 | IN PROGRESS | Electron main/preload/worker lifecycle exists; packaged close/cancel E2E remains. |
| CORE-INPUT-001 | NOT STARTED | Validate normalized input/config and source identity. |
| CORE-CLEAN-001 | IN PROGRESS | Existing clean-copy implementation; exclusions/limits and regression gates remain. |
| CORE-INSTALL-001 | IN PROGRESS | Dirty install/toolchain classification changes; tests and benchmark pending. |
| CORE-BUILD-001 | IN PROGRESS | Dirty build classification change; full regression evidence pending. |
| CORE-PORT-001 | NOT STARTED | Foreign listener ownership and race tests required. |
| CORE-RUNTIME-001 | IN PROGRESS | Delayed crash and unexplained delayed-timeout tests pass in the full 68-test suite; remaining process/port ownership acceptance is incomplete. |
| CORE-HTTP-001 | NOT STARTED | API status semantics and 204/expected-status coverage required. |
| CORE-ROUTES-001 | NOT STARTED | Typed/configured route coverage and critical-route test investigation required. |
| CORE-BROWSER-001 | NOT STARTED | Delayed Playwright errors and browser capability correctness required. |
| CORE-ENV-001 | NOT STARTED | Minimal child environment and explicit environment allowlist required. |
| CORE-CANCEL-001 | IN PROGRESS | AbortSignal wired through install/build/start/browser/clean copy; cancelled run status has no shipping verdict; real owned-server cleanup test passes. CLI SIGINT is platform-skipped on this Windows host; POSIX CI must verify exit 130. |
| CORE-SCORE-001 | IN PROGRESS | Per-check weighted credit, unknown/skipped=0 and separate evidence coverage implemented; 7 scoring tests pass and CLI/HTML/AI output include coverage. Final benchmark/CLI evidence remains. |
| CORE-VERDICT-001 | IN PROGRESS | Static-only missing-runtime guard exists in dirty diff; benchmark/regression proof pending. |
| CORE-CLEANUP-001 | IN PROGRESS | Graceful→force process-tree cleanup, bounded output, signal-aware workspace copy and owned-server cancel test; complete all-phase/Windows+POSIX cleanup proof remains. |
| DETECT-TARGET-001 | IN PROGRESS | Dirty Express port candidate exists; target selection model not complete. |
| DETECT-MIXED-001 | NOT STARTED | Monorepo/mixed target preview and explicit choice required. |
| DETECT-FRAMEWORK-001 | IN PROGRESS | Dirty source-declared Express port detection; broader capability model remains. |
| RUNTIME-NODE-001 | NOT STARTED | Full npm/pnpm/Yarn lockfile and conflict policy matrix required. |
| RUNTIME-TOOLCHAIN-001 | IN PROGRESS | Dirty incompatible-toolchain classification candidates; authoritative proof pending. |
| RUNTIME-PY-001 | IN PROGRESS | Python install timeout and interpreter consistency need diagnosis and regression proof. |
| RUNTIME-PY-002 | NOT STARTED | uv/requirements/pyproject frozen/reproducibility policy remains incomplete. |
| RUNTIME-PY-003 | IN PROGRESS | Windows incompatibility handling candidate; cross-platform proof pending. |
| CLI-CONFIG-001 | NOT STARTED | Deep merge, schema validation and precedence tests required. |
| CLI-FLAGS-001 | NOT STARTED | Compiled CLI flag propagation and target selection tests required. |
| CLI-PROGRESS-001 | NOT STARTED | Stable progress/event output contract required. |
| CLI-EXIT-001 | NOT STARTED | Compiled CLI exit mapping 0/1/2/3/130 required. |
| CLI-JSON-001 | NOT STARTED | Single schema-valid stdout report and redaction contract required. |
| REPORT-SCHEMA-001 | IN PROGRESS | Added runStatus, evidenceCoverage and cancellation/blocker invariants with schema tests; full schema v1 metadata/migration remains. |
| REPORT-CONSISTENCY-001 | IN PROGRESS | Core validates generated report; atomic multi-artifact writer and stale-run protection remain. |
| REPORT-AI-001 | NOT STARTED | Evidence-bound full and per-finding AI handoffs required. |
| REPORT-REDACT-001 | NOT STARTED | Synthetic secret must be absent from all outputs and clipboard paths. |
| SEC-TRUST-001 | NOT STARTED | Explicit Desktop trust acknowledgement and path safety required. |
| SEC-ENV-001 | NOT STARTED | Host environment minimization and explicit opt-in required. |
| SEC-ENVFILE-001 | IN PROGRESS | Dirty scanner candidate removes generic env false blocker; false-secret test currently exists but full suite pending. |
| SEC-REDACT-001 | IN PROGRESS | Existing redaction changes are dirty; chunking and every artifact boundary still need tests. |
| SEC-PROC-001 | NOT STARTED | Process invocation/ownership/resource bounds audit and regression suite required. |
| SEC-REPORT-001 | NOT STARTED | HTML/Markdown untrusted-content escaping and safe path validation required. |
| SEC-ELECTRON-001 | NOT STARTED | Electron security boundary not implemented. |
| DESKTOP-IPC-001 | IN PROGRESS | Narrow typed preload IPC, runtime validation, context isolation, sandbox and CSP exist; automated IPC tests remain. |
| DESKTOP-WORKER-001 | IN PROGRESS | Dedicated worker invokes shared Core and emits progress/report events; crash/stream limits remain. |
| DESKTOP-LIFE-001 | NOT STARTED | Cancel/close/quit process cleanup E2E required. |
| DESKTOP-PARITY-001 | NOT STARTED | Five-case real CLI/Desktop parity suite required. |
| DESKTOP-SELECT-001 | IN PROGRESS | Picker/drop/recent/project preview and explicit trust acknowledgement implemented. |
| DESKTOP-VERIFY-001 | IN PROGRESS | Actual worker-backed verification and Verify Again implemented; packaged E2E remains. |
| DESKTOP-PROGRESS-001 | IN PROGRESS | Worker progress and Cancel IPC/UI implemented; close/quit cleanup E2E remains. |
| DESKTOP-RESULT-001 | IN PROGRESS | READY/NOT READY/INCOMPLETE/CANCELLED, score and evidence coverage rendered; parity test remains. |
| DESKTOP-FINDING-001 | NOT STARTED | Findings list/detail/copy behavior required. |
| DESKTOP-EVIDENCE-001 | NOT STARTED | Bounded typed evidence viewer required. |
| DESKTOP-LOGS-001 | NOT STARTED | Bounded sanitized live logs required. |
| DESKTOP-DOCTOR-001 | NOT STARTED | Target-aware capability doctor required. |
| DESKTOP-SETTINGS-001 | NOT STARTED | Theme and nonsecret persistence required. |
| DESIGN-A11Y-001 | NOT STARTED | Keyboard, focus, contrast, reduced motion and screen-reader checks required. |
| PKG-WIN-001 | IN PROGRESS | NSIS installer built as `ReleaseProof-Setup-0.2.0-dev.0.exe`; isolated silent install launched `ReleaseProof.exe` for 5s without Node/pnpm and silent uninstall removed it (exit 0). SHA-256 `251c126ede279b0030e17b09567229674cbe58d0b450f952601b768b665edebe`. Repo-native shield/checkmark SVG is configured as the Windows product icon; final installed metadata inspection remains. |
| PKG-CLI-001 | IN PROGRESS | Existing CLI tarball E2E passed on earlier `c371dea`; rerun after implementation and record hash. |
| TEST-CORE-001 | IN PROGRESS | Latest full suite: 22 files, 77 passed, 1 skipped. Regression coverage added for score, cancellation, bounded output and browser HTTP abort; full required matrix remains incomplete. |
| TEST-CLI-001 | NOT STARTED | Compiled CLI contract E2E matrix required. |
| TEST-SEC-001 | IN PROGRESS | Dirty secret-scanner tests exist; no full security regression evidence yet. |
| TEST-DESKTOP-001 | IN PROGRESS | Desktop builds and installer smoke job added; component/IPC/packaged E2E required. |
| TEST-REALWORLD-001 | IN PROGRESS | Ten-pin corpus document exists as dirty work; exact reruns against finalized code required. |
| BENCH-AUTH-001 | IN PROGRESS | Current working-tree AUTHORITATIVE run passed 42 fixtures (Python 3.12.14 explicit); final/CI-SHA gate remains. |
| BENCH-METRIC-001 | IN PROGRESS | Current working-tree metrics: TP 13, TN 29, FP 0, FN 0, zero mismatch/errors; CI/release SHA evidence remains. |
| CI-MATRIX-001 | IN PROGRESS | Earlier `c371dea` six-cell CI passed; new dirty tree has not been pushed/tested. |
| CI-DESKTOP-001 | IN PROGRESS | Windows desktop build + installer artifact job added; same-SHA remote run pending. |
| ACTION-001 | IN PROGRESS | Earlier Action E2E passed on `c371dea`; required expanded status/path cases pending. |
| RELEASE-PROV-001 | IN PROGRESS | Development-only work; keep `v0.1.0`, release assets, merge and npm publish untouched. |

## Phase log

| Phase | Status | Evidence / exit condition |
| --- | --- | --- |
| 0 — preserve and validate baseline | DONE | Preserved all pre-existing changes. `pnpm run build` + `pnpm run lint` passed; `pnpm test`: 21 files, 68 passed, 1 skipped; `pnpm --filter benchmarks run bench` AUTHORITATIVE with explicit Python 3.12.14: 42 fixtures, TP 13/TN 29/FP 0/FN 0, zero mismatches/errors, 6 external cases, exit 0; `git diff --check` passed with line-ending warnings only. Targeted 11 non-Python blockers passed (TP 11); targeted 3 FastAPI fixtures passed (TP 2/TN 1). Cleanup inspection found no new residue; two old temp directories from prior runs were left untouched. Evidence is for current dirty worktree; PR CI still covers only `c371dea`. |
| 1 — Core hardening and target/runtime model | IN PROGRESS | Score/coverage and cooperative cancellation foundations implemented with regressions. Authoritative benchmark is green, but schema v1, typed targets/routes, env boundary, ownership proof and other Core acceptance gaps remain. |
| 2 — CLI and report contracts | NOT STARTED | Depends on Phase 1 stable Core/schema. |
| 3 — Benchmark and real-world gate | NOT STARTED | Depends on Phases 1–2. |
| 4 — Desktop infrastructure | IN PROGRESS | Electron/React/Vite package, main/preload/worker and shared IPC are present; automated lifecycle tests remain. |
| 5 — Desktop UX and accessibility | IN PROGRESS | Core screens and dark/light/system settings are present; accessibility and visual QA remain. |
| 6 — Packaging and distribution preparation | IN PROGRESS | NSIS installer builds locally; installed-app E2E, icon metadata and checksums remain. |
| 7 — CI/Action integration | IN PROGRESS | Windows desktop installer job added; remote same-SHA CI and expanded Action gates remain. |
| 8 — full acceptance and Stage C handoff | NOT STARTED | Every P0 evidence-backed; P1 residuals explicit. |

## Evidence update rule

Update this file after each phase gate with exact command, test counts, source SHA and artifact/run links. Do not mark a requirement DONE based only on code presence, mock tests, an earlier commit's CI or a report written before the final implementation. Keep historical corpus pins separate from refreshed pins.
