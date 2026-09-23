import { describe, it, expect, afterEach } from 'vitest';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { detectProject } from '../index.js';

describe('detector', () => {
  const testRoot = path.join(os.tmpdir(), `test-detector-${Date.now()}`);

  afterEach(async () => {
    try {
      await fs.rm(testRoot, { recursive: true, force: true });
    } catch {}
  });

  it('detects Next.js application with app router and pnpm', async () => {
    await fs.mkdir(path.join(testRoot, 'app', 'dashboard'), { recursive: true });
    await fs.writeFile(
      path.join(testRoot, 'package.json'),
      JSON.stringify({
        name: 'my-next-app',
        scripts: { build: 'next build', start: 'next start' },
        dependencies: { next: '15.0.0', react: '19.0.0' },
      })
    );
    await fs.writeFile(path.join(testRoot, 'pnpm-lock.yaml'), '');
    await fs.writeFile(path.join(testRoot, 'app', 'page.tsx'), 'export default () => <div>Home</div>');
    await fs.writeFile(path.join(testRoot, 'app', 'dashboard', 'page.tsx'), 'export default () => <div>Dashboard</div>');

    const profile = await detectProject(testRoot);

    expect(profile.name).toBe('my-next-app');
    expect(profile.frameworks[0].type).toBe('nextjs');
    expect(profile.packageManagers[0].type).toBe('pnpm');
    expect(profile.commands.build).toBe('pnpm build');
    expect(profile.commands.install).toBe('pnpm install --frozen-lockfile');
    expect(profile.commands.start).toBe('pnpm start');
    expect(profile.capabilities.browser).toBe(true);
    expect(profile.entrypoints).toContain('/');
    expect(profile.entrypoints).toContain('/dashboard');
  });

  it('uses lockfile-enforcing npm installation when package-lock exists', async () => {
    await fs.mkdir(testRoot, { recursive: true });
    await fs.writeFile(path.join(testRoot, 'package.json'), JSON.stringify({ name: 'locked-node-app' }));
    await fs.writeFile(path.join(testRoot, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3 }));
    const profile = await detectProject(testRoot);
    expect(profile.commands.install).toBe('npm ci');
  });

  it('uses the Vite production preview port rather than the dev-server port', async () => {
    await fs.mkdir(testRoot, { recursive: true });
    await fs.writeFile(path.join(testRoot, 'package.json'), JSON.stringify({
      name: 'vite-app', dependencies: { vite: '6.0.0' }, scripts: { build: 'vite build', preview: 'vite preview' },
    }));
    const profile = await detectProject(testRoot);
    expect(profile.ports).toContain(4173);
    expect(profile.ports).not.toContain(5173);
    expect(profile.commands.start).toContain('--host 127.0.0.1 --port 4173');
  });

  it('does not append Vite flags to a custom preview runtime', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rp-detector-vite-custom-'));
    try {
      await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({
        name: 'vite-custom-preview',
        dependencies: { vite: '6.0.0' },
        scripts: { preview: 'node server.cjs' },
      }));
      await fs.writeFile(path.join(root, 'server.cjs'), 'require("node:http").createServer((_q,r)=>r.end("ok")).listen(5173);');
      const profile = await detectProject(root);
      expect(profile.commands.start).toBe('npm run preview');
      expect(profile.ports).toContain(5173);
      expect(profile.ports).not.toContain(4173);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('detects FastAPI application with uvicorn', async () => {
    await fs.mkdir(testRoot, { recursive: true });
    await fs.writeFile(
      path.join(testRoot, 'requirements.txt'),
      'fastapi==0.115.0\nuvicorn==0.32.0'
    );
    await fs.writeFile(
      path.join(testRoot, 'main.py'),
      `from fastapi import FastAPI\napp = FastAPI()\n@app.get("/items")\ndef read_items(): return []`
    );

    const profile = await detectProject(testRoot);

    expect(profile.frameworks[0].type).toBe('fastapi');
    expect(profile.languages).toContain('python');
    expect(profile.ports).toContain(8000);
    expect(profile.entrypoints).toContain('/items');
    expect(profile.capabilities.api).toBe(true);
  });
});
