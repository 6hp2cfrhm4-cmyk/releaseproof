import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  CheckResult,
  BrowserEvidence,
  ScreenshotEvidence,
  HttpEvidence,
} from '@releaseproof/schemas';
import {
  PageCrawlResult,
  BrowserVerificationOptions,
  BrowserVerificationResult,
} from './types.js';
import { crawlViaHttp } from './http-crawler.js';

export async function verifyBrowserApp(
  options: BrowserVerificationOptions
): Promise<BrowserVerificationResult> {
  await fs.mkdir(options.screenshotsDir, { recursive: true });

  let pageResults: PageCrawlResult[] = [];
  let usedPlaywright = false;

  try {
    const pw: any = await import('playwright').catch(() => null);
    if (!pw || !pw.chromium) {
      throw new Error('Playwright module not available');
    }
    const browser = await pw.chromium.launch({
      headless: options.headless ?? true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    usedPlaywright = true;

    try {
      pageResults = await runPlaywrightCrawl(browser, options);
    } finally {
      await browser.close();
    }
  } catch (err: unknown) {
    // If Playwright fails to launch (e.g. browser binaries not installed), use HTTP fallback
    pageResults = await crawlViaHttp(options);
  }

  const checks = buildBrowserChecks(pageResults, usedPlaywright);
  const evidence = buildEvidence(pageResults);

  return {
    pagesVisited: pageResults.length,
    results: pageResults,
    checks,
    evidence,
  };
}

async function runPlaywrightCrawl(
  browser: any,
  options: BrowserVerificationOptions
): Promise<PageCrawlResult[]> {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (ReleaseProof Verification Engine; Headless)',
  });

  const page = await context.newPage();
  const queue: { route: string; depth: number }[] = [
    ...options.initialRoutes.map((r) => ({ route: r, depth: 0 })),
  ];
  if (queue.length === 0) {
    queue.push({ route: '/', depth: 0 });
  }

  const visited = new Set<string>();
  const pageResults: PageCrawlResult[] = [];
  const maxPages = options.maxPages ?? 15;
  const maxDepth = options.maxDepth ?? 3;

  for (let idx = 0; idx < queue.length && pageResults.length < maxPages; idx++) {
    const item = queue[idx];
    let normRoute = item.route.startsWith('/') ? item.route : `/${item.route}`;
    if (visited.has(normRoute)) continue;
    visited.add(normRoute);

    const fullUrl = new URL(normRoute, options.baseUrl).toString();
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const failedRequests: { url: string; status?: number; errorText?: string }[] = [];

    const onConsole = (msg: any) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    };
    const onPageError = (err: Error) => {
      pageErrors.push(err.message || String(err));
    };
    const onRequestFailed = (req: any) => {
      failedRequests.push({
        url: req.url(),
        errorText: req.failure()?.errorText || 'Failed to load',
      });
    };
    const onResponse = (res: any) => {
      if (res.status() >= 400) {
        failedRequests.push({
          url: res.url(),
          status: res.status(),
          errorText: `HTTP ${res.status()}`,
        });
      }
    };

    page.on('console', onConsole);
    page.on('pageerror', onPageError);
    page.on('requestfailed', onRequestFailed);
    page.on('response', onResponse);

    let status = 200;
    let title = '';
    let links: string[] = [];
    let domState: 'loaded' | 'blank' | 'error_boundary' | 'crashed' = 'loaded';

    try {
      const resp = await page.goto(fullUrl, {
        timeout: options.timeoutMs ?? 15000,
        waitUntil: 'domcontentloaded',
      });
      status = resp?.status() ?? 200;
      title = await page.title().catch(() => '');

      // Check DOM state
      const bodyText = await page.evaluate(() => document.body?.innerText?.trim() || '').catch(() => '');
      const childCount = await page.evaluate(() => document.body?.children?.length || 0).catch(() => 0);
      const innerHtml = await page.evaluate(() => document.body?.innerHTML?.trim() || '').catch(() => '');

      if (!bodyText && childCount === 0 && (!innerHtml || innerHtml.length === 0)) {
        domState = 'blank';
      } else if (/Application error|Unhandled Runtime Error|500 Internal Server Error/i.test(bodyText)) {
        domState = 'error_boundary';
      }

      // Collect links
      const hrefs: string[] = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a[href]'));
        return anchors
          .map((a) => a.getAttribute('href'))
          .filter((h): h is string => Boolean(h && h.startsWith('/') && !h.startsWith('//')));
      }).catch(() => []);

      links = hrefs;

      if (item.depth < maxDepth) {
        for (const link of links) {
          const cleanLink = link.split('#')[0].split('?')[0];
          if (!visited.has(cleanLink) && !queue.some((q) => q.route === cleanLink)) {
            queue.push({ route: cleanLink, depth: item.depth + 1 });
          }
        }
      }
    } catch (err: unknown) {
      status = 0;
      domState = 'crashed';
      pageErrors.push(err instanceof Error ? err.message : String(err));
    }

    // Remove listeners for this page
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
    page.off('requestfailed', onRequestFailed);
    page.off('response', onResponse);

    let screenshotPath: string | undefined;
    const hasIssues = pageErrors.length > 0 || consoleErrors.length > 0 || status >= 500 || domState !== 'loaded';

    if (hasIssues) {
      try {
        const safeName = normRoute.replace(/[^a-zA-Z0-9_-]/g, '_') || 'root';
        const filename = `error-${safeName}-${Date.now()}.png`;
        const fullScreenshotPath = path.join(options.screenshotsDir, filename);
        await page.screenshot({ path: fullScreenshotPath, fullPage: true });
        screenshotPath = fullScreenshotPath;
      } catch {}
    }

    pageResults.push({
      url: normRoute,
      status,
      title,
      consoleErrors,
      pageErrors,
      failedRequests,
      discoveredLinks: links,
      domState,
      screenshotPath,
    });
  }

  await context.close();
  return pageResults;
}

function buildBrowserChecks(results: PageCrawlResult[], usedPlaywright: boolean): CheckResult[] {
  const checks: CheckResult[] = [];

  const allPageErrors = results.filter((r) => r.pageErrors.length > 0);
  const allConsoleErrors = results.filter((r) => r.consoleErrors.length > 0);
  const all500Requests = results.flatMap((r) =>
    r.failedRequests
      .filter((f) => f.status && f.status >= 500)
      .map((f) => ({ pageUrl: r.url, ...f }))
  );
  const rootResult = results.find((r) => r.url === '/');
  const blankPages = results.filter((r) => r.domState === 'blank');
  const errorBoundaries = results.filter((r) => r.domState === 'error_boundary');

  // 1. Uncaught JS Exceptions -> Blocker
  if (allPageErrors.length > 0) {
    const evidence: BrowserEvidence[] = allPageErrors.map((r) => ({
      type: 'browser',
      url: r.url,
      pageErrors: r.pageErrors,
      consoleErrors: r.consoleErrors,
      domState: r.domState,
      failedRequests: r.failedRequests,
    }));

    checks.push({
      id: 'browser-uncaught-exceptions',
      title: 'Uncaught JavaScript exceptions in browser',
      category: 'browser',
      status: 'block',
      severity: 'blocker',
      summary: `Found uncaught JS exceptions on ${allPageErrors.length} route(s): ${allPageErrors.map((r) => r.url).join(', ')}.`,
      evidence,
      remediation: 'Inspect the stack traces and fix the runtime exception preventing client components from rendering.',
    });
  }

  // 2. Server 500 errors on routes -> Blocker
  if (all500Requests.length > 0) {
    const evidence: HttpEvidence[] = all500Requests.map((r) => ({
      type: 'http',
      url: r.url,
      method: 'GET',
      statusCode: r.status || 500,
      statusText: 'Internal Server Error',
    }));

    checks.push({
      id: 'browser-server-500',
      title: 'HTTP 500 Internal Server Errors encountered',
      category: 'browser',
      status: 'block',
      severity: 'blocker',
      summary: `Encountered ${all500Requests.length} HTTP 500 error(s) during route exploration.`,
      evidence,
      remediation: 'Check server logs for the crashed handler and ensure required services or environment variables are available.',
    });
  }

  // 3. Root route missing (404 on /) -> Blocker
  if (rootResult && rootResult.status === 404) {
    checks.push({
      id: 'browser-root-missing',
      title: 'Root route returned 404 Not Found',
      category: 'browser',
      status: 'block',
      severity: 'blocker',
      summary: 'The main index route (/) returned 404 Not Found. Application has no accessible landing or home view.',
      evidence: [
        {
          type: 'http',
          url: '/',
          method: 'GET',
          statusCode: 404,
          statusText: 'Not Found',
        },
      ],
      remediation: 'Configure a root page or index route handler in your framework.',
    });
  }

  // 4. Blank page detection -> Blocker
  if (blankPages.length > 0 && (!rootResult || rootResult.status !== 404)) {
    checks.push({
      id: 'browser-blank-page',
      title: 'Blank page rendered',
      category: 'browser',
      status: 'block',
      severity: 'blocker',
      summary: `Route(s) rendered completely blank with no DOM content: ${blankPages.map((r) => r.url).join(', ')}.`,
      evidence: blankPages.map((r) => ({
        type: 'browser',
        url: r.url,
        domState: 'blank',
        consoleErrors: r.consoleErrors,
        pageErrors: r.pageErrors,
        failedRequests: r.failedRequests,
      })),
      remediation: 'Ensure client root component mounts properly and has fallback content.',
    });
  }

  // 5. Error Boundary triggered -> Blocker
  if (errorBoundaries.length > 0) {
    checks.push({
      id: 'browser-error-boundary',
      title: 'Application Error Boundary triggered',
      category: 'browser',
      status: 'block',
      severity: 'blocker',
      summary: `Application rendered an error boundary on route(s): ${errorBoundaries.map((r) => r.url).join(', ')}.`,
      evidence: errorBoundaries.map((r) => ({
        type: 'browser',
        url: r.url,
        domState: 'error_boundary',
        consoleErrors: r.consoleErrors,
        pageErrors: r.pageErrors,
        failedRequests: r.failedRequests,
      })),
      remediation: 'Check the error message in the error boundary and fix the component crash.',
    });
  }

  // 6. Expected Auth responses (401/403) -> Info / Warning (NEVER a blocker)
  const authRequests = results.flatMap((r) =>
    r.failedRequests.filter((f) => f.status === 401 || f.status === 403)
  );
  if (authRequests.length > 0) {
    checks.push({
      id: 'browser-auth-boundary',
      title: 'Authentication boundary detected',
      category: 'browser',
      status: 'pass',
      severity: 'info',
      summary: `Detected expected protected route authentication response (${authRequests.map((a) => a.url).join(', ')}).`,
      evidence: authRequests.map((a) => ({
        type: 'http',
        url: a.url,
        method: 'GET',
        statusCode: a.status || 401,
        statusText: a.status === 403 ? 'Forbidden' : 'Unauthorized',
      })),
    });
  }

  // 7. Non-fatal 404 assets (images, favicons) -> Warning (low severity, NOT blocker)
  const asset404s = results.flatMap((r) =>
    r.failedRequests.filter((f) => f.status === 404 && f.url !== '/')
  );
  if (asset404s.length > 0) {
    checks.push({
      id: 'browser-missing-assets',
      title: 'Non-critical assets returned 404',
      category: 'browser',
      status: 'warn',
      severity: 'low',
      summary: `Found ${asset404s.length} non-critical sub-resource(s) returning 404: ${asset404s.map((a) => a.url).join(', ')}.`,
      evidence: asset404s.map((a) => ({
        type: 'http',
        url: a.url,
        method: 'GET',
        statusCode: 404,
        statusText: 'Not Found',
      })),
      remediation: 'Verify that static assets referenced in HTML or CSS are placed in the public static directory.',
    });
  }

  // 8. Console errors (warning if not crashing page)
  if (allConsoleErrors.length > 0 && allPageErrors.length === 0) {
    checks.push({
      id: 'browser-console-errors',
      title: 'Console errors logged during execution',
      category: 'browser',
      status: 'warn',
      severity: 'medium',
      summary: `Observed ${allConsoleErrors.length} route(s) logging console errors: ${allConsoleErrors.map((r) => r.url).join(', ')}.`,
      evidence: allConsoleErrors.map((r) => ({
        type: 'browser',
        url: r.url,
        consoleErrors: r.consoleErrors,
        pageErrors: [],
        failedRequests: r.failedRequests,
      })),
      remediation: 'Check browser console warnings/errors to prevent degraded client performance or latent bugs.',
    });
  }

  // 9. Healthy routes check
  const hasBlockers = checks.some((c) => c.status === 'block');
  if (!hasBlockers && results.length > 0) {
    checks.push({
      id: 'browser-routes-verified',
      title: 'Browser route exploration passed',
      category: 'browser',
      status: 'pass',
      severity: 'info',
      summary: `Successfully verified ${results.length} route(s) with zero page crashes or server 500 errors (${usedPlaywright ? 'Playwright browser' : 'HTTP crawler'}).`,
      evidence: results.map((r) => ({
        type: 'browser',
        url: r.url,
        domState: r.domState || 'loaded',
        consoleErrors: [],
        pageErrors: [],
        failedRequests: [],
      })),
    });
  }

  return checks;
}

function buildEvidence(results: PageCrawlResult[]): (BrowserEvidence | ScreenshotEvidence | HttpEvidence)[] {
  const list: (BrowserEvidence | ScreenshotEvidence | HttpEvidence)[] = [];

  for (const r of results) {
    list.push({
      type: 'browser',
      url: r.url,
      consoleErrors: r.consoleErrors,
      pageErrors: r.pageErrors,
      failedRequests: r.failedRequests,
      domState: r.domState,
    });

    if (r.screenshotPath) {
      list.push({
        type: 'screenshot',
        name: `screenshot-${r.url.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
        path: r.screenshotPath,
        relativePath: path.relative(process.cwd(), r.screenshotPath),
        caption: `Visual capture of error on ${r.url}`,
      });
    }
  }

  return list;
}
