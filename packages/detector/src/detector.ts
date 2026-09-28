import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { PackageManagerType, ProjectProfile } from '@releaseproof/schemas';
import { detectPackageManager } from './package-managers.js';
import { analyzeFrameworks } from './frameworks.js';
import { discoverStaticRoutes } from './routes.js';

const TARGET_SCAN_IGNORES = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.releaseproof', '.venv', 'venv', '__pycache__', 'fixtures', 'examples', 'benchmarks', 'docs', 'scripts', 'packages']);

export async function detectProject(projectDir: string, packageManagerOverride?: PackageManagerType): Promise<ProjectProfile> {
  const absoluteDir = path.resolve(projectDir);
  const packageManager = await detectPackageManager(absoluteDir, packageManagerOverride);
  const analysis = await analyzeFrameworks(absoluteDir, packageManager);
  const routes = await discoverStaticRoutes(absoluteDir);

  const entrypoints = routes.map((r) => r.path);

  // Runtime info
  const runtimes: ProjectProfile['runtime'] = [];
  if (analysis.languages.includes('javascript') || analysis.languages.includes('typescript')) {
    runtimes.push({ type: 'node', version: process.version });
  }
  if (analysis.languages.includes('python')) {
    runtimes.push({ type: 'python' });
  }
  if (analysis.capabilities.docker) {
    runtimes.push({ type: 'docker' });
  }

  const targetCandidates = await discoverTargetCandidates(absoluteDir, analysis);

  return {
    root: absoluteDir,
    name: analysis.name,
    languages: analysis.languages,
    frameworks: analysis.frameworks,
    runtime: runtimes,
    packageManagers: [packageManager],
    commands: analysis.commands,
    ports: analysis.ports,
    environmentVariables: [],
    capabilities: analysis.capabilities,
    entrypoints,
    targetCandidates,
  };
}

/**
 * Discover only explicit, shallow workspace candidates. This is deliberately
 * conservative: ReleaseProof presents candidates for user selection instead
 * of pretending it understands arbitrary monorepo orchestration.
 */
async function discoverTargetCandidates(
  root: string,
  rootAnalysis: Awaited<ReturnType<typeof analyzeFrameworks>>,
): Promise<NonNullable<ProjectProfile['targetCandidates']>> {
  const candidates: NonNullable<ProjectProfile['targetCandidates']> = [];
  const add = (relativePath: string, analysis: Awaited<ReturnType<typeof analyzeFrameworks>>, kind: 'node' | 'python' | 'mixed' | 'unknown', reasons: string[]) => {
    // A build-only workspace is not a runnable application target. The
    // verifier needs an explicit production start command (or a framework
    // preview command) before it can make a runtime readiness claim.
    const runnable = Boolean(analysis.commands.start);
    candidates.push({
      path: relativePath,
      name: analysis.name,
      kind,
      confidence: runnable ? 0.9 : 0.55,
      frameworks: analysis.frameworks,
      commands: { install: analysis.commands.install, build: analysis.commands.build, start: analysis.commands.start },
      runnable,
      reasons,
    });
  };

  const rootKind = rootAnalysis.languages.includes('javascript') && rootAnalysis.languages.includes('python')
    ? 'mixed'
    : rootAnalysis.languages.includes('javascript') ? 'node' : rootAnalysis.languages.includes('python') ? 'python' : 'unknown';
  add('.', rootAnalysis, rootKind, ['Selected project root.']);

  async function walk(dir: string, relative: string, depth: number): Promise<void> {
    if (depth > 2) return;
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (!entry.isDirectory() || TARGET_SCAN_IGNORES.has(entry.name) || entry.name.startsWith('.')) continue;
      const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
      const child = path.join(dir, entry.name);
      let hasNode = false;
      let hasPython = false;
      try { await fs.access(path.join(child, 'package.json')); hasNode = true; } catch {}
      try {
        await Promise.any([
          fs.access(path.join(child, 'pyproject.toml')),
          fs.access(path.join(child, 'requirements.txt')),
          fs.access(path.join(child, 'main.py')),
        ]);
        hasPython = true;
      } catch {}
      if (hasNode || hasPython) {
        const manager = await detectPackageManager(child);
        const analysis = await analyzeFrameworks(child, manager);
        const kind = hasNode && hasPython ? 'mixed' : hasNode ? 'node' : 'python';
        add(childRelative, analysis, kind, ['Nested project manifest detected.']);
      }
      await walk(child, childRelative, depth + 1);
    }
  }

  await walk(root, '', 0);
  // Keep the root first and provide stable ordering for the UI/JSON contract.
  return candidates.filter((candidate, index, all) => all.findIndex((item) => item.path === candidate.path) === index)
    .sort((a, b) => a.path === '.' ? -1 : b.path === '.' ? 1 : a.path.localeCompare(b.path));
}
