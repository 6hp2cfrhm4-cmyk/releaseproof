# Current repository state — 2026-09-28

This is an evidence-labelled snapshot for the implementation/review stage. Re-run the baseline on the actual checkout before making changes. The numbered blueprint is normative for the target product; this file records the observed baseline and its limits.

## Git and GitHub — VERIFIED

| Item | Observed state |
| --- | --- |
| Branch / HEAD | `codex/core-hardening-before-desktop` / `a3524f56c69982ead3b0901aeed638c3ac9171dd` |
| Worktree at latest validation | Tracked worktree is clean. Ignored build, benchmark and `.releaseproof` artifacts remain disposable and are not release evidence. |
| Remote branch | `origin/codex/core-hardening-before-desktop` points to `a3524f56c69982ead3b0901aeed638c3ac9171dd`. |
| PR | Draft PR #1, “Core hardening before desktop”, base `main`, open; head SHA matches `a3524f56`. |
| Historical tag | `v0.1.0` resolves to `d03eae2e2b828d551d897669f0e4f4925b64ab14` in this checkout. It is immutable; do not move, replace, or overwrite its release assets. |
| Worktrees | One worktree: `C:/Users/alex/Desktop/megaproekt/RealiseProof`. |
| Recent commits | `a3524f5` aligns Desktop parity with the typed worker protocol; `7e6ae58` completes core hardening and artifact boundaries; `76ba859` strengthens accessibility/CLI report coverage. Run `git log --oneline -15` for the authoritative list. |

The owner previously authorized pushing this development branch for CI. That does not authorize merge, tag movement, npm publication, or a GitHub Release. This blueprint pass performs none of those actions.

## Latest local implementation checkpoint — VERIFIED on exact HEAD

On exact source commit `a3524f56c69982ead3b0901aeed638c3ac9171dd`, `pnpm run build`, `pnpm run lint`, and the full Vitest suite pass locally (30 files, 117 passed, 2 legitimate platform-specific skips). Exact-head CI run [36344233294](https://github.com/6hp2cfrhm4-cmyk/releaseproof/actions/runs/36344233294) passed all nine required jobs. Ubuntu and Windows Node 20 authoritative runs each report source `a3524f56`, clean source, 42 fixtures, TP 12 / TN 30 / FP 0 / FN 0, zero expectation mismatches and execution errors. The installed Windows E2E, Action E2E, CLI tarball E2E and six OS/Node cells also passed.

The exact-head CI Windows artifact is `ReleaseProof-Setup-0.2.0-dev.0.exe`; its installer SHA-256 is `bdd1182e355ef8aba6d6f251d65647fc25a01186eb2f0fe89a9d3419dc85ac7b`, and the uploaded artifact zip digest is `b4f2ff1635cf9d3655c458f47598331b2f36edb4ad6bed3cc0a890b64778b7b1`. CI installed, launched without Node/pnpm/Corepack on PATH, verified a real fixture, exercised Cancel and close-during-run cleanup, and uninstalled cleanly. A local equivalent installer E2E also passed; hosted CI is the final-source evidence.

The exact-head run uses an explicit PR-head checkout rather than GitHub's synthetic merge SHA, and benchmark logs print the checked-out source. This is the authoritative provenance gate for the current branch. Older runs and older local checkpoints remain historical.

## Repository architecture — VERIFIED by current files

- Root is a private pnpm workspace (`pnpm-lock.yaml`, lockfile version 9) containing `packages/*`, `apps/*`, and `benchmarks`. Development version is `0.2.0-dev.0`; CLI package requires Node `>=20`.
- The Desktop manifest declares React/React DOM `^19.1.1`, Electron `^37.5.1`, Vite `^7.1.5`, electron-builder `^26.0.12`, TypeScript `^5.7.3`, and Playwright `^1.50.1`; exact resolved versions are in the committed lockfile. The local shell reported pnpm `12.3.4`, while CI installs pnpm 9. The root manifest does not declare a `packageManager` pin. Treat this as a reproducibility/toolchain decision for the implementation agent, not permission to change versions casually.
- CLI lives at `apps/cli/src/index.ts` with `commands/{verify,doctor,report,vibe,clean}.ts`; it calls `@releaseproof/core` and the reporter. The root `releaseproof` invocation defaults to verification.
- Core packages are `schemas`, `detector`, `runner`, `sandbox` (clean-workspace copy), `browser` (Playwright plus HTTP crawler), `environment`, `security`, `core`, and `reporter`.
- Desktop exists at `apps/desktop`: Electron main `src/main/main.ts`, preload `src/preload/index.cts`, renderer `src/renderer/main.tsx` and CSS, forked worker `src/worker/verify.ts`, shared DTOs `src/shared/ipc.ts`, Vite config, and electron-builder config. The worker calls `@releaseproof/core`; Desktop is not intended to contain separate verifier logic.
- Desktop source config includes `nodeIntegration: false`, `contextIsolation: true`, sandboxing, CSP, deny-by-default navigation/window opening, project selection/preview, trust acknowledgement, recents/settings, progress/cancel, findings/evidence/logs and report/clipboard actions. These are source-presence facts, not proof that every flow is correct.
- Windows NSIS configuration builds `ReleaseProof-Setup-${version}.exe`, with Start Menu and uninstall configuration. A Windows installer smoke job exists; see the evidence boundary below for exactly what its current committed test exercises.
- `action.yml` is a repository-local composite Action: it builds and runs this checkout's bundled CLI, then writes Action outputs. It does not depend on an npm-published `releaseproof` package.

## Earlier exact-HEAD CI — HISTORICAL

GitHub Actions run [36297402432](https://github.com/6hp2cfrhm4-cmyk/releaseproof/actions/runs/36297402432) completed successfully for exact HEAD `5a8cee6025f1d0db5f81b0e9be922d68c2e5bdb0`. It is retained as historical evidence only; current acceptance evidence is run `36344233294` on `a3524f56` above.

The older installer script covered a narrower healthy flow; the current exact-head installer job covers the expanded packaged flow and is the applicable evidence.

## Existing local/remote evidence and boundaries

- The exact-head run `36344233294` is the current authoritative CI reference. Older green runs at `ca89f52`/`6455c50` remain historical and must not be cited as final-SHA evidence.
- Local benchmark and test counts are supplementary; the exact-head Ubuntu and Windows Node 20 jobs are the current recorded 42-case gates.
- `docs/REAL_WORLD_VALIDATION.md` records ten pinned upstream repositories, including refreshed SHAs for six historical pins that became unreachable. The current corpus rerun uses ReleaseProof `a3524f56` and reports three READY, one NOT_READY and six INCOMPLETE across 11 target runs. Keep original and refreshed pins/outcomes separate. `hackathon-starter` remains unresolved INCOMPLETE; do not infer a failure cause.
- The report schemas and artifacts exist, but the independent schema-version/migration, complete capability/evidence contract, atomic cross-artifact consistency, and final-sha redaction/trust audit remain acceptance checks.
- Existing source includes tests for Core/CLI, runner/process, browser, Action, Desktop worker/renderer and package behavior. Test presence is not the same as full real-process, browser, packaged UI, accessibility or cleanup coverage; use [12](12_TESTING_STRATEGY.md), [17](17_ACCEPTANCE_CRITERIA.md), and [20](20_FINAL_CHECKLIST.md).

## Known limitations and review boundaries

- The packaged E2E and exact-head CI prove the required product flows, but a manual screen-reader audit and exhaustive accessibility certification across every platform remain NOT VERIFIED.
- The current branch is development-only. Stage C independent review must precede merge/release; do not publish a new release during implementation.

## Evidence labels

`VERIFIED` means observed in this checkout or backed by a named exact-SHA run. `INFERRED` means a conclusion from inspected code. `NOT VERIFIED` means the evidence is absent or does not cover the claim. `EXPECTED` means a future contract in files 00–20. Never promote code presence, a prior commit's CI, or a partial installer smoke to a final readiness claim.
