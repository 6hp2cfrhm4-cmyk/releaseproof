import pc from 'picocolors';
import { execCommand } from '@releaseproof/runner';
import { detectProject } from '@releaseproof/detector';

export interface DoctorOptions { json?: boolean }
export interface DoctorCapability {
  id: string;
  label: string;
  required: boolean;
  available: boolean;
  version?: string;
  remediation?: string;
}

export async function handleDoctor(targetPath = '.', options: DoctorOptions = {}): Promise<void> {
  const profile = await detectProject(targetPath).catch(() => undefined);
  const needsPython = profile?.languages.includes('python') ?? false;
  const needsNode = Boolean(profile?.languages.some((language) => language === 'javascript' || language === 'typescript'));
  const probes: Array<Promise<DoctorCapability>> = [Promise.resolve({
    id: 'node', label: 'Node.js', required: needsNode, available: majorNodeVersion() >= 20,
    version: process.version, remediation: 'Install Node.js 20 or 22 and retry.',
  })];
  probes.push(probe('npm', 'npm --version', needsNode, 'Install npm with Node.js.'));
  if (needsNode && profile?.packageManagers.some((manager) => manager.type === 'pnpm')) probes.push(probe('pnpm', 'pnpm --version', true, 'Install the project-declared pnpm version or enable Corepack.'));
  if (needsNode && profile?.packageManagers.some((manager) => manager.type === 'yarn')) probes.push(probe('yarn', 'yarn --version', true, 'Install the project-declared Yarn version or enable Corepack.'));
  if (needsPython) probes.push(probe('python', 'python --version', true, 'Install a supported Python interpreter or pass --python-interpreter.'));
  probes.push(probe('playwright', 'node -e "import(\'playwright\').then(()=>process.exit(0)).catch(()=>process.exit(1))"', Boolean(profile?.capabilities.browser), 'Install Playwright browser dependencies; HTTP fallback cannot prove client-side behavior.'));

  const capabilities = await Promise.all(probes);
  const missingRequired = capabilities.filter((capability) => capability.required && !capability.available);
  if (options.json) {
    console.log(JSON.stringify({ target: targetPath, profile, capabilities, ready: missingRequired.length === 0 }));
  } else {
    console.log('');
    console.log(pc.bold('ReleaseProof System Doctor'));
    if (profile) console.log(pc.dim(`Target: ${profile.name} (${profile.frameworks.map((framework) => framework.name).join(', ') || 'unknown stack'})`));
    for (const capability of capabilities) {
      const mark = capability.available ? pc.green('✓') : capability.required ? pc.red('✗') : pc.dim('○');
      console.log(`  ${mark} ${capability.label.padEnd(14)} ${capability.version ?? (capability.available ? 'available' : 'not available')}`);
      if (!capability.available && capability.required && capability.remediation) console.log(pc.dim(`      ${capability.remediation}`));
    }
    console.log('');
    console.log(missingRequired.length === 0 ? pc.green('Required verification capabilities are available.') : pc.yellow(`${missingRequired.length} required capability(ies) are unavailable.`));
  }
  process.exitCode = missingRequired.length === 0 ? 0 : 2;
}

async function probe(id: string, command: string, required: boolean, remediation: string): Promise<DoctorCapability> {
  const result = await execCommand(command, { timeoutMs: 5000 });
  return { id, label: id, required, available: result.exitCode === 0, version: result.exitCode === 0 ? result.stdout.trim() || result.stderr.trim() : undefined, remediation };
}

function majorNodeVersion(): number {
  return Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10);
}
