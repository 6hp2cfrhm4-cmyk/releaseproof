# Product vision and milestone boundary

## Promise

> Your AI says it's done. ReleaseProof checks if it actually ships.

Vibe code. Verify before you ship. ReleaseProof gives developers a repeatable, local-first answer to a narrow but valuable question: does this selected application install, build, start, answer relevant routes, and render in a browser where applicable under a clean production-like run? It does not replace product tests, security review, deployment smoke tests, or human release approval. A user must understand both what was checked and what could not be checked.

## Audiences and jobs

Vibe coders using Codex, Claude Code, Cursor, Antigravity or Windsurf need a plain-language finding and a safe AI handoff. Traditional developers need precise evidence and reruns. Maintainers need reproducible issue reports. CI owners need stable JSON, exit codes and a reusable Action. Desktop users must succeed without knowing terminal commands; CLI users must never be forced through GUI or cloud.

## Non-negotiable principles

- **PROD-EVIDENCE-001 · P0:** No READY or NOT_READY solely from confidence, framework names, or a successful static scan. The verdict must trace to check outcomes and capabilities.
- **PROD-UNCERTAINTY-001 · P0:** Inability to verify is `VERIFICATION INCOMPLETE`, not a fabricated pass or application blocker. A verified application failure is NOT READY even if other checks are unavailable.
- **PROD-SHARED-001 · P0:** CLI and Desktop call the same Core and share config, report schema, score and verdict. UI-specific code may present the report, not reinterpret it.
- **PROD-LOCAL-001 · P0:** No required account, cloud, telemetry or embedded AI. Network may be used by project dependency installation, a tested application, and optional explicit update checks, never covert ReleaseProof analytics.
- **PROD-SCOPE-001 · P1:** Every result names selected target, commit/source identity when available, platform/toolchain, route coverage and verification limitations. READY is scoped, not a universal shipping guarantee.

## Intended experience

Desktop: choose or drop a project folder → inspect detected targets/runtime requirements → select one target if ambiguous → Verify Project → visible step progress → READY TO SHIP / NOT READY TO SHIP / VERIFICATION INCOMPLETE → findings and evidence → Copy for AI or open fix file → fix outside ReleaseProof → Verify Again. CLI offers the same engine from a terminal and automation. Detailed Desktop behavior is owned by [07](07_DESKTOP_PRODUCT_SPEC.md); command contracts by [06](06_CLI_SPEC.md).

## Milestone scope

Required: Core correctness, deterministic report schema, CLI, GitHub Action, Electron/React/TypeScript/Vite Desktop, Windows NSIS-style setup executable, Start Menu/uninstall, tests and cross-platform CI, authoritative synthetic benchmark, pinned real-world corpus. Desktop must launch without separately installing Node or pnpm; verification of a user project may require its own Node/Python/package manager/browser toolchain, clearly explained by Doctor.

Not in this milestone: SaaS backend, accounts, billing, AI chat or embedded LLM, automatic code changes, team dashboard, telemetry, marketplace, authenticated business-flow automation, universal framework detection, OS/container security isolation, macOS DMG and Linux AppImage (possible later smoke/distribution work). Do not change README's Windows download call-to-action until a real reviewed release exists.

## Product outcome hierarchy

Correct verdict > complete evidence > actionable presentation > polish. A polished GUI showing misleading READY is a product failure. A verifier that always says INCOMPLETE is also a product failure; it must perform practical checks and distinguish ordinary supported projects from genuinely unavailable capabilities. See [04](04_CORE_VERIFIER_SPEC.md) and [19](19_RISKS_AND_LIMITATIONS.md).
