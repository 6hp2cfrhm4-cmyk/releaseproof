# CLI contract

CLI is a first-class interface over shared Core. Existing commands at inspection: default `releaseproof [path]`, `verify`, `doctor`, `report`, `vibe`, `clean`. Preserve them; changes below are additive or documented deprecations. Avoid a separate CLI-only verdict implementation.

## Commands and behavior

| Command | Required behavior |
| --- | --- |
| `releaseproof [path]` | Alias of `verify [path]`, default cwd, same flags/exits/report. |
| `verify [path]` | Select target, validate config, run clean verification, emit progress and final summary, write three artifacts. |
| `doctor [path]` | Probe host/project requirements (Node, manager/version, Python/venv, Playwright Chromium, native tools where inferable); structured availability and remediation; no unconditional “ready.” `--json` returns machine-readable capability results. |
| `report [path]` | Locate latest valid report, print path and optionally open HTML. `--no-open` supported. Validate report schema and safe file path; do not launch arbitrary shell command from interpolated path. |
| `vibe [path]` | Render compact card from validated latest report, or explicitly rerun when none exists; respect same result semantics. It must not silently present stale report as current. |
| `clean [path]` | Show exact `.releaseproof` target, remove only that validated artifact directory; never touch source/temp unrelated dirs. |

## Flags and config

**CLI-CONFIG-001 · P0:** Precedence: built-in defaults < project `.releaseproof.json` < explicitly supplied flags. Deep-merge named nested sections (`start`, `build`, `browser`, `environment`, `python`, `checks`) so omitted CLI flags do not erase project config. Validate entire merged schema; invalid JSON/unknown critical keys/out-of-range values are input errors, not silent defaults. Desktop uses the same normalizer. Expose resolved nonsecret config in report for reproducibility. Config may include `target`, typed `criticalRoutes`, manager override, phase timeouts, browser window, environment allow/provide and safety limits.

**CLI-FLAGS-001 · P0:** `verify`: `--target <relative-path>`, `--port 1..65535`, `--timeout <positive-ms>` (startup), `--python-interpreter <absolute-or-resolved-path>`, `--package-manager <npm|pnpm|yarn|pip|uv>` where relevant, `--json`, `--ci`, `--verbose`, `--no-browser` (explicit skip/incomplete for browser app), `--in-place` (development-only clean-copy bypass; legacy `--skip-sandbox` alias with warning), `--output-dir <path>` constrained/validated. Boolean flags override config only when explicitly passed. Document every supported flag in `--help` and test **real compiled binary** both before and after path. Do not pass CLI-only flags to project scripts.

**CLI-EXIT-001 · P0:** `0` READY; `1` NOT_READY; `2` VERIFICATION INCOMPLETE (including required capability unavailable); `3` ReleaseProof internal error or invalid invocation/config; `130` user SIGINT/cancel after cleanup. `--ci` does not change core verdict/exit mapping; it disables interactive affordances, uses deterministic plain output and still writes artifacts. Action may implement its own fail policy based on report, but outputs must be produced before exit. `doctor` returns 0 when all **required for selected target** capabilities exist, 2 when required capabilities are unavailable, 3 on Doctor internal/input failure; optional missing tools do not fail.

## Output contracts

**CLI-JSON-001 · P0:** `verify --json` writes **exactly one** complete schema-valid JSON report to stdout, no banners/progress/logs. Non-JSON diagnostic errors go to stderr; if no report can be produced, stderr contains a small typed JSON error and exit 3. Redaction applies to both streams. Human mode: concise phase progress to stderr or terminal, then verdict, score **and coverage**, target, counts, browser mode, top findings, artifact paths. `--verbose` may stream bounded redacted logs without changing JSON stdout. Use stable ASCII/plain mode when `NO_COLOR`/CI; color is decorative only. Never print sensitive env values or full unbounded logs.

**CLI-PROGRESS-001 · P1:** Stable phase IDs/events from Core, one running and one terminal event per phase. Flush final output after cleanup; a failed cleanup is visible and may change run to internal/incomplete, never READY. Ctrl+C twice may force exit but still attempts owned-child cleanup; no hanging terminal.

## Examples

```sh
releaseproof verify . --target apps/web --ci --json > report.json
releaseproof verify ./my-api --port 8080 --timeout 60000
releaseproof doctor ./my-python-app --json
releaseproof report ./my-app --no-open
releaseproof vibe ./my-app
```

CLI tarball distribution is a GitHub Release artifact for this milestone. No npm publication is required; do not document `npx releaseproof` as available until actually published. See [14](14_CI_CD_AND_RELEASE.md).
