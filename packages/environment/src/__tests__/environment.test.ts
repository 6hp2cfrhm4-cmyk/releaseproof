import { describe, it, expect, afterEach } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { analyzeEnvironment } from '../index.js';

describe('environment analysis', () => {
  const testRoot = path.join(os.tmpdir(), `test-env-${Date.now()}`);

  afterEach(async () => {
    try {
      await fs.rm(testRoot, { recursive: true, force: true });
    } catch {}
  });

  it('detects undocumented variables and client exposed secrets', async () => {
    await fs.mkdir(path.join(testRoot, 'src'), { recursive: true });
    await fs.writeFile(
      path.join(testRoot, '.env.example'),
      'PORT=3000\nDATABASE_URL=\n'
    );
    await fs.writeFile(
      path.join(testRoot, 'src', 'app.ts'),
      `
      const db = process.env.DATABASE_URL;
      const stripeKey = process.env.STRIPE_SECRET_KEY; // Undocumented
      const clientSecret = process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY; // Leaked secret!
      `
    );

    const checks = await analyzeEnvironment(testRoot);

    const clientSecretCheck = checks.find((c) => c.id === 'env-exposed-client-secrets');
    const undocumentedCheck = checks.find((c) => c.id === 'env-undocumented-variables');

    expect(clientSecretCheck).toBeDefined();
    expect(clientSecretCheck?.status).toBe('block');

    expect(undocumentedCheck).toBeDefined();
    expect(undocumentedCheck?.summary).toContain('STRIPE_SECRET_KEY');
  });
});
