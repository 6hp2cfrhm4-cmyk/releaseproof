import { describe, it, expect, afterEach } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { scanForSecrets } from '../index.js';

describe('security scanner', () => {
  const testRoot = path.join(os.tmpdir(), `test-sec-${Date.now()}`);

  afterEach(async () => {
    try {
      await fs.rm(testRoot, { recursive: true, force: true });
    } catch {}
  });

  it('detects AWS access keys and unencrypted private keys', async () => {
    await fs.mkdir(path.join(testRoot, 'src'), { recursive: true });
    await fs.writeFile(
      path.join(testRoot, 'src', 'aws.ts'),
      'const key = "AKIAIOSFODNN7EXAMPLE";'
    );
    await fs.writeFile(
      path.join(testRoot, 'src', 'server.key'),
      '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----'
    );

    const checks = await scanForSecrets(testRoot);
    const secCheck = checks.find((c) => c.id === 'sec-secrets-detected');

    expect(secCheck).toBeDefined();
    expect(secCheck?.status).toBe('block');
    expect(secCheck?.evidence.length).toBe(2);
    // Ensure secrets are never printed in plain text
    const evidenceText = JSON.stringify(secCheck?.evidence);
    expect(evidenceText).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(evidenceText).toContain('AKIA****************');
  });

  it('passes when no secrets are present', async () => {
    await fs.mkdir(path.join(testRoot, 'src'), { recursive: true });
    await fs.writeFile(
      path.join(testRoot, 'src', 'index.ts'),
      'export const hello = "world";'
    );

    const checks = await scanForSecrets(testRoot);
    const cleanCheck = checks.find((c) => c.id === 'sec-clean-secrets');
    expect(cleanCheck).toBeDefined();
    expect(cleanCheck?.status).toBe('pass');
  });

  it('warns on populated env keys without a recognized credential instead of blocking a sample project', async () => {
    await fs.mkdir(testRoot, { recursive: true });
    await fs.writeFile(path.join(testRoot, '.env'), 'DATABASE_URL=postgres://sample:sample@localhost:5432/demo\nCLERK_SECRET_KEY=sk_test_example_value\n');
    await fs.writeFile(path.join(testRoot, '.env.production'), 'NEXT_PUBLIC_APP_URL=https://example.org\n');

    const checks = await scanForSecrets(testRoot);
    expect(checks.some((check) => check.status === 'block')).toBe(false);
    expect(checks.find((check) => check.id === 'sec-env-file-review')?.status).toBe('warn');
    expect(JSON.stringify(checks)).not.toContain('sample:sample');
  });
});
