import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const executablePath = process.env.RELEASEPROOF_APP_PATH;
const projectPath = process.env.RELEASEPROOF_E2E_PROJECT;
if (!executablePath || !projectPath) {
  throw new Error('Set RELEASEPROOF_APP_PATH and RELEASEPROOF_E2E_PROJECT to run the packaged Desktop E2E.');
}

async function launchAndAttach(userData, env) {
  const activePortFile = path.join(userData, 'DevToolsActivePort');
  await fs.rm(activePortFile, { force: true });
  const child = spawn(executablePath, [`--user-data-dir=${userData}`, '--remote-debugging-port=0'], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output = `${output}${chunk}`.slice(-8000); });
  child.stderr.on('data', (chunk) => { output = `${output}${chunk}`.slice(-8000); });
  try {
    const deadline = Date.now() + 20000;
    let connected = false;
    let port;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error(`Desktop exited with code ${child.exitCode}.`);
      try {
        const [portLine] = (await fs.readFile(activePortFile, 'utf8')).split(/\r?\n/);
        const candidatePort = Number(portLine);
        if (Number.isInteger(candidatePort) && candidatePort > 0 && candidatePort < 65536) {
          const response = await fetch(`http://127.0.0.1:${candidatePort}/json/version`, { signal: AbortSignal.timeout(500) });
          if (response.ok) { port = candidatePort; connected = true; break; }
        }
      } catch { /* Electron has not opened its local debugging endpoint yet. */ }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    if (!connected) throw new Error('Desktop did not expose its local test endpoint within 20 seconds.');
    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    const deadlineForPage = Date.now() + 10000;
    let page;
    while (!page && Date.now() < deadlineForPage) {
      page = browser.contexts().flatMap((context) => context.pages()).find((candidate) => candidate.url().startsWith('file:'));
      if (!page) await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!page) { await browser.close(); throw new Error('Packaged Desktop opened no application window.'); }
    const rendererErrors = [];
    page.on('pageerror', (error) => rendererErrors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') rendererErrors.push(message.text()); });
    await page.waitForLoadState('domcontentloaded');
    try { await page.locator('.app-shell').waitFor({ timeout: 10000 }); }
    catch {
      const body = await page.locator('body').innerText().catch(() => '<no body text>');
      throw new Error(`Packaged renderer did not mount. Body: ${body}. Errors: ${rendererErrors.join(' | ')}`);
    }
    return { browser, page, child, output: () => output };
  } catch (error) {
    if (child.exitCode === null) child.kill();
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${output}`);
  }
}

async function closeAttachedApp(session) {
  const { page, child, browser } = session;
  const hasExited = () => child.exitCode !== null || child.signalCode !== null;
  if (!hasExited()) {
    await page.evaluate(() => window.close()).catch(() => {});
    await Promise.race([
      new Promise((resolve) => child.once('exit', resolve)),
      new Promise((resolve) => setTimeout(resolve, 8000)),
    ]);
  }
  if (!hasExited()) child.kill();
  await browser.close().catch(() => {});
  if (!hasExited()) {
    await Promise.race([
      new Promise((resolve) => child.once('exit', resolve)),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
  }
  assert.ok(hasExited(), `Packaged Desktop process did not exit. ${session.output()}`);
}

async function removeTestUserData(directory) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try { await fs.rm(directory, { recursive: true, force: true }); return; }
    catch (error) {
      if (!['EBUSY', 'EPERM', 'ENOTEMPTY'].includes(error?.code) || attempt === 11) throw error;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
}

const tempRoot = path.resolve(os.tmpdir());
const userData = await fs.mkdtemp(path.join(tempRoot, 'releaseproof-desktop-e2e-'));
const resolvedUserData = path.resolve(userData);
if (path.dirname(resolvedUserData) !== tempRoot || !path.basename(resolvedUserData).startsWith('releaseproof-desktop-e2e-')) {
  throw new Error('Refusing to use an unexpected Desktop E2E user-data directory.');
}

const generatedProjects = [];
async function createGeneratedProject(name, packageJson, config) {
  const project = await fs.mkdtemp(path.join(tempRoot, `releaseproof-desktop-${name}-`));
  if (path.dirname(path.resolve(project)) !== tempRoot || !path.basename(project).startsWith(`releaseproof-desktop-${name}-`)) {
    throw new Error('Refusing to use an unexpected generated Desktop test project.');
  }
  generatedProjects.push(project);
  await fs.writeFile(path.join(project, 'package.json'), JSON.stringify(packageJson, null, 2));
  await fs.writeFile(path.join(project, '.releaseproof.json'), JSON.stringify(config, null, 2));
  return project;
}

async function verifyThroughRenderer(page, project, expectedVerdict, expectedHeading, timeoutMs = 60000) {
  await page.evaluate(async (selectedProject) => window.releaseproof.previewProject(selectedProject), project);
  await page.reload();
  await page.locator('.app-shell').waitFor({ timeout: 10000 });
  await page.getByRole('button', { name: 'Home / Project', exact: true }).click();
  await page.getByRole('button', { name: project, exact: true }).click();
  const verifyButton = page.getByRole('button', { name: 'Verify Project', exact: true });
  assert.equal(await verifyButton.isDisabled(), true, 'Verification must require explicit project-script trust acknowledgement.');
  await page.locator('.trust input').check();
  assert.equal(await verifyButton.isEnabled(), true, 'Runnable selected target should be verifiable after trust acknowledgement.');
  await verifyButton.click();
  await page.getByRole('heading', { name: expectedHeading, exact: true }).waitFor({ timeout: timeoutMs });
  await assertAccessibleControls(page, expectedHeading);
  const report = JSON.parse(await fs.readFile(path.join(project, '.releaseproof', 'report.json'), 'utf8'));
  assert.equal(report.verdict, expectedVerdict);
  assert.equal(report.runStatus, 'completed');
  const htmlReport = await fs.readFile(path.join(project, '.releaseproof', 'report.html'), 'utf8');
  const aiHandoff = await fs.readFile(path.join(project, '.releaseproof', 'RELEASEPROOF_FIX.md'), 'utf8');
  assert.ok(htmlReport.includes(`Report ${report.id}`), 'HTML report must identify the same verification run as report.json.');
  assert.ok(aiHandoff.includes(`**Report ID**: ${report.id}`), 'AI handoff must identify the same verification run as report.json.');
  return report;
}

async function assertAccessibleControls(page, screenName) {
  const unnamed = await page.evaluate(() => [...document.querySelectorAll('button, input, select, textarea, a[href], [role="button"], [role="link"]')]
    .filter((element) => {
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || element.getAttribute('aria-hidden') === 'true') return false;
      const labelledBy = element.getAttribute('aria-labelledby')?.split(/\s+/).map((id) => document.getElementById(id)?.textContent?.trim()).filter(Boolean).join(' ');
      const label = element.labels ? [...element.labels].map((item) => item.textContent?.trim()).filter(Boolean).join(' ') : '';
      return !(element.getAttribute('aria-label') || labelledBy || label || element.getAttribute('title') || element.getAttribute('alt') || element.textContent?.trim());
    })
    .map((element) => `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}`));
  assert.deepEqual(unnamed, [], `${screenName} contains controls without accessible names.`);
}

async function assertVisibleTextContrast(page, themeName) {
  const failures = await page.evaluate(() => {
    const parse = (color) => {
      const values = color.match(/[\d.]+/g)?.map(Number) ?? [];
      if (values.length < 3) return undefined;
      const [r, g, b, alpha = 1] = values;
      if (alpha === 0) return undefined;
      return [r, g, b].map((part) => part / 255);
    };
    const luminance = (channels) => channels.map((part) => part <= 0.04045 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4).reduce((sum, part, index) => sum + part * [0.2126, 0.7152, 0.0722][index], 0);
    const elements = [...document.querySelectorAll('.screen *')].filter((element) => element.children.length === 0 && element.textContent?.trim());
    return elements.flatMap((element) => {
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return [];
      const foreground = parse(style.color);
      let ancestor = element;
      let background;
      while (ancestor && !background) {
        background = parse(getComputedStyle(ancestor).backgroundColor);
        ancestor = ancestor.parentElement;
      }
      if (!foreground || !background) return [];
      const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
      const ratio = (values[0] + 0.05) / (values[1] + 0.05);
      const large = Number.parseFloat(style.fontSize) >= 24 || (Number.parseFloat(style.fontSize) >= 18.66 && Number(style.fontWeight) >= 700);
      return ratio < (large ? 3 : 4.5) ? [{ text: element.textContent.trim().slice(0, 60), ratio, required: large ? 3 : 4.5 }] : [];
    });
  });
  assert.deepEqual(failures, [], `${themeName} visible text fails WCAG AA contrast: ${JSON.stringify(failures)}`);
}

let session;
try {
  // Keep normal Windows/system paths but remove every directory that supplies
  // Node, pnpm, or Corepack. The installed executable itself must still open.
  const pathWithoutNode = (process.env.PATH ?? '').split(path.delimiter).filter((entry) => {
    if (!entry) return false;
    return !['node.exe', 'node.cmd', 'pnpm.cmd', 'corepack.cmd'].some((tool) => existsSync(path.join(entry, tool)));
  }).join(path.delimiter);
  session = await launchAndAttach(userData, { ...process.env, PATH: pathWithoutNode, NODE_OPTIONS: '' });
  await assertAccessibleControls(session.page, 'Home');
  await session.page.keyboard.press('Tab');
  const firstFocus = await session.page.evaluate(() => ({
    tag: document.activeElement?.tagName,
    outlineStyle: getComputedStyle(document.activeElement).outlineStyle,
    outlineWidth: getComputedStyle(document.activeElement).outlineWidth,
  }));
  assert.equal(firstFocus.tag, 'BUTTON', 'Keyboard navigation did not reach an actionable control.');
  assert.equal(firstFocus.outlineStyle, 'solid', 'Keyboard focus must have a visible outline.');
  assert.notEqual(firstFocus.outlineWidth, '0px', 'Keyboard focus outline must be non-zero.');

  const doctorProject = await session.page.evaluate(async (selectedProject) => {
    await window.releaseproof.previewProject(selectedProject);
    return selectedProject;
  }, projectPath);
  await closeAttachedApp(session);
  session = await launchAndAttach(userData, { ...process.env, PATH: pathWithoutNode, NODE_OPTIONS: '' });
  await session.page.getByRole('button', { name: doctorProject, exact: true }).click();
  await session.page.getByRole('button', { name: 'Doctor', exact: true }).click();
  await session.page.getByRole('button', { name: 'Run capability checks' }).click();
  const doctorNode = session.page.locator('.doctor-list .finding').filter({ hasText: 'Node.js' });
  await doctorNode.waitFor({ timeout: 10000 });
  assert.match(await doctorNode.innerText(), /MISSING[\s\S]*Install Node\.js 20 or newer/,
    'System Doctor did not explain how to restore a required missing runtime.');
  await closeAttachedApp(session);
  session = undefined;
  console.log('Packaged Desktop launch passed without Node, pnpm, or Corepack on PATH.');

  // Verify an actual target through installed renderer -> preload -> validated
  // main IPC -> worker -> the shared Core, using the project toolchain normally.
  session = await launchAndAttach(userData, process.env);
  let { page, child } = session;
  console.log('Packaged Desktop opened; running the selected fixture through its worker.');
  const readyReport = await verifyThroughRenderer(page, projectPath, 'READY', 'READY TO SHIP');
  assert.equal(readyReport.verdict, 'READY', JSON.stringify(readyReport.checks.filter((check) => check.status === 'block' || check.status === 'unknown')));
  await page.getByRole('button', { name: 'Copy for AI' }).waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: 'Copy for AI' }).click();
  await page.getByText('Copied sanitized handoff to clipboard.').waitFor({ timeout: 5000 });
  const copiedHandoff = execFileSync('powershell.exe', ['-NoProfile', '-Command', 'Get-Clipboard -Raw'], { encoding: 'utf8' });
  assert.match(copiedHandoff, /ReleaseProof/i, 'Copy for AI did not put the sanitized handoff on the clipboard.');
  await page.getByRole('button', { name: 'Findings' }).click();
  await assertAccessibleControls(page, 'Findings');
  const firstFinding = page.locator('article.finding').first();
  const findingTitle = await firstFinding.locator('strong').innerText();
  await firstFinding.click();
  await page.getByRole('button', { name: 'Copy Fix Prompt' }).click();
  await page.getByText('Copied sanitized handoff to clipboard.').waitFor({ timeout: 5000 });
  const copiedFinding = execFileSync('powershell.exe', ['-NoProfile', '-Command', 'Get-Clipboard -Raw'], { encoding: 'utf8' });
  assert.ok(copiedFinding.includes(findingTitle), 'Finding-specific AI handoff omitted the selected finding.');
  const findingWithEvidence = page.locator('article.finding').filter({ hasText: /[1-9]\d* evidence item/ }).first();
  await findingWithEvidence.click();
  await page.getByRole('button', { name: 'Evidence', exact: true }).click();
  await assertAccessibleControls(page, 'Evidence');
  await page.getByRole('heading', { name: 'Evidence' }).waitFor({ timeout: 5000 });
  assert.ok((await page.locator('.evidence').count()) > 0, 'Evidence view did not render report evidence.');
  await page.getByRole('button', { name: 'Logs', exact: true }).click();
  await assertAccessibleControls(page, 'Logs');
  await page.getByRole('heading', { name: 'Logs' }).waitFor({ timeout: 5000 });
  assert.match(await page.locator('.log-box').innerText(), /finished|done|READY/i, 'Logs view did not retain the terminal run event.');
  await page.getByRole('button', { name: 'Doctor', exact: true }).click();
  await assertAccessibleControls(page, 'System Doctor');
  await page.getByRole('heading', { name: 'System Doctor' }).waitFor({ timeout: 5000 });
  await page.getByRole('button', { name: 'Run capability checks' }).click();
  const availableDoctorNode = page.locator('.doctor-list .finding').filter({ hasText: 'Node.js' });
  await availableDoctorNode.waitFor({ timeout: 10000 });
  assert.match(await availableDoctorNode.innerText(), /AVAILABLE[\s\S]*v\d+/,
    'System Doctor did not report the installed required runtime and version.');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByText('0.2.0-dev.0').waitFor({ timeout: 10000 });
  await assertAccessibleControls(page, 'Settings');
  const themeSelect = page.locator('.setting-row select').first();
  await themeSelect.selectOption('light');
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
  await page.getByRole('button', { name: 'Doctor', exact: true }).click();
  await assertVisibleTextContrast(page, 'Light theme');
  await page.getByRole('button', { name: 'Settings' }).click();
  await themeSelect.selectOption('dark');
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  await page.getByRole('button', { name: 'Doctor', exact: true }).click();
  await assertVisibleTextContrast(page, 'Dark theme');
  await page.getByRole('button', { name: 'Settings' }).click();
  await closeAttachedApp(session);
  session = undefined;
  session = await launchAndAttach(userData, process.env);
  page = session.page;
  child = session.child;
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
  assert.equal(await page.locator('.setting-row select').first().inputValue(), 'dark', 'Theme selection was not persisted across application restart.');
  const persistedThemeSelect = page.locator('.setting-row select').first();
  await persistedThemeSelect.selectOption('system');
  await page.waitForFunction(() => ['light', 'dark'].includes(document.documentElement.dataset.theme)
    && document.documentElement.dataset.themePreference === 'system');
  let systemTheme = await page.evaluate(() => document.documentElement.dataset.theme);
  await assertVisibleTextContrast(page, `System theme (${systemTheme})`);
  await page.emulateMedia({ colorScheme: systemTheme === 'light' ? 'dark' : 'light' });
  await page.waitForFunction((previousTheme) => document.documentElement.dataset.theme !== previousTheme, systemTheme);
  systemTheme = await page.evaluate(() => document.documentElement.dataset.theme);
  await assertVisibleTextContrast(page, `System theme changed to ${systemTheme}`);
  for (const artifact of ['report.json', 'report.html', 'RELEASEPROOF_FIX.md']) {
    await fs.access(path.join(projectPath, '.releaseproof', artifact));
  }
  console.log(JSON.stringify({ verdict: readyReport.verdict, score: readyReport.score, target: readyReport.target, artifacts: path.join(projectPath, '.releaseproof') }));

  const notReadyProject = await createGeneratedProject('not-ready', {
    name: 'desktop-not-ready-e2e',
    scripts: {
      build: 'node -e "process.exit(23)"',
      start: 'node -e "require(\'node:http\').createServer((_q,r)=>r.end(\'ok\')).listen(Number(process.env.PORT),\'127.0.0.1\')"',
    },
  }, { checks: { install: false, browser: false, routes: false, environment: false, secrets: false, documentation: false, devProd: false } });
  const notReadyReport = await verifyThroughRenderer(page, notReadyProject, 'NOT_READY', 'NOT READY TO SHIP');
  assert.ok(notReadyReport.checks.some((check) => check.status === 'block'), 'NOT READY UI result must have a verified blocker.');

  const incompleteProject = await createGeneratedProject('incomplete', {
    name: 'desktop-incomplete-e2e',
    scripts: { start: 'node -e "setInterval(()=>{},10000)"' },
  }, { checks: { install: false, build: false, browser: false, routes: false, environment: false, secrets: false, documentation: false, devProd: false } });
  await page.evaluate(() => window.releaseproof.updateSettings({ defaultTimeoutMs: 1000 }));
  const incompleteReport = await verifyThroughRenderer(page, incompleteProject, 'INCOMPLETE', 'VERIFICATION INCOMPLETE', 30000);
  assert.ok(incompleteReport.checks.some((check) => check.status === 'unknown'), 'INCOMPLETE UI result must retain the unverified startup reason.');
  await page.evaluate(() => window.releaseproof.updateSettings({ defaultTimeoutMs: 30000 }));

  const hangingProject = process.env.RELEASEPROOF_E2E_HANGING_PROJECT
    ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../fixtures/hanging-start-command');
  const cancelled = await page.evaluate(async (selectedProject) => {
    const preview = await window.releaseproof.previewProject(selectedProject);
    const target = preview.profile.targetCandidates.find((candidate) => candidate.runnable);
    if (!target) throw new Error('The cancellation fixture has no runnable target.');
    let runId;
    let unsubscribe = () => {};
    const terminal = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out waiting for cancellation cleanup.')), 20000);
      unsubscribe = window.releaseproof.subscribeRun((event) => {
        if (event.runId !== runId) return;
        if (event.type === 'progress' && event.step === 'Starting production server' && event.status === 'running') {
          void window.releaseproof.cancelVerification(runId).catch(reject);
        }
        if (event.type === 'finished') { clearTimeout(timer); resolve(event.report); }
        if (event.type === 'error') { clearTimeout(timer); reject(new Error(event.message)); }
      });
    });
    runId = await window.releaseproof.startVerification({
      projectPath: selectedProject,
      ...(target.path !== '.' ? { target: target.path } : {}),
      trusted: true,
      timeoutMs: 60000,
    });
    try { return await terminal; } finally { unsubscribe(); }
  }, hangingProject);
  assert.equal(cancelled.runStatus, 'cancelled');
  assert.equal(cancelled.verdict, 'CANCELLED');
  assert.equal(cancelled.score, 0);
  await page.getByRole('button', { name: 'Overview' }).click();
  await page.getByRole('heading', { name: 'VERIFICATION CANCELLED' }).waitFor({ timeout: 10000 });
  console.log('Cancel IPC stopped the worker and returned a zero-score CANCELLED report.');

  const tempBeforeCloseRun = new Set((await fs.readdir(tempRoot)).filter((name) => name.startsWith('releaseproof-')));
  const closeRunId = await page.evaluate(async (selectedProject) => {
    const preview = await window.releaseproof.previewProject(selectedProject);
    const target = preview.profile.targetCandidates.find((candidate) => candidate.runnable);
    if (!target) throw new Error('The close-during-run fixture has no runnable target.');
    let runId;
    let unsubscribe = () => {};
    const started = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out waiting for the long-running verification to start.')), 20000);
      unsubscribe = window.releaseproof.subscribeRun((event) => {
        if (event.runId !== runId) return;
        if (event.type === 'progress' && event.step === 'Starting production server' && event.status === 'running') {
          clearTimeout(timer);
          resolve(runId);
        }
        if (event.type === 'error') { clearTimeout(timer); reject(new Error(event.message)); }
      });
    });
    runId = await window.releaseproof.startVerification({
      projectPath: selectedProject,
      ...(target.path !== '.' ? { target: target.path } : {}),
      trusted: true,
      timeoutMs: 60000,
    });
    try { return await started; } finally { unsubscribe(); }
  }, hangingProject);
  assert.ok(closeRunId);
  await closeAttachedApp(session);
  session = undefined;
  let leakedWorkspace;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const current = (await fs.readdir(tempRoot)).filter((name) => name.startsWith('releaseproof-'));
    leakedWorkspace = current.find((name) => !tempBeforeCloseRun.has(name));
    if (!leakedWorkspace) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  assert.equal(leakedWorkspace, undefined, `Closing during verification left a clean workspace behind: ${leakedWorkspace}`);
  console.log('Closing the installed app during startup verification terminated its worker and removed the owned workspace.');
} finally {
  if (session) await closeAttachedApp(session).catch(() => {});
  await removeTestUserData(resolvedUserData);
  for (const project of generatedProjects) {
    if (path.dirname(path.resolve(project)) === tempRoot && path.basename(project).startsWith('releaseproof-desktop-')) {
      await fs.rm(project, { recursive: true, force: true });
    }
  }
}
