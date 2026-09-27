# Implementation status ledger

This optional ledger records the transition from the blueprint stage into Stage B. It is subordinate to [17_ACCEPTANCE_CRITERIA.md](17_ACCEPTANCE_CRITERIA.md) and [20_FINAL_CHECKLIST.md](20_FINAL_CHECKLIST.md); it must never turn code presence or a partial green run into DONE.

**Snapshot:** 2026-09-27
**Branch / HEAD:** `codex/core-hardening-before-desktop` / `96930383efab319dcd8187ca0ff518213a6283aa`
**Working tree:** Desktop source/E2E changes are committed; real-world and progress-ledger evidence updates remain uncommitted. No reset/rebase performed.
**Current implementation phase:** Core/CLI gates have prior evidence; packaged verification, five-case parity, cancel and close-during-run were added and pass locally. Updated-commit remote CI, worker-crash handling and the remaining acceptance rows are still open.

## Evidence currently available

| Area | Evidence | Boundary |
| --- | --- | --- |
| Build/typecheck/tests | Frozen install, `pnpm run build`, `pnpm run lint`, Desktop renderer typecheck and `pnpm test` passed before source commit `9693038`; 23 files, 83 passed, 1 skipped | lint is TypeScript no-emit, not an ESLint policy; remote CI must validate the committed SHA |
| Authoritative benchmark | `pnpm run bench` with `RELEASEPROOF_BENCH_MODE=AUTHORITATIVE` on source tree committed as `9693038`: 42 fixtures, TP12/TN30/FP0/FN0, 7 external, 0 mismatches/errors, 663.7s | Windows local result; remote final-SHA benchmark still required |
| Remote CI | <https://github.com/6hp2cfrhm4-cmyk/releaseproof/actions/runs/36281327249> passed six OS/Node cells, Action E2E, CLI tarball E2E, Windows authoritative benchmark and prior installer smoke on base SHA `6455c50` | new parity and installed-verification tests have not yet run remotely on the current worktree |
| Windows installer / packaged E2E | `ReleaseProof-Setup-0.2.0-dev.0.exe`, 95,792,627 bytes, SHA256 `acefaf0cf180e22d9d698511625f8ad6502a7c0de86c95fd56090c1b8b742168`; local install/launch without Node/pnpm/Corepack, READY 90 fixture verification, report artifacts, CANCELLED/0, close-during-start cleanup and uninstall passed | produced from source in `9693038`; remote rebuild/hash and Start Menu/icon/about/version metadata inspection remain; unsigned development artifact only |
| CLI/Desktop parity | Source in `9693038`: five cases READY, build/runtime/browser NOT_READY and external-dependency INCOMPLETE matched on verdict, score, check ID/status/classification and browser mode | local Windows; parity CI job added but not yet run remotely |
| Real-world | ten exact-pinned Windows targets rerun on base SHA `6455c50`: 3 READY, 1 NOT_READY, 6 INCOMPLETE; refreshed pins kept separate from historical SHA | new final SHA rerun remains; Windows-only evidence, and hackathon-starter's cause remains unknown |

## Status definitions

- **NOT STARTED** — no implementation or meaningful evidence.
- **IN PROGRESS** — implementation exists, but an acceptance gate is missing.
- **DONE** — all acceptance evidence for the requirement is linked to the applicable final SHA.
- **BLOCKED** — an external dependency prevents a named gate; unrelated work continues.
- **NOT APPLICABLE** — only when the owning specification explicitly permits it and evidence supports the exclusion.

## Requirement ledger

| Requirement group | Status | Next evidence |
| --- | --- | --- |
| `PROD-*`, `CORE-*`, `DETECT-*`, `RUNTIME-*` | IN PROGRESS | authoritative current-worktree benchmark and ten-project base-SHA corpus are recorded; final-SHA corpus, cross-platform/process cleanup evidence remain |
| `CLI-*`, `REPORT-*` | IN PROGRESS | compiled CLI exits/JSON/config precedence and schema v1 metadata are covered; atomic JSON/HTML/AI parity and redaction remain to be independently gated |
| `SEC-*` | IN PROGRESS | host-env minimization and IPC/path validation are tested; clean-workspace-vs-isolation and packaged report redaction need final E2E evidence |
| `DESKTOP-*`, `DESIGN-A11Y-*` | IN PROGRESS | packaged verification, Cancel, close-during-run and five-case parity pass locally; worker-crash, full UI-flow/a11y/settings and remote CI evidence remain |
| `PKG-WIN-001`, `PKG-CLI-001` | IN PROGRESS | local installed project verification/uninstall passes; final-SHA installer/hash, Start Menu/icon/about inspection and release-style CLI tarball checksum remain |
| `TEST-*`, `BENCH-*`, `CI-*`, `ACTION-001` | IN PROGRESS | current-worktree authoritative benchmark and local Desktop gates pass; run updated six-cell CI, Action/tarball and Windows packaged E2E on committed SHA |
| `RELEASE-PROV-001` | IN PROGRESS | Stage C review; preserve `v0.1.0`; new immutable release only after review |

## Rules for updating this ledger

After each gate, record the exact command or URL, source SHA, test count, artifact name/hash and limitations. Keep `VERIFIED`, `INFERRED`, `NOT VERIFIED` and `EXPECTED` distinct. A local build, development installer, historical CI run or mock test cannot close a P0. Do not merge the draft PR, move `v0.1.0`, publish npm or create a release from this stage.
