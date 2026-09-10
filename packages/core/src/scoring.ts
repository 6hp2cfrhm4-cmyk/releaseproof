import {
  CheckResult,
  CheckCategory,
  CategoryScore,
  VerificationVerdict,
} from '@releaseproof/schemas';

export const CATEGORY_WEIGHTS: Record<CheckCategory, number> = {
  install: 15,
  build: 15,
  runtime: 20,
  browser: 15,
  api: 10,
  environment: 10,
  documentation: 5,
  security: 10,
};

export interface ScoreComputationResult {
  score: number;
  verdict: VerificationVerdict;
  categoryScores: Record<CheckCategory, CategoryScore>;
  counts: {
    total: number;
    passed: number;
    warnings: number;
    blockers: number;
    unknown: number;
    skipped: number;
  };
}

export function computeScore(checks: CheckResult[]): ScoreComputationResult {
  let passed = 0;
  let warnings = 0;
  let blockers = 0;
  let unknown = 0;
  let skipped = 0;

  for (const check of checks) {
    if (check.severity === 'blocker' || check.status === 'block') {
      blockers++;
    } else if (check.severity === 'high' || check.status === 'warn') {
      warnings++;
    } else if (check.status === 'pass') {
      passed++;
    } else if (check.status === 'unknown') {
      unknown++;
    } else if (check.status === 'skipped') {
      skipped++;
    }
  }

  const categoryScores: Record<CheckCategory, CategoryScore> = {
    install: { max: CATEGORY_WEIGHTS.install, score: CATEGORY_WEIGHTS.install, status: 'pass' },
    build: { max: CATEGORY_WEIGHTS.build, score: CATEGORY_WEIGHTS.build, status: 'pass' },
    runtime: { max: CATEGORY_WEIGHTS.runtime, score: CATEGORY_WEIGHTS.runtime, status: 'pass' },
    browser: { max: CATEGORY_WEIGHTS.browser, score: CATEGORY_WEIGHTS.browser, status: 'pass' },
    api: { max: CATEGORY_WEIGHTS.api, score: CATEGORY_WEIGHTS.api, status: 'pass' },
    environment: { max: CATEGORY_WEIGHTS.environment, score: CATEGORY_WEIGHTS.environment, status: 'pass' },
    documentation: { max: CATEGORY_WEIGHTS.documentation, score: CATEGORY_WEIGHTS.documentation, status: 'pass' },
    security: { max: CATEGORY_WEIGHTS.security, score: CATEGORY_WEIGHTS.security, status: 'pass' },
  };

  for (const cat of Object.keys(CATEGORY_WEIGHTS) as CheckCategory[]) {
    const catChecks = checks.filter((c) => c.category === cat);
    if (catChecks.length === 0) continue;

    const hasBlock = catChecks.some((c) => c.status === 'block' || c.severity === 'blocker');
    const hasWarn = catChecks.some((c) => c.status === 'warn' || c.severity === 'high');
    const allSkipped = catChecks.every((c) => c.status === 'skipped');

    if (hasBlock) {
      categoryScores[cat].score = 0;
      categoryScores[cat].status = 'fail';
    } else if (hasWarn) {
      categoryScores[cat].score = Math.round(CATEGORY_WEIGHTS[cat] * 0.5);
      categoryScores[cat].status = 'warn';
    } else if (allSkipped) {
      categoryScores[cat].status = 'skipped';
    } else {
      categoryScores[cat].score = CATEGORY_WEIGHTS[cat];
      categoryScores[cat].status = 'pass';
    }
  }

  let totalScore = 0;
  for (const cat of Object.keys(categoryScores) as CheckCategory[]) {
    totalScore += categoryScores[cat].score;
  }

  // A blocker ALWAYS yields NOT_READY
  const verdict: VerificationVerdict = blockers > 0 ? 'NOT_READY' : 'READY';

  return {
    score: Math.min(100, Math.max(0, totalScore)),
    verdict,
    categoryScores,
    counts: {
      total: checks.length,
      passed,
      warnings,
      blockers,
      unknown,
      skipped,
    },
  };
}
