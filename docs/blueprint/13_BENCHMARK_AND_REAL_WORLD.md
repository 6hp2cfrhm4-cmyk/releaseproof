# Benchmark and pinned real-world validation

## Synthetic benchmark contract

**BENCH-AUTH-001 · P0:** FAST mode favors iteration (shorter windows, may bypass clean copy) and is explicitly nonauthoritative. AUTHORITATIVE runs the real default clean workspace, lockfile-enforcing install, production build/start, HTTP/browser where required and normal stability/observation windows. Every fixture has required `expectedVerdict`; optional expected blocker category/check ID, blocker/warning bounds, expected capability, route/status assertions. Missing/malformed expectation is an execution error, never implicit READY. Run code cannot special-case fixture names.

**BENCH-METRIC-001 · P0:** TP = broken fixture correctly NOT_READY; FN = broken fixture not NOT_READY; FP = healthy/environment-limited fixture incorrectly NOT_READY; TN = healthy/environment-limited fixture not falsely blocked. This binary matrix is **insufficient alone**: every fixture must also match exact READY vs INCOMPLETE expectation, category, declared bounds and capabilities. A benchmark fails on FP>0, FN>0, any expectation mismatch or any execution error. Do not call precision/recall 100% when denominator is zero; report `N/A`. Print mode, source SHA, platform/toolchain, fixture count, TP/TN/FP/FN, mismatches, errors and external cases. Keep all failures visible rather than exiting after first one.

Prior CI at `c371dea` reported 42 fixtures/TP13/TN29/FP0/FN0/external6; this does **not** certify the current dirty worktree or Desktop milestone. The implementation agent reruns authoritative on final commit, with at least Ubuntu Node 20 as required job and Windows authoritative recommended/required if platform-specific paths changed. FAST smoke runs across all six OS/Node cells.

## Real-world corpus method

**TEST-REALWORLD-001 · P1:** For each target record repo URL, exact 40-char SHA, pin type (`original`/`refreshed`), date, OS/arch, Node/Python/package-manager versions, selected target, commands/lockfile, verdict, blockers/warnings/unknowns, browser mode, limitations and link to redacted report evidence. Clone read-only; do not mutate upstream. Use clean copy and exact pinned checkout. Retry environmental network timeouts once with same SHA/config and report both attempts. Do not change an expected verdict to hide a false blocker; review evidence, classify root cause and add synthetic regression first. Historical pins remain historical and are never silently equated with refreshed HEADs.

## Current working-tree corpus record (pending final rerun)

These entries are from the uncommitted `docs/REAL_WORLD_VALIDATION.md` dated 2026-09-23, **not** a green CI corpus gate:

| Repo | SHA / pin | Working-tree Windows observation | Caveat |
| --- | --- | --- | --- |
| ixartz/Next-js-Boilerplate | `9df22d0980702729da01c4465b9fb8ca292d6cce` refreshed | INCOMPLETE | Drizzle Postgres URL absent at build |
| shadcn-ui/taxonomy | `298a8857c7128a0d121e7f699dfd729f23b3966d` refreshed | INCOMPLETE | pnpm 8 for v6 lockfile; required env missing |
| leerob/site | `fd03371e3c90481a8447904e1b548e4c0327b7db` refreshed | READY 92 | pnpm 9; noncritical analytics warnings |
| antfu/vitesse-lite | `0b352977755e1f7f6399698e308777760409ca71` original | READY 100 | Playwright VERIFIED |
| sapphi-red/vite-plugin-inspect | `87be12718b1abc56c42e7024b08f41546b08951e` original | NOT_READY | upstream Windows ESM build error |
| gothinkster/node-express-realworld-example-app | `30b68e1e881462b2f4164ea09ab4c4f5699c7b0b` original | READY 100 | first registry timeout, retry passed; API-only browser SKIPPED |
| sahat/hackathon-starter | `14229eff8f9b892038ed30d0a338312f3b9d60d2` refreshed | INCOMPLETE | live server delayed HTTP timeout unresolved |
| nsidnev/fastapi-realworld-example-app | `029eb7781c60d5f563ee8990a0cbfb79b244538c` original | INCOMPLETE | old asyncpg needs absent MSVC |
| Kludex/fastapi-microservices | `262bd1b7a97d6a6375067abac778bb8d75bb5edc` refreshed | INCOMPLETE root and `users/` | no runnable root; pinned uvloop unsupported on Windows |
| tastejs/todomvc | `ff43b02e59dfa604386bb382034b2cd07c2bcd8a` refreshed | INCOMPLETE root | nested `examples/react` is separate target |

Historical unreachable six SHA values remain in `docs/REAL_WORLD_VALIDATION.md`. The refreshed six were explicitly approved by the owner. This corpus is **diagnostic**, not a promise of 100% READY: 3 READY, 1 NOT_READY, 6 INCOMPLETE was honest for the recorded environment. A genuinely unverified external dependency or unsupported Windows package should stay INCOMPLETE, not be benchmark-gamed into READY. Cross-platform reruns may legitimately differ; record platform and reason.

## Release gate

Authoritative synthetic benchmark on exact final source: FP=0, FN=0, zero mismatches/errors, required capability expectations match. Real-world: all ten pinned cases rerun or explicitly marked NOT VERIFIED with exact environment blocker; no confirmed false blocker remains unexplained. A corpus target that cannot be fetched later retains its last observation as historical only; never replace it without a new dated pin and review.
