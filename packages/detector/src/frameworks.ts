import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { FrameworkDetection, PackageManagerInfo } from '@releaseproof/schemas';

interface PackageJson {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  engines?: Record<string, string>;
}

export interface FrameworkAnalysisResult {
  name: string;
  languages: string[];
  frameworks: FrameworkDetection[];
  commands: {
    install?: string;
    dev?: string;
    build?: string;
    start?: string;
    test?: string;
  };
  ports: number[];
  capabilities: {
    browser: boolean;
    api: boolean;
    docker: boolean;
  };
}

export async function analyzeFrameworks(
  projectDir: string,
  packageManager: PackageManagerInfo
): Promise<FrameworkAnalysisResult> {
  let pkgJson: PackageJson | null = null;
  const languages = new Set<string>();
  const frameworks: FrameworkDetection[] = [];
  const ports = new Set<number>();
  let hasBrowser = false;
  let hasApi = false;
  let hasDocker = false;

  const checkExists = async (relPath: string) => {
    try {
      await fs.stat(path.join(projectDir, relPath));
      return true;
    } catch {
      return false;
    }
  };

  if (await checkExists('Dockerfile') || await checkExists('docker-compose.yml') || await checkExists('compose.yaml')) {
    hasDocker = true;
  }

  // Check package.json for JS/TS
  try {
    const raw = await fs.readFile(path.join(projectDir, 'package.json'), 'utf-8');
    pkgJson = JSON.parse(raw) as PackageJson;
  } catch {
    // Not a Node.js project or invalid JSON
  }

  const commands: {
    install?: string;
    dev?: string;
    build?: string;
    start?: string;
    test?: string;
  } = {};

  if (pkgJson) {
    languages.add('javascript');
    if (await checkExists('tsconfig.json') || await checkExists('src/index.ts')) {
      languages.add('typescript');
    }

    const allDeps = {
      ...(pkgJson.dependencies || {}),
      ...(pkgJson.devDependencies || {}),
    };

    const pm = packageManager.type;
    const runPrefix = pm === 'npm' ? 'npm run' : pm;

    // Detect Next.js
    if ('next' in allDeps) {
      frameworks.push({
        type: 'nextjs',
        name: 'Next.js',
        version: allDeps['next'],
        confidence: 1.0,
      });
      hasBrowser = true;
      ports.add(3000);

      // Check app router / pages router for API routes
      if (await checkExists('app/api') || await checkExists('src/app/api') || await checkExists('pages/api') || await checkExists('src/pages/api')) {
        hasApi = true;
      }

      commands.install = `${pm} install`;
      commands.dev = `${runPrefix} dev`;
      commands.build = pkgJson.scripts?.build ? `${runPrefix} build` : `${pm === 'npm' ? 'npx' : pm} next build`;
      commands.start = pkgJson.scripts?.start ? `${runPrefix} start` : `${pm === 'npm' ? 'npx' : pm} next start`;
    }
    // Detect Vite
    else if ('vite' in allDeps) {
      frameworks.push({
        type: 'vite',
        name: 'Vite',
        version: allDeps['vite'],
        confidence: 1.0,
      });
      hasBrowser = true;
      ports.add(5173);

      commands.install = `${pm} install`;
      commands.dev = `${runPrefix} dev`;
      commands.build = pkgJson.scripts?.build ? `${runPrefix} build` : `${pm === 'npm' ? 'npx' : pm} vite build`;
      commands.start = pkgJson.scripts?.preview ? `${runPrefix} preview` : (pkgJson.scripts?.start ? `${runPrefix} start` : `${pm === 'npm' ? 'npx' : pm} vite preview`);
    }
    // Detect Express
    else if ('express' in allDeps) {
      frameworks.push({
        type: 'express',
        name: 'Express',
        version: allDeps['express'],
        confidence: 1.0,
      });
      hasApi = true;
      ports.add(3000);

      commands.install = `${pm} install`;
      commands.dev = pkgJson.scripts?.dev ? `${runPrefix} dev` : undefined;
      commands.build = pkgJson.scripts?.build ? `${runPrefix} build` : undefined;
      commands.start = pkgJson.scripts?.start ? `${runPrefix} start` : undefined;
    }
    // Generic Node
    else {
      frameworks.push({
        type: 'generic-node',
        name: 'Generic Node.js',
        confidence: 0.8,
      });
      if (pkgJson.scripts?.build) commands.build = `${runPrefix} build`;
      if (pkgJson.scripts?.start) commands.start = `${runPrefix} start`;
      if (pkgJson.scripts?.dev) commands.dev = `${runPrefix} dev`;
      commands.install = `${pm} install`;
    }

    if (pkgJson.scripts?.test) {
      commands.test = `${runPrefix} test`;
    }

    // Inspect script strings for port flags like -p 8080 or --port 4000
    for (const script of Object.values(pkgJson.scripts || {})) {
      const match = script.match(/(?:-p|--port|PORT=|listen\()\s*['"]?(\d+)['"]?/);
      if (match && match[1]) {
        ports.add(parseInt(match[1], 10));
      }
    }
  }

  // Check Python (FastAPI / generic)
  const hasRequirements = await checkExists('requirements.txt');
  const hasPyproject = await checkExists('pyproject.toml');
  const hasMainPy = await checkExists('main.py') || await checkExists('app/main.py');

  if (hasRequirements || hasPyproject || hasMainPy) {
    languages.add('python');

    let isFastApi = false;
    let fastApiVersion: string | undefined;

    if (hasRequirements) {
      try {
        const reqs = await fs.readFile(path.join(projectDir, 'requirements.txt'), 'utf-8');
        if (/fastapi/i.test(reqs)) {
          isFastApi = true;
          const match = reqs.match(/fastapi[=><~!^]*([0-9.]+)/i);
          if (match) fastApiVersion = match[1];
        }
      } catch {}
    }

    if (hasPyproject && !isFastApi) {
      try {
        const pyproj = await fs.readFile(path.join(projectDir, 'pyproject.toml'), 'utf-8');
        if (/fastapi/i.test(pyproj)) {
          isFastApi = true;
        }
      } catch {}
    }

    if (!isFastApi && hasMainPy) {
      try {
        const mainPyPath = (await checkExists('main.py')) ? 'main.py' : 'app/main.py';
        const content = await fs.readFile(path.join(projectDir, mainPyPath), 'utf-8');
        if (/from\s+fastapi\s+import|import\s+fastapi/i.test(content)) {
          isFastApi = true;
        }
      } catch {}
    }

    if (isFastApi) {
      frameworks.push({
        type: 'fastapi',
        name: 'FastAPI',
        version: fastApiVersion,
        confidence: 1.0,
      });
      hasApi = true;
      ports.add(8000);

      const isUv = packageManager.type === 'uv';
      commands.install = isUv ? 'uv pip install -r requirements.txt' : 'pip install -r requirements.txt';
      commands.dev = 'python -m uvicorn main:app --reload --port 8000';
      commands.start = 'python -m uvicorn main:app --host 127.0.0.1 --port 8000';
    } else if (languages.has('python') && frameworks.length === 0) {
      frameworks.push({
        type: 'generic-python',
        name: 'Generic Python',
        confidence: 0.7,
      });
      commands.install = packageManager.type === 'uv' ? 'uv pip install -r requirements.txt' : 'pip install -r requirements.txt';
    }
  }

  if (ports.size === 0) {
    ports.add(3000);
  }

  return {
    name: pkgJson?.name || path.basename(projectDir),
    languages: Array.from(languages),
    frameworks,
    commands,
    ports: Array.from(ports),
    capabilities: {
      browser: hasBrowser,
      api: hasApi,
      docker: hasDocker,
    },
  };
}
