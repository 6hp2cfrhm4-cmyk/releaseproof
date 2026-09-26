# ReleaseProof implementation blueprint — read this first

This directory is the implementation contract for the next milestone: one evidence-driven Core, first-class CLI, Electron/React/TypeScript/Vite Desktop, a real Windows installer, reproducible CI and release artifacts. It is **not** a claim that the current checkout already satisfies that contract. The implementation agent must read **every file 00–20 before editing code**.

## Source-of-truth policy

1. This blueprint defines intended behavior. The checked-out source, tests and Git state define current behavior; [02_CURRENT_STATE](02_CURRENT_STATE.md) is a dated snapshot, not a permanent fact. Re-run its baseline commands before coding.
2. When a requirement conflicts with existing code, keep user-approved product principles and implement the requirement, adding regression evidence. Never quietly weaken a benchmark expectation to make it green.
3. `VERIFIED` means directly inspected or backed by a named run/SHA; `EXPECTED` is future contract; `NOT VERIFIED` means evidence is missing. Keep these labels in progress and final reporting.
4. Stable IDs identify cross-document requirements. P0 blocks milestone distribution, P1 is required for a trustworthy milestone, P2 is important but may be deferred explicitly, P3 is optional. A P2/P3 deferral must be documented; it must not be silently called done.
5. Historical `v0.1.0` tag/release/assets are immutable. Do not merge PR #1 or publish a release without the separate post-implementation review. No implementation work is authorized by this document-creation stage.

## Reading order and ownership

| File | Owns |
| --- | --- |
| [01_PRODUCT_VISION](01_PRODUCT_VISION.md) | promise, users, scope and principles |
| [02_CURRENT_STATE](02_CURRENT_STATE.md) | inspected baseline and evidence limits |
| [03_TARGET_ARCHITECTURE](03_TARGET_ARCHITECTURE.md) | component boundaries and lifecycle |
| [04_CORE_VERIFIER_SPEC](04_CORE_VERIFIER_SPEC.md) | verification semantics and verdict |
| [05_PROJECT_DETECTION_AND_RUNTIMES](05_PROJECT_DETECTION_AND_RUNTIMES.md) | target selection, Node and Python |
| [06_CLI_SPEC](06_CLI_SPEC.md) | command-line contract |
| [07_DESKTOP_PRODUCT_SPEC](07_DESKTOP_PRODUCT_SPEC.md) | screen-by-screen user contract |
| [08_DESKTOP_TECHNICAL_ARCHITECTURE](08_DESKTOP_TECHNICAL_ARCHITECTURE.md) | Electron/IPC/worker boundary |
| [09_DESIGN_SYSTEM](09_DESIGN_SYSTEM.md) | visual and accessibility rules |
| [10_SECURITY_PRIVACY](10_SECURITY_PRIVACY.md) | execution trust and redaction |
| [11_REPORTING_AND_AI_HANDOFF](11_REPORTING_AND_AI_HANDOFF.md) | versioned report and AI output |
| [12_TESTING_STRATEGY](12_TESTING_STRATEGY.md) | test pyramid and regression matrix |
| [13_BENCHMARK_AND_REAL_WORLD](13_BENCHMARK_AND_REAL_WORLD.md) | corpus methodology and metrics |
| [14_CI_CD_AND_RELEASE](14_CI_CD_AND_RELEASE.md) | workflows, packaging and provenance |
| [15_IMPLEMENTATION_ROADMAP](15_IMPLEMENTATION_ROADMAP.md) | dependency-ordered phases |
| [16_FILE_CHANGE_MAP](16_FILE_CHANGE_MAP.md) | ownership mapped to actual paths |
| [17_ACCEPTANCE_CRITERIA](17_ACCEPTANCE_CRITERIA.md) | objectively testable Definition of Done |
| [18_LUNA_EXECUTION_CONTRACT](18_LUNA_EXECUTION_CONTRACT.md) | next agent's operating rules |
| [19_RISKS_AND_LIMITATIONS](19_RISKS_AND_LIMITATIONS.md) | honest residual limitations |
| [20_FINAL_CHECKLIST](20_FINAL_CHECKLIST.md) | final implementation gate |

`99_IMPLEMENTATION_STATUS.md` is a supplemental, dated status ledger. It does not replace any numbered contract and is not part of the required 00–20 reading order.

## Execution order

Follow [15_IMPLEMENTATION_ROADMAP](15_IMPLEMENTATION_ROADMAP.md) phase by phase, recording evidence against [17_ACCEPTANCE_CRITERIA](17_ACCEPTANCE_CRITERIA.md). The implementation agent may choose internal design details not fixed here, but must preserve externally visible contracts. A new requirement or unavoidable deviation needs a written rationale in its implementation report, corresponding tests, and review in Stage C. A green unit suite is not a substitute for the packaged-app and release gates.

## Terms

**Project** is the selected repository. **Target** is one runnable application/service inside it. **Clean verification workspace** is a disposable source copy without dirty build artifacts; it is **not a security sandbox**. **Capability** describes whether a verification method actually ran. **Evidence** is a bounded, redacted observation. **Finding** interprets evidence; its classification must not be stronger than the observation. **READY** only describes the selected target under the declared environment and tested routes, never all business behavior.
