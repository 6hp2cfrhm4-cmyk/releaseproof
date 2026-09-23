# Real-World Open Source Repository Validation

> **Revalidation date:** 2026-09-21
> **ReleaseProof under test:** `0.2.0-dev.0` (unreleased working tree)
> **Method:** read-only local verification of exact pinned commits; no upstream changes.

This document supersedes the historical v0.1.0 snapshot. Results below are evidence for
the reachable pins only. A historical result is not treated as current proof when its
exact commit can no longer be fetched.

## Current exact-pin revalidation

| Repository | Exact commit | Result | Evidence summary |
| --- | --- | --- | --- |
| [vitesse-lite](https://github.com/antfu/vitesse-lite) | `0b352977755e1f7f6399698e308777760409ca71` | **READY** (100, 0 blockers) | Vite/Vue clean install, production build, preview startup, and Playwright browser verification passed. |
| [vite-plugin-inspect](https://github.com/sapphi-red/vite-plugin-inspect) | `87be12718b1abc56c42e7024b08f41546b08951e` | **NOT_READY** (75, 1 blocker) | Clean pnpm install passed; pinned Windows build failed with Node ESM `ERR_UNSUPPORTED_ESM_URL_SCHEME` (`c:` URL) in upstream Vite build. |
| [node-express-realworld](https://github.com/gothinkster/node-express-realworld-example-app) | `30b68e1e881462b2f4164ea09ab4c4f5699c7b0b` | **READY** (100, 0 blockers) | Clean npm install, build, startup stability, API route, environment, documentation, and security checks passed; browser correctly `SKIPPED` for API-only project. |
| [fastapi-realworld](https://github.com/nsidnev/fastapi-realworld-example-app) | `029eb7781c60d5f563ee8990a0cbfb79b244538c` | **INCOMPLETE** (72, 0 blockers, 1 unknown) | Isolated Python setup succeeded, but old `asyncpg`/package wheel build requires unavailable MSVC; classified `VERIFICATION_UNAVAILABLE`; dependent startup was not attempted. |

### Interpretation

The current reachable corpus contains two verified READY projects, one genuine upstream
build failure, and one environment-limited verification. No false blocker was observed
in these four runs. The FastAPI case specifically exercises the distinction between an
application failure and an unavailable native build capability.

## Historical pins that are no longer reachable

The following exact SHAs from the original v0.1.0 report were re-requested from their
upstream remotes and returned `upload-pack: not our ref`. They are retained here for
traceability, but are **not** substituted with newer commits and are **not** presented as
current validation evidence:

- `next-js-boilerplate` — `9df22d059e61284d7a1262d085942be63e52e554`
- `taxonomy` — `298a885be9ba64e432c66860d9ea592e3be6fa0b`
- `leerob-site` — `fd0337188f61536b3b552bb7a8bdf1b359f1c7ca`
- `hackathon-starter` — `63644030ee233fa8894df581ec01c70e060032b4`
- `fastapi-microservices` — `262bd1b171c7757ee92a831e6792376f2f9f8f48`
- `todomvc` — `ff43b02229fa1380126a117bdf753b8214300300`

The old v0.1.0 outcomes remain historical context only. Revalidation of those projects
requires a user-supplied reachable mirror or an explicit new pinned commit; this audit
does not silently change scope.

## Reproduction

From the repository root, build the local CLI and run a reachable pin:

```powershell
pnpm run build
node apps/cli/dist/index.js verify <checkout> --timeout 10000 --json
```

For `fastapi-realworld`, use the bundled Python interpreter explicitly:

```powershell
node apps/cli/dist/index.js verify <checkout> --timeout 10000 `
  --python-interpreter C:\Users\alex\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe --json
```

Generated `.releaseproof` directories are disposable evidence artifacts and are not
part of the repository source.
