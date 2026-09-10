import { describe, it, expect } from 'vitest';
import { redactSecrets, redactObject } from '../index.js';

describe('secret redaction layer', () => {
  it('redacts AWS keys from text', () => {
    const raw = 'Connected using key AKIAIOSFODNN7EXAMPLE successfully';
    const clean = redactSecrets(raw);
    expect(clean).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(clean).toContain('AKIA****************');
  });

  it('redacts database passwords in URLs', () => {
    const url = 'postgres://admin:superSecretPass123@db.example.com:5432/production';
    const clean = redactSecrets(url);
    expect(clean).not.toContain('superSecretPass123');
    expect(clean).toContain('postgres://admin:[REDACTED_PASSWORD]@db.example.com:5432/production');
  });

  it('redacts GitHub personal access tokens', () => {
    const token = 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const clean = redactSecrets(token);
    expect(clean).not.toContain('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789');
    expect(clean).toContain('ghp_********************************');
  });

  it('redacts private key blocks', () => {
    const key = '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----';
    const clean = redactSecrets(key);
    expect(clean).toBe('[REDACTED_PRIVATE_KEY]');
  });

  it('deeply redacts nested objects and arrays', () => {
    const data = {
      user: 'alice',
      env: {
        DATABASE_URL: 'postgres://root:p@ssw0rd!@localhost:5432/db',
      },
      tokens: ['ghp_123456789012345678901234567890123456'],
    };

    const redacted = redactObject(data);
    expect(redacted.env.DATABASE_URL).toContain('[REDACTED_PASSWORD]');
    expect(redacted.tokens[0]).toContain('ghp_********************************');
    expect(redacted.user).toBe('alice');
  });
});
