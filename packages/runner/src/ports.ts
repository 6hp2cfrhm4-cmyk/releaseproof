import * as net from 'node:net';
import * as http from 'node:http';

/**
 * Tests whether a TCP port is actively accepting connections.
 */
export function isPortListening(port: number, host = '127.0.0.1', timeoutMs = 800): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const cleanup = () => {
      if (!settled) {
        settled = true;
        socket.destroy();
      }
    };

    socket.setTimeout(timeoutMs);

    socket.once('connect', () => {
      cleanup();
      resolve(true);
    });

    socket.once('timeout', () => {
      cleanup();
      resolve(false);
    });

    socket.once('error', () => {
      cleanup();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

/**
 * Polls a port until it becomes ready or exceeds the timeout.
 */
export async function waitForPort(
  port: number,
  options: {
    host?: string;
    timeoutMs?: number;
    intervalMs?: number;
    abortSignal?: AbortSignal;
  } = {}
): Promise<boolean> {
  const host = options.host || '127.0.0.1';
  const timeoutMs = options.timeoutMs ?? 30000;
  const intervalMs = options.intervalMs ?? 300;
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    if (options.abortSignal?.aborted) {
      return false;
    }

    const ready = await isPortListening(port, host, 500);
    if (ready) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return false;
}

/**
 * Makes an HTTP health check request to verify responsiveness.
 */
export function checkHealthEndpoint(
  url: string,
  timeoutMs = 5000
): Promise<{ status: number; ok: boolean; body: string; durationMs: number }> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let settled = false;

    try {
      const parsed = new URL(url);
      const req = http.request(
        {
          hostname: parsed.hostname,
          port: parsed.port || 80,
          path: parsed.pathname + parsed.search,
          method: 'GET',
          headers: {
            'User-Agent': 'ReleaseProof-HealthChecker/0.1.0',
            Accept: '*/*',
          },
          timeout: timeoutMs,
        },
        (res) => {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', (chunk) => {
            if (body.length < 10000) {
              body += chunk;
            }
          });
          res.on('end', () => {
            if (!settled) {
              settled = true;
              const durationMs = Date.now() - startTime;
              const status = res.statusCode || 0;
              resolve({
                status,
                ok: status >= 200 && status < 400,
                body: body.slice(0, 1000),
                durationMs,
              });
            }
          });
        }
      );

      req.on('timeout', () => {
        if (!settled) {
          settled = true;
          req.destroy();
          resolve({
            status: 0,
            ok: false,
            body: 'Connection timed out',
            durationMs: Date.now() - startTime,
          });
        }
      });

      req.on('error', (err) => {
        if (!settled) {
          settled = true;
          resolve({
            status: 0,
            ok: false,
            body: err.message,
            durationMs: Date.now() - startTime,
          });
        }
      });

      req.end();
    } catch (err: unknown) {
      resolve({
        status: 0,
        ok: false,
        body: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - startTime,
      });
    }
  });
}

/**
 * Forcefully frees a port if a lingering process is holding it.
 */
export async function killPortProcess(port: number): Promise<void> {
  if (!port || port <= 0) return;

  if (process.platform === 'win32') {
    try {
      const { execSync } = await import('node:child_process');
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
      for (const line of out.split('\n')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5 && parts[1].endsWith(`:${port}`) && parts[3] === 'LISTENING') {
          const pid = parts[4];
          if (pid && pid !== '0' && pid !== String(process.pid)) {
            try {
              execSync(`taskkill /pid ${pid} /F /T`, { stdio: 'ignore' });
            } catch {}
          }
        }
      }
    } catch {}
  } else {
    try {
      const { execSync } = await import('node:child_process');
      execSync(`fuser -k -9 ${port}/tcp 2>/dev/null || lsof -ti:${port} | xargs -r kill -9 2>/dev/null || true`, {
        shell: '/bin/sh',
        stdio: 'ignore',
      });
    } catch {}
  }
}

/**
 * Waits until a port is no longer accepting connections.
 */
export async function waitForPortClose(
  port: number,
  host = '127.0.0.1',
  timeoutMs = 3000
): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const listening = await isPortListening(port, host, 200);
    if (!listening) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

