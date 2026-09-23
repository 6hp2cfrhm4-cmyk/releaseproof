import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { verifyBrowserApp, crawlViaHttp } from '../index.js';

describe('browser verification', () => {
  let server: http.Server;
  let port: number;
  let baseUrl: string;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>Home</h1><a href="/about">About</a><a href="/crash">Crash</a></body></html>');
      } else if (req.url === '/about') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>About Us</h1></body></html>');
      } else if (req.url === '/crash') {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal Server Error');
      } else if (req.url === '/delayed') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>Delayed</h1><script>setTimeout(() => { throw new Error("delayed boom") }, 150)</script></body></html>');
      } else if (req.url === '/no-content') {
        res.writeHead(204);
        res.end();
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address();
    port = typeof address === 'object' && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('crawls links and detects 500 server error', async () => {
    const results = await crawlViaHttp({
      baseUrl,
      initialRoutes: ['/'],
      screenshotsDir: path.join(os.tmpdir(), 'rp-test-screenshots'),
    });

    expect(results.length).toBeGreaterThanOrEqual(3);
    const crashPage = results.find((r) => r.url === '/crash');
    expect(crashPage).toBeDefined();
    expect(crashPage?.status).toBe(500);
  });

  it('generates blocker check when 500 error is found', async () => {
    const res = await verifyBrowserApp({
      baseUrl,
      initialRoutes: ['/'],
      screenshotsDir: path.join(os.tmpdir(), 'rp-test-screenshots'),
    });

    const errorCheck = res.checks.find((c) => c.id === 'browser-server-500');
    expect(errorCheck).toBeDefined();
    expect(errorCheck?.status).toBe('block');
    expect(errorCheck?.severity).toBe('blocker');
  });

  it('models Playwright unavailability as HTTP fallback, not browser pass', async () => {
    const res = await verifyBrowserApp({
      baseUrl,
      initialRoutes: ['/about'],
      maxDepth: 0,
      forceHttpFallback: true,
      requiresBrowserRuntime: true,
      screenshotsDir: path.join(os.tmpdir(), 'rp-test-screenshots'),
    });
    expect(res.capabilityStatus).toBe('HTTP_FALLBACK');
    expect(res.checks.find((c) => c.id === 'browser-runtime-unavailable')?.status).toBe('unknown');
    expect(res.checks.find((c) => c.id === 'browser-routes-verified')).toBeUndefined();
  });

  it('treats HTTP 204 as a successful API response rather than a blank browser page', async () => {
    const res = await verifyBrowserApp({
      baseUrl,
      initialRoutes: ['/no-content'],
      maxDepth: 0,
      requiresBrowserRuntime: false,
      screenshotsDir: path.join(os.tmpdir(), 'rp-test-screenshots'),
    });
    expect(res.capabilityStatus).toBe('SKIPPED');
    expect(res.checks.find((c) => c.id === 'browser-blank-page')).toBeUndefined();
    expect(res.checks.find((c) => c.id === 'browser-routes-verified')?.category).toBe('api');
  });

  it('captures a JavaScript exception raised after DOMContentLoaded', async () => {
    const res = await verifyBrowserApp({
      baseUrl,
      initialRoutes: ['/delayed'],
      maxDepth: 0,
      observationWindowMs: 400,
      requiresBrowserRuntime: true,
      screenshotsDir: path.join(os.tmpdir(), 'rp-test-screenshots'),
    });
    expect(res.capabilityStatus).toBe('VERIFIED');
    expect(res.checks.find((c) => c.id === 'browser-uncaught-exceptions')?.status).toBe('block');
  });
});
