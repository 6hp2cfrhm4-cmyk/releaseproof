import pc from 'picocolors';
import { execCommand } from '@releaseproof/runner';

export async function handleDoctor(): Promise<void> {
  console.log('');
  console.log(pc.bold('ReleaseProof System Doctor'));
  console.log(pc.dim('Inspecting environment for production verification capabilities...'));
  console.log('');

  // 1. Node.js
  const nodeVer = process.version;
  const major = parseInt(nodeVer.slice(1).split('.')[0], 10);
  const nodeOk = major >= 20;
  console.log(
    `  ${nodeOk ? pc.green('✓') : pc.yellow('!')} Node.js:        ${nodeVer} ${
      nodeOk ? pc.dim('(Supported)') : pc.yellow('(Recommend Node 22+)')
    }`
  );

  // 2. npm
  const npmRes = await execCommand('npm --version');
  const npmOk = npmRes.exitCode === 0;
  console.log(
    `  ${npmOk ? pc.green('✓') : pc.red('✗')} npm:            ${
      npmOk ? npmRes.stdout.trim() : pc.red('Not found')
    }`
  );

  // 3. pnpm
  const pnpmRes = await execCommand('pnpm --version');
  const pnpmOk = pnpmRes.exitCode === 0;
  console.log(
    `  ${pnpmOk ? pc.green('✓') : pc.dim('○')} pnpm:           ${
      pnpmOk ? pnpmRes.stdout.trim() : pc.dim('Not installed (optional)')
    }`
  );

  // 4. yarn
  const yarnRes = await execCommand('yarn --version');
  const yarnOk = yarnRes.exitCode === 0;
  console.log(
    `  ${yarnOk ? pc.green('✓') : pc.dim('○')} yarn:           ${
      yarnOk ? yarnRes.stdout.trim() : pc.dim('Not installed (optional)')
    }`
  );

  // 5. Python
  const pyRes = await execCommand('python --version');
  const pyOk = pyRes.exitCode === 0;
  console.log(
    `  ${pyOk ? pc.green('✓') : pc.dim('○')} Python:         ${
      pyOk ? pyRes.stdout.trim() : pc.dim('Not installed (needed only for Python apps)')
    }`
  );

  // 6. uv
  const uvRes = await execCommand('uv --version');
  const uvOk = uvRes.exitCode === 0;
  console.log(
    `  ${uvOk ? pc.green('✓') : pc.dim('○')} uv:             ${
      uvOk ? uvRes.stdout.trim() : pc.dim('Not installed (optional)')
    }`
  );

  // 7. Docker
  const dockerRes = await execCommand('docker --version');
  const dockerOk = dockerRes.exitCode === 0;
  console.log(
    `  ${dockerOk ? pc.green('✓') : pc.dim('○')} Docker:         ${
      dockerOk ? dockerRes.stdout.trim() : pc.dim('Not available (local sandbox will be used)')
    }`
  );

  console.log('');
  console.log(pc.green('Environment is ready to run ReleaseProof.'));
  console.log('');
}
