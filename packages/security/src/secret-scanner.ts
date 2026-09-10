import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { CheckResult, FilesystemEvidence } from '@releaseproof/schemas';

interface SecretRule {
  id: string;
  name: string;
  pattern: RegExp;
  mask: (val: string) => string;
}

const SECRET_RULES: SecretRule[] = [
  {
    id: 'sec-private-key',
    name: 'Private Key Block',
    pattern: /-----BEGIN (?:RSA|EC|DSA|OPENSSH|PGP)?\s*PRIVATE KEY-----/g,
    mask: () => '-----BEGIN PRIVATE KEY...[REDACTED]-----',
  },
  {
    id: 'sec-aws-access-key',
    name: 'AWS Access Key ID',
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
    mask: (val) => `${val.slice(0, 4)}****************`,
  },
  {
    id: 'sec-github-pat',
    name: 'GitHub Personal Access Token',
    pattern: /\bghp_[0-9a-zA-Z]{36}\b/g,
    mask: (val) => `${val.slice(0, 4)}********************************`,
  },
  {
    id: 'sec-slack-token',
    name: 'Slack Token',
    pattern: /\bxox[baprs]-[0-9a-zA-Z]{10,48}\b/g,
    mask: (val) => `${val.slice(0, 4)}****************`,
  },
];

const IGNORED_SCAN_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.turbo',
  '.releaseproof',
  '.venv',
  'venv',
  '__pycache__',
  '__tests__',
]);

export interface DetectedSecretFinding {
  ruleId: string;
  ruleName: string;
  file: string;
  line: number;
  maskedSnippet: string;
}

export async function scanForSecrets(projectDir: string, ignoreDirs: string[] = []): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const findings: DetectedSecretFinding[] = [];
  const customIgnore = new Set(ignoreDirs);

  // 1. Check for committed / unignored .env files containing non-empty keys
  const dotEnvFiles = ['.env', '.env.local', '.env.production'];
  for (const envFile of dotEnvFiles) {
    if (customIgnore.has(envFile)) continue;
    const fullPath = path.join(projectDir, envFile);
    try {
      const stat = await fs.stat(fullPath);
      if (stat.isFile()) {
        const content = await fs.readFile(fullPath, 'utf-8');
        // Check if has actual populated values, not just placeholders
        const hasPopulatedSecrets = content
          .split('\n')
          .some((l) => /^[a-zA-Z_0-9]+=[^\s"'#]{8,}/.test(l.trim()));

        if (hasPopulatedSecrets) {
          findings.push({
            ruleId: 'sec-committed-env',
            ruleName: 'Committed .env File',
            file: envFile,
            line: 1,
            maskedSnippet: `${envFile} contains populated credentials and should not be in repository.`,
          });
        }
      }
    } catch {}
  }

  // 2. Scan source code files
  async function walk(currentDir: string) {
    let entries;
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (IGNORED_SCAN_DIRS.has(entry.name) || customIgnore.has(entry.name)) continue;

      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        // Skip binary, lockfiles, and test files
        if (
          entry.name.endsWith('.lock') ||
          entry.name.endsWith('-lock.json') ||
          entry.name.endsWith('.png') ||
          entry.name.includes('.test.') ||
          entry.name.includes('.spec.')
        ) {
          continue;
        }
        await scanFileForSecrets(fullPath, path.relative(projectDir, fullPath), findings);
      }
    }
  }

  await walk(projectDir);

  if (findings.length > 0) {
    const evidence: FilesystemEvidence[] = findings.map((f) => ({
      type: 'filesystem',
      path: `${f.file}:${f.line}`,
      exists: true,
      contentPreview: `${f.ruleName}: ${f.maskedSnippet}`,
    }));

    results.push({
      id: 'sec-secrets-detected',
      title: 'Secrets detected in repository files',
      category: 'security',
      status: 'block',
      severity: 'blocker',
      summary: `Detected ${findings.length} secret(s) or exposed credential(s) in project files.`,
      evidence,
      remediation: 'Remove the hard-coded secrets immediately, revoke compromised credentials, and use environment variables.',
    });
  } else {
    results.push({
      id: 'sec-clean-secrets',
      title: 'No obvious secrets detected',
      category: 'security',
      status: 'pass',
      severity: 'info',
      summary: 'Scanned project files and found no unencrypted keys, tokens, or committed .env files.',
      evidence: [],
    });
  }

  return results;
}

async function scanFileForSecrets(
  filePath: string,
  relPath: string,
  findings: DetectedSecretFinding[]
) {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const rule of SECRET_RULES) {
        rule.pattern.lastIndex = 0;
        const match = rule.pattern.exec(line);
        if (match) {
          findings.push({
            ruleId: rule.id,
            ruleName: rule.name,
            file: relPath,
            line: i + 1,
            maskedSnippet: rule.mask(match[0]),
          });
        }
      }
    }
  } catch {}
}
