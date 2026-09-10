import * as path from 'node:path';
import { ProjectProfile } from '@releaseproof/schemas';
import { detectPackageManager } from './package-managers.js';
import { analyzeFrameworks } from './frameworks.js';
import { discoverStaticRoutes } from './routes.js';

export async function detectProject(projectDir: string): Promise<ProjectProfile> {
  const absoluteDir = path.resolve(projectDir);
  const packageManager = await detectPackageManager(absoluteDir);
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
  };
}
