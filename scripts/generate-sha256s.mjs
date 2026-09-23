import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';

const artifacts = process.argv.slice(2);
if (artifacts.length === 0) {
  console.error('Usage: node scripts/generate-sha256s.mjs <artifact>...');
  process.exitCode = 2;
} else {
  const lines = [];
  for (const artifact of artifacts) {
    const data = await readFile(artifact);
    lines.push(`${createHash('sha256').update(data).digest('hex')}  ${basename(artifact)}`);
  }
  await writeFile('SHA256SUMS.txt', `${lines.join('\n')}\n`, 'utf8');
}
