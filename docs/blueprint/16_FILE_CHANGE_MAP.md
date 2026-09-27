# File change map and package responsibility

This maps **inspected existing paths** to likely work. New paths are proposals inside verified workspace structure; adjust names only if a coherent implementation requires it, preserving package ownership. Do not edit code in the blueprint stage.

## Existing paths

| Area | Inspected paths | Ownership / likely change |
| --- | --- | --- |
| Schemas | `packages/schemas/src/{config,report,check,evidence,profile}.ts` | v1 report/config/target/event schema, invariants and migration |
| Core | `packages/core/src/engine.ts`, `scoring.ts`, `checks/{install,build,startup,external-services,readme,dev-prod}.ts` | session orchestration/cancel, verdict/coverage, classification, ports/HTTP/routes, no global signal handler |
| Detector | `packages/detector/src/{detector,frameworks,package-managers,routes}.ts` | candidate target discovery, mixed/monorepo, manager/version/route metadata |
| Runner | `packages/runner/src/{exec,command-parser,ports,process-tree}.ts` | explicit argv, env policy, owned process tree, abort/grace/force cleanup and bounded logs |
| Clean copy | `packages/sandbox/src/{copy,workspace}.ts` | hygiene excludes, symlink/file/size limits, observable cleanup; terminology change from “security sandbox” |
| Browser | `packages/browser/src/{playwright-runner,http-crawler,types}.ts` | capability separation, real delayed errors, API/document rules, route/host limits |
| Environment/security | `packages/environment/src/{analysis,scanner,parse-env}.ts`, `packages/security/src/{redact,secret-scanner}.ts` | required env analysis, generic env false blocker, central value redaction |
| Reporter | `packages/reporter/src/{terminal,html,ai-handoff,vibe}.ts` | v1 schema, score+coverage, escaped HTML, evidence-bound AI text |
| CLI | `apps/cli/src/index.ts`, `commands/{verify,doctor,report,vibe,clean}.ts`, `apps/cli/package.json` | options/config/exit/Doctor/artifact safety, bundled release |
| Tests | `apps/cli/src/__tests__`, `packages/*/src/__tests__`, `fixtures/*/expected.json`, `vitest.config.ts` | mandatory regression matrix and no clone contamination |
| Benchmark | `benchmarks/{run-bench,setup-fixtures}.ts` | modes, expectation validation, metrics, cleanup |
| CI/Action | `.github/workflows/ci.yml`, `action.yml`, `scripts/write-action-results.mjs`, `scripts/generate-sha256s.mjs` | matrix, outputs, packaged E2E, checksums. Verify any additional workflow path exists before citing it. |
| Docs | `README.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md`, `SECURITY.md`, `docs/{REAL_WORLD_VALIDATION,RELEASE_PROVENANCE}.md` | update only after implementation evidence; correct stale claims and 36-fixture PR template |
| Workspace | `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json` | add Desktop workspace/scripts/deps; keep frozen reproducible |

At the 2026-09-27 blueprint snapshot, the only dirty tracked file is `apps/desktop/e2e/installed-app.mjs`, expanding packaged UI coverage for the trust acknowledgement and READY/NOT_READY/INCOMPLETE outcomes. Preserve and review it; do not reset or overwrite it. Always repeat `git status` before implementation because this status is time-specific.

## Proposed new paths

`apps/desktop/` already exists as a workspace package. Current ownership is `src/main/` for Electron window/dialog/IPC/persistence, `src/preload/index.cts` for the typed bridge, `src/worker/` for shared Core execution, `src/renderer/` for React screens/components/theme, `src/shared/` for Desktop DTOs, `assets/icon.svg` for the product icon and `electron-builder.yml` for packaging. Tests currently live beside source and under `apps/desktop/e2e/`; add coverage in the established layout unless a test-runner boundary justifies a new directory. Do not move verification algorithms into Desktop; strengthen the current IPC/runtime validation and lifecycle implementation in place. Exact filenames may evolve with the selected Vite/Electron toolchain.

Optional new Core files: `packages/core/src/session.ts`, `verdict.ts`, `capabilities.ts`; runner `environment.ts`/`owned-process.ts`; detector `targets.ts`; reporter `artifact-writer.ts`; schemas `events.ts`. Create only when responsibilities are clearer than a larger existing module. Do not introduce a new parallel “desktop-core” package.

New CI workflow/job files may be split for Desktop installer E2E and release provenance. Real-world corpus metadata can move to a machine-readable file under `benchmarks/` or `docs/` if the runner uses it; historical records remain separately labeled. The blueprint itself stays under `docs/blueprint/` and is not product runtime input.
