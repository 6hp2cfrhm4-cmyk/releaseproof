import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { CheckResult } from '@releaseproof/schemas';

export async function runReadmeContractCheck(
  projectDir: string,
  actualPort?: number
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  let readmeContent: string;

  try {
    readmeContent = await fs.readFile(path.join(projectDir, 'README.md'), 'utf-8');
  } catch {
    // No README file found
    return [
      {
        id: 'readme-missing',
        title: 'Project README missing',
        category: 'documentation',
        status: 'warn',
        severity: 'medium',
        summary: 'No README.md found in project root. Quickstart instructions are missing.',
        evidence: [],
        remediation: 'Create a README.md documenting setup, build, and run instructions.',
      },
    ];
  }

  // 1. Check documented commands vs package.json scripts
  let pkgScripts: Record<string, string> = {};
  try {
    const pkgRaw = await fs.readFile(path.join(projectDir, 'package.json'), 'utf-8');
    const parsed = JSON.parse(pkgRaw);
    pkgScripts = parsed.scripts || {};
  } catch {}

  const commandRegex = /```(?:bash|sh|shell)?\s*\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  const documentedNpmRunCommands: string[] = [];
  const suspiciousInstructions: string[] = [];

  while ((match = commandRegex.exec(readmeContent)) !== null) {
    const block = match[1];
    const lines = block.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();

      // Check for pipe-to-shell patterns
      if (/(?:curl|wget)[^|]*\|\s*(?:ba|z)?sh/i.test(trimmed)) {
        suspiciousInstructions.push(trimmed);
      }

      // Skip comments and descriptive lines
      if (trimmed.startsWith('#') || trimmed.startsWith('//')) {
        continue;
      }

      const cmdLine = trimmed.startsWith('$ ') ? trimmed.slice(2).trim() : trimmed;
      const runMatch = cmdLine.match(/^(?:npm run|pnpm run|pnpm|yarn)\s+([a-zA-Z0-9_:-]+)/);
      if (runMatch && !['install', 'test', 'run'].includes(runMatch[1])) {
        documentedNpmRunCommands.push(runMatch[1]);
      }
    }
  }

  if (suspiciousInstructions.length > 0) {
    results.push({
      id: 'readme-insecure-quickstart',
      title: 'Insecure pipe-to-shell instructions in README',
      category: 'documentation',
      status: 'warn',
      severity: 'high',
      summary: `README suggests piped shell installation (${suspiciousInstructions[0]}), which is unsafe for automated runners.`,
      evidence: [
        {
          type: 'filesystem',
          path: 'README.md',
          exists: true,
          contentPreview: suspiciousInstructions.join('\n'),
        },
      ],
      remediation: 'Replace curl/wget pipe-to-shell instructions with vetted package manager dependencies or verified lockfile scripts.',
    });
  }

  const brokenCommands = documentedNpmRunCommands.filter(
    (cmd) => Object.keys(pkgScripts).length > 0 && !(cmd in pkgScripts)
  );

  if (brokenCommands.length > 0) {
    results.push({
      id: 'readme-invalid-scripts',
      title: 'README documents non-existent script command(s)',
      category: 'documentation',
      status: 'block',
      severity: 'blocker',
      summary: `README instructions claim \`npm run ${brokenCommands.join('`, `npm run ')}\`, but this script does not exist in package.json.`,
      evidence: [
        {
          type: 'filesystem',
          path: 'README.md',
          exists: true,
          contentPreview: `Documented missing script(s): ${brokenCommands.join(', ')}`,
        },
      ],
      remediation: `Add the missing script to package.json "scripts" or update README.md instructions.`,
    });
  }

  // 2. Check port claim vs reality
  if (actualPort) {
    const portClaims = readmeContent.match(/localhost:(\d+)|port\s+(\d+)/i);
    if (portClaims) {
      const claimedPort = parseInt(portClaims[1] || portClaims[2], 10);
      if (claimedPort && claimedPort !== actualPort) {
        results.push({
          id: 'readme-port-mismatch',
          title: 'README port documentation mismatch',
          category: 'documentation',
          status: 'warn',
          severity: 'medium',
          summary: `README claims application runs on port ${claimedPort}, but server actually runs on port ${actualPort}.`,
          evidence: [
            {
              type: 'filesystem',
              path: 'README.md',
              exists: true,
              contentPreview: `Claimed port ${claimedPort} vs actual port ${actualPort}`,
            },
          ],
          remediation: `Update README.md to state port ${actualPort} instead of ${claimedPort}.`,
        });
      }
    }
  }

  if (results.length === 0) {
    results.push({
      id: 'readme-contract-valid',
      title: 'README documentation matches reality',
      category: 'documentation',
      status: 'pass',
      severity: 'info',
      summary: 'README instructions and port configurations match project reality.',
      evidence: [],
    });
  }

  return results;
}
