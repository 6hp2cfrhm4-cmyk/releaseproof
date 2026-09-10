import { CheckResult, BrowserEvidence, ScreenshotEvidence, HttpEvidence } from '@releaseproof/schemas';

export interface PageCrawlResult {
  url: string;
  status: number;
  title?: string;
  consoleErrors: string[];
  pageErrors: string[];
  failedRequests: { url: string; status?: number; errorText?: string }[];
  discoveredLinks: string[];
  screenshotPath?: string;
  domState?: 'loaded' | 'blank' | 'error_boundary' | 'crashed';
}

export interface BrowserVerificationOptions {
  baseUrl: string;
  initialRoutes: string[];
  maxPages?: number;
  maxDepth?: number;
  timeoutMs?: number;
  screenshotsDir: string;
  ignorePatterns?: string[];
  headless?: boolean;
}

export interface BrowserVerificationResult {
  pagesVisited: number;
  results: PageCrawlResult[];
  checks: CheckResult[];
  evidence: (BrowserEvidence | ScreenshotEvidence | HttpEvidence)[];
}
