# Real-World Open Source Repository Validation

> **Revalidation date:** 2026-09-28
> **ReleaseProof under test:** unreleased `0.2.0-dev.0`, source `a3524f56c69982ead3b0901aeed638c3ac9171dd`
> **Environment:** Windows 11 Home 10.0.26200 x64, Node v24.19.0, bundled CPython 3.12.14. Compatible managers were used where required by the lockfile: pnpm 8.15.9 (taxonomy), pnpm 9.15.9 (leerob/site), pnpm 10.7.1 (vite-plugin-inspect), pnpm 12.3.4 (vitesse-lite); npm for npm-lockfile projects.
> **Method:** clean-workspace verification of ten public repositories at exact pinned SHAs; no upstream changes. Reports were inspected for target, capability, checks and evidence. These outcomes are environment-scoped, not universal claims.

The six unreachable historical pins were not silently substituted. The owner's decision authorized fresh pins for those same six repositories; the original hashes and their older outcomes remain in the historical sections below. The four still-available original pins were rerun unchanged.

## Final-SHA rerun — 2026-09-28, ReleaseProof `a3524f56`

| Repository | Pin | Exact SHA | Target / toolchain | Result | Evidence and limitation |
| --- | --- | --- | --- | --- | --- |
| [Next.js-Boilerplate](https://github.com/ixartz/Next-js-Boilerplate) | refreshed | `9df22d0980702729da01c4465b9fb8ca292d6cce` | root; Next.js, npm lockfile | **INCOMPLETE 71** | Install passed; build reported required reachable PostgreSQL at port 5432 unavailable. 0 blockers, 1 unknown, 1 warning; browser unavailable because prerequisite build did not complete. |
| [taxonomy](https://github.com/shadcn-ui/taxonomy) | refreshed | `298a8857c7128a0d121e7f699dfd729f23b3966d` | root; Next.js, pnpm 8.15.9 for v6 lockfile | **INCOMPLETE 79** | Frozen install passed; build could not run without required project environment values. 0 blockers, 1 unknown; browser unavailable after build prerequisite. |
| [leerob/site](https://github.com/leerob/site) | refreshed | `fd03371e3c90481a8447904e1b548e4c0327b7db` | root; Next.js, pnpm 9.15.9 | **READY 94** | Build/start/runtime and Playwright browser verification passed; 0 blockers, 2 nonblocking warnings (analytics-related). |
| [vitesse-lite](https://github.com/antfu/vitesse-lite) | original | `0b352977755e1f7f6399698e308777760409ca71` | root; Vite, pnpm 12.3.4 | **READY 100** | Build, startup and Playwright browser verification passed; no blockers/warnings/unknowns. |
| [vite-plugin-inspect](https://github.com/sapphi-red/vite-plugin-inspect) | original | `87be12718b1abc56c42e7024b08f41546b08951e` | root; Vite, pnpm 10.7.1 | **NOT_READY 75** | Clean install passed; build failed in upstream Node ESM loading on Windows with `ERR_UNSUPPORTED_ESM_URL_SCHEME` for a `c:` URL. One evidenced blocker; browser could not run after build failure. |
| [node-express-realworld-example-app](https://github.com/gothinkster/node-express-realworld-example-app) | original | `30b68e1e881462b2f4164ea09ab4c4f5699c7b0b` | root; Express/API, npm lockfile | **READY 100** | Install/build/start and API route evidence passed. Browser correctly SKIPPED for API-only target. |
| [hackathon-starter](https://github.com/sahat/hackathon-starter) | refreshed | `410fccec23f6d4b509397b408ba7745f0f469027` | root; Express, npm lockfile | **INCOMPLETE 75** | Process remained alive, but source-declared port 8080 did not become ready within 60s. Evidence cannot distinguish slow startup, external dependency or misconfiguration. 0 blockers, 1 unknown; browser skipped. |
| [fastapi-realworld-example-app](https://github.com/nsidnev/fastapi-realworld-example-app) | original | `029eb7781c60d5f563ee8990a0cbfb79b244538c` | root; FastAPI, Poetry lock; Python 3.12.14 | **INCOMPLETE 43** | Poetry was detected but this milestone has no verified Poetry install environment. 0 blockers, 1 unknown, 1 warning; dependent startup not attempted, browser skipped. |
| [fastapi-microservices](https://github.com/Kludex/fastapi-microservices) | refreshed | `262bd1b7a97d6a6375067abac778bb8d75bb5edc` | root and `users/`; Python 3.12.14 | **INCOMPLETE 56 root; INCOMPLETE 80 users/** | Root has no runnable target, so no runtime proof. `users/` install identifies pinned `uvloop==0.15.2` as unsupported on Windows. Both are 0 blockers/1 unknown; browser skipped/not applicable. |
| [todomvc](https://github.com/tastejs/todomvc) | refreshed | `ff43b02e59dfa604386bb382034b2cd07c2bcd8a` | repository root; Express dependencies, npm lockfile | **INCOMPLETE 83** | Root has no supported build/start target; README commands scoped to nested `examples/react` do not prove root runtime. 0 blockers, 1 unknown; browser skipped. |

Totals across the ten repositories: **3 READY, 1 NOT_READY, 6 INCOMPLETE** (the FastAPI microservices root and `users/` are two targets within one repository; there are 11 target runs). No confirmed false blocker was observed. `hackathon-starter` remains unresolved and correctly incomplete; the `vite-plugin-inspect` build failure is supported by Windows build evidence. Reports were inspected from the ignored `.temp/realworld-a3524f56` clean checkouts and are not committed because they contain machine-specific paths/logs; the table records bounded, redacted conclusions. pnpm was pinned to 8.15.9 (taxonomy), 9.15.9 (leerob/site), 10.7.1 (vite-plugin-inspect) and 12.3.4 (vitesse-lite); the final Vitesse rerun verified that manager and reported READY. This corpus is diagnostic Windows evidence, not a universal outcome guarantee.

## Previous ReleaseProof source `2357e45` — historical snapshot from 2026-09-27

This is the prior table retained verbatim in outcome meaning before the `a3524f56` rerun. It used the same repository pins and environment. Do not combine its values with the current table or treat score changes as upstream changes.

| Repository | Exact SHA | Result on `2357e45` | Evidence boundary |
| --- | --- | --- | --- |
| Next.js-Boilerplate | `9df22d0980702729da01c4465b9fb8ca292d6cce` | INCOMPLETE 71 | PostgreSQL unavailable for build; 0 blockers, 1 unknown, 1 warning. |
| taxonomy | `298a8857c7128a0d121e7f699dfd729f23b3966d` | INCOMPLETE 79 | Required project env absent; 0 blockers, 1 unknown. |
| leerob/site | `fd03371e3c90481a8447904e1b548e4c0327b7db` | READY 94 | Browser verified; two nonblocking analytics warnings. |
| vitesse-lite | `0b352977755e1f7f6399698e308777760409ca71` | READY 100 | Browser verified. |
| vite-plugin-inspect | `87be12718b1abc56c42e7024b08f41546b08951e` | NOT_READY 75 | Upstream Windows `ERR_UNSUPPORTED_ESM_URL_SCHEME` build failure. |
| node-express-realworld-example-app | `30b68e1e881462b2f4164ea09ab4c4f5699c7b0b` | READY 100 | API route passed; browser skipped for API-only target. |
| hackathon-starter | `410fccec23f6d4b509397b408ba7745f0f469027` | INCOMPLETE 75 | Port 8080 not ready within 60s; cause unresolved. |
| fastapi-realworld-example-app | `029eb7781c60d5f563ee8990a0cbfb79b244538c` | INCOMPLETE 72 | Old asyncpg required unavailable MSVC. |
| fastapi-microservices root / `users/` | `262bd1b7a97d6a6375067abac778bb8d75bb5edc` | INCOMPLETE 56 / 80 | No runnable root; `users/` pins Windows-incompatible uvloop. |
| todomvc | `ff43b02e59dfa604386bb382034b2cd07c2bcd8a` | INCOMPLETE 83 | Root has no runnable target; README `cd` instructions belong to nested examples. |

Totals were 3 READY, 1 NOT_READY and 6 repositories INCOMPLETE (7 target runs). The refreshed SHAs and six unavailable historical SHAs remain separately recorded below.

## Prior run — 2026-09-23 (historical; different ReleaseProof SHA)

Four original v0.1.0 corpus SHAs remained fetchable. Six original SHAs returned
`upload-pack: not our ref`; with the owner's approval, those six repositories were
re-pinned to their reachable upstream HEADs on the revalidation date. The new pins
are different snapshots, so their results are **not** direct verdict comparisons
with the historical v0.1.0 runs.

## Prior corpus observations

| Repository | Pin | Exact SHA | Result | Evidence summary |
| --- | --- | --- | --- | --- |
| [Next-js-boilerplate](https://github.com/ixartz/Next-js-Boilerplate) | refreshed | `9df22d0980702729da01c4465b9fb8ca292d6cce` | **INCOMPLETE** (83; 0 blockers, 1 unknown) | Clean npm install passed. Drizzle build requires a Postgres URL excluded from the clean workspace. Populated sensitive env names receive a warning, not a credential-leak blocker without recognized secret evidence. |
| [taxonomy](https://github.com/shadcn-ui/taxonomy) | refreshed | `298a8857c7128a0d121e7f699dfd729f23b3966d` | **INCOMPLETE** (90; 0 blockers, 1 unknown) | pnpm 8.15.9 was used for the committed v6 lockfile. Build requires multiple user-supplied environment values. pnpm 12 cannot read that lockfile and correctly reports verification unavailable. |
| [leerob/site](https://github.com/leerob/site) | refreshed | `fd03371e3c90481a8447904e1b548e4c0327b7db` | **READY** (92; 0 blockers, 2 warnings) | pnpm 9.15.9 installed the v9 lockfile; production build, startup, and browser verification passed. Four noncritical Vercel analytics 404s and console errors were warnings. pnpm 12 policy blocked dependency build scripts in the default environment. |
| [vitesse-lite](https://github.com/antfu/vitesse-lite) | original | `0b352977755e1f7f6399698e308777760409ca71` | **READY** (100; 0 blockers) | Clean install, production build, Vite preview startup, and Playwright verification passed. |
| [vite-plugin-inspect](https://github.com/sapphi-red/vite-plugin-inspect) | original | `87be12718b1abc56c42e7024b08f41546b08951e` | **NOT_READY** (75; 1 blocker) | Clean install passed. The pinned Windows build failed inside upstream Vite/Node ESM loading with `ERR_UNSUPPORTED_ESM_URL_SCHEME` (`c:` URL). |
| [node-express-realworld](https://github.com/gothinkster/node-express-realworld-example-app) | original | `30b68e1e881462b2f4164ea09ab4c4f5699c7b0b` | **READY** (100; 0 blockers) | Clean npm install, build, startup stability, API route, and documentation checks passed; browser was correctly `SKIPPED` for API-only app. An earlier npm registry timeout produced `INCOMPLETE`; the retry completed. |
| [hackathon-starter](https://github.com/sahat/hackathon-starter) | refreshed | `14229eff8f9b892038ed30d0a338312f3b9d60d2` | **INCOMPLETE** (75; 0 blockers, 1 unknown) | Clean install/start used source-declared default port 8080. A live process stopped answering HTTP during the stability window; available logs did not establish whether MongoDB or application code caused the timeout. The run used a 60-second startup budget to allow Sass compilation. |
| [fastapi-realworld](https://github.com/nsidnev/fastapi-realworld-example-app) | original | `029eb7781c60d5f563ee8990a0cbfb79b244538c` | **INCOMPLETE** (72; 0 blockers, 1 unknown) | Isolated Python setup passed, but old `asyncpg` wheel building required unavailable MSVC. Dependent startup was not attempted. |
| [fastapi-microservices](https://github.com/Kludex/fastapi-microservices) | refreshed | `262bd1b7a97d6a6375067abac778bb8d75bb5edc` | **INCOMPLETE** (root 78; `users/` 80) | Repository root has no runnable manifest, so static checks cannot claim READY. Nested `users/` service could not install pinned `uvloop` on Windows; both targets have 0 blockers and 1 unknown. |
| [todomvc](https://github.com/tastejs/todomvc) | refreshed | `ff43b02e59dfa604386bb382034b2cd07c2bcd8a` | **INCOMPLETE** (83; 0 blockers, 1 unknown) | Root has no build/start command, so no runtime evidence exists. README commands belong to `examples/react` after `cd`; they are no longer treated as missing root scripts. Individual examples need separate verification. |

Prior-run totals: **3 READY, 1 NOT_READY, 6 INCOMPLETE**. The upstream Windows build failure in
`vite-plugin-inspect` is a verified build blocker. `hackathon-starter` remains an
unresolved runtime cause, accurately reported as incomplete.

## Historical pins no longer reachable upstream

These six exact SHAs remain part of the old report but could not be fetched from
their current upstream remotes. They were not silently replaced or treated as
current evidence:

- `next-js-boilerplate` — `9df22d059e61284d7a1262d085942be63e52e554`
- `taxonomy` — `298a885be9ba64e432c66860d9ea592e3be6fa0b`
- `leerob-site` — `fd0337188f61536b3b552bb7a8bdf1b359f1c7ca`
- `hackathon-starter` — `63644030ee233fa8894df581ec01c70e060032b4`
- `fastapi-microservices` — `262bd1b171c7757ee92a831e6792376f2f9f8f48`
- `todomvc` — `ff43b02229fa1380126a117bdf753b8214300300`

## Reproduction notes

Build the local CLI and verify a checkout at its recorded SHA:

```powershell
pnpm run build
node apps/cli/dist/index.js verify <checkout> --timeout 10000 --json
```

Use pnpm 8.15.9 for the old taxonomy lockfile and pnpm 9.15.9 for leerob/site.
For the two FastAPI projects, pass a usable absolute Python interpreter with
`--python-interpreter`. The local Windows run used bundled Python 3.12.

Generated `.releaseproof` directories and temporary cloned checkouts are disposable
verification artifacts. Their contents are not committed to this repository.
