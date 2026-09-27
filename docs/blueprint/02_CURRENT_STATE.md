# Current repository state — 2026-09-27

This is the baseline for the next implementation/review stage. It is a dated, evidence-labelled snapshot, not a substitute for rerunning the commands on the final source SHA. The target blueprint remains normative; this file records what is actually present now.

## Git and GitHub — VERIFIED

| Item | Observed state |
| --- | --- |
| Branch / HEAD | `codex/core-hardening-before-desktop` / `6455c5028de4d82f15a8220ae7ed2b1826ce046e` |
| Worktree | source changes are committed; four evidence documents and a newline-only fixture diff are uncommitted at this snapshot |
| Remote | `origin` = `https://github.com/6hp2cfrhm4-cmyk/releaseproof.git` |
| PR | draft PR #1, `Core hardening before desktop`, base `main`, head `6455c50`, open |
| Tag/release | historical `v0.1.0` exists and is not to be moved or replaced |
| Worktrees | one worktree at `C:/Users/alex/Desktop/megaproekt/RealiseProof` |
| Recent commits | `6455c50` hanging-start benchmark expectation; `549a679` verifier/Desktop/installer acceptance hardening; `a782af1` report/IPC/Action gates; `29b700f` CI policy/FAST timeout; `ea03d8e` Desktop typecheck |

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

- Fresh 2026-09-27 rerun on `6455c50`: `pnpm run build` and `pnpm run lint` passed; `pnpm test` passed with 23 files, 83 passed, 1 skipped (84 total).
- Local Windows authoritative benchmark on `6455c50`: 42 fixtures, TP 12, TN 30, FP 0, FN 0, zero expectation mismatches/errors, seven external-dependency cases, 652.5 seconds. Windows Node 20 hosted CI independently passed the same 42-case gate in 1044.0 seconds. The changed TP/TN split reflects the corrected expected classification of an indeterminate hanging startup, not a hidden mismatch.
- Windows CI installed the generated Setup exe silently, launched/version-checked the installed application, and silently uninstalled it successfully. This does not prove verification of a project from the installed app, Start Menu shortcut behavior, icon rendering or upgrade behavior.
- Several `releaseproof-*` directories remain under the user temp directory from earlier diagnostics. They are outside the repository and were deliberately not deleted during this read-only blueprint pass; final lifecycle acceptance must distinguish pre-existing residue from residue created by the final run and verify success/failure/cancel cleanup.

## Remote CI — VERIFIED status at snapshot time

Run `36281327249` targets `6455c50` and completed successfully: <https://github.com/6hp2cfrhm4-cmyk/releaseproof/actions/runs/36281327249>. Desktop installer install/launch/uninstall smoke, CLI tarball E2E, Action E2E and all six Windows/Ubuntu/macOS × Node 20/22 jobs passed. Windows Node 20 authoritative benchmark reported 42 fixtures, TP 12, TN 30, FP 0, FN 0, zero mismatches/errors and seven external cases. FAST smoke and dogfood checks passed under the expected `INCOMPLETE` monorepo-root policy.

The matrix includes six OS/Node cells, Action E2E, CLI tarball E2E, Windows authoritative benchmark and Windows installer install/launch/uninstall smoke. Full installed-app project-verification E2E, Desktop parity and complete IPC/lifecycle tests remain open gates.

## Real-world corpus — VERIFIED as historical working-tree record, not final gate

`docs/REAL_WORLD_VALIDATION.md` now records the final-SHA Windows reruns for ten repositories: three READY, one NOT_READY and six INCOMPLETE. Four original pins were rerun unchanged and six repositories use refreshed pins explicitly authorized by the user; the unreachable old hashes and earlier outcomes remain historical. Environment was Windows 11 build 26200, Node 24.19.0, Python 3.12.14 with lockfile-compatible package managers. `hackathon-starter` still has an unresolved 60-second readiness timeout and is INCOMPLETE, not guessed broken.

## Known incomplete gates — EXPECTED / NOT VERIFIED

- Desktop has implementation code but lacks a complete automated Electron E2E and five-case CLI/Desktop parity suite.
- Worker/main lifecycle needs real tests for close, worker crash, cancellation, force cleanup, event bounds and foreign-port safety. Current `before-quit` has a bounded exit fallback; it is not proof that every child is reaped.
- Current report schemas contain useful fields and cancellation/blocker invariants, but the independent `schemaVersion: 1.0.0` contract, migration policy, artifact hashes and full evidence/capability model still need completion.
- Current Desktop `System Doctor`, evidence/log presentation and finding copy are functional scaffolds; target behavior in [07](07_DESKTOP_PRODUCT_SPEC.md) is broader than current code.
- Action exposes `path`, `target`, `port`, `timeout`, `fail-on-blocker` and `fail-on-incomplete`; healthy/blocker/incomplete policy E2E is verified in run `36281327249`.
- Windows installer CI installs, launches/version-checks and uninstalls the packaged application. Project verification from the installed app, icon rendering and Start Menu behavior remain NOT VERIFIED.
- The release remains development-only. Stage C review, new immutable version/tag, downloaded-artifact verification and public release are out of scope here.

## Evidence rule

`VERIFIED` means directly observed in this checkout or linked to a named run/SHA. `INFERRED` means a design conclusion from inspected code. `NOT VERIFIED` means an explicit missing gate. `EXPECTED` means the future contract in files 00–20. Never promote code presence, a prior commit's CI or a partial installer smoke into a final readiness claim.
