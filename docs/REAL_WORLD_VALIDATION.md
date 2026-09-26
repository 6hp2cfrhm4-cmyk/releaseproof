# Real-World Open Source Repository Validation

> **Revalidation date:** 2026-09-23
> **ReleaseProof under test:** unreleased `0.2.0-dev.0` core-hardening checkout on Windows
> **Method:** clean-room verification of ten public repositories at the exact SHAs below; no upstream changes.

Four original v0.1.0 corpus SHAs remained fetchable. Six original SHAs returned
`upload-pack: not our ref`; with the owner's approval, those six repositories were
re-pinned to their reachable upstream HEADs on the revalidation date. The new pins
are different snapshots, so their results are **not** direct verdict comparisons
with the historical v0.1.0 runs.

## Revalidated corpus

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

Final corpus totals: **3 READY, 1 NOT_READY, 6 INCOMPLETE**. No confirmed false blocker
remains in these ten final runs. The upstream Windows build failure in
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
