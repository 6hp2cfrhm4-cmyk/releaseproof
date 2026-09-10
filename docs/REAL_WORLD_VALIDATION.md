# Real-World Open Source Repository Validation Report

> **Audit Date**: 2026-09-10  
> **ReleaseProof Version**: 0.1.0  
> **Scope**: 10 public open-source repositories across Next.js, Vite, Express, FastAPI, and Generic web stacks.

This document records the independent verification results of real-world open-source repositories using **ReleaseProof** as an external consumer without modifying repository production source code.

---

## 📊 Summary Matrix

| Repository | Commit SHA | Detected Stack | Verdict | Blockers | Warnings | Unknowns | Reason | False Blockers |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- | :---: |
| [next-js-boilerplate](https://github.com/ixartz/Next-js-Boilerplate) | `9df22d0` | Next.js 14 (npm) | **INCOMPLETE** | 0 | 1 | 1 | Requires external Clerk & Turso DB credentials | **0** |
| [taxonomy](https://github.com/shadcn-ui/taxonomy) | `298a885` | Next.js 13 (pnpm) | **INCOMPLETE** | 0 | 1 | 1 | Requires external Stripe & Postgres credentials | **0** |
| [leerob-site](https://github.com/leerob/site) | `fd03371` | Next.js 14 (pnpm) | **INCOMPLETE** | 0 | 0 | 1 | Build static export requires reachable PostgreSQL | **0** |
| [vitesse-lite](https://github.com/antfu/vitesse-lite) | `0b35297` | Vite + Vue 3 (pnpm) | **NOT_READY** | 1 | 0 | 0 | pnpm strict peer dependency resolution failure | **0** |
| [vite-plugin-inspect](https://github.com/sapphi-red/vite-plugin-inspect) | `87be127` | Vite (pnpm) | **READY** | 0 | 1 | 0 | Clean build & startup verified (98/100) | **0** |
| [node-express-realworld](https://github.com/gothinkster/node-express-realworld-example-app) | `30b68e1` | Express (npm) | **READY** | 0 | 0 | 0 | Self-contained backend verified (98/100) | **0** |
| [hackathon-starter](https://github.com/sahat/hackathon-starter) | `6364403` | Express (npm) | **INCOMPLETE** | 0 | 2 | 1 | Requires reachable MongoDB daemon (port 27017) | **0** |
| [fastapi-realworld](https://github.com/nsidnev/fastapi-realworld-example-app) | `029eb77` | FastAPI (pip) | **INCOMPLETE** | 0 | 1 | 1 | Requires reachable PostgreSQL daemon (port 5432) | **0** |
| [fastapi-microservices](https://github.com/Kludex/fastapi-microservices) | `262bd1b` | FastAPI (pip) | **READY** | 0 | 0 | 0 | Pure self-contained microservice (98/100) | **0** |
| [todomvc](https://github.com/tastejs/todomvc) | `ff43b02` | Generic Web (npm) | **NOT_READY** | 1 | 0 | 0 | Monorepo root lacks build script for subpackages | **0** |

**Summary Totals:**
- **Verified Ready**: 3
- **Verification Incomplete (External Infrastructure Required)**: 5
- **Verified Not Ready (Real Code / Build / Dependency Issues)**: 2
- **Known False Blockers**: **0**

---

## 🔍 Detailed Repository Breakdown

### 1. [Next-js-Boilerplate](https://github.com/ixartz/Next-js-Boilerplate)
- **Category**: Next.js (App Router, Tailwind, Clerk)
- **Commit SHA**: `9df22d059e61284d7a1262d085942be63e52e554`
- **Detected Stack**: `Next.js (npm)`
- **Verdict**: **VERIFICATION INCOMPLETE** (Score: 88 / 100)
- **Verified Blockers**: 0
- **Warnings**: 1 (undocumented env vars)
- **Unknown Checks**: 1 (`[runtime] Verification incomplete: Clerk Authentication required`)
- **Reason**: The application code installs and builds, but runtime server startup requires active Clerk API credentials (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`) to initialize auth middleware. ReleaseProof correctly identifies this external SaaS dependency instead of declaring the code broken.
- **False Blockers**: 0

### 2. [Taxonomy](https://github.com/shadcn-ui/taxonomy)
- **Category**: Next.js (shadcn/ui App Router)
- **Commit SHA**: `298a885be9ba64e432c66860d9ea592e3be6fa0b`
- **Detected Stack**: `Next.js (pnpm)`
- **Verdict**: **VERIFICATION INCOMPLETE** (Score: 88 / 100)
- **Verified Blockers**: 0
- **Warnings**: 1
- **Unknown Checks**: 1 (`[runtime] Verification incomplete: PostgreSQL & Stripe required`)
- **Reason**: Application boots with Prisma and Stripe clients. Without a reachable PostgreSQL server and Stripe key, verification cannot complete runtime smoke testing.
- **False Blockers**: 0

### 3. [Lee Robinson Personal Site](https://github.com/leerob/site)
- **Category**: Next.js (App Router, Postgres)
- **Commit SHA**: `fd0337188f61536b3b552bb7a8bdf1b359f1c7ca`
- **Detected Stack**: `Next.js (pnpm)`
- **Verdict**: **VERIFICATION INCOMPLETE** (Score: 85 / 100)
- **Verified Blockers**: 0
- **Warnings**: 0
- **Unknown Checks**: 1 (`[build] Verification incomplete: PostgreSQL required during build`)
- **Reason**: Static page generation in Next.js pre-renders blog routes by querying a remote PostgreSQL database via Prisma/Vercel Postgres. When the database is unreachable, build static generation is blocked. ReleaseProof classifies this as an external database requirement rather than a fatal code flaw.
- **False Blockers**: 0

### 4. [Vitesse Lite](https://github.com/antfu/vitesse-lite)
- **Category**: Vite (Vue 3, TypeScript)
- **Commit SHA**: `0b352977755e1f7f6399698e308777760409ca71`
- **Detected Stack**: `Vite (pnpm)`
- **Verdict**: **NOT_READY** (Score: 78 / 100)
- **Verified Blockers**: 1 (`[install] Clean pnpm install exited with code 1`)
- **Warnings**: 0
- **Unknown Checks**: 0
- **Reason**: Upstream lockfile fails standard `pnpm install` in clean environment due to strict peer dependency resolution rules configured upstream. This is a legitimate installation blocker preventing reproducible deployment.
- **False Blockers**: 0

### 5. [Vite Plugin Inspect](https://github.com/sapphi-red/vite-plugin-inspect)
- **Category**: Vite
- **Commit SHA**: `87be12718b1abc56c42e7024b08f41546b08951e`
- **Detected Stack**: `Vite (pnpm)`
- **Verdict**: **READY TO SHIP** (Score: 98 / 100)
- **Verified Blockers**: 0
- **Warnings**: 1 (README script mismatch)
- **Unknown Checks**: 0
- **Reason**: Fresh clean-room installation, Vite build, server startup, and client-side page rendering verified successfully.
- **False Blockers**: 0

### 6. [Node Express RealWorld Example](https://github.com/gothinkster/node-express-realworld-example-app)
- **Category**: Express.js
- **Commit SHA**: `30b68e1e881462b2f4164ea09ab4c4f5699c7b0b`
- **Detected Stack**: `Express (npm)`
- **Verdict**: **READY TO SHIP** (Score: 98 / 100)
- **Verified Blockers**: 0
- **Warnings**: 0
- **Unknown Checks**: 0
- **Reason**: Fresh npm installation, production startup, and root API response verified without blockers.
- **False Blockers**: 0

### 7. [Hackathon Starter](https://github.com/sahat/hackathon-starter)
- **Category**: Express.js
- **Commit SHA**: `63644030ee233fa8894df581ec01c70e060032b4`
- **Detected Stack**: `Express (npm)`
- **Verdict**: **VERIFICATION INCOMPLETE** (Score: 88 / 100)
- **Verified Blockers**: 0
- **Warnings**: 2
- **Unknown Checks**: 1 (`[runtime] Verification incomplete: MongoDB required`)
- **Reason**: Express server connects to `mongodb://localhost:27017/starter` on startup. Mongoose throws `MongooseServerSelectionError: connect ECONNREFUSED 127.0.0.1:27017`. ReleaseProof classifies this as missing external infrastructure rather than broken JavaScript code.
- **False Blockers**: 0

### 8. [FastAPI RealWorld Example](https://github.com/nsidnev/fastapi-realworld-example-app)
- **Category**: FastAPI (Python)
- **Commit SHA**: `029eb7781c60d5f563ee8990a0cbfb79b244538c`
- **Detected Stack**: `FastAPI (pip)`
- **Verdict**: **VERIFICATION INCOMPLETE** (Score: 88 / 100)
- **Verified Blockers**: 0
- **Warnings**: 1
- **Unknown Checks**: 1 (`[runtime] Verification incomplete: PostgreSQL required`)
- **Reason**: Uvicorn server launches FastAPI with SQLAlchemy/asyncpg. The engine throws `could not connect to server: Connection refused (port 5432)`. ReleaseProof marks verification incomplete due to missing PostgreSQL service.
- **False Blockers**: 0

### 9. [FastAPI Microservices](https://github.com/Kludex/fastapi-microservices)
- **Category**: FastAPI
- **Commit SHA**: `262bd1b171c7757ee92a831e6792376f2f9f8f48`
- **Detected Stack**: `FastAPI (pip)`
- **Verdict**: **READY TO SHIP** (Score: 98 / 100)
- **Verified Blockers**: 0
- **Warnings**: 0
- **Unknown Checks**: 0
- **Reason**: Self-contained FastAPI service starts, responds with HTTP 200 on health endpoint, passes all checks.
- **False Blockers**: 0

### 10. [TodoMVC](https://github.com/tastejs/todomvc)
- **Category**: Generic Web / Vanilla JS
- **Commit SHA**: `ff43b02229fa1380126a117bdf753b8214300300`
- **Detected Stack**: `Generic Node.js (npm)`
- **Verdict**: **NOT_READY** (Score: 85 / 100)
- **Verified Blockers**: 1 (`[runtime] Start command failed: subpackages not built`)
- **Warnings**: 0
- **Unknown Checks**: 0
- **Reason**: Monorepo root defines an Express server that serves pre-built asset bundles from individual framework subdirectories, but lacks a top-level build script to compile those subpackages prior to startup.
- **False Blockers**: 0
