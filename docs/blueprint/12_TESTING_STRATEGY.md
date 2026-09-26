# Testing pyramid and mandatory regressions

Tests must exercise the exact seam they claim. Mock-based unit tests do not prove process cleanup, Playwright execution or installer behavior. New Desktop and Core code requires tests at the lowest sensible level **plus** representative E2E evidence.

## Levels and ownership

| Level | Required evidence |
| --- | --- |
| Unit | schemas/config/score/verdict/detector/classification/redaction/report serialization; deterministic pure cases, no fixture-name special paths |
| Integration | clean copy, install/build/start pipeline on tiny local fixtures; config precedence and target selection; actual report artifacts |
| Process | real child server on free port, foreign listener, delayed crash, timeout, SIGINT/Abort, descendants and temp cleanup on Windows/POSIX |
| Browser | real Chromium for browser app, delayed exception after DOMContentLoaded, 500 route, harmless analytics/console; explicit no-binary fallback test |
| CLI E2E | compiled `apps/cli/dist/index.js` from outside test handler; flags before/after subcommand, JSON parse-only stdout, exit 0/1/2/3/130, paths with spaces/Unicode |
| Desktop component | screen states, keyboard/focus, theme, details/empty/error UX using typed fixture reports |
| Desktop IPC/E2E | actual Electron main/preload/renderer/worker on safe local fixtures; wrong/oversized IPC rejected; Cancel/close and parity |
| Packaged app E2E | install Windows setup on clean VM/runner; Start Menu, launch, verify actual target, open/copy report, close/uninstall, no system Node/pnpm for launch |
| Benchmark | FAST on development; AUTHORITATIVE on release gate with real clean copy/frozen install/build/start; expected verdict/category/capability |
| Real-world corpus | pinned SHAs/toolchain/date, real clean-room runs, classification review, no upstream mutation |
| GitHub Action E2E | `uses: ./` and next-version tag smoke once published, real outputs and fail policy |

## Required regression matrix

**TEST-CORE-001 · P0:** Implement fixtures/tests for foreign occupied port (foreign listener survives, no READY), port race/app ignores chosen port; process responds then delayed crash; live unexplained HTTP timeout unknown; browser delayed pageerror; Playwright unavailable yields HTTP_FALLBACK + browser app INCOMPLETE, API-only skipped; empty/no runnable target; zero/skipped-only checks; high score + blocker; HTTP 204 API and expected 401/403/404/redirect; configured critical route 500; browser harmless analytics failure; mixed Node+Python/monorepo root and nested target; multiple lockfiles; incompatible pnpm lockfile/ignored build scripts/unsupported platform; external DB timeout vs real app failure; nested README `cd`; generic `.env` values warn vs real credential block.

**TEST-CLI-001 · P0:** Real binary propagates `--port`, `--timeout`, `--json`, `--target`, Python interpreter and booleans; absent CLI fields preserve `.releaseproof.json`; invalid config/flags fail predictably; JSON stdout has no progress; exits 0/1/2/3/130; Doctor reports required missing tool; `report` handles space/Unicode paths safely; tarball install from outside repo.

**TEST-SEC-001 · P0:** Synthetic host secret is not inherited by default; explicit allowed/provided value is present to test app but absent from every output/clipboard; values split across output chunks remain redacted; `.env` excluded unless opt-in; symlink outside root excluded; HTML/Markdown untrusted text safely escaped/fenced; IPC cannot open arbitrary file/URL or spawn shell.

**TEST-DESKTOP-001 · P0:** Folder picker and drag/drop select same project; recent missing path; ambiguous target requires choice; progress sequence; cancel; close during run; worker crash; three verdict renderings; one/all finding copy equals reporter-generated sanitized text; open artifact validation; System Check remediation; dark/light/system and keyboard/focus. Parity suite of five safe targets compares CLI/Desktop report fields (not timestamps). Package tests use installed app, not Vite dev.

## Cross-platform and test hygiene

Windows/Ubuntu/macOS Node 20/22 all build/typecheck/unit/CLI smoke. Windows/Ubuntu run Python execution/process tests; macOS Python smoke if available. Browser tests launch Chromium where CI installs it, and separate unavailable test forces no-browser mode. Tests allocate ephemeral ports, avoid global port 3000 assumptions, clean their own processes/temp data even on assertion failure. Vitest excludes ignored `.temp`, project clones and generated artifacts; test discovery must not ingest cloned repositories. Preserve fixture expectations and explain any legitimate expectation change in review. See [13](13_BENCHMARK_AND_REAL_WORLD.md) for benchmark metrics and [14](14_CI_CD_AND_RELEASE.md) for jobs.
