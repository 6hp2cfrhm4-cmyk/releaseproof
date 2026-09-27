# Objective Definition of Done

Every P0/P1 row must have evidence on the **same final source SHA**. “Code exists” is insufficient where an E2E assertion is named. P2/P3 may be deferred only with explicit rationale. IDs point to owning specifications.

## Core correctness and safety

| ID | Priority | Pass condition / evidence |
| --- | --- | --- |
| PROD-EVIDENCE-001, PROD-UNCERTAINTY-001 | P0 | Healthy/broken/unavailable fixtures produce READY/NOT_READY/INCOMPLETE respectively; report links every decision to checks and capabilities. |
| PROD-LOCAL-001, PROD-SCOPE-001 | P0/P1 | No account/cloud/telemetry is required; every result names the selected target, source/toolchain, route scope and limitations. |
| ARCH-LIFE-001, CORE-INPUT-001 | P0 | Verification rejects invalid path/config before side effects, assigns one run/session ID, tracks only owned resources and emits a terminal report/event for success, failure, cancel and cleanup error. |
| CORE-INSTALL-001, CORE-BUILD-001 | P0 | Frozen install and production build run in the clean workspace; verified app failure blocks, unavailable toolchain/external capability is INCOMPLETE, and dependent skipped checks retain reasons. |
| CORE-PORT-001 | P0 | Foreign listener present before run cannot produce READY, is not killed, and no foreign HTTP response appears as target evidence. |
| CORE-RUNTIME-001 | P0 | Server answering 200 then crashing within stability window is NOT_READY; unexplained live HTTP timeout is INCOMPLETE; no runnable target is never READY. |
| CORE-BROWSER-001 | P0 | Real Chromium catches delayed pageerror; no-browser fallback does not claim Playwright and browser app is INCOMPLETE; API-only skip remains possible. |
| CORE-HTTP-001, CORE-ROUTES-001 | P0/P1 | API 204 passes without HTML blank check; configured critical route 500 blocks; expected 401/403/404/redirect do not falsely block; route coverage is reported. |
| CORE-SCORE-001, CORE-VERDICT-001 | P0 | Zero/skipped/unknown-only never READY/100; not_applicable excluded; any blocker forces NOT_READY; score and separate coverage shown in all outputs. |
| CORE-CLEAN-001, CORE-CLEANUP-001 | P0 | Clean copy excludes dirty artifacts/env by default; success/fail/timeout/cancel leave no owned server/temp residue, or report observable cleanup failure. |
| CORE-CANCEL-001, ARCH-SESSION-001 | P0 | AbortSignal cancels every phase without Core `process.exit`, no false verdict and no orphan child; concurrent runs do not contaminate one another. |
| CORE-ENV-001, SEC-ENV-001, SEC-ENVFILE-001, SEC-REDACT-001 | P0 | Synthetic host marker absent from child by default and all outputs; explicit allowed value reaches child but is redacted everywhere; generic env value is not false credential blocker. |
| SEC-TRUST-001, SEC-REPORT-001, SEC-PROC-001 | P0 | Untrusted project execution requires trust acknowledgement; text cannot execute in HTML/Desktop or become AI instruction; shell/path/port and process ownership tests pass. |

## Detection, CLI and reports

| ID | Priority | Pass condition / evidence |
| --- | --- | --- |
| DETECT-TARGET-001, DETECT-MIXED-001, DETECT-FRAMEWORK-001 | P0/P1 | Monorepo root/mixed project shows candidates; ambiguous selection required; selected nested target can verify; supported framework families are detected with confidence/reasons; static-only root INCOMPLETE. |
| RUNTIME-NODE-001, RUNTIME-TOOLCHAIN-001 | P0 | npm/pnpm/Yarn frozen commands chosen for compatible lockfiles; conflicts and incompatible manager/policy/toolchain yield truthful INCOMPLETE; no lockfile is labeled nonreproducible. |
| RUNTIME-PY-001, RUNTIME-PY-002, RUNTIME-PY-003 | P0/P1 | Install/start use same venv absolute `sys.executable` on Windows/Ubuntu; FastAPI works; uv.lock is either genuinely frozen or honestly unavailable; Windows uvloop/MSVC cases not false blockers. |
| CLI-CONFIG-001, CLI-FLAGS-001 | P0 | Compiled binary propagates flags, deep-merges explicit overrides, rejects bad config; path spaces/Unicode supported. |
| CLI-EXIT-001, CLI-JSON-001 | P0 | Actual binary exits 0/1/2/3/130 as defined; `--json` stdout parses as one schema-valid report; Action respects it. |
| CLI-PROGRESS-001 | P1 | Core phase events have stable IDs and terminal ordering; human progress is bounded and flushed only with cleanup-aware final status. |
| REPORT-SCHEMA-001, REPORT-CONSISTENCY-001 | P0 | v1 report validates, all three artifacts agree, stale report cannot be mistaken for new run, cleanup and coverage fields present. |
| REPORT-AI-001, REPORT-REDACT-001 | P0 | Full/per-finding prompts contain evidence/reproduction without invented root cause or secret; copied Desktop text matches generated sanitized source. |

## Desktop and distribution

| ID | Priority | Pass condition / evidence |
| --- | --- | --- |
| PROD-SHARED-001, DESKTOP-PARITY-001 | P0 | Five fixture CLI/Desktop parity test matches verdict, score, finding IDs/status/classification/browser mode. |
| DESKTOP-IPC-001, SEC-ELECTRON-001 | P0 | Renderer lacks Node/process APIs; typed preload/main reject arbitrary path/channel/oversized payload; CSP and navigation rules tested. |
| DESKTOP-SELECT-001, DESKTOP-VERIFY-001 | P0 | Picker/drop/recent/preview/target choice lead to actual verification with first-run trust acknowledgement; no auto-execution on selection. |
| DESKTOP-PROGRESS-001, DESKTOP-RESULT-001 | P0 | Live phases, Cancel, Verify Again, all three verdicts and coverage render in actual Electron E2E; no READY before cleanup. |
| DESKTOP-FINDING-001, DESKTOP-EVIDENCE-001, DESKTOP-LOGS-001 | P0/P1 | List/detail/evidence/logs are navigable, bounded/redacted; one/all AI copy and artifact open work. |
| DESKTOP-DOCTOR-001, DESKTOP-SETTINGS-001, DESIGN-A11Y-001 | P0/P1 | Doctor gives correct required-tool remedies; theme system/dark/light persists; keyboard/focus/contrast checks pass; no secrets persisted. |
| DESKTOP-LIFE-001, DESKTOP-WORKER-001 | P0 | Cancel, worker crash and close during run terminate owned processes/temp; renderer stays responsive and cannot return false READY. |
| PKG-WIN-001 | P0 | Actual `ReleaseProof-Setup-<version>.exe` from final dev SHA installs, Start Menu launches, About/version/icon metadata correct, verifies a safe project without separate system Node/pnpm for launch, uninstalls cleanly. |
| PKG-CLI-001 | P0 | Packed GitHub-release-style CLI tarball installs outside repo and passes version/help/doctor/verify/report; SHA256 recorded. |

## CI, benchmark and release controls

| ID | Priority | Pass condition / evidence |
| --- | --- | --- |
| TEST-CORE-001, TEST-CLI-001, TEST-SEC-001, TEST-DESKTOP-001 | P0 | Full regression matrix in [12](12_TESTING_STRATEGY.md) passes with exact counts on final SHA, not only mocks. |
| BENCH-AUTH-001, BENCH-METRIC-001 | P0 | AUTHORITATIVE clean-source run: source tree clean at start/end, FP=0, FN=0, no expectation mismatch/execution errors; changed paths exposed; correct capability/category checks; FAST labeled nonrelease. |
| TEST-REALWORLD-001 | P1 | Ten pinned repos have dated final reruns or exact NOT VERIFIED reason; historical/refreshed SHA never conflated; no unexplained confirmed false blocker. |
| CI-MATRIX-001, CI-DESKTOP-001 | P0 | Six OS/Node jobs, Ubuntu + Windows authoritative, Python, browser, Desktop build/E2E and installed Windows app jobs green on final SHA. |
| ACTION-001 | P0 | Action E2E proves outputs and correct healthy/blocker/incomplete/internal exit policies, no nonexistent npm dependency. |
| RELEASE-PROV-001 | P0 | Historical `v0.1.0` unchanged; no merge/release before review; dev artifacts/checksums identify one source SHA. Future public release uses new immutable tag/source/artifacts. |

## Final decision rule

If any P0 lacks evidence, report **implementation incomplete**; do not call milestone ready. If P1 is deferred, say exactly which product promise is weakened and seek review. A clean Git status alone is not readiness; packaged installer + runtime verification + CI/benchmark parity are decisive. Stage C independently reviews/corrects before any release decision.
