import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export const BUILT_IN_ENV_VARS = new Set([
  'NODE_ENV',
  'PORT',
  'HOST',
  'CI',
  'PATH',
  'PWD',
  'HOME',
  'USER',
  'SHELL',
  'npm_package_version',
  'npm_package_name',
]);

const IGNORED_DIRS = new Set([
  'node_modules',
  '.next',
  'dist',
  'build',
  'out',
  '.git',
  '.venv',
  'venv',
  '__pycache__',
  '.turbo',
  '.releaseproof',
  '__tests__',
]);

const VALID_EXTENSIONS = new Set([
  '.js',
  '.ts',
  '.jsx',
  '.tsx',
  '.mjs',
  '.cjs',
  '.py',
]);

export interface EnvUsage {
  variable: string;
  files: string[];
}

/**
 * Scans code files to discover environment variables accessed by the application.
 */
export async function scanCodeForEnvVars(projectDir: string, ignoreDirs: string[] = []): Promise<Map<string, string[]>> {
  const envMap = new Map<string, Set<string>>();
  const customIgnore = new Set(ignoreDirs);

  async function walk(currentDir: string) {
    let entries;
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name) || customIgnore.has(entry.name)) continue;

      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        if (entry.name.includes('.test.') || entry.name.includes('.spec.')) {
          continue;
        }
        const ext = path.extname(entry.name).toLowerCase();
        if (VALID_EXTENSIONS.has(ext)) {
          const relPath = path.relative(projectDir, fullPath);
          await scanFile(fullPath, relPath, envMap);
        }
      }
    }
  }

  await walk(projectDir);

  const result = new Map<string, string[]>();
  for (const [v, files] of envMap.entries()) {
    result.set(v, Array.from(files));
  }
  return result;
}

async function scanFile(filePath: string, relPath: string, envMap: Map<string, Set<string>>) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');

    // JS/TS: process.env.XYZ or process.env['XYZ'] or process.env["XYZ"]
    const processEnvRegex = /process\.env(?:\.([a-zA-Z_][a-zA-Z0-9_]*)|\[['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]\])/g;
    let m: RegExpExecArray | null;
    while ((m = processEnvRegex.exec(content)) !== null) {
      const varName = m[1] || m[2];
      if (varName && !BUILT_IN_ENV_VARS.has(varName)) {
        addVar(envMap, varName, relPath);
      }
    }

    // JS/TS: import.meta.env.XYZ or import.meta.env['XYZ']
    const importMetaRegex = /import\.meta\.env(?:\.([a-zA-Z_][a-zA-Z0-9_]*)|\[['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]\])/g;
    while ((m = importMetaRegex.exec(content)) !== null) {
      const varName = m[1] || m[2];
      if (varName && !BUILT_IN_ENV_VARS.has(varName)) {
        addVar(envMap, varName, relPath);
      }
    }

    // Python: os.environ.get('XYZ') or os.getenv('XYZ') or os.environ['XYZ']
    const pythonEnvRegex = /os\.(?:environ\.get|getenv|environ)\(\s*['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]\s*\)|os\.environ\[['"]([a-zA-Z_][a-zA-Z0-9_]*)['"]\]/g;
    while ((m = pythonEnvRegex.exec(content)) !== null) {
      const varName = m[1] || m[2];
      if (varName && !BUILT_IN_ENV_VARS.has(varName)) {
        addVar(envMap, varName, relPath);
      }
    }
  } catch {}
}

function addVar(envMap: Map<string, Set<string>>, varName: string, relPath: string) {
  let set = envMap.get(varName);
  if (!set) {
    set = new Set();
    envMap.set(varName, set);
  }
  set.add(relPath);
}
