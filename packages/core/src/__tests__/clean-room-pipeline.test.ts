import { describe, it, expect, afterEach } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { verifyProject } from '../engine.js';

describe('clean-room isolation in verification pipeline', () => {
  const testRoots: string[] = [];

  afterEach(async () => {
    for (const r of testRoots) {
      try {
        await fs.rm(r, { recursive: true, force: true });
      } catch {}
    }
    testRoots.length = 0;
  });

  it('proves that apps working locally due to uncommitted node_modules fail in clean-room verification', async () => {
    const dirtyDir = path.join(os.tmpdir(), `rp-pipeline-dirty-${Date.now()}`);
    testRoots.push(dirtyDir);

    await fs.mkdir(path.join(dirtyDir, 'node_modules', 'untracked-pkg'), { recursive: true });

    // Package.json has NO dependencies declared
    await fs.writeFile(
      path.join(dirtyDir, 'package.json'),
      JSON.stringify(
        {
          name: 'untracked-dep-app',
          version: '1.0.0',
          scripts: {
            start: 'node server.js',
          },
          dependencies: {},
        },
        null,
        2
      )
    );

    // Host node_modules has untracked-pkg
    await fs.writeFile(
      path.join(dirtyDir, 'node_modules', 'untracked-pkg', 'index.js'),
      'module.exports = { secretValue: 42 };'
    );

    // server.js imports the untracked package
    await fs.writeFile(
      path.join(dirtyDir, 'server.js'),
      `const http = require('node:http');
const { secretValue } = require('untracked-pkg');
const server = http.createServer((req, res) => res.end('ok ' + secretValue));
server.listen(3000);
`
    );

    // Run verification through clean-room sandbox (skipSandbox: false)
    const report = await verifyProject({
      projectDir: dirtyDir,
      skipSandbox: false,
      config: {
        start: {
          timeoutMs: 3000,
        },
      },
    });

    // The clean room MUST NOT inherit host node_modules, so server fails to start
    expect(report.verdict).toBe('NOT_READY');
    const runtimeFailure = report.checks.find(
      (c) => c.category === 'runtime' && c.status === 'block'
    );
    expect(runtimeFailure).toBeDefined();
  });
});
