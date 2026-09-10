import * as path from 'node:path';
import { CheckResult, EnvironmentEvidence } from '@releaseproof/schemas';
import { scanCodeForEnvVars } from './scanner.js';
import { findEnvFiles, parseEnvVariableNames } from './parse-env.js';

const SENSITIVE_SECRET_PATTERNS = [
  /secret/i,
  /private/i,
  /password/i,
  /database_url/i,
  /service_role/i,
  /admin_key/i,
];

export async function analyzeEnvironment(projectDir: string, ignoreDirs: string[] = []): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const codeEnvMap = await scanCodeForEnvVars(projectDir, ignoreDirs);
  const { envFiles, exampleFiles } = await findEnvFiles(projectDir);

  const documentedVars = new Set<string>();
  for (const exampleFile of exampleFiles) {
    const vars = await parseEnvVariableNames(path.join(projectDir, exampleFile));
    for (const v of vars) documentedVars.add(v);
  }

  const definedLocalVars = new Set<string>();
  for (const envFile of envFiles) {
    const vars = await parseEnvVariableNames(path.join(projectDir, envFile));
    for (const v of vars) definedLocalVars.add(v);
  }

  const undocumentedVars: { name: string; files: string[] }[] = [];
  const clientExposedSecrets: { name: string; files: string[] }[] = [];

  for (const [varName, files] of codeEnvMap.entries()) {
    // Check if secret name is leaked via client-facing prefixes
    const isClientPrefixed =
      varName.startsWith('NEXT_PUBLIC_') ||
      varName.startsWith('VITE_') ||
      varName.startsWith('REACT_APP_');

    if (isClientPrefixed) {
      const isSensitive = SENSITIVE_SECRET_PATTERNS.some((p) => p.test(varName));
      if (isSensitive) {
        clientExposedSecrets.push({ name: varName, files });
      }
    }

    // Check if undocumented in example file
    const isDocumented = documentedVars.has(varName);
    if (!isDocumented && exampleFiles.length > 0) {
      undocumentedVars.push({ name: varName, files });
    }
  }

  // 1. Client exposed secret check
  if (clientExposedSecrets.length > 0) {
    const evidence: EnvironmentEvidence[] = clientExposedSecrets.map((s) => ({
      type: 'environment',
      variable: s.name,
      defined: true,
      usedInFiles: s.files,
      documentedInExample: documentedVars.has(s.name),
      exposedToClient: true,
    }));

    results.push({
      id: 'env-exposed-client-secrets',
      title: 'Server secrets exposed to client-side bundle',
      category: 'environment',
      status: 'block',
      severity: 'blocker',
      summary: `Found ${clientExposedSecrets.length} sensitive secret variable(s) with client-facing prefixes (${clientExposedSecrets.map((s) => s.name).join(', ')}).`,
      evidence,
      remediation: 'Do not prefix server-only credentials with client prefixes like NEXT_PUBLIC_ or VITE_. Access them on the server side.',
    });
  }

  // 2. Undocumented environment variables check
  if (undocumentedVars.length > 0) {
    const evidence: EnvironmentEvidence[] = undocumentedVars.map((u) => ({
      type: 'environment',
      variable: u.name,
      defined: definedLocalVars.has(u.name),
      usedInFiles: u.files,
      documentedInExample: false,
      exposedToClient: false,
    }));

    results.push({
      id: 'env-undocumented-variables',
      title: 'Undocumented environment variables',
      category: 'environment',
      status: 'warn',
      severity: 'medium',
      summary: `Found ${undocumentedVars.length} environment variable(s) used in code but missing from .env.example: ${undocumentedVars.map((u) => u.name).join(', ')}.`,
      evidence,
      remediation: `Add the missing variables to ${exampleFiles[0] || '.env.example'} so deployments and other developers know they are needed.`,
    });
  } else if (codeEnvMap.size > 0) {
    results.push({
      id: 'env-documentation-check',
      title: 'Environment variables documented',
      category: 'environment',
      status: 'pass',
      severity: 'info',
      summary: `All ${codeEnvMap.size} discovered environment variables are properly documented in example config.`,
      evidence: [],
    });
  }

  return results;
}
