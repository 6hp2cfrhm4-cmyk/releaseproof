# Project detection, target selection and runtimes

Detection is a preview and hypothesis, not evidence that an app works. A user can override it; explicit selection must be recorded in the report. This file owns manager/interpreter selection; [04](04_CORE_VERIFIER_SPEC.md) owns how failures affect verdict.

## Target model

**DETECT-TARGET-001 · P0:** Return candidate runnable targets `{id, relativeRoot, displayName, stack, confidence, reasons, commands, ports, capabilities}`. A single unambiguous target may be preselected; multiple plausible apps (workspace packages, frontend + backend, Node + Python) require explicit target selection in Desktop and `--target <relative-path>` in CLI or `.releaseproof.json`. Never execute every workspace service by guess. Repository root with no start/build is a context, not a runnable target; static-only root cannot be READY. Reject path traversal and symlink escapes; preserve spaces/Unicode.

**DETECT-MIXED-001 · P1:** Inspect root and bounded nested manifests (`pnpm-workspace.yaml`, npm/yarn workspaces, `package.json`, `pyproject.toml`, `requirements.txt`, common apps/services/examples paths) without recursively walking arbitrary vendor trees. Show independent frontend/backend candidates, their dependencies and uncertainty. A combined multi-service verification is P2 and must be explicit; nearest milestone verifies one selected target at a time. Root config may define target aliases with cwd/commands/health route. CLI `--target` and Desktop picker resolve to the same model.

**DETECT-FRAMEWORK-001 · P1:** Recognize current supported families: Next.js, Vite/React/Vue, Express/generic Node, FastAPI/generic Python. Infer from manifest dependencies + scripts + files; never choose Next over Python just because `package.json` exists. A package with no web runtime may be reported unsupported/incomplete, not forced into port 3000. Record detection confidence and reasons. Browser capability belongs to target, not entire repository. Prefer explicit port/config, then script/source/manifest signals, then known framework default; do not invent a default as verified fact.

## Node and package managers

**RUNTIME-NODE-001 · P0:** Selection order: explicit validated config/CLI override → `packageManager` field and Corepack-compatible version → unique committed lockfile → installed manager if no lockfile. Multiple conflicting lockfiles without `packageManager` require user choice/INCOMPLETE; never silently prefer pnpm. Record detected and actually executed manager/version. `npm` with package-lock uses `npm ci`; pnpm uses `pnpm install --frozen-lockfile`; Yarn Classic uses `yarn install --frozen-lockfile`; Yarn Berry uses `yarn install --immutable` after version detection. With no lockfile, install may run but warn nonreproducible; never claim frozen. Ensure scripts/workspace layout are retained in clean copy.

**RUNTIME-TOOLCHAIN-001 · P0:** Detect engine constraints and lockfile compatibility *before* install where feasible. Corepack may activate pinned project manager with user consent for network/download; no automatic global install or mutation of host toolchain. Unsupported lockfile version, unavailable manager, blocked dependency build policy, absent native compiler, OS-incompatible package, registry/network timeout are capability UNKNOWN with actionable Doctor text. Verified manifest/lock mismatch or deterministic source/build failure is BLOCK. Do not broaden regexes so ordinary app errors are hidden. Taxonomy v6 lockfile/pnpm 8 and leerob/site v9/pnpm 9 are real-world regression references, not universal version rules.

## Python

**RUNTIME-PY-001 · P0:** Resolve explicit absolute `python.interpreter`/`--python-interpreter` first; otherwise discover platform candidates (`py -3`/`python` Windows, `python3`/`python` POSIX), probe executable/version/architecture, and record selection. Create a unique venv **inside the disposable verification workspace**. From then on, use its absolute interpreter for `-m pip`, build steps and `-m uvicorn`; never rely on another PATH `python`, `pip` or `uvicorn`. Set `VIRTUAL_ENV` and prepend the venv bin/Scripts path only for this run. An interpreter without usable venv/pip is UNKNOWN with guidance, not a project blocker.

**RUNTIME-PY-002 · P1:** `requirements.txt`: use venv `python -m pip install -r requirements.txt` and record that without hashes it is not fully reproducible. `pyproject.toml`: parse build system/dependencies/`requires-python`; use venv pip install of project when supported. `uv.lock`: when uv is installed and compatible, use locked `uv sync --frozen` against the **same venv/interpreter** (e.g. explicit `UV_PYTHON`/environment flags); if exact semantics cannot be guaranteed, report UNKNOWN and offer pip fallback only with a clear “not lockfile-authoritative” warning—do not pretend uv support from detecting the file. Poetry lock is detected but not automatically verified unless implemented/tested; mark capability unavailable or require explicit command. FastAPI entrypoint (`main:app`, `app.main:app`, configured module) must be detected/selected, and startup calls `venvPython -m uvicorn ...` on loopback with chosen port. A generic Python package without known server entrypoint is INCOMPLETE until configured.

**RUNTIME-PY-003 · P1:** On Windows, Unix-only pinned dependency (`uvloop`) or absent MSVC required for an old wheel is `VERIFICATION_UNAVAILABLE`; never claim app broken. On Linux, a package genuinely failing due to app dependency declarations may block. Test multiple Python installations and path-with-spaces; compare install and startup `sys.executable`/venv path. Python tests run in Windows and Ubuntu CI; macOS smoke where practical.

## Commands and ports

Command resolution order: explicit per-target config → manifest script → framework-safe default. Present exact install/build/start command before run. Commands may be project-authored and execute arbitrary code; prompt user on Desktop first run for untrusted folders. Start commands must support configured port or report inability to correlate. For custom Vite preview, do not append Vite CLI flags blindly. Source-declared Express fallback port can inform a candidate but must be confirmed at runtime. Nested README `cd examples/react` is evaluated in that directory's package context; never call it a missing root script. See [10](10_SECURITY_PRIVACY.md) for trust/command execution.

## Config target example (normative shape, schema to implement)

```json
{
  "target": "apps/web",
  "start": {"command": "pnpm start", "port": 4173, "healthCheckPath": "/"},
  "criticalRoutes": [{"path": "/", "kind": "page", "expectedStatus": [200]}],
  "python": {"interpreter": "C:/Python312/python.exe"}
}
```

Backwards-compatible string `criticalRoutes` remains accepted as GET routes; report normalizes to typed route records. Config schema and precedence are owned by [06](06_CLI_SPEC.md), not this example.
