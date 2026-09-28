import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { CheckResult, PackageManagerType, ReleaseProofPackageManager } from '@releaseproof/schemas';

const nodeLockfiles = new Map<PackageManagerType, string>([
  ['npm', 'package-lock.json'],
  ['pnpm', 'pnpm-lock.yaml'],
  ['yarn', 'yarn.lock'],
]);
const pythonLockfiles = new Map<PackageManagerType, string>([
  ['pip', 'requirements.txt'],
  ['uv', 'uv.lock'],
  ['poetry', 'poetry.lock'],
]);

export interface PackageManagerPolicy {
  canExecute: boolean;
  manager?: PackageManagerType;
  findings: CheckResult[];
}

/** Resolve manager ambiguity before installation so it cannot become a false application blocker. */
export async function inspectPackageManagerPolicy(
  projectDir: string,
  languages: string[],
  detectedManager: PackageManagerType | undefined,
  override?: ReleaseProofPackageManager,
): Promise<PackageManagerPolicy> {
  const hasNode = languages.includes('javascript') || languages.includes('typescript');
  const hasPython = languages.includes('python');
  if (!hasNode && !hasPython && override) {
    return unavailable(`Package manager ${override} was selected, but no Node.js or Python target was detected.`);
  }
  if (hasNode && hasPython) {
    return unavailable('This target combines Node.js and Python runtimes. Select a single runnable subproject or configure a dedicated target before choosing one package manager.');
  }

  if (hasNode) {
    if (override && !nodeLockfiles.has(override)) {
      return unavailable(`Package manager ${override} is for Python projects, but this target is Node.js.`);
    }
    const manifest = await readPackageManifest(projectDir);
    const declared = parseDeclaredNodeManager(manifest?.packageManager);
    if (!override && typeof manifest?.packageManager === 'string' && !declared) {
      return unavailable(`package.json declares an unsupported packageManager value (${manifest.packageManager}).`);
    }
    const locks = await existingFiles(projectDir, [...nodeLockfiles.values()]);
    const selected = override ?? declared ?? (locks.length === 1
      ? [...nodeLockfiles.entries()].find(([, lockfile]) => lockfile === locks[0])?.[0]
      : locks.length === 0 && detectedManager && nodeLockfiles.has(detectedManager) ? detectedManager : undefined);

    if (!selected || !nodeLockfiles.has(selected)) {
      if (locks.length > 1) {
        return unavailable(`Multiple Node lockfiles were found (${locks.join(', ')}) with no packageManager declaration or explicit --package-manager selection.`);
      }
      return { canExecute: true, findings: [] };
    }

    const selectedLock = nodeLockfiles.get(selected)!;
    if (locks.length > 0 && !locks.includes(selectedLock)) {
      return unavailable(`Selected package manager ${selected} has no matching ${selectedLock}, while a different Node lockfile is present (${locks.join(', ')}).`);
    }
    if (locks.length > 1) {
      return warning(`Using ${selectedLock} for ${selected}; other lockfiles are ignored because the project declares or explicitly selects this manager.`, locks, selected);
    }
    if (override && declared && override !== declared) {
      return warning(`The explicit ${override} selection overrides package.json packageManager=${declared}.`, locks, selected);
    }
    return { canExecute: true, manager: selected, findings: [] };
  }

  if (hasPython) {
    if (override && !pythonLockfiles.has(override)) {
      return unavailable(`Package manager ${override} is for Node.js projects, but this target is Python.`);
    }
    const manifest = await readText(path.join(projectDir, 'pyproject.toml'));
    const hasUvConfig = Boolean(manifest && /\[tool\.uv(?:\.|\])/m.test(manifest));
    const hasPoetryConfig = Boolean(manifest && /\[tool\.poetry(?:\.|\])/m.test(manifest));
    const locks = await existingFiles(projectDir, [...pythonLockfiles.values()]);
    const selected = override ?? (hasPoetryConfig ? 'poetry' : hasUvConfig ? 'uv' : detectedManager);

    if (selected === 'poetry') {
      return unavailable('Poetry projects are detected, but this milestone does not yet provide a verified Poetry install environment.');
    }
    if (selected !== 'pip' && selected !== 'uv') {
      return unavailable('No supported Python package manager could be selected for this target.');
    }
    if (selected === 'pip' && (locks.includes('uv.lock') || locks.includes('poetry.lock')) && !locks.includes('requirements.txt')) {
      return unavailable(`pip cannot honor the available Python lockfile(s): ${locks.join(', ')}.`);
    }
    if (selected === 'uv' && locks.includes('poetry.lock') && !locks.includes('uv.lock')) {
      return unavailable('uv cannot honor poetry.lock. Select a target with uv.lock or provide a pip requirements.txt for this verification.');
    }
    if (!override && locks.length > 1 && !hasUvConfig && !hasPoetryConfig) {
      return unavailable(`Multiple Python dependency files were found (${locks.join(', ')}) without an explicit tool configuration or --package-manager selection.`);
    }
    if (locks.length > 1) {
      return warning(`Using ${selected} for the selected Python dependency file; other dependency files are ignored.`, locks, selected);
    }
    if (selected === 'uv' && !locks.includes('uv.lock')) {
      return warning('uv is available for this project, but no uv.lock was found; dependency resolution is not frozen.', locks, selected);
    }
    return { canExecute: true, manager: selected, findings: [] };
  }

  return { canExecute: true, findings: [] };
}

function unavailable(summary: string): PackageManagerPolicy {
  return {
    canExecute: false,
    findings: [{
      id: 'package-manager-selection',
      title: 'Dependency manager selection is ambiguous or unavailable',
      category: 'install',
      status: 'unknown',
      severity: 'high',
      classification: 'VERIFICATION_UNAVAILABLE',
      summary,
      evidence: [],
      remediation: 'Select the runnable Node.js or Python target and pass its compatible --package-manager, or make the repository lockfiles and manager declaration consistent.',
    }],
  };
}

function warning(summary: string, lockfiles: string[], manager: PackageManagerType): PackageManagerPolicy {
  return {
    canExecute: true,
    manager,
    findings: [{
      id: 'package-manager-selection',
      title: 'Package manager selection recorded',
      category: 'install',
      status: 'warn',
      severity: 'low',
      classification: 'VERIFICATION_UNAVAILABLE',
      summary,
      evidence: lockfiles.map((filePath) => ({
        type: 'filesystem' as const,
        path: filePath,
        exists: true,
        contentPreview: 'Detected dependency lock/config file.',
      })),
    }],
  };
}

function parseDeclaredNodeManager(value: unknown): PackageManagerType | undefined {
  if (typeof value !== 'string') return undefined;
  return /^(npm|pnpm|yarn)@/.exec(value)?.[1] as PackageManagerType | undefined;
}

async function readPackageManifest(projectDir: string): Promise<{ packageManager?: unknown } | undefined> {
  try { return JSON.parse(await fs.readFile(path.join(projectDir, 'package.json'), 'utf8')) as { packageManager?: unknown }; }
  catch { return undefined; }
}

async function readText(filePath: string): Promise<string | undefined> {
  try { return await fs.readFile(filePath, 'utf8'); }
  catch { return undefined; }
}

async function existingFiles(projectDir: string, candidates: string[]): Promise<string[]> {
  const present: string[] = [];
  for (const candidate of candidates) {
    try {
      if ((await fs.stat(path.join(projectDir, candidate))).isFile()) present.push(candidate);
    } catch {}
  }
  return present;
}
