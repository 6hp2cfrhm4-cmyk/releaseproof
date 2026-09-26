# Current state snapshot — 2026-09-26

This is a read-only inspection of the actual checkout. It is **not** a fresh full test of its uncommitted changes. Revalidate before implementation and before any readiness claim.

## Git and GitHub

| Item | Observed state |
| --- | --- |
| Branch / HEAD | `codex/core-hardening-before-desktop` / `c371dea505f32df07e25ae5b4f271f9b47fd69ef` |
| Previous main | `4a742634478e89850b19731826277dac254f4876` |
| Recent hardening commit | `c371dea Harden ReleaseProof core verification before desktop`; no later committed changes on this branch at inspection |
| Remote | `origin` points to `https://github.com/6hp2cfrhm4-cmyk/releaseproof.git` (verify again before push) |
| Worktree | one listed worktree at `C:/Users/alex/Desktop/megaproekt/RealiseProof` |
| PR | [draft #1](https://github.com/6hp2cfrhm4-cmyk/releaseproof/pull/1), head `c371dea`, base `main`, open |
| Historical release | `v0.1.0` tag and GitHub Release exist; immutable under this blueprint |
| Working tree | dirty: 14 modified tracked files plus 3 untracked test files before these blueprint documents; **preserve them** |

Dirty tracked paths at inspection: `docs/REAL_WORLD_VALIDATION.md`, core install/startup tests, core build/external-services/install/readme/startup/engine, detector test/frameworks, security test/secret-scanner, `vitest.config.ts`. Untracked tests: `packages/core/src/__tests__/external-services.test.ts`, `readme-context.test.ts`, `runtime-evidence.test.ts`. Their content addresses current corpus findings but has **not** been included in CI run below. Do not reset or silently commit them with unrelated work.

## Architecture actually present — VERIFIED by file inspection

`apps/cli` (Commander, bundled ESM via esbuild) → `packages/core/src/engine.ts` → `detector`, clean-copy `sandbox`, `runner`, `browser`, `environment`, `security`, `schemas`; `reporter` formats terminal/HTML/AI output. Root workspace uses pnpm lockfile v9 and package version `0.2.0-dev.0`; Node package declares `>=20`. `apps/desktop` and Electron dependencies/config, renderer, preload, utility worker, installer config and setup `.exe` are **absent**. The existing `packages/sandbox` is a clean-copy implementation, not OS isolation. Root `pnpm run lint` is TypeScript `--noEmit`, not an ESLint policy. `packages/browser` uses Playwright with HTTP fallback. The CLI has default verify plus explicit `verify`, `doctor`, `report`, `vibe`, `clean`; current flags include `--ci`, `--json`, `--verbose`, `--timeout`, `--port`, `--python-interpreter`, `--skip-sandbox`.

Current report schema is unversioned as a schema (it has a product `version` field), and uses verdict `READY | NOT_READY | INCOMPLETE`, check status `pass | warn | block | unknown | skipped | not_applicable`, four failure classifications, and browser capability `VERIFIED | HTTP_FALLBACK | UNAVAILABLE | SKIPPED`. The authoritative benchmark runner reads `fixtures/*/expected.json`; FAST skips the clean copy, AUTHORITATIVE does not. There were 42 fixture directories at this inspection, matching the prior CI count; their current outcomes must be rerun at gate time. The GitHub Action builds the checked-out action repository locally and writes declared outputs. These observations do not prove the current dirty tree still works.

## Test and CI evidence — VERIFIED only for named SHA

[CI run 35876959495](https://github.com/6hp2cfrhm4-cmyk/releaseproof/actions/runs/35876959495) succeeded for **`c371dea`**: Windows/Ubuntu/macOS × Node 20/22, Action E2E, and bundled CLI tarball E2E. The prior authoritative Ubuntu run reported 42 fixtures, TP 13, TN 29, FP 0, FN 0, six external cases. The previous local Windows pass reported build/lint and 56 passing tests with one POSIX-only SIGINT skip; this is historical evidence supplied by the prior hardening work, not a rerun on current files. CI currently has no Desktop build, Desktop E2E or installer gate. The `v0.1.0` published tarball was separately smoke-tested in prior work, but it is not the development build.

## Real-world corpus — current document is uncommitted, not CI evidence

The user approved new pinned SHAs for six upstream-unreachable historical pins while preserving old expectations separately. The dirty `docs/REAL_WORLD_VALIDATION.md` records ten Windows runs: 3 READY, 1 NOT_READY, 6 INCOMPLETE. READY: leerob/site, vitesse-lite, node-express-realworld. NOT_READY: vite-plugin-inspect upstream Windows build failure. INCOMPLETE: Next-js-boilerplate, taxonomy, hackathon-starter, fastapi-realworld, fastapi-microservices, todomvc. Exact pins, toolchain and caveats are copied into [13](13_BENCHMARK_AND_REAL_WORLD.md); these are **observed working-tree notes**, pending independent rerun on finalized code. An npm registry timeout recovered on retry; hackathon-starter's delayed HTTP timeout cause remains unresolved; old FastAPI dependency needs MSVC; `uvloop` pin is Windows-incompatible.

## Known work and gaps

The dirty diff attempts to classify incompatible pnpm lockfiles/ignored builds/Windows `uvloop`, missing required env/Drizzle Postgres URL, live-server delayed timeout, Express source-declared port, nested README `cd`, generic `.env` false secrets, and static-only monorepo root false READY. It also excludes ignored `.temp` from Vitest discovery. **EXPECTED, not verified:** full lint/test/authoritative benchmark and new CI after these edits. Additional design gaps to solve: explicit cancellation API instead of `process.exit` signal hooks inside Core; bounded logs/output and worker streaming; route typing and coverage; versioned report; Desktop; packaged-app verification; clear Doctor result instead of unconditional “ready”; release provenance. Possible code-review concerns, not confirmed defects: broad string-based command parsing, root route default for APIs, `skipSandbox` naming, and shell-based report opener. See [04](04_CORE_VERIFIER_SPEC.md), [06](06_CLI_SPEC.md), [10](10_SECURITY_PRIVACY.md), [19](19_RISKS_AND_LIMITATIONS.md).

## Evidence labels for the implementation agent

**VERIFIED:** file structure, present schemas/commands, PR/CI status for `c371dea`, dirty paths, absence of Desktop. **NOT VERIFIED:** any full-suite or CI outcome for current dirty tree, executable setup installer, Desktop/CLI parity, packaged Desktop launch. **EXPECTED:** all contracts in this blueprint. Do not promote the historical green CI run to evidence for new changes.
