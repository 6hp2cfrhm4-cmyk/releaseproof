# Implementation status ledger

This ledger tracks Stage B against [17_ACCEPTANCE_CRITERIA.md](17_ACCEPTANCE_CRITERIA.md) and [20_FINAL_CHECKLIST.md](20_FINAL_CHECKLIST.md). `DONE` requires evidence; code presence or an older green run is insufficient.

**Snapshot:** 2026-09-27

**Branch:** `codex/core-hardening-before-desktop`

**Current revision:** `43194abb0d7847899e3965514e6e4646f2166157` (`test(desktop): cover unexpected verification worker exit`).

**Current worktree:** worker-exit supervisor/test and ledger are committed locally; frozen install not changed.

**Starting implementation SHA:** `6455c5028de4d82f15a8220ae7ed2b1826ce046e`

**PR:** [Draft #1](https://github.com/6hp2cfrhm4-cmyk/releaseproof/pull/1), not merged.

**Historical release:** `v0.1.0` still points to `060bbbf43381f94b4bc041ab9290a3439030c5ce`; existing release remains published and untouched.

## Verified evidence

| Gate | Evidence | Status / boundary |
| --- | --- | --- |
| Workspace build, typecheck/lint, tests | CI [`36288832814`](https://github.com/6hp2cfrhm4-cmyk/releaseproof/actions/runs/36288832814) on `43194ab`: 24 files, 85 passed, 1 skipped; build/typecheck/lint passed | VERIFIED on current revision |
| Desktop worker crash | `apps/desktop/src/main/worker-exit.test.ts`: real Node child exits with code 23; one terminal error, no `finished`; cancellation exit also covered; CI run `36288832814` passed | VERIFIED on current revision |
| Desktop packaged flow | Run `36288832814` on `43194ab`: Windows NSIS installer built and hashed; installed app launched without Node/pnpm/Corepack, verified fixture via worker/Core, copied full/finding handoff, cancelled run, closed during run, and uninstalled | VERIFIED on current revision |
| CLI/Desktop parity | Run `36288832814`: five-case worker/Core parity completed successfully on Windows desktop job | VERIFIED on current revision |
| GitHub Action / CLI tarball | Run `36288832814`: Composite Action E2E and bundled CLI tarball E2E passed | VERIFIED on current revision |
| Cross-platform matrix | Run `36288832814`: Windows/Ubuntu/macOS × Node 20/22 all passed | VERIFIED on current revision |
| Authoritative benchmark | Run `36288832814`: 42 fixtures, TP 12 / TN 30 / FP 0 / FN 0, 7 external, zero mismatch/error, precision/recall 100% | VERIFIED on current revision |
| Real-world corpus | Ten exact target pins recorded in [`docs/REAL_WORLD_VALIDATION.md`](../REAL_WORLD_VALIDATION.md): 3 READY, 1 NOT_READY, 6 INCOMPLETE; refreshed pins remain separate from historical SHAs | Last executed with ReleaseProof `6455c50`; no Core/detector/runner changes exist from `6455c50` through `f344a81`, but an exact final-SHA rerun is NOT VERIFIED |
| Desktop accessibility/full UI coverage | Packaged verification, result, handoff, settings version, cancel and close flows exercised; full keyboard/focus/contrast/theme/Doctor and worker-crash packaged flow are not covered end-to-end | NOT VERIFIED |
| Release safety | `v0.1.0` tag SHA checked; no merge, new release, or npm publish performed | VERIFIED; keep unchanged |

## Requirement group status

| Requirement group | Status | Remaining evidence / note |
| --- | --- | --- |
| `PROD-*`, `CORE-*`, `DETECT-*`, `RUNTIME-*` | IN PROGRESS | Core regression suite and 42-fixture benchmark pass; final-SHA real-world rerun and full acceptance review remain |
| `CLI-*`, `REPORT-*`, `ACTION-001` | IN PROGRESS | Binary, exit/config tests, reports and Action/tarball E2E pass; full atomic-artifact/schema/redaction contract still needs final consolidated evidence |
| `SEC-*` | IN PROGRESS | Minimal environment, redaction and Electron boundaries have regression tests; packaged report/redaction and complete path/trust audit remain |
| `DESKTOP-PARITY-001`, `DESKTOP-IPC-001`, `DESKTOP-SELECT-001`, `DESKTOP-VERIFY-001`, `DESKTOP-PROGRESS-001`, `DESKTOP-RESULT-001`, `DESKTOP-LIFE-001`, `DESKTOP-WORKER-001` | IN PROGRESS | Five-case parity, actual install/verify, cancel, close and worker-crash regression pass on `43194ab`; full accessibility/UI matrix remains |
| `DESKTOP-FINDING-*`, `DESKTOP-EVIDENCE-*`, `DESKTOP-LOGS-*`, `DESKTOP-DOCTOR-*`, `DESKTOP-SETTINGS-*`, `DESIGN-A11Y-*` | IN PROGRESS | GUI exists and core handoff flows pass; full navigation, focus, accessibility and theme persistence matrix not verified |
| `PKG-WIN-001`, `PKG-CLI-001` | IN PROGRESS | Windows installed-app E2E and tarball E2E pass on `43194ab`; release-style artifact provenance remains pre-release work |
| `TEST-*`, `BENCH-*`, `CI-*` | IN PROGRESS | Required CI and authoritative benchmark pass on `43194ab`; full accessibility and final corpus evidence remain |
| `TEST-REALWORLD-001` | IN PROGRESS | Ten cases documented; exact final-SHA rerun is open. Core code is unchanged since the corpus run; historical pins remain immutable records |
| `RELEASE-PROV-001` | IN PROGRESS | `v0.1.0` is unchanged; Stage C review must occur before any merge or release |

## Status rules

- **NOT STARTED** — no meaningful implementation/evidence.
- **IN PROGRESS** — work exists, but an acceptance gate is missing.
- **DONE** — all owning acceptance evidence is on the applicable final source SHA.
- **BLOCKED** — a specific external dependency prevents a named gate; continue unrelated work.
- **NOT APPLICABLE** — explicitly permitted by the owning specification and evidence supports it.

Do not merge PR #1, move `v0.1.0`, publish npm, create a GitHub Release, or claim overall completion until the full acceptance pass is complete and Stage C review is handed the result.
