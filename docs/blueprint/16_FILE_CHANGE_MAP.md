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
| CI/Action | `.github/workflows/{ci,action-example}.yml`, `action.yml`, `scripts/write-action-results.mjs`, `scripts/generate-sha256s.mjs` | matrix, outputs, packaged E2E, checksums |
| Docs | `README.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md`, `SECURITY.md`, `docs/{REAL_WORLD_VALIDATION,RELEASE_PROVENANCE}.md` | update only after implementation evidence; correct stale claims and 36-fixture PR template |
| Workspace | `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json` | add Desktop workspace/scripts/deps; keep frozen reproducible |

The current dirty edits in Core/detector/security and three untracked tests are user-owned work already in the checkout. Inspect and preserve them; integrate/refine through normal review, never reset or overwrite wholesale.

## Proposed new paths

`apps/desktop/` now exists as a baseline workspace package. Its current ownership is `src/main/` for Electron window/dialog/IPC/persistence, `src/preload/` for the typed bridge, `src/worker/` for shared Core execution, `src/renderer/` for React screens/components/theme, `src/shared/` for Desktop DTOs, `assets/icon.svg` for the approved icon and `electron-builder.yml` for packaging. Add `apps/desktop/tests/` (or an equivalent tested location) for component/IPC/E2E/packaged tests. Do not move verification algorithms into Desktop; strengthen the current IPC/runtime validation and lifecycle implementation in place. Exact entry filenames may follow the selected Vite/Electron toolchain.

Optional new Core files: `packages/core/src/session.ts`, `verdict.ts`, `capabilities.ts`; runner `environment.ts`/`owned-process.ts`; detector `targets.ts`; reporter `artifact-writer.ts`; schemas `events.ts`. Create only when responsibilities are clearer than a larger existing module. Do not introduce a new parallel “desktop-core” package.

New CI workflow/job files may be split for Desktop installer E2E and release provenance. Real-world corpus metadata can move to a machine-readable file under `benchmarks/` or `docs/` if the runner uses it; historical records remain separately labeled. The blueprint itself stays under `docs/blueprint/` and is not product runtime input.
