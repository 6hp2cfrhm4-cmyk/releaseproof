import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { CheckResult, FilesystemEvidence } from '@releaseproof/schemas';

const NODE_BUILT_INS = new Set([
  'fs',
  'node:fs',
  'fs/promises',
  'node:fs/promises',
  'path',
  'node:path',
  'http',
  'node:http',
  'https',
  'node:https',
  'os',
  'node:os',
  'crypto',
  'node:crypto',
  'child_process',
  'node:child_process',
  'stream',
  'node:stream',
  'util',
  'node:util',
  'events',
  'node:events',
  'url',
  'node:url',
  'net',
  'node:net',
  'buffer',
  'node:buffer',
]);

export async function runDevVsProdCheck(projectDir: string): Promise<CheckResult | null> {
  let pkgJsonRaw: string;
  try {
    pkgJsonRaw = await fs.readFile(path.join(projectDir, 'package.json'), 'utf-8');
  } catch {
    return null;
  }

  let pkgJson: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  try {
    pkgJson = JSON.parse(pkgJsonRaw);
  } catch {
    return null;
  }

  const prodDeps = new Set(Object.keys(pkgJson.dependencies || {}));
  const devDeps = new Set(Object.keys(pkgJson.devDependencies || {}));

  // Look for runtime code files in server/src
  const serverFiles = ['src/server.ts', 'server.js', 'src/app.ts', 'app.js', 'src/index.ts', 'index.js'];
  const mismatches: { pkg: string; file: string; line: number }[] = [];

  for (const relFile of serverFiles) {
    const fullPath = path.join(projectDir, relFile);
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // match import ... from 'pkg' or require('pkg')
        const importMatch = line.match(/(?:from\s+['"]([^'"]+)['"]|require\(['"]([^'"]+)['"]\))/);
        if (importMatch) {
          const rawPkg = importMatch[1] || importMatch[2];
          if (!rawPkg || rawPkg.startsWith('.') || rawPkg.startsWith('/')) continue;
          const pkgName = rawPkg.startsWith('@')
            ? rawPkg.split('/').slice(0, 2).join('/')
            : rawPkg.split('/')[0];

          if (NODE_BUILT_INS.has(pkgName)) continue;

          // If package is in devDependencies but NOT in dependencies
          if (devDeps.has(pkgName) && !prodDeps.has(pkgName)) {
            mismatches.push({ pkg: pkgName, file: relFile, line: i + 1 });
          }
        }
      }
    } catch {}
  }

  if (mismatches.length > 0) {
    const evidence: FilesystemEvidence[] = mismatches.map((m) => ({
      type: 'filesystem',
      path: `${m.file}:${m.line}`,
      exists: true,
      contentPreview: `Package '${m.pkg}' is imported at runtime but only declared in devDependencies.`,
    }));

    return {
      id: 'dev-prod-dependency-mismatch',
      title: 'Runtime dependency declared only in devDependencies',
      category: 'runtime',
      status: 'block',
      severity: 'blocker',
      summary: `Found ${mismatches.length} runtime package(s) mistakenly placed in devDependencies: ${Array.from(new Set(mismatches.map((m) => m.pkg))).join(', ')}. This works locally with full node_modules but will crash in production!`,
      evidence,
      remediation: `Move packages to 'dependencies' via: npm install ${Array.from(new Set(mismatches.map((m) => m.pkg))).join(' ')} --save-prod`,
    };
  }

  return {
    id: 'dev-prod-dependency-mismatch',
    title: 'Dependencies correctly configured for production',
    category: 'runtime',
    status: 'pass',
    severity: 'info',
    summary: 'All scanned runtime module imports are declared in production dependencies.',
    evidence: [],
  };
}
