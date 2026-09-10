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
});
