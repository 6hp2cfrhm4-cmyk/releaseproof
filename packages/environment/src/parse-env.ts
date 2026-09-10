import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface ParsedEnvFile {
  filePath: string;
  variableNames: Set<string>;
}

/**
 * Parses variable names from a .env or .env.example file without keeping secret values.
 */
export async function parseEnvVariableNames(filePath: string): Promise<Set<string>> {
  const names = new Set<string>();
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=/);
      if (match && match[1]) {
        names.add(match[1]);
      }
    }
  } catch {
    // File not found or unreadable
  }
  return names;
}

export async function findEnvFiles(projectDir: string): Promise<{
  envFiles: string[];
  exampleFiles: string[];
}> {
  const envFiles: string[] = [];
  const exampleFiles: string[] = [];

  const candidates = [
    '.env',
    '.env.local',
    '.env.production',
    '.env.example',
    '.env.sample',
    '.env.template',
    'example.env',
  ];

  for (const name of candidates) {
    const fullPath = path.join(projectDir, name);
    try {
      await fs.stat(fullPath);
      if (name.includes('example') || name.includes('sample') || name.includes('template')) {
        exampleFiles.push(name);
      } else {
        envFiles.push(name);
      }
    } catch {}
  }

  return { envFiles, exampleFiles };
}
