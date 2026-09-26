# Current repository state — 2026-09-27

This is the baseline for the next implementation/review stage. It is a dated, evidence-labelled snapshot, not a substitute for rerunning the commands on the final source SHA. The target blueprint remains normative; this file records what is actually present now.

## Git and GitHub — VERIFIED

| Item | Observed state |
| --- | --- |
| Branch / HEAD | `codex/core-hardening-before-desktop` / `29b700f8e1fb057982aee11191e4f2e51ea26455` |
| Worktree | clean; `git status --short --branch` reports the branch tracking `origin/codex/core-hardening-before-desktop` with no local changes |
| Remote | `origin` = `https://github.com/6hp2cfrhm4-cmyk/releaseproof.git` |
| PR | draft PR #1, `Core hardening before desktop`, base `main`, head `29b700f`, open |
| Tag/release | historical `v0.1.0` exists and is not to be moved or replaced |
| Worktrees | one worktree at `C:/Users/alex/Desktop/megaproekt/RealiseProof` |
| Recent commits | `29b700f` CI policy/FAST timeout; `ea03d8e` Desktop typecheck; `c22c0cc` verifier hardening + Desktop; `c371dea` Core hardening before Desktop |

The development branch was explicitly authorized for CI push. That authorization does not authorize merge, tag movement, npm publication or a GitHub Release.

## Repository architecture — VERIFIED by current files

- Root is a private pnpm workspace (`pnpm-lock.yaml` v9) with `packages/*`, `apps/*` and `benchmarks`; product version is `0.2.0-dev.0`, Node engine is `>=20`.
- CLI: `apps/cli/src/index.ts` and `commands/{verify,doctor,report,vibe,clean}.ts`; it invokes `@releaseproof/core` and the reporter. The default command is the verify alias.
- Core packages: `schemas`, `detector`, `runner`, `sandbox` (clean copy), `browser` (Playwright + HTTP crawler), `environment`, `security`, `core`, and `reporter`.
- Desktop now exists at `apps/desktop`: Electron main (`src/main/main.ts`), preload (`src/preload/index.ts`), renderer (`src/renderer/main.tsx` + CSS), forked worker (`src/worker/verify.ts`), shared DTOs (`src/shared/ipc.ts`), Vite and electron-builder configuration. The worker calls `@releaseproof/core`; no second verifier is intended.
- Desktop has `nodeIntegration:false`, `contextIsolation:true`, `sandbox:true`, a CSP in the renderer HTML, deny-by-default navigation/window opening, folder picker, detection preview, trust acknowledgement, recent paths, settings, progress, cancel, result, findings/evidence/log views and artifact/clipboard actions. These are code-presence observations, not complete UX/E2E proof.
- Windows packaging configuration produces `ReleaseProof-Setup-${version}.exe`, Start Menu shortcut and uninstall metadata. Installer packaging exists; installed metadata/icon inspection and full installed-app verification remain gates.
- `action.yml` is a repository-local composite Action that builds the checked-out repository, runs the bundled CLI and writes declared outputs. It is not an npm dependency.

## Local evidence — VERIFIED for this checkout where stated

- `pnpm run build` and `pnpm run lint` completed successfully on this checkout during this blueprint pass.
- Prior same-checkout verification recorded `pnpm test`: 22 files, 77 passed, 1 skipped; the fresh 2026-09-27 rerun is **not green**: 22 files, 74 passed, 3 failed, 1 skipped. Failures are `critical-routes.test.ts` (missing expected `metadata.api`), one CLI flag/config E2E (fixture server did not become ready), and one browser 500 test timeout. Treat these as current P0/P1 investigation gates. A deliberately supplied unsupported Vitest reporter flag is not a test result and must not be cited as one.
- Prior same-checkout authoritative benchmark recorded 42 fixtures, TP 13, TN 29, FP 0, FN 0, zero expectation mismatches/errors and six external-dependency cases using explicit Python 3.12.14. The fresh Windows rerun on this checkout completed with **TP 11, TN 28, FP 1, FN 2, three expectation mismatches, eight external cases** in 918.5 seconds and therefore fails the release gate. The three mismatches are `fastapi-env-error` and `fastapi-missing-dependency` (expected NOT_READY, observed INCOMPLETE) and `fastapi-working` (expected READY, observed NOT_READY). CI Ubuntu Node 20 still passed its 42-fixture gate; the platform divergence is unresolved and must not be hidden.
- Local Windows installer smoke recorded silent install/uninstall exit 0, installed executable launch without system Node/pnpm, and SHA-256 `251c126ede279b0030e17b09567229674cbe58d0b450f952601b768b665edebe` for `ReleaseProof-Setup-0.2.0-dev.0.exe`. This does not prove icon/version metadata or project verification from the installed app.
- Several `releaseproof-*` directories remain under the user temp directory from earlier diagnostics. They are outside the repository and were deliberately not deleted during this read-only blueprint pass; final lifecycle acceptance must distinguish pre-existing residue from residue created by the final run and verify success/failure/cancel cleanup.

## Remote CI — VERIFIED status at snapshot time

Run `36272677692` targets this exact SHA and completed successfully: <https://github.com/6hp2cfrhm4-cmyk/releaseproof/actions/runs/36272677692>. Desktop installer smoke, CLI tarball E2E, Action E2E and all six Windows/Ubuntu/macOS × Node 20/22 jobs passed. Ubuntu Node 20 authoritative benchmark reported 42 fixtures, TP 13, TN 29, FP 0, FN 0, zero mismatches/errors and six external cases in 345.4 seconds. Earlier run `36272111888` failed for an empty Desktop Vitest suite, expected monorepo-root exit 2 and a Windows FastAPI timeout; commits `ea03d8e` and `29b700f` address those specific failures.

The matrix currently includes six OS/Node cells, Action E2E, CLI tarball E2E and a Windows Desktop build/installer artifact job. Full installed-app E2E, Desktop parity, IPC/lifecycle tests and a release-candidate Windows authoritative benchmark are still target gates, not implied by the green jobs above.

## Real-world corpus — VERIFIED as historical working-tree record, not final gate

`docs/REAL_WORLD_VALIDATION.md` records ten dated Windows runs using exact pins: three READY, one NOT_READY and six INCOMPLETE. Four historical pins remained reachable; six were refreshed to new pinned SHAs with the user's approval. Historical and refreshed pins are explicitly separated. The record is useful diagnostic evidence, but it must be rerun or marked NOT VERIFIED on the final implementation SHA with toolchain/date/target/capability evidence. The unresolved `hackathon-starter` delayed HTTP timeout remains a limitation rather than a guessed blocker.

## Known incomplete gates — EXPECTED / NOT VERIFIED

- Desktop has implementation code but lacks a complete automated Electron E2E and five-case CLI/Desktop parity suite.
- Worker/main lifecycle needs real tests for close, worker crash, cancellation, force cleanup, event bounds and foreign-port safety. Current `before-quit` has a bounded exit fallback; it is not proof that every child is reaped.
- Current report schemas contain useful fields and cancellation/blocker invariants, but the independent `schemaVersion: 1.0.0` contract, migration policy, artifact hashes and full evidence/capability model still need completion.
- Current Desktop `System Doctor`, evidence/log presentation and finding copy are functional scaffolds; target behavior in [07](07_DESKTOP_PRODUCT_SPEC.md) is broader than current code.
- Action currently exposes `path`, `port`, `timeout` and `fail-on-blocker`; target `target`/`fail-on-incomplete` validation and healthy/blocker/incomplete/path-space E2E remain required.
- Windows installer CI currently builds and hashes an artifact; it does not yet install, launch a project verification, inspect metadata/icon, or uninstall in CI.
- The release remains development-only. Stage C review, new immutable version/tag, downloaded-artifact verification and public release are out of scope here.

## Evidence rule

`VERIFIED` means directly observed in this checkout or linked to a named run/SHA. `INFERRED` means a design conclusion from inspected code. `NOT VERIFIED` means an explicit missing gate. `EXPECTED` means the future contract in files 00–20. Never promote code presence, a prior commit's CI or a partial installer smoke into a final readiness claim.
