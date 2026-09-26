# Contract for GPT-6 Luna Max implementation stage

You are the **implementation agent**, not the spec author or final independent reviewer. Read **all 21 blueprint files** before touching source. Start at [00_README_FIRST](00_README_FIRST.md), then inspect current Git status/HEAD/PR/CI and compare [02](02_CURRENT_STATE.md) with reality. Preserve all existing valid changes, especially pre-existing dirty Core edits; do not reset, overwrite wholesale or silently discard work. The current blueprint task intentionally did not implement code.

## Operating mode

Implement [15_IMPLEMENTATION_ROADMAP](15_IMPLEMENTATION_ROADMAP.md) phase by phase. Make ordinary engineering choices autonomously; do not stop to ask about filenames, component decomposition, test library or CSS details when contract is clear. Ask only for new authority, missing secrets/external coordination or a product tradeoff that materially changes scope. Do not stop after the first green test, a dev Electron window, or a built-but-untested EXE. Each requirement ID needs code **and** proportionate evidence. Add regression tests for each discovered bug. Never game benchmarks by weakening expected verdicts or classifying all failures as unavailable.

Keep a concise progress record: phase, changed components, exact tests/results, blocker/next gate. Distinguish VERIFIED, EXPECTED, NOT VERIFIED. When real-world corpus differs, investigate with original pin/config/toolchain; historical and refreshed pins are separate. If toolchain or CI cannot run, continue independent safe work but do not claim complete. Validate clean Git state at handoff and name uncommitted user-origin files if preserved.

## Git, CI and release boundaries

The owner previously authorized pushing **this development branch** `codex/core-hardening-before-desktop` for CI. You may push implementation commits to that branch when needed to run CI, after reviewing the diff and verifying no secrets/artifacts are included. Do not force-push, rewrite `main`, merge draft PR #1, move `v0.1.0`, replace release assets, publish npm or create a GitHub Release without separate direction and Stage C review. Use a development version for installer/tarball. Attach any newly created PR if a later explicit request creates one; ordinarily continue existing draft PR.

## Minimum final evidence

Report exact final branch/SHA/dirty state; file/architecture summary; each P0/P1 ID status; full build/typecheck/unit/CLI/Desktop/packaged Windows E2E; benchmark mode/count/TP/TN/FP/FN/mismatches/errors; ten pinned corpus outcomes/limitations; six matrix cells + Action + installer CI URLs; artifact names/SHA256; CLI/Desktop parity; process cleanup/redaction results; `v0.1.0` unchanged; deferred risks. Mark any unrun gate NOT VERIFIED with reason. Do not write “production ready” unless [17](17_ACCEPTANCE_CRITERIA.md) and [20](20_FINAL_CHECKLIST.md) are satisfied and Stage C review has occurred.

## Handoff state

Stop after implementation evidence, development artifacts and review-ready PR state. Do **not** merge or release. Stage C will independently review code and correct remaining issues. A completed implementation report is the entry point for that review, not the public-release authorization.
