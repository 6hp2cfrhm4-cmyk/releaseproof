# Risks and honest limitations

ReleaseProof can provide strong, scoped evidence, not mathematical proof that a product is safe or useful. Every report and README claim must stay inside tested scope.

## Fundamental limits

- **Business behavior:** A successful build, startup, route smoke and browser render do not prove payments, auth, migrations, emails, permissions, accessibility, localization or every user journey. Authenticated/stateful flows require separate configured tests. P1 documentation requirement, not a Core release blocker by itself.
- **Route coverage:** Discovery is bounded and incomplete; dynamic parameters, redirects and nested flows can be missed. Report attempted/configured/discovered routes and coverage. Do not claim full-site verification.
- **External infrastructure:** Postgres/MongoDB/Redis/SaaS credentials can be unavailable locally. Return INCOMPLETE with exact missing capability unless app code failure is independently proven. A test stub may not match production service.
- **Browser:** Chromium/Playwright absent means HTTP-only evidence; it cannot prove client JavaScript. Headless behavior may differ from users' browsers. Delayed errors beyond observation window can be missed.
- **Clean copy:** It removes dirty artifacts but is not a security sandbox. Dependency and project scripts execute with local user privileges and can access files/network unless OS/container isolation is separately built. First-run trust notice is essential.
- **Environment:** Minimal env can cause legitimate projects to require explicit values; this is an INCOMPLETE limitation, not automatic app defect. Redaction reduces leakage but cannot guarantee detection of unknown secrets if arbitrary project code exfiltrates them itself.
- **Static detection:** Monorepos and mixed stacks may require user target/config selection. Autodetection should expose uncertainty rather than guess.
- **Toolchains/platform:** Windows native wheels, Unix-only dependencies, lockfile-manager versions, Corepack and registry availability affect verification. A verdict from one OS is not proof for another.
- **Score:** It is a weighted summary of observed checks, not a probability of production success. Coverage/confidence and blocker count are separate, dominant signals.
- **Release:** An unsigned Windows installer may trigger SmartScreen. No code signing claim until obtained and verified. macOS DMG/Linux AppImage are not part of the nearest distribution milestone.

## Current specific risks to track

At blueprint snapshot, Core fixes after `c371dea` are dirty and untested as a whole; previous CI cannot certify them. `hackathon-starter` has an unresolved delayed HTTP timeout. FastAPI old pins exercise missing MSVC/unsupported uvloop rather than complete runtime. No Desktop/installer exists. Current CLI Doctor ends with a generic readiness line, and current report schema lacks independent schema version. Existing `--skip-sandbox` label can mislead about security isolation. `action-example.yml` references future `v0.2.0`; do not present it as currently published. The PR template still says 36 fixtures while prior CI used 42. These are facts/gaps to recheck and resolve or document in implementation, not permission to alter source during blueprint stage.

## Risk management rule

When evidence is incomplete, say exactly which capability and target were not verified; provide a path to retry. A failure of verifier itself is distinct from app failure. Prioritize P0 correctness and security boundary over optional new framework coverage or visual polish. Any deferred P1 from [17](17_ACCEPTANCE_CRITERIA.md) must be called out before review.
