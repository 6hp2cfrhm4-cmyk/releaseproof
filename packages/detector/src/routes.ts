import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface DiscoveredRoute {
  path: string;
  type: 'page' | 'api';
  method?: string;
  sourceFile?: string;
}

/**
 * Discovers routes statically from the file system.
 */
export async function discoverStaticRoutes(projectDir: string): Promise<DiscoveredRoute[]> {
  const routes: DiscoveredRoute[] = [];
  const visited = new Set<string>();

  const addRoute = (r: DiscoveredRoute) => {
    const key = `${r.method || 'GET'}:${r.path}`;
    if (!visited.has(key)) {
      visited.add(key);
      routes.push(r);
    }
  };

  // Always include root
  addRoute({ path: '/', type: 'page', method: 'GET' });

  // 1. Next.js App Router (app/ or src/app/)
  for (const appDir of ['app', 'src/app']) {
    const fullAppPath = path.join(projectDir, appDir);
    try {
      await scanAppRouter(fullAppPath, '', addRoute);
    } catch {
      // Directory doesn't exist
    }
  }

  // 2. Next.js Pages Router (pages/ or src/pages/)
  for (const pagesDir of ['pages', 'src/pages']) {
    const fullPagesPath = path.join(projectDir, pagesDir);
    try {
      await scanPagesRouter(fullPagesPath, '', addRoute);
    } catch {
      // Directory doesn't exist
    }
  }

  // 3. Scan main/routes files for Express / FastAPI routes
  const codeFiles = ['src/index.ts', 'src/server.ts', 'server.js', 'index.js', 'app.js', 'main.py', 'app/main.py'];
  for (const relFile of codeFiles) {
    try {
      const content = await fs.readFile(path.join(projectDir, relFile), 'utf-8');
      scanRoutesInFile(content, relFile, addRoute);
    } catch {}
  }

  return routes;
}

async function scanAppRouter(
  currentDir: string,
  relRoute: string,
  addRoute: (r: DiscoveredRoute) => void
) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const subPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      // Ignore route groups like (marketing)
      const segment = entry.name.startsWith('(') && entry.name.endsWith(')')
        ? ''
        : entry.name;
      const nextRoute = segment ? `${relRoute}/${segment}` : relRoute;
      await scanAppRouter(subPath, nextRoute, addRoute);
    } else if (entry.isFile()) {
      if (/^page\.(tsx|jsx|js|ts)$/.test(entry.name)) {
        addRoute({
          path: relRoute || '/',
          type: 'page',
          method: 'GET',
          sourceFile: subPath,
        });
      } else if (/^route\.(ts|js)$/.test(entry.name)) {
        addRoute({
          path: relRoute || '/',
          type: 'api',
          method: 'GET',
          sourceFile: subPath,
        });
      }
    }
  }
}

async function scanPagesRouter(
  currentDir: string,
  relRoute: string,
  addRoute: (r: DiscoveredRoute) => void
) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    const subPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      await scanPagesRouter(subPath, `${relRoute}/${entry.name}`, addRoute);
    } else if (entry.isFile()) {
      const baseName = entry.name.replace(/\.(tsx|jsx|js|ts)$/, '');
      if (['_app', '_document', '_error'].includes(baseName)) continue;

      let routePath = baseName === 'index' ? relRoute || '/' : `${relRoute}/${baseName}`;
      if (!routePath.startsWith('/')) routePath = `/${routePath}`;

      const isApi = routePath.startsWith('/api');
      addRoute({
        path: routePath,
        type: isApi ? 'api' : 'page',
        method: 'GET',
        sourceFile: subPath,
      });
    }
  }
}

function scanRoutesInFile(
  content: string,
  relFile: string,
  addRoute: (r: DiscoveredRoute) => void
) {
  // Express patterns: app.get('/foo', ...) or router.get('/foo', ...)
  const expressRegex = /(?:app|router)\.(get|post|put|delete|patch)\(\s*['"`]([^'"`]+)['"`]/g;
  let match: RegExpExecArray | null;
  while ((match = expressRegex.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const route = match[2];
    if (route.startsWith('/') && !route.includes(':')) {
      addRoute({
        path: route,
        type: route.startsWith('/api') ? 'api' : 'page',
        method,
        sourceFile: relFile,
      });
    }
  }

  // FastAPI patterns: @app.get("/foo") or @router.get("/foo")
  const fastApiRegex = /@(?:app|router)\.(get|post|put|delete|patch)\(\s*['"`]([^'"`]+)['"`]/g;
  while ((match = fastApiRegex.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const route = match[2];
    if (route.startsWith('/') && !route.includes('{')) {
      addRoute({
        path: route,
        type: 'api',
        method,
        sourceFile: relFile,
      });
    }
  }
}
