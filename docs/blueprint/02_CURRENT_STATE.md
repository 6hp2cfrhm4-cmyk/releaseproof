# Current repository state — 2026-09-27

This is an evidence-labelled snapshot for the implementation/review stage. Re-run the baseline on the actual checkout before making changes. The numbered blueprint is normative for the target product; this file records the observed baseline and its limits.

## Git and GitHub — VERIFIED

| Item | Observed state |
| --- | --- |
| Branch / HEAD | `codex/core-hardening-before-desktop` / `caedb07980edd365253313f1d6c9775b4ab3f6d6` |
| Worktree at latest validation | The exact-SHA benchmark ran clean. A subsequent report-hardening change is currently uncommitted in `packages/reporter/src/ai-handoff.ts` and its tests; see below. |
| Remote branch | `origin/codex/core-hardening-before-desktop` points to `caedb07980edd365253313f1d6c9775b4ab3f6d6`. |
| PR | Draft PR #1, “Core hardening before desktop”, base `main`, open; head SHA matches `caedb079`. |
| Historical tag | `v0.1.0` resolves to `d03eae2e2b828d551d897669f0e4f4925b64ab14` in this checkout. It is immutable; do not move, replace, or overwrite its release assets. |
| Worktrees | One worktree: `C:/Users/alex/Desktop/megaproekt/RealiseProof`. |
| Recent commits | `caedb07` hardens benchmark integrity and packaged UI coverage; `5a8cee6` records prior verified gates. Run `git log --oneline -15` for the authoritative list. |

The owner previously authorized pushing this development branch for CI. That does not authorize merge, tag movement, npm publication, or a GitHub Release. This blueprint pass performs none of those actions.

## Latest local implementation checkpoint — VERIFIED on dirty working tree

On exact source commit `caedb07980edd365253313f1d6c9775b4ab3f6d6`, `pnpm test` passed 25 files (90 passed, 1 skipped); `pnpm run build`, `pnpm run lint`, benchmark-package TypeScript check, and E2E syntax check passed. The full AUTHORITATIVE benchmark passed 42 fixtures (TP 12 / TN 30 / FP 0 / FN 0; 0 expectation mismatches; 0 execution errors; 7 external cases; 913.2 seconds) on Windows 11 / Node 24.19.0. The output recorded this exact source commit and `Working tree: CLEAN`.

The Windows NSIS installer was rebuilt locally as `ReleaseProof-Setup-0.2.0-dev.0.exe`, installed into a unique temporary directory, launched without Node/pnpm/Corepack on PATH, and ran the installed-app E2E successfully, then uninstalled cleanly. The local installer SHA-256 was `65997e2c48743f1de88323713609f227201bff510fbe837c8fb3c1ea125bf1f3`. The revised E2E requires the normal trust acknowledgement and asserts READY, NOT_READY, and INCOMPLETE UI outcomes. This is local dirty-tree evidence, not CI evidence.

The exact-SHA GitHub Actions run [36301498915](https://github.com/6hp2cfrhm4-cmyk/releaseproof/actions/runs/36301498915) passed all nine jobs on `caedb079`, including six OS/Node cells, Composite Action, CLI tarball and Windows packaged Desktop E2E. A subsequent uncommitted report-hardening change adds defensive AI-handoff fencing and one adversarial regression test; local reporter/security tests, build, lint/typecheck and the 25-file full test suite (91 passed, 1 skipped) pass for that dirty tree. Exact-SHA CI for this latter change is pending.

## Repository architecture — VERIFIED by current files

- Root is a private pnpm workspace (`pnpm-lock.yaml`, lockfile version 9) containing `packages/*`, `apps/*`, and `benchmarks`. Development version is `0.2.0-dev.0`; CLI package requires Node `>=20`.
- The Desktop manifest declares React/React DOM `^19.1.1`, Electron `^37.5.1`, Vite `^7.1.5`, electron-builder `^26.0.12`, TypeScript `^5.7.3`, and Playwright `^1.50.1`; exact resolved versions are in the committed lockfile. The local shell reported pnpm `12.3.4`, while CI installs pnpm 9. The root manifest does not declare a `packageManager` pin. Treat this as a reproducibility/toolchain decision for the implementation agent, not permission to change versions casually.
- CLI lives at `apps/cli/src/index.ts` with `commands/{verify,doctor,report,vibe,clean}.ts`; it calls `@releaseproof/core` and the reporter. The root `releaseproof` invocation defaults to verification.
- Core packages are `schemas`, `detector`, `runner`, `sandbox` (clean-workspace copy), `browser` (Playwright plus HTTP crawler), `environment`, `security`, `core`, and `reporter`.
- Desktop exists at `apps/desktop`: Electron main `src/main/main.ts`, preload `src/preload/index.cts`, renderer `src/renderer/main.tsx` and CSS, forked worker `src/worker/verify.ts`, shared DTOs `src/shared/ipc.ts`, Vite config, and electron-builder config. The worker calls `@releaseproof/core`; Desktop is not intended to contain separate verifier logic.
- Desktop source config includes `nodeIntegration: false`, `contextIsolation: true`, sandboxing, CSP, deny-by-default navigation/window opening, project selection/preview, trust acknowledgement, recents/settings, progress/cancel, findings/evidence/logs and report/clipboard actions. These are source-presence facts, not proof that every flow is correct.
- Windows NSIS configuration builds `ReleaseProof-Setup-${version}.exe`, with Start Menu and uninstall configuration. A Windows installer smoke job exists; see the evidence boundary below for exactly what its current committed test exercises.
- `action.yml` is a repository-local composite Action: it builds and runs this checkout's bundled CLI, then writes Action outputs. It does not depend on an npm-published `releaseproof` package.

## Exact-HEAD CI — VERIFIED

GitHub Actions run [36297402432](https://github.com/6hp2cfrhm4-cmyk/releaseproof/actions/runs/36297402432) completed successfully for exact HEAD `5a8cee6025f1d0db5f81b0e9be922d68c2e5bdb0`. All nine jobs passed: six Windows/Ubuntu/macOS × Node 20/22 matrix jobs, Composite Action E2E, bundled CLI tarball E2E, and Windows Desktop build/installer smoke. The matrix runs build, typecheck, tests and a small FAST benchmark smoke; Ubuntu and Windows Node 20 each run the 42-fixture authoritative benchmark. The installer job builds an NSIS EXE, installs it, launches the app, exercises the packaged-app script present on that SHA, and uninstalls. This green run is evidence only for code committed at `5a8cee6`; it does not include the uncommitted E2E expansion described below.

The committed installer script exercises the healthy READY project through the installed app and checks artifacts, plus worker/lifecycle behavior. It does not prove that the actual UI renders both non-READY verdicts or that the normal Verify button enforces trust acknowledgement. The current uncommitted edit adds those UI assertions and generated NOT_READY/INCOMPLETE projects. Prior-turn handoff reports that `node --check`, a local build/install, the revised installed-app E2E and uninstall passed; this pass has not independently rerun those commands. Treat that local result as handoff evidence on the working-tree version, not as exact-HEAD CI evidence.

## Existing local/remote evidence and boundaries

- The exact-HEAD run above is the current authoritative CI reference. Older green runs at `ca89f52`/`6455c50` remain historical and must not be cited as final-SHA evidence when newer source changes affect the gate.
- The local Windows benchmark and test counts recorded in prior status documents were run on earlier source revisions. Do not carry their exact metrics to `5a8cee6` without rerunning locally. The exact-HEAD Windows Node 20 benchmark is the current recorded 42-case gate.
- `docs/REAL_WORLD_VALIDATION.md` records ten pinned upstream repositories, including refreshed SHAs for six historical pins that became unreachable. The current corpus implementation under test was ReleaseProof `2357e45`, not this later HEAD. Three repositories were READY, one NOT_READY, and six INCOMPLETE (11 target runs because one repository has two targets). Keep original and refreshed pins/outcomes separate. `hackathon-starter` remains unresolved INCOMPLETE; do not infer a failure cause.
- The report schemas and artifacts exist, but the independent schema-version/migration, complete capability/evidence contract, atomic cross-artifact consistency, and final-sha redaction/trust audit remain acceptance checks.
- Existing source includes tests for Core/CLI, runner/process, browser, Action, Desktop worker/renderer and package behavior. Test presence is not the same as full real-process, browser, packaged UI, accessibility or cleanup coverage; use [12](12_TESTING_STRATEGY.md), [17](17_ACCEPTANCE_CRITERIA.md), and [20](20_FINAL_CHECKLIST.md).

## Known incomplete gates — NOT VERIFIED unless evidence is added on the final SHA

- The packaged E2E extension has passed locally but has not been exercised by CI. After it is committed, run the exact-SHA Windows installer job and require all three verdicts plus trust-gate behavior through the real renderer.
- Re-run exact-SHA CI after the uncommitted AI-handoff safety change is committed. The current authoritative benchmark and CI are on `caedb079`; the security fix changes report generation and requires new CI evidence.
- Complete the P0/P1 schema, report atomicity/consistency, environment propagation, secret redaction, filesystem/path/trust and owned-process cleanup checks in [17](17_ACCEPTANCE_CRITERIA.md).
- Complete broad keyboard/screen-reader/contrast/reduced-motion and narrow-window accessibility review; sampled checks are not a full audit.
- The current branch is development-only. Stage C independent review must precede merge/release; do not publish a new release during implementation.

## Evidence labels

`VERIFIED` means observed in this checkout or backed by a named exact-SHA run. `INFERRED` means a conclusion from inspected code. `NOT VERIFIED` means the evidence is absent or does not cover the claim. `EXPECTED` means a future contract in files 00–20. Never promote code presence, a prior commit's CI, or a partial installer smoke to a final readiness claim.
