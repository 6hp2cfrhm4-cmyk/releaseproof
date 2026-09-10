# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

---

## Security Philosophy & Mitigations in ReleaseProof

ReleaseProof executes foreign code, build commands, and web servers during verification. Because of this, security and process isolation are core design requirements:

1. **Clean-Room Sandbox Isolation**:
   - Verification runs in an ephemeral temporary directory (`rp-sandbox-*`).
   - Copy operations strictly enforce directory boundaries to prevent path traversal attacks (`..`).
   - Symlinks pointing outside the workspace root are automatically dropped.

2. **Process Execution & Command Injection Defense**:
   - Commands are parsed into explicit executable and argument vectors.
   - On Windows, compiled binaries (`node`, `python`, `git`) are invoked directly with `shell: false`. For batch wrappers (`npm.cmd`, `pnpm.cmd`), paths are resolved deterministically to prevent arbitrary argument execution (addressing CVE-2024-27980).
   - Process tree cleanup uses kernel-level process termination (`taskkill /T /F` on Windows, POSIX process groups `-pid` on Unix) to guarantee no zombie background listeners remain active.

3. **Centralized Secret Redaction Layer**:
   - Any secret, API key, AWS token, private key, or password matched by our pattern rules is masked (e.g. `AKIA****************`) before being written to stdout, JSON, HTML reports, or AI prompts.
   - Raw credentials are never transmitted over any network socket.

4. **XSS-Safe HTML Serialization**:
   - The standalone offline HTML report serializes report data with standard HTML escaping (`<` → `\u003c`, `>` → `\u003e`, `&` → `\u0026`) and uses `textContent` DOM nodes to prevent XSS execution.

---

## Reporting a Vulnerability

If you discover a security vulnerability in ReleaseProof:

1. **Do not open a public GitHub issue.**
2. Send an email to `security@releaseproof.dev` with:
   - Description of the vulnerability
   - Affected versions and configurations
   - Minimal reproduction steps or proof-of-concept
3. We will acknowledge receipt within 48 hours and work with you on a coordinated disclosure timeline.
