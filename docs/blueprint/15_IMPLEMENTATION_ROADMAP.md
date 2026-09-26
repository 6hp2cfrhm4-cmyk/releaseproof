# Dependency-ordered implementation roadmap

Each phase has an entry gate, owned paths/components, work, tests and exit evidence. The implementation agent may split commits, but must not declare a phase complete merely because focused tests pass. See [17](17_ACCEPTANCE_CRITERIA.md) for the full milestone gate.

## Phase 0 — preserve and validate baseline

**Entry:** current checkout, no assumption of clean tree. **Work:** inspect `git status`, HEAD/PR/CI, read all blueprint files, preserve 14 modified + 3 untracked pre-existing Core files, run frozen install/build/lint/full tests/authoritative benchmark on current worktree, triage failures without resetting user work. Inspect report/corpus and record known limitations. **Components:** root scripts, `vitest.config.ts`, `docs/REAL_WORLD_VALIDATION.md`, all dirty files. **Tests:** exact local counts and benchmark metrics. **Exit:** evidence-backed baseline table, no accidental source edits, open failures assigned requirement IDs. Dependencies: none.

## Phase 1 — finish Core hardening and target/runtime model

**Entry:** Phase 0 evidence. **Work:** review/complete dirty classification fixes; implement typed target detection, mixed/monorepo selection, manager/lockfile policy, Python venv/interpreter identity, clean copy/env/redaction, deterministic ownership/stability/browser/API/route semantics, AbortSignal lifecycle, score/coverage/verdict and schema v1. **Components:** `packages/core`, `detector`, `runner`, `sandbox`, `browser`, `environment`, `security`, `schemas`, `reporter`; exact files in [16](16_FILE_CHANGE_MAP.md). **Tests:** all `TEST-CORE-001`, `TEST-SEC-001`; process/browser real integrations; schema invariants. **Exit:** no false READY/blocker in regression matrix, cancel/cleanup proven, full build/lint/unit green. Dependencies: baseline.

## Phase 2 — CLI and report contracts

**Entry:** stable Core API/schema. **Work:** normalize config/flags/target, JSON stdout, exit codes, Doctor, report/vibe/clean safety, atomically produce JSON/HTML/AI handoff, packaged CLI. **Components:** `apps/cli`, `packages/reporter`, `packages/schemas`, `scripts/write-action-results.mjs`. **Tests:** compiled binary E2E, 0/1/2/3/130, spaces/Unicode, report parity/redaction, tarball outside repo. **Exit:** `CLI-*` and `REPORT-*` acceptance rows green. Dependencies: Phase 1.

## Phase 3 — benchmark and real-world gate

**Entry:** stable CLI/Core. **Work:** extend fixtures and expectations for P0/P1 cases, repair benchmark methodology, rerun exact ten pinned repositories with recorded toolchains, retain historical SHAs separately, investigate differences without changing expectations opportunistically. **Components:** `fixtures`, `benchmarks`, `docs/REAL_WORLD_VALIDATION.md`. **Tests:** FAST and AUTHORITATIVE, FP/FN/mismatch/error zero, corpus reports. **Exit:** corpus-scoped evidence and remaining limitations recorded; no confirmed false blocker unexplained. Dependencies: Phases 1–2.

## Phase 4 — Desktop infrastructure

**Entry:** Core schema/events stable. **Work:** add `apps/desktop` Electron main/preload/renderer/worker, typed validated IPC, CSP/security settings, app state/recent/settings, folder dialog, worker cancellation and artifact open. No duplicate verification logic. **Tests:** IPC validation, worker crash, cancel/close process cleanup, shared Core parity fixture. **Exit:** development Desktop launches and verifies one real safe fixture through main→worker→Core, with no renderer Node access. Dependencies: Phases 1–2.

## Phase 5 — Desktop UX and accessibility

**Entry:** infrastructure running. **Work:** Project/detection preview, run progress, Overview, Findings/detail, Evidence, Logs, Doctor, Settings/theme, copy/open actions, error taxonomy and empty states per [07](07_DESKTOP_PRODUCT_SPEC.md) and [09](09_DESIGN_SYSTEM.md). **Tests:** component + full Electron E2E, five-fixture CLI/Desktop parity, keyboard/focus, themes, long/Unicode paths. **Exit:** complete Choose→Verify→result→evidence→Copy→Verify Again flow, all three verdicts honest. Dependencies: Phase 4.

## Phase 6 — packaging and distribution preparation

**Entry:** Desktop flow stable. **Work:** builder config, icon/version metadata, setup EXE, Start Menu/uninstall, embedded runtime and worker assets; CLI tarball/checksums; package license/asset audit. **Components:** `apps/desktop` packaging files, root scripts, `scripts/generate-sha256s.mjs`. **Tests:** actual installed Windows app on clean environment, verify safe fixture and uninstall; packed CLI outside repo. **Exit:** development `ReleaseProof-Setup-<version>.exe` exists as CI artifact with hash and installed-app evidence. No GitHub Release. Dependencies: Phase 5.

## Phase 7 — CI/Action integration

**Entry:** testable packaged artifacts. **Work:** update `.github/workflows/ci.yml`, `action.yml`, action result script, CI artifact uploads, Windows authoritative/installer E2E, cross-OS browser/Python smoke, minimum permissions. **Tests:** all required jobs, Action healthy/blocker/incomplete/path-space cases. **Exit:** every required job green on the same development branch SHA; no `continue-on-error` concealment. User already authorized pushes of the Core branch for CI, but Stage B must follow [18](18_LUNA_EXECUTION_CONTRACT.md) for push scope. Dependencies: Phases 1–6.

## Phase 8 — full acceptance and handoff to Stage C

**Entry:** CI green for exact SHA. **Work:** rerun local final gates, inspect artifacts, review docs against reality, check clean Git status, list exact residual limitations, record PR/CI/commit and checksums, do not merge/release. **Tests:** [20](20_FINAL_CHECKLIST.md) entirely checked or explicit blocker. **Exit:** implementation report with VERIFIED/NOT VERIFIED per requirement, ready for independent Stage C review; no claim of public release. Dependencies: all previous phases.

## Stop rules

If a phase is blocked by external toolchain/CI service, continue safe in-scope work on independent later phases, but do not mark full milestone complete. A change of product scope, external account/credential requirement, public release or PR merge needs user direction; ordinary engineering choices do not. Keep progress concise with phase, evidence, next gate.
