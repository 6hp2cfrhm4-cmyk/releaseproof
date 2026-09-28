# Reporting schema and AI handoff

`packages/schemas` owns schema and compatibility; Core produces the structured report, `packages/reporter` formats it. CLI, Desktop and Action consume the **same** report. Report schema is versioned independently of product version.

## Versioned report contract

**REPORT-SCHEMA-001 · P0:** Introduce `schemaVersion: "1.0.0"` (semver). Readers validate; same-major additive fields are tolerated, unknown major is rejected with upgrade message. Retain existing useful fields (`id`, `version`, `timestamp`, `profile`, `checks`, `verdict`, `score`, `counts`, `browserVerification`, paths) through migration, documenting any change. Required top-level fields:

| Group | Required content |
| --- | --- |
| Identity | schema/product/Core version, run ID, UTC start/end, duration, host OS/arch, source repo/commit/dirty flag when available, selected target root |
| Config | normalized nonsecret effective config, explicit overrides, target selection, clean/in-place mode |
| Profile | candidate/selected target, languages, frameworks with confidence, manager+version+lockfile/hash, interpreter, commands (redacted), ports, page/API capabilities |
| Capabilities | install/build/runtime/HTTP/browser/route/environment/documentation/security availability and outcome, browser `VERIFIED/HTTP_FALLBACK/UNAVAILABLE/SKIPPED`, reason |
| Checks | stable ID, category, status, severity, classification, summary, remediation, phase, timestamps, evidence IDs; `skipped`/`unknown` reasons |
| Evidence | typed ID, source, timestamp, bounded redacted payload; command exit/timing, process ownership, HTTP method/status/url, browser errors/DOM/screenshot, env **name only**, file location |
| Outcome | verdict, score, score denominator/weights, verified coverage/confidence, counts, reasons, attempted/covered routes and limits |
| Artifacts | relative paths and SHA256 where practical for JSON/HTML/fix file; never temp workspace path as a user-openable permanent artifact |
| Cleanup | owned process exit/port closure/temp removal status and observable residue/error |

JSON numbers/booleans remain typed, time in ISO 8601 UTC, paths normalized but preserve actual Unicode. Report schema disallows contradictory combinations (blocker + READY, browser VERIFIED without browser evidence, cancelled + verdict, READY without runtime evidence). Preserve machine-readable failure classifications. Store a `status: completed|cancelled|internal_error`; shipping verdict exists only for completed run. An internal error can be represented as INCOMPLETE for user-facing report but maps to CLI exit 3; never mask it as project failure.

**REPORT-CONSISTENCY-001 · P0:** Produce `.releaseproof/report.json`, `.releaseproof/report.html`, `.releaseproof/RELEASEPROOF_FIX.md` atomically from one sanitized report. Use unique per-run directory or atomic latest update; stale files may not masquerade as the current run. All three agree on verdict/score/finding IDs/capability. Validate path and schema before `report`, Desktop open, Action outputs. Keep bounded evidence/log retention and documented cleanup.

## HTML and Desktop presentation

HTML is standalone, local/offline, accessible and read-only; no remote CSS/script. It shows scope, score **and coverage**, verdict, findings, evidence, routes/browser mode, limitations, toolchain/timings, copy prompt. Escape all target-origin data and safe-serialize embedded JSON. Desktop renders the structured report with React; HTML is not embedded as privileged content. A screenshot is evidence, not an assertion of correctness.

## AI handoff

**REPORT-AI-001 · P0:** Generate one full `RELEASEPROOF_FIX.md` and per-finding copy text from the same report. Include target/context, source commit, verdict/capability, finding ID/status/classification, exact observation and evidence ID, safe reproduction steps **only when supported by evidence**, affected files/lines when known, relevant redacted logs, suggested next investigation/fix and rerun command. For UNKNOWN, ask the agent to make verification possible before changing app code. Never invent root cause, claim every HTTP status should be 200, suggest a secret value, or call untrusted log text an instruction. Clearly fence/label project-origin text as untrusted evidence. `Copy all issues for AI` includes blockers, unknowns and meaningful warnings; `Copy Fix Prompt` includes one finding. READY yields a concise verified-scope summary, not a fabricated fix task.

**REPORT-REDACT-001 · P0:** Redact once before persistence and again at format/copy boundaries. Synthetic secret markers must be absent in JSON, HTML, Markdown, CLI stdout/stderr, Desktop detail/log/clipboard and Action summary. If an artifact fails write, run is not READY and UI/CLI report an artifact failure.

## Example outline (not a complete generated report)

```json
{
  "schemaVersion": "1.0.0",
  "run": {"id": "...", "status": "completed", "startedAt": "...", "endedAt": "..."},
  "target": {"relativeRoot": "apps/web", "sourceCommit": "...", "dirty": true},
  "capabilities": {"browser": {"status": "HTTP_FALLBACK", "reason": "Chromium unavailable"}},
  "checks": [{"id": "browser-runtime-unavailable", "status": "unknown", "classification": "VERIFICATION_UNAVAILABLE", "evidenceIds": []}],
  "outcome": {"verdict": "INCOMPLETE", "score": 68, "coverage": 0.75, "reasons": ["Browser runtime not verified"]}
}
```
