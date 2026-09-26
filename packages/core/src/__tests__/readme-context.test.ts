import { afterEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { runReadmeContractCheck } from '../checks/readme.js';

describe('README shell directory context', () => {
  const roots: string[] = [];
  afterEach(async () => {
    for (const root of roots) await fs.rm(root, { recursive: true, force: true });
    roots.length = 0;
  });

  it('checks npm scripts against the package selected by cd', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rp-readme-cd-'));
    roots.push(root);
    const nested = path.join(root, 'examples', 'react');
    await fs.mkdir(nested, { recursive: true });
    await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts: { server: 'node server.js' } }));
    await fs.writeFile(path.join(nested, 'package.json'), JSON.stringify({ scripts: { build: 'vite build', serve: 'vite preview' } }));
    await fs.writeFile(path.join(root, 'README.md'), '# Examples\n```sh\n$ cd examples/react\n$ npm run build\n$ npm run serve\n```\n');
    const checks = await runReadmeContractCheck(root);
    expect(checks.find((check) => check.id === 'readme-invalid-scripts')).toBeUndefined();
  });

  it('still blocks a missing script in the selected package', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rp-readme-missing-'));
    roots.push(root);
    await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts: { start: 'node server.js' } }));
    await fs.writeFile(path.join(root, 'README.md'), '# Run\n```sh\n$ npm run deploy\n```\n');
    const checks = await runReadmeContractCheck(root);
    expect(checks.find((check) => check.id === 'readme-invalid-scripts')?.status).toBe('block');
  });
});
