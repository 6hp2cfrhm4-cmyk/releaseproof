# Implementation status ledger

This optional ledger records the transition from the blueprint stage into Stage B. It is subordinate to [17_ACCEPTANCE_CRITERIA.md](17_ACCEPTANCE_CRITERIA.md) and [20_FINAL_CHECKLIST.md](20_FINAL_CHECKLIST.md); it must never turn code presence or a partial green run into DONE.

**Snapshot:** 2026-09-27
**Branch / HEAD:** `codex/core-hardening-before-desktop` / `29b700f8e1fb057982aee11191e4f2e51ea26455`
**Working tree:** implementation changes are uncommitted; blueprint edits are intentionally preserved
**Current implementation phase:** Core hardening, report contract metadata, Action policy controls and Desktop IPC/lifecycle hardening are in progress; final acceptance is still incomplete.

## Evidence currently available

| Area | Evidence | Boundary |
| --- | --- | --- |
| Build/typecheck | `pnpm run build` and `pnpm run lint` passed after report/IPC changes | rerun on final SHA; lint is TypeScript no-emit, not an ESLint policy |
| Tests | fresh full run after changes: 23 files, 80 passed, 1 skipped; Desktop validation adds 3 IPC tests | no complete packaged-app E2E or CLI/Desktop parity suite |
| Benchmark | Ubuntu CI AUTHORITATIVE on this SHA: 42 fixtures, TP13/TN29/FP0/FN0, zero mismatches/errors, 6 external cases; fresh Windows local rerun: TP11/TN28/FP1/FN2, 3 mismatches, 8 external cases, 918.5s | Windows FastAPI classification divergence is an active release blocker; do not weaken expectations or call the local gate green |
| Remote CI | run `36272677692` completed successfully for this SHA: six OS/Node cells, Action E2E, CLI tarball E2E and Desktop installer smoke; Ubuntu Node 20 benchmark 42 fixtures, TP13/TN29/FP0/FN0, zero mismatches/errors, six external cases | no installed-app E2E, Desktop parity or full lifecycle gate in this run |
| Windows installer | current development package built successfully: `apps/desktop/release/ReleaseProof-Setup-0.2.0-dev.0.exe`, SHA256 `ad8320f6650dd97a453596f3d396129aa49de39b6fc47af1459dd79a5d54cacb` | installed project verification, metadata/icon inspection and CI install/uninstall remain; no release was created |
| Real-world | ten pinned Windows observations: 3 READY, 1 NOT_READY, 6 INCOMPLETE | diagnostic record; final SHA reruns required |

## Status definitions

- **NOT STARTED** — no implementation or meaningful evidence.
- **IN PROGRESS** — implementation exists, but an acceptance gate is missing.
- **DONE** — all acceptance evidence for the requirement is linked to the applicable final SHA.
- **BLOCKED** — an external dependency prevents a named gate; unrelated work continues.
- **NOT APPLICABLE** — only when the owning specification explicitly permits it and evidence supports the exclusion.

## Requirement ledger

| Requirement group | Status | Next evidence |
| --- | --- | --- |
| `PROD-*`, `CORE-*`, `DETECT-*`, `RUNTIME-*` | IN PROGRESS | final regression matrix: foreign port, delayed crash/browser error, API semantics, target selection, Python/manager compatibility, cancellation and cleanup; Python interpreter probing now avoids pip-less MSYS false starts |
| `CLI-*`, `REPORT-*` | IN PROGRESS | compiled CLI exits/JSON/config precedence; schema v1 metadata/capability/cleanup fields now emitted by Core; atomic JSON/HTML/AI parity and redaction remain |
| `SEC-*` | IN PROGRESS | host-env minimization, env-file policy, chunk-safe redaction, safe HTML/Markdown and IPC path/channel rejection; Desktop validation tests now cover trust/path/settings/artifact boundaries |
| `DESKTOP-*`, `DESIGN-A11Y-*` | IN PROGRESS | real Electron E2E, worker crash/close/cancel, full findings/evidence/log/Doctor/settings behavior, accessibility and five-case parity; bounded event log and shared AI handoff are implemented |
| `PKG-WIN-001`, `PKG-CLI-001` | IN PROGRESS | clean installed Windows app verification, metadata/icon/uninstall, CLI tarball outside repo and checksums |
| `TEST-*`, `BENCH-*`, `CI-*`, `ACTION-001` | IN PROGRESS | exact final-SHA counts, authoritative benchmark, six-cell CI, Action policy cases and installed-app CI; Action now exposes `target` and independent `fail-on-incomplete`, and CI schedules Windows authoritative benchmark on Node 20 |
| `RELEASE-PROV-001` | IN PROGRESS | Stage C review; preserve `v0.1.0`; new immutable release only after review |

## Rules for updating this ledger

After each gate, record the exact command or URL, source SHA, test count, artifact name/hash and limitations. Keep `VERIFIED`, `INFERRED`, `NOT VERIFIED` and `EXPECTED` distinct. A local build, development installer, historical CI run or mock test cannot close a P0. Do not merge the draft PR, move `v0.1.0`, publish npm or create a release from this stage.
