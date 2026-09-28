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

  it('honors packageManager declarations and explicit Node manager overrides', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rp-detector-manager-'));
    try {
      await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({
        name: 'manager-override', packageManager: 'pnpm@9.15.0',
        dependencies: { express: '4.21.0' }, scripts: { start: 'node server.js', build: 'node build.js' },
      }));
      await fs.writeFile(path.join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9');

      const declared = await detectProject(root);
      expect(declared.packageManagers[0]?.type).toBe('pnpm');
      expect(declared.commands.install).toBe('pnpm install --frozen-lockfile');

      const overridden = await detectProject(root, 'npm');
      expect(overridden.packageManagers[0]?.type).toBe('npm');
      expect(overridden.commands.install).toBe('npm install');
      expect(overridden.commands.start).toBe('npm run start');
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('uses uv locked sync for a Python project with uv.lock', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rp-detector-uv-'));
    try {
      await fs.writeFile(path.join(root, 'pyproject.toml'), '[project]\nname="uv-app"\ndependencies=["fastapi"]');
      await fs.writeFile(path.join(root, 'uv.lock'), 'version = 1');
      await fs.writeFile(path.join(root, 'main.py'), 'from fastapi import FastAPI\napp = FastAPI()');
      const profile = await detectProject(root, 'uv');
      expect(profile.packageManagers[0]?.type).toBe('uv');
      expect(profile.commands.install).toBe('uv sync --locked --active');
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
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

  it('uses an Express source-declared default port when the start script has none', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rp-detector-express-port-'));
    try {
      await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({
        name: 'express-default-port',
        dependencies: { express: '4.21.0' },
        scripts: { start: 'node app.js' },
      }));
      await fs.writeFile(path.join(root, 'app.js'), "app.set('port', process.env.PORT || process.env.OPENSHIFT_NODEJS_PORT || 8080);\n");
      const profile = await detectProject(root);
      expect(profile.ports[0]).toBe(8080);
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

  it('surfaces shallow monorepo targets without claiming the root is runnable', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rp-detector-mono-'));
    try {
      await fs.mkdir(path.join(root, 'apps', 'web'), { recursive: true });
      await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'workspace-root', workspaces: ['apps/*'] }));
      await fs.writeFile(path.join(root, 'apps', 'web', 'package.json'), JSON.stringify({
        name: 'web', dependencies: { express: '4.21.0' }, scripts: { start: 'node server.js' },
      }));
      await fs.writeFile(path.join(root, 'apps', 'web', 'server.js'), "require('http').createServer((_q,r)=>r.end('ok')).listen(4100);");
      const profile = await detectProject(root);
      expect(profile.targetCandidates.map((candidate) => candidate.path)).toEqual(['.', 'apps/web']);
      expect(profile.targetCandidates.find((candidate) => candidate.path === 'apps/web')?.runnable).toBe(true);
      expect(profile.targetCandidates.find((candidate) => candidate.path === '.')?.runnable).toBe(false);
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
