import { describe, it, expect } from 'vitest';
import * as http from 'node:http';
import { execCommand, isPortListening, waitForPort } from '../index.js';

describe('runner', () => {
  it('executes a command and captures stdout/stderr', async () => {
    const res = await execCommand('node -e "console.log(\'hello\'); console.error(\'world\')"');
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toContain('hello');
    expect(res.stderr).toContain('world');
    expect(res.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('captures non-zero exit code', async () => {
    const res = await execCommand('node -e "process.exit(42)"');
    expect(res.exitCode).toBe(42);
  });

  it('does not inherit arbitrary host secrets unless explicitly allowed', async () => {
    const key = 'RELEASEPROOF_TEST_SECRET';
    const previous = process.env[key];
    process.env[key] = 'synthetic-secret-value';
    try {
      const isolated = await execCommand(`node -e "console.log(process.env.${key} || 'absent')"`);
      expect(isolated.stdout.trim()).toBe('absent');

      const allowed = await execCommand(`node -e "console.log(process.env.${key} || 'absent')"`, {
        allowHostEnv: [key],
      });
      expect(allowed.stdout.trim()).toBe('synthetic-secret-value');
    } finally {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    }
  });

  it('handles command timeout properly', async () => {
    const res = await execCommand('node -e "setTimeout(() => {}, 10000)"', {
      timeoutMs: 500,
    });
    expect(res.timedOut).toBe(true);
  });

  it('detects listening port and waits for it', async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200);
      res.end('OK');
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 0;
    expect(port).toBeGreaterThan(0);

    const isListening = await isPortListening(port);
    expect(isListening).toBe(true);

    const ready = await waitForPort(port, { timeoutMs: 1000 });
    expect(ready).toBe(true);

    server.close();
    await new Promise((resolve) => setTimeout(resolve, 100));

    const isClosed = await isPortListening(port);
    expect(isClosed).toBe(false);
  });
});
