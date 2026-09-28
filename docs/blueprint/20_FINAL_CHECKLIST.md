# Final implementation checklist

Check an item only with a link to test/run/artifact or a precise local command/result on the final SHA. The implementation agent owns filling evidence; this blueprint stage leaves boxes unchecked.

## Baseline and source integrity

- [ ] Read all 21 blueprint files, inspect current branch/HEAD/status/PR/CI, preserve all valid existing Core/Desktop work and document any user-origin changes.
- [ ] Record final source SHA, worktree status, `v0.1.0` tag/release/assets unchanged; no PR merge or public release.
- [ ] Frozen install, build and full typecheck/lint pass; exact test files/cases/skips recorded.
- [ ] Every P0/P1 ID in [17](17_ACCEPTANCE_CRITERIA.md) has implementation + evidence or explicit blocking reason.

## Core and runtime

- [ ] Foreign occupied port yields no READY, foreign listener survives, no foreign response used.
- [ ] Delayed crash blocks; unexplained live HTTP timeout unknown; cleanup removes owned process/port/temp after all outcomes.
- [ ] Playwright delayed error detected; unavailable browser is HTTP_FALLBACK/UNAVAILABLE, not VERIFIED; API-only browser skip valid.
- [ ] API 204 passes; configured critical route 500 blocks; expected auth/redirect statuses handled contextually.
- [ ] Monorepo root without runnable target INCOMPLETE; nested/mixed target selection works in CLI and Desktop.
- [ ] Zero/skipped/unknown-only not READY/100; blocker forces NOT_READY; coverage shown separately.
- [ ] npm/pnpm/Yarn lockfile mode and conflict/toolchain messages tested; no lockfile mutation in authoritative run.
- [ ] Python Windows/Linux venv install/start use same absolute interpreter; uv/requirements/pyproject capabilities honest.
- [ ] Minimal host env, `.env` default exclusion, generic-env false-secret fix and synthetic marker redaction pass across all outputs.
- [ ] AbortSignal/SIGINT/Desktop Cancel/close cleanup real process trees; no Core `process.exit`.

## CLI, reporting and AI

- [ ] Real compiled CLI commands/default alias and flags work; config precedence and invalid config tested.
- [ ] CLI exit 0/1/2/3/130, JSON-only stdout, CI mode, Doctor/Report/Vibe/Clean contracts tested.
- [ ] Schema v1 validates report identity/profile/capabilities/checks/evidence/score/verdict/timings/environment/browser/cleanup.
- [ ] JSON/HTML/Markdown agree, are atomic, escaped/redacted, and stale report is not mistaken for current run.
- [ ] AI full/per-finding prompts include evidence/reproduction/files/logs where known, no fabricated cause or secrets.
- [ ] GitHub Release-style CLI tarball installs outside repo; version/help/doctor/verify/report smoke and SHA256 recorded.

## Desktop UX and package

- [ ] Electron/React/TypeScript/Vite app launches; renderer has no Node integration; CSP/preload/IPC validation tests pass.
- [ ] Picker/drop/recent/preview/target choice → Verify → progress → three verdicts → findings/evidence/logs → Copy for AI → Verify Again.
- [ ] Cancel/close/worker crash leave no owned processes/temp or false READY; UI responsive.
- [ ] System Check, Settings theme System/Dark/Light, nonsecret persistence, plain-language error + Technical details work.
- [ ] Keyboard/focus/contrast/reduced-motion and dark/light/narrow/Unicode-path QA pass.
- [ ] Five safe fixture CLI/Desktop parity cases match verdict/score/finding IDs/status/classification/browser capability.
- [ ] Actual `ReleaseProof-Setup-<version>.exe` built with icon/version metadata, Start Menu, uninstall; installed app launches without system Node/pnpm and verifies a safe project.

## Benchmark, corpus, CI and release preparation

- [ ] FAST clearly nonauthoritative; AUTHORITATIVE full clean-copy/frozen run on exact final SHA has FP=0, FN=0, zero mismatches/errors and capability expectations pass.
- [ ] Ten exact-pinned real-world cases rerun with toolchains/date/target/outcome/limitations; old six unreachable SHA records remain historical, not overwritten.
- [ ] Six Windows/Ubuntu/macOS × Node 20/22 required jobs green; Python/browser/CLI/Desktop and Ubuntu+Windows authoritative gates green on same SHA.
- [ ] Action E2E healthy/blocker/incomplete/path-space outputs and exit policy pass; no nonexistent npm dependency.
- [ ] Windows installed-app E2E, CLI tarball E2E and SHA256SUMS for development artifacts pass; source/provenance recorded.
- [ ] README/Action/docs updated **only** to claims backed by actual artifacts; no fake Windows download, universal zero-FP or security-sandbox claim.
- [ ] Final implementation report lists VERIFIED/NOT VERIFIED, exact CI URLs, artifact hashes, known limitations and Stage C review handoff; no merge/release.
