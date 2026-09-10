import * as http from 'node:http';
import { PageCrawlResult, BrowserVerificationOptions } from './types.js';

export async function crawlViaHttp(
  options: BrowserVerificationOptions
): Promise<PageCrawlResult[]> {
  const queue: { route: string; depth: number }[] = [
    ...options.initialRoutes.map((r) => ({ route: r, depth: 0 })),
  ];
  if (queue.length === 0) {
    queue.push({ route: '/', depth: 0 });
  }

  const visited = new Set<string>();
  const results: PageCrawlResult[] = [];
  const maxPages = options.maxPages ?? 15;
  const maxDepth = options.maxDepth ?? 3;

  while (queue.length > 0 && results.length < maxPages) {
    const item = queue.shift()!;
    let normRoute = item.route.startsWith('/') ? item.route : `/${item.route}`;
    if (visited.has(normRoute)) continue;
    visited.add(normRoute);

    const fullUrl = new URL(normRoute, options.baseUrl).toString();
    const crawlRes = await fetchPageHttp(fullUrl, options.timeoutMs ?? 10000);
    results.push(crawlRes);

    if (item.depth < maxDepth && crawlRes.discoveredLinks.length > 0) {
      for (const link of crawlRes.discoveredLinks) {
        if (!visited.has(link) && !queue.some((q) => q.route === link)) {
          queue.push({ route: link, depth: item.depth + 1 });
        }
      }
    }
  }

  return results;
}

function fetchPageHttp(targetUrl: string, timeoutMs: number): Promise<PageCrawlResult> {
  return new Promise((resolve) => {
    const parsed = new URL(targetUrl);

    const req = http.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || 80,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: {
          'User-Agent': 'ReleaseProof-Crawler/0.1.0',
          Accept: 'text/html,application/xhtml+xml,application/json,*/*',
        },
        timeout: timeoutMs,
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          if (body.length < 500000) {
            body += chunk;
          }
        });
        res.on('end', () => {
          const status = res.statusCode || 0;
          const links: string[] = [];

          // Extract href links from html
          const hrefRegex = /href=['"]([^'"]+)['"]/g;
          let match: RegExpExecArray | null;
          while ((match = hrefRegex.exec(body)) !== null) {
            const href = match[1];
            if (href.startsWith('/') && !href.startsWith('//') && !href.includes(':')) {
              links.push(href.split('#')[0]);
            }
          }

          // Check if body looks like error page
          const isBlank = body.trim().length === 0;
          const isErrorBoundary = /Internal Server Error|Application Error|Unhandled Runtime Error/i.test(body);

          const domState = isBlank
            ? 'blank'
            : isErrorBoundary
            ? 'error_boundary'
            : 'loaded';

          const pageErrors: string[] = [];
          const consoleErrors: string[] = [];

          const throwMatch = body.match(/<script[^>]*>[\s\S]*?throw\s+new\s+Error\(['"]([^'"]+)['"]\)/i);
          if (throwMatch) {
            pageErrors.push(throwMatch[1]);
          }

          const consoleErrorMatch = body.match(/<script[^>]*>[\s\S]*?console\.error\(['"]([^'"]+)['"]\)/i);
          if (consoleErrorMatch) {
            consoleErrors.push(consoleErrorMatch[1]);
          }

          const failedRequests = [];
          if (status >= 400) {
            failedRequests.push({
              url: targetUrl,
              status,
              errorText: `HTTP ${status}: ${res.statusMessage || 'Error'}`,
            });
          }

          resolve({
            url: parsed.pathname,
            status,
            consoleErrors,
            pageErrors,
            failedRequests,
            discoveredLinks: Array.from(new Set(links)),
            domState,
          });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      resolve({
        url: parsed.pathname,
        status: 0,
        consoleErrors: ['Request timeout'],
        pageErrors: [],
        failedRequests: [{ url: targetUrl, errorText: 'Request timeout' }],
        discoveredLinks: [],
        domState: 'crashed',
      });
    });

    req.on('error', (err) => {
      resolve({
        url: parsed.pathname,
        status: 0,
        consoleErrors: [err.message],
        pageErrors: [],
        failedRequests: [{ url: targetUrl, errorText: err.message }],
        discoveredLinks: [],
        domState: 'crashed',
      });
    });

    req.end();
  });
}
