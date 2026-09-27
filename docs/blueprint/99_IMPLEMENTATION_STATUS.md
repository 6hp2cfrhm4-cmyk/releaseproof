# Implementation status ledger

This ledger tracks Stage B against [17_ACCEPTANCE_CRITERIA.md](17_ACCEPTANCE_CRITERIA.md) and [20_FINAL_CHECKLIST.md](20_FINAL_CHECKLIST.md). `DONE` requires evidence; code presence or an older green run is insufficient.

## Latest checkpoint — 2026-09-27

- **Current source baseline:** branch `codex/core-hardening-before-desktop`, committed HEAD `b6e0851c7d1b2cb69fc8252144faf6014f1fda95`; current accessibility/CLI follow-up is uncommitted and must receive exact-head CI after commit. Draft PR #1 is open/unmerged. Historical tag `v0.1.0` remains at `d03eae2e2b828d551d897669f0e4f4925b64ab14`.
- **Latest exact-head CI:** [run 36316094517](https://github.com/6hp2cfrhm4-cmyk/releaseproof/actions/runs/36316094517) is green, all 9 jobs. Workflow checkout explicitly pins PR head; authoritative benchmark now reports the checked-out Git HEAD instead of PR `GITHUB_SHA` (synthetic merge SHA). Both Windows and Ubuntu Node 20 authoritative runs report source `091a323bcddec70a0ca06af9b5acedafe6ac5f5f`, clean at start/end, 42 fixtures, TP 12 / TN 30 / FP 0 / FN 0, 0 mismatches, 0 execution errors, 7 external cases. Windows run reports 1100.7 seconds. The six OS/Node 20/22 cells, packaged Windows installer E2E, Action E2E and CLI tarball E2E also passed on this exact source.
- **Latest exact-head CI:** [run 36319730522](https://github.com/6hp2cfrhm4-cmyk/releaseproof/actions/runs/36319730522) is green, all 9 jobs, on `b6e0851c7d1b2cb69fc8252144faf6014f1fda95`. Windows and Ubuntu Node 20 authoritative benchmarks each report a clean source tree, 42 fixtures, TP 12 / TN 30 / FP 0 / FN 0, zero expectation mismatches/errors, 7 external cases; runtimes were 943.6s (Windows) and 305.8s (Ubuntu). Six OS/Node 20/22 cells, packaged Windows installer E2E, Action E2E, CLI tarball E2E and parity all passed on this SHA.
- **Current local follow-up evidence:** after centralizing JSON/HTML/AI artifact publication in `packages/reporter` and invoking it at CLI/Desktop boundaries, `pnpm run build`, `pnpm run lint`, and `pnpm test` pass (25 files, 95 passed, 1 skipped). Reporter tests verify the manifest-backed set, stale identity, tampering and failed publication; CLI E2E verifies valid/tampered report behavior and first-run `vibe` artifact creation. The packaged Windows app E2E using `apps/desktop/release/win-unpacked/ReleaseProof.exe` passed READY (`score 90`), no-system-Node launch, report artifacts, all-screen WCAG AA text sampling in Light/Dark/System (including OS color-scheme changes), accessible progress/status semantics, Cancel and close-during-run cleanup. This is local evidence on the uncommitted follow-up; the generated setup executable has not yet been installer-installed locally.
- **Accessibility finding fixed locally:** the strict all-screen contrast check exposed insufficient contrast on the light page background, hero text, result score suffix, finding details, and dark-mode finding metadata. Palette corrections now pass the strict sampled checker; progress and run status expose accessible roles, and finding selection is keyboard-operable with semantic pressed state. A manual screen-reader audit on Windows/macOS remains NOT VERIFIED.
- **Remaining exact-source gates:** the uncommitted follow-up requires exact-head CI, including authoritative benchmarks and installer E2E. The report-set tests cover consistency/tampering but do not replace final security/redaction/schema review. Reconcile remaining P0/P1 criteria against [17](17_ACCEPTANCE_CRITERIA.md) and [20](20_FINAL_CHECKLIST.md) before completion.
- **Provenance correction:** commit `8fefe82` pins CI checkout to the PR head, and `091a323` makes benchmark source identity prefer `git rev-parse HEAD` with CI metadata only as a no-repository fallback. Run `36314667396` was green but its printed source SHA still came from `GITHUB_SHA`; do not use it as exact-source benchmark evidence. The following run `36316094517` is the valid exact-head gate.
- **Still incomplete:** do not mark the milestone done. The packaged E2E now samples visible-text WCAG AA contrast on all seven main views in Light, Dark, and System themes (including a simulated OS scheme change), and checks selected keyboard semantics plus live progress/status announcements. This is automated coverage, not a manual screen-reader audit or exhaustive accessibility certification across every state/platform. Report artifacts share a run identity and reporter/CLI tests cover manifest consistency and tampering, but a final schema/redaction/trust review remains required. The uncommitted follow-up still needs exact-head CI and installer E2E. Reconcile these remaining P0/P1 criteria against [17](17_ACCEPTANCE_CRITERIA.md) and [20](20_FINAL_CHECKLIST.md) before completion.

The detailed evidence table and requirement-group snapshot below records the earlier `ca89f52` checkpoint unless an entry explicitly names another SHA. It is retained as historical evidence, not as a claim about the current HEAD. The exact-head evidence above supersedes its older CI/status claims; re-evaluate every row at the final implementation SHA.

**Snapshot:** 2026-09-27

**Branch:** `codex/core-hardening-before-desktop`

**Implementation revision with complete exact-SHA CI:** `ca89f5229ad29668ae68315fac99d1989344a148` (`test(desktop): verify doctor and accessibility states`).

**Current worktree:** implementation and corpus/status changes are committed and pushed; see `ca89f52` and its CI below. This ledger update is documentation-only. No Core/CLI code or package lock changes; frozen install not changed.

**Starting implementation SHA:** `6455c5028de4d82f15a8220ae7ed2b1826ce046e`

**PR:** [Draft #1](https://github.com/6hp2cfrhm4-cmyk/releaseproof/pull/1), not merged.

**Historical release:** `v0.1.0` still points to `060bbbf43381f94b4bc041ab9290a3439030c5ce`; existing release remains published and untouched.

## Verified evidence

| Gate | Evidence | Status / boundary |
| --- | --- | --- |
| Workspace build, typecheck/lint, tests | CI [`36296080034`](https://github.com/6hp2cfrhm4-cmyk/releaseproof/actions/runs/36296080034) on `ca89f52`: all 9 jobs passed; six OS/Node cells each built/typechecked/tested | VERIFIED on `ca89f52` |
| Desktop worker crash | `apps/desktop/src/main/worker-exit.test.ts`: real Node child exits with code 23; one terminal error, no `finished`; cancellation exit also covered; CI run `36296080034` passed | VERIFIED on `ca89f52` |
| Desktop packaged flow | CI run `36296080034`: Windows NSIS installer built, metadata/icon/Start Menu checked, installed app launched without Node/pnpm/Corepack, Express fixture verified via shared Core, full/finding handoff copied, Evidence/Logs and Doctor available/missing remediation checked, focus/light contrast/theme persistence checked, cancelled, closed during run, and uninstalled. The installed artifact checksum is available from the workflow artifact; local equivalent installer was 95,794,074 bytes, SHA-256 `e90b47c9c0ecb8611c6e9fba77eabba3c52d5f289d669d32c98f0b52c5760187` | VERIFIED on `ca89f52`; hosted and local installer bytes may differ |
| CLI/Desktop parity | CI run `36296080034` plus local five-case worker/Core parity: healthy, build/runtime/browser failure and external dependency cases match | VERIFIED on `ca89f52` |
| GitHub Action / CLI tarball | CI run `36296080034`: Composite Action outputs/policies and bundled CLI tarball install/verify E2E passed | VERIFIED on `ca89f52` |
| Cross-platform matrix | CI run `36296080034`: Windows/Ubuntu/macOS × Node 20/22 all passed | VERIFIED on `ca89f52` |
| Authoritative benchmark | CI run `36296080034` and local rerun: 42 fixtures, TP 12 / TN 30 / FP 0 / FN 0, 7 external, zero mismatch/error, precision/recall 100% | VERIFIED on `ca89f52` |
| Real-world corpus | Ten repositories / 11 targets rerun using current CLI from `2357e45`; see [`docs/REAL_WORLD_VALIDATION.md`](../REAL_WORLD_VALIDATION.md). Changes through `ca89f52` did not touch Core, detector or runner | VERIFIED; refreshed pins and older SHA results are separate |
| Current working-tree regression suite | `pnpm test`: 24 files, 85 passed, 1 skipped; `pnpm build`, `pnpm lint`, and `node --check apps/desktop/e2e/installed-app.mjs` pass; CI `36296080034` also green | VERIFIED on `ca89f52`; earlier timing assertions failed only during concurrent local build/test resource contention, then passed isolated and in CI |
| Current parity / benchmark | Desktop `e2e/parity.mjs`: five classes matched; AUTHORITATIVE 42 fixtures TP12/TN30/FP0/FN0, 7 external, zero mismatch/errors, precision/recall 100%, 890.2 s | VERIFIED on `ca89f52` |
| Current Windows installer / packaged app | Local artifact `ReleaseProof-Setup-0.2.0-dev.0.exe`, 95,794,074 bytes, SHA-256 `e90b47c9c0ecb8611c6e9fba77eabba3c52d5f289d669d32c98f0b52c5760187`; installed E2E and uninstall passed locally using zero-dependency fixture. Standard CI E2E on this SHA also passed with Express fixture | VERIFIED on `ca89f52`; local original network-dependent attempt correctly reported INCOMPLETE on npm install timeout, not READY |
| Desktop accessibility/full UI coverage | Packaged E2E asserts keyboard-visible focus, sampled WCAG AA light-theme contrast, required Node missing remediation and installed Node version; the app still lacks an independent accessibility audit for every component/surface | PARTIALLY VERIFIED; full audit NOT VERIFIED |
| Release safety | `v0.1.0` tag SHA checked; no merge, new release, or npm publish performed | VERIFIED; keep unchanged |

## Requirement group status

| Requirement group | Status | Remaining evidence / note |
| --- | --- | --- |
| `PROD-*`, `CORE-*`, `DETECT-*`, `RUNTIME-*` | IN PROGRESS | Core regression suite, 42-fixture benchmark and current-source real-world corpus pass; final acceptance review remains |
| `CLI-*`, `REPORT-*`, `ACTION-001` | IN PROGRESS | Binary, exit/config tests, reports and Action/tarball E2E pass; full atomic-artifact/schema/redaction contract still needs final consolidated evidence |
| `SEC-*` | IN PROGRESS | Minimal environment, redaction and Electron boundaries have regression tests; packaged report/redaction and complete path/trust audit remain |
| `DESKTOP-PARITY-001`, `DESKTOP-IPC-001`, `DESKTOP-SELECT-001`, `DESKTOP-VERIFY-001`, `DESKTOP-PROGRESS-001`, `DESKTOP-RESULT-001`, `DESKTOP-LIFE-001`, `DESKTOP-WORKER-001` | IN PROGRESS | Five-case parity, actual install/verify, cancel, close and worker-crash regression pass on `ca89f52`; broad accessibility audit remains |
| `DESKTOP-FINDING-*`, `DESKTOP-EVIDENCE-*`, `DESKTOP-LOGS-*`, `DESKTOP-DOCTOR-*`, `DESKTOP-SETTINGS-*`, `DESIGN-A11Y-*` | IN PROGRESS | Evidence/Logs, available and missing-Node Doctor behavior, System/Dark/Light persistence, keyboard focus and sampled light contrast pass in packaged E2E; broader per-component accessibility audit remains |
| `PKG-WIN-001`, `PKG-CLI-001` | IN PROGRESS | Windows install/launch/verify/uninstall and release-style CLI tarball E2E pass on `ca89f52`; public release provenance still awaits Stage C review |
| `TEST-*`, `BENCH-*`, `CI-*` | IN PROGRESS | Full suite/build/lint, parity and authoritative benchmark pass; all required exact-SHA CI jobs pass on `ca89f52` |
| `TEST-REALWORLD-001` | DONE | All ten pinned repositories / 11 targets rerun on `2357e45`; historical pins remain immutable records |
| `RELEASE-PROV-001` | IN PROGRESS | `v0.1.0` is unchanged; Stage C review must occur before any merge or release |

## Status rules

- **NOT STARTED** — no meaningful implementation/evidence.
- **IN PROGRESS** — work exists, but an acceptance gate is missing.
- **DONE** — all owning acceptance evidence is on the applicable final source SHA.
- **BLOCKED** — a specific external dependency prevents a named gate; continue unrelated work.
- **NOT APPLICABLE** — explicitly permitted by the owning specification and evidence supports it.

Do not merge PR #1, move `v0.1.0`, publish npm, create a GitHub Release, or claim overall completion until the full acceptance pass is complete and Stage C review is handed the result.
