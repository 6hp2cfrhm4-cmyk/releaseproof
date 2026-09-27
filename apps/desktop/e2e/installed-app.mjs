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

let session;
try {
  // Keep normal Windows/system paths but remove every directory that supplies
  // Node, pnpm, or Corepack. The installed executable itself must still open.
  const pathWithoutNode = (process.env.PATH ?? '').split(path.delimiter).filter((entry) => {
    if (!entry) return false;
    return !['node.exe', 'node.cmd', 'pnpm.cmd', 'corepack.cmd'].some((tool) => existsSync(path.join(entry, tool)));
  }).join(path.delimiter);
  session = await launchAndAttach(userData, { ...process.env, PATH: pathWithoutNode, NODE_OPTIONS: '' });
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
  await page.getByRole('button', { name: projectPath, exact: true }).click();
  const result = await page.evaluate(async (selectedProject) => {
    const preview = await window.releaseproof.previewProject(selectedProject);
    const target = preview.profile.targetCandidates.find((candidate) => candidate.runnable);
    if (!target) throw new Error('The E2E project has no detected runnable target.');

    let runId;
    let unsubscribe = () => {};
    const resultPromise = new Promise((resolve, reject) => {
      unsubscribe = window.releaseproof.subscribeRun((event) => {
        if (event.runId !== runId) return;
        if (event.type === 'finished') resolve({ runId, report: event.report });
        if (event.type === 'error') reject(new Error(event.message));
      });
    });
    runId = await window.releaseproof.startVerification({
      projectPath: selectedProject,
      ...(target.path !== '.' ? { target: target.path } : {}),
      trusted: true,
      timeoutMs: 60000,
    });
    try { return await resultPromise; } finally { unsubscribe(); }
  }, projectPath);

  assert.equal(result.report.runStatus, 'completed');
  assert.equal(result.report.verdict, 'READY', JSON.stringify(result.report.checks.filter((check) => check.status === 'block' || check.status === 'unknown')));
  await page.getByRole('button', { name: 'Overview' }).click();
  await page.getByRole('button', { name: 'Copy for AI' }).waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: 'Copy for AI' }).click();
  await page.getByText('Copied sanitized handoff to clipboard.').waitFor({ timeout: 5000 });
  const copiedHandoff = execFileSync('powershell.exe', ['-NoProfile', '-Command', 'Get-Clipboard -Raw'], { encoding: 'utf8' });
  assert.match(copiedHandoff, /ReleaseProof/i, 'Copy for AI did not put the sanitized handoff on the clipboard.');
  await page.getByRole('button', { name: 'Findings' }).click();
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
  await page.getByRole('heading', { name: 'Evidence' }).waitFor({ timeout: 5000 });
  assert.ok((await page.locator('.evidence').count()) > 0, 'Evidence view did not render report evidence.');
  await page.getByRole('button', { name: 'Logs', exact: true }).click();
  await page.getByRole('heading', { name: 'Logs' }).waitFor({ timeout: 5000 });
  assert.match(await page.locator('.log-box').innerText(), /finished|done|READY/i, 'Logs view did not retain the terminal run event.');
  await page.getByRole('button', { name: 'Doctor', exact: true }).click();
  await page.getByRole('heading', { name: 'System Doctor' }).waitFor({ timeout: 5000 });
  await page.getByRole('button', { name: 'Run capability checks' }).click();
  const availableDoctorNode = page.locator('.doctor-list .finding').filter({ hasText: 'Node.js' });
  await availableDoctorNode.waitFor({ timeout: 10000 });
  assert.match(await availableDoctorNode.innerText(), /AVAILABLE[\s\S]*v\d+/,
    'System Doctor did not report the installed required runtime and version.');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByText('0.2.0-dev.0').waitFor({ timeout: 10000 });
  const themeSelect = page.locator('.setting-row select').first();
  await themeSelect.selectOption('light');
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'light');
  await page.getByRole('button', { name: 'Doctor', exact: true }).click();
  const lightContrast = await page.evaluate(() => {
    const rgb = (value) => value.match(/[\d.]+/g).slice(0, 3).map(Number).map((part) => part / 255).map((part) => part <= 0.04045 ? part / 12.92 : ((part + 0.055) / 1.055) ** 2.4);
    const luminance = (value) => { const [r, g, b] = rgb(value); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const background = getComputedStyle(document.documentElement).backgroundColor;
    return [...document.querySelectorAll('.screen .eyebrow, .screen .lede, .screen .metric span')].map((element) => {
      const foreground = getComputedStyle(element).color;
      const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
      return { text: element.textContent?.trim(), ratio: (light + 0.05) / (dark + 0.05) };
    });
  });
  assert.ok(lightContrast.length > 0 && lightContrast.every((item) => item.ratio >= 4.5),
    `Light theme text contrast below WCAG AA: ${JSON.stringify(lightContrast)}`);
  await page.getByRole('button', { name: 'Settings' }).click();
  await themeSelect.selectOption('dark');
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
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
  await page.waitForFunction(() => document.documentElement.dataset.theme === 'system');
  for (const artifact of ['report.json', 'report.html', 'RELEASEPROOF_FIX.md']) {
    await fs.access(path.join(projectPath, '.releaseproof', artifact));
  }
  console.log(JSON.stringify({ verdict: result.report.verdict, score: result.report.score, target: result.report.target, artifacts: path.join(projectPath, '.releaseproof') }));

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
}
