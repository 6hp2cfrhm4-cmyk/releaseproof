# Implementation status ledger

This ledger tracks Stage B against [17_ACCEPTANCE_CRITERIA.md](17_ACCEPTANCE_CRITERIA.md) and [20_FINAL_CHECKLIST.md](20_FINAL_CHECKLIST.md). `DONE` means the requirement has implementation and evidence; a source-only inspection or an older run is not enough.

## Final implementation checkpoint — 2026-09-28

- **Final branch source:** branch `codex/core-hardening-before-desktop`, commit `eea13253db393a3e3449802c505042e1c4c7b859` (`docs: reconcile final implementation evidence`). This is a documentation-only commit on top of runtime implementation `a3524f56c69982ead3b0901aeed638c3ac9171dd`; no verifier, CLI, Desktop or lockfile code changed. The tracked worktree was clean when this checkpoint was verified; ignored build, benchmark and `.releaseproof` artifacts are disposable.
- **PR:** [Draft #1](https://github.com/6hp2cfrhm4-cmyk/releaseproof/pull/1), open and unmerged. Pushing this development branch is authorized; merge, release, npm publication and tag movement are not.
- **Historical release:** `v0.1.0` resolves to `d03eae2e2b828d551d897669f0e4f4925b64ab14`; the published `releaseproof-0.1.0.tgz` remains unchanged with digest `5192a4d98a48704afdff5c6f67b0889918564505c17ab898a58c6c13e683e65a`.

## Exact-head CI evidence

[Run 36385364473](https://github.com/6hp2cfrhm4-cmyk/releaseproof/actions/runs/36385364473) checked out the submitted head `eea13253db393a3e3449802c505042e1c4c7b859` and passed all nine required jobs:

| Job | Result / evidence |
| --- | --- |
| Ubuntu Node 20 | PASS; authoritative benchmark source `eea1325`, clean source, 42 fixtures, TP 12 / TN 30 / FP 0 / FN 0, zero expectation mismatches and execution errors |
| Windows Node 20 | PASS; same authoritative benchmark metrics and clean source |
| Ubuntu Node 22 | PASS; build, typecheck, tests, FAST smoke and dogfood |
| Windows Node 22 | PASS; build, typecheck, tests, FAST smoke and dogfood |
| macOS Node 20 | PASS; build, typecheck, tests, FAST smoke and dogfood |
| macOS Node 22 | PASS; build, typecheck, tests, FAST smoke and dogfood |
| Composite Action E2E | PASS; healthy, blocker/incomplete policy, invalid input and path-with-spaces outputs |
| Bundled CLI Tarball E2E | PASS; packed artifact installed outside the workspace and executed |
| Desktop build / Windows installer smoke | PASS; parity, NSIS build, checksum, install/launch/verify/cancel/close/uninstall |

The CI job generated `ReleaseProof-Setup-0.2.0-dev.0.exe`. The installer SHA-256 printed by the job is `80c20e4bddd7a75636975e593f2fe406f30bdea126d34f6eafb06e07a0620fce`; the uploaded artifact zip digest is `5250e7eeee8809b71bf8db047d93c3ac772ed43eb7b5e20adb2f8114478262a9`.

## Local verification on the implementation source

- `pnpm install --frozen-lockfile`: PASS on runtime implementation source.
- `pnpm run build`: PASS on runtime implementation source.
- `pnpm run lint`: PASS on runtime implementation source.
- `pnpm test`: 30 files, 117 passed, 2 skipped on runtime implementation source. The skips are legitimate platform guards: POSIX-only symlink redirection on Windows and native Windows SIGINT simulation on Windows; both execute on their supported CI platforms.
- Desktop five-case parity: PASS for healthy READY, build failure NOT_READY, runtime failure NOT_READY, browser failure NOT_READY and external dependency INCOMPLETE.
- Local packaged Windows application E2E: PASS for installed launch without Node/pnpm/Corepack, real verification, reports/AI handoff, themes/accessibility semantics, Cancel, close-during-run cleanup and silent uninstall. Hosted CI is the authoritative final-source installer evidence.

## Final real-world corpus

`docs/REAL_WORLD_VALIDATION.md` records the 2026-09-28 rerun using runtime implementation source `a3524f56c69982ead3b0901aeed638c3ac9171dd`; the final branch head adds documentation only. The same ten repositories and approved refreshed pins produced 11 target runs because `fastapi-microservices` has root and `users/` targets. Windows 11 / Node 24.19.0 / bundled Python 3.12.14 was used with compatible pinned pnpm versions. Results: 3 READY, 1 NOT_READY, 6 INCOMPLETE; no confirmed false blocker. Historical six unreachable SHAs and the prior `2357e45` table remain separate.

| Target | Result | Important evidence boundary |
| --- | --- | --- |
| Next.js-Boilerplate | INCOMPLETE 71 | PostgreSQL unavailable during build; browser not reached |
| taxonomy | INCOMPLETE 79 | Required project environment values absent; browser not reached |
| leerob/site | READY 94 | Playwright verified; two analytics warnings |
| vitesse-lite | READY 100 | Build/start/Playwright verified |
| vite-plugin-inspect | NOT_READY 75 | Upstream Windows `ERR_UNSUPPORTED_ESM_URL_SCHEME` build failure |
| node-express-realworld-example-app | READY 100 | API route verified; browser correctly skipped |
| hackathon-starter | INCOMPLETE 75 | Process alive but port 8080 never became ready in 60s; cause unresolved |
| fastapi-realworld-example-app | INCOMPLETE 43 | Poetry detected but no verified Poetry install environment in this milestone |
| fastapi-microservices root | INCOMPLETE 56 | No runnable root target; no runtime evidence |
| fastapi-microservices `users/` | INCOMPLETE 80 | Pinned `uvloop` cannot install on Windows |
| todomvc root | INCOMPLETE 83 | Root has no supported runnable target; nested README commands are not root proof |

## Acceptance requirement groups

| Group / IDs | Status on implementation source | Evidence / boundary |
| --- | --- | --- |
| `PROD-*`, `CORE-*`, `DETECT-*`, `RUNTIME-*` | DONE | Core regression suite, clean-room process/browser tests, package-manager policy tests and exact-source authoritative benchmark pass; external/toolchain uncertainty remains explicitly INCOMPLETE. |
| `CLI-*`, `REPORT-*`, `ACTION-001` | DONE | Compiled CLI E2E, exit/config/flag tests, schema and manifest/tamper tests, Action E2E and tarball E2E pass. |
| `SEC-*` | DONE | Minimal host environment, redaction, path/artifact boundaries, Electron IPC/security tests and cleanup regressions pass. This is defensive product isolation, not an OS security sandbox. |
| `DESKTOP-PARITY-001`, `DESKTOP-IPC-001`, `DESKTOP-SELECT-001`, `DESKTOP-VERIFY-001`, `DESKTOP-PROGRESS-001`, `DESKTOP-RESULT-001`, `DESKTOP-LIFE-001`, `DESKTOP-WORKER-001` | DONE | Typed worker protocol, five-case parity, packaged install/verify, Cancel, close, worker crash and exact-head installer E2E pass. |
| `DESKTOP-FINDING-*`, `DESKTOP-EVIDENCE-*`, `DESKTOP-LOGS-*`, `DESKTOP-DOCTOR-*`, `DESKTOP-SETTINGS-*`, `DESIGN-A11Y-001` | DONE for defined automated acceptance | Finding/evidence/log/Doctor/settings flows, theme persistence, keyboard/focus semantics and sampled WCAG contrast pass. Manual screen-reader certification remains a documented limitation, not a hidden claim. |
| `PKG-WIN-001`, `PKG-CLI-001` | DONE | Exact-head installer and CLI tarball E2E pass; development artifacts are checksum-identified. |
| `TEST-*`, `BENCH-*`, `CI-*` | DONE | Local build/lint/tests plus all nine exact-head CI jobs and authoritative benchmark gates pass. |
| `TEST-REALWORLD-001` | DONE | Ten pinned repositories / 11 targets rerun on the implementation source with exact pins, toolchains, dates, outcomes and limitations. |
| `RELEASE-PROV-001` | DONE for development gate | `v0.1.0` and its asset are unchanged; no merge/release/npm publish occurred; dev installer provenance is recorded. Stage C review is still required before release. |

## Explicit limitations

- Verification covers the selected target and discovered/configured critical routes; it cannot prove every business workflow or every external integration.
- The clean verification workspace is not a security sandbox. An optional OS/container isolation mode is future scope.
- Browser-unavailable and unsupported toolchain cases are capability limitations, not browser/application PASS claims.
- The current branch is a development milestone. Stage C independent review must inspect and correct it before any merge or public release.

## Status rules

- **DONE** — implementation and required evidence exist on the named implementation source.
- **IN PROGRESS** — work exists but a named acceptance gate is missing.
- **BLOCKED** — a specific external dependency prevents a named gate; continue unrelated work.
- **NOT APPLICABLE** — explicitly allowed by the owning specification and supported by evidence.

Do not merge PR #1, move `v0.1.0`, publish npm, or create a GitHub Release during Stage B.
