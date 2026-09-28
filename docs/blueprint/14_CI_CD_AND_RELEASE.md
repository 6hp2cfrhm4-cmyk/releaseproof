# CI, packaging, Action and release provenance

This file owns the future release gate and distinguishes it from evidence already present. Exact-head CI run [36344233294](https://github.com/6hp2cfrhm4-cmyk/releaseproof/actions/runs/36344233294) passed all six Windows/Ubuntu/macOS × Node 20/22 matrix cells, Composite Action E2E, bundled CLI tarball E2E, authoritative Ubuntu/Windows Node 20 benchmarks and packaged Windows installer E2E on source `a3524f56c69982ead3b0901aeed638c3ac9171dd`. Both authoritative benchmark jobs report 42 fixtures, TP 12 / TN 30 / FP 0 / FN 0, zero expectation mismatches and zero execution errors; the installer flow covers trust acknowledgement, READY/NOT_READY/INCOMPLETE outcomes, Cancel, close cleanup and uninstall. These gates do not automatically satisfy every acceptance row in [17](17_ACCEPTANCE_CRITERIA.md), and Stage C review remains mandatory before a public release. Historical `v0.1.0` tag, release and assets are immutable.

## Required CI topology

**CI-MATRIX-001 · P0:** Required pull-request jobs: Windows/Ubuntu/macOS × Node 20/22 frozen monorepo install, full build, typecheck/lint, unit/integration/CLI E2E and FAST benchmark smoke. Chromium browser E2E on each OS where supported; failures cannot be hidden by `continue-on-error`. Python interpreter/venv tests required Windows + Ubuntu (macOS smoke desirable). `vitest.config.ts` excludes clones/generated dirs. Ubuntu Node 20 AUTHORITATIVE full benchmark is required; Windows authoritative full benchmark is required for release candidate because of observed Windows-specific corpus failures. A cross-platform Dogfood verification is smoke, not substitute for benchmark.

**CI-DESKTOP-001 · P0:** Dedicated Desktop build/typecheck/component/IPC tests on matrix. The exact-HEAD Windows workflow builds the actual `ReleaseProof-Setup-<development-version>.exe`, installs, launches/version-checks, exercises the committed packaged-app flow, and uninstalls. It includes CLI/Desktop worker parity, but the coverage is not a claim that every UI scenario, every worker cleanup path, or all OS GUI behavior is proved. Review the current E2E working-tree delta and require a green remote run on its eventual committed final SHA. Development builds are CI artifacts only, not GitHub Releases. Linux/macOS Desktop smoke verifies build/core matrix behavior; DMG/AppImage are future distribution, not required artifacts. Cross-platform GUI E2E may use virtual display; clearly label any OS smoke skipped due environment.

## GitHub Action

**ACTION-001 · P0:** `action.yml` is a composite Action that uses repository-local bundled CLI from its own `GITHUB_ACTION_PATH` or a pinned published release artifact, never `npx releaseproof` before npm publication. Inputs: project `path`, optional `target`, `port`, `timeout`, `fail-on-blocker` (default `true`) and `fail-on-incomplete` (default `true`). Validate values, quote paths safely, use minimum `contents: read` permissions. Outputs `score`, `status`, blocker/warning counts, HTML and fix paths are written via `$GITHUB_OUTPUT` **before** fail policy exits; summary includes verdict and coverage. Internal error always fails; NOT_READY fails iff `fail-on-blocker=true`; INCOMPLETE fails iff `fail-on-incomplete=true`; READY succeeds. These policy flags affect only Action step status, never Core verdict or CLI exit. Action E2E runs on healthy, blocker, incomplete and path-with-spaces, checks outputs and step exit. A tag-based usage example appears only after the new immutable tag is published.

## Artifacts and Windows distribution

**PKG-WIN-001 · P0:** Build a normal Windows installer named exactly `ReleaseProof-Setup-<version>.exe` (NSIS/equivalent), with correct product icon, publisher/product name, file version metadata matching app/CLI, Start Menu shortcut, Add/Remove Programs uninstall, per-user install default unless justified, and clean upgrade behavior. Installed Desktop launches offline without separately installed Node/pnpm; project verification may request its own runtimes. Test actual installed executable, not merely unpacked Electron or dev server. Optional portable exe is P2; macOS DMG/Linux AppImage later. If unsigned, label SmartScreen trust limitation; do not claim code signing.

**PKG-CLI-001 · P0:** Create versioned GitHub Release CLI `.tgz`/tarball with bundled ESM and required licenses; install it in an empty directory outside repository and smoke `--version`, `--help`, `doctor`, `verify`, JSON/report. Do not require npm publication. Packaged browser runtime availability must be accurately represented; if Chromium is not bundled, Doctor and verdict make that explicit. Produce SHA256 for installer, CLI tarball and optional artifacts in `SHA256SUMS.txt`.

## Immutable release provenance

**RELEASE-PROV-001 · P0:** Until Stage C independent review, use development version; no merge/release. After review, choose a **new** version/tag. Source commit SHA = annotated tag target = clean CI checkout used to build all artifacts = source SHA in release notes/provenance. Reject dirty build input. Generate artifacts once, run E2E and hashes, publish once, verify downloaded hashes; never replace release assets in place. `v0.1.0` is historical and untouched. Version displayed by CLI, Desktop About, installer metadata, filenames and report must match. CI upload of a development artifact is not a public release.

## Documentation gate

Only after installed-app E2E and final review may README first screen say:

```text
# ReleaseProof
Your AI says it's done.
ReleaseProof checks if it actually ships.
Vibe code. Verify before you ship.
[ Download for Windows ]
```

The button must point to the actual new Setup exe with checksum; CLI instructions and GUI demo follow. Until then, label Desktop and download as in development. Update Action usage, supported runtimes, browser fallback, clean workspace trust, route scope, exit codes and limitations to match evidence. No universal “zero false positives” claim; only corpus-scoped benchmark metrics at a named SHA.
