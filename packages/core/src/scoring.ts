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
  /** Fraction of required checks with an observed pass, warning, or blocker. */
  evidenceCoverage: number;
  verdict: VerificationVerdict;
  categoryScores: Record<CheckCategory, CategoryScore>;
  counts: {
    total: number;
    passed: number;
    warnings: number;
    blockers: number;
    unknown: number;
    skipped: number;
    notApplicable: number;
  };
}

export function computeScore(checks: CheckResult[]): ScoreComputationResult {
  let passed = 0;
  let warnings = 0;
  let blockers = 0;
  let unknown = 0;
  let skipped = 0;
  let notApplicable = 0;
  let observedRequired = 0;
  let applicableRequired = 0;

  for (const check of checks) {
    if (check.status === 'block') {
      blockers++;
      observedRequired++;
      applicableRequired++;
    } else if (check.status === 'pass') {
      passed++;
      observedRequired++;
      applicableRequired++;
    } else if (check.status === 'warn') {
      warnings++;
      observedRequired++;
      applicableRequired++;
    } else if (check.status === 'unknown') {
      unknown++;
      applicableRequired++;
    } else if (check.status === 'skipped') {
      skipped++;
      applicableRequired++;
    } else if (check.status === 'not_applicable') {
      notApplicable++;
    }
  }

  const categoryScores: Record<CheckCategory, CategoryScore> = {
    install: { max: 0, score: 0, status: 'skipped' },
    build: { max: 0, score: 0, status: 'skipped' },
    runtime: { max: 0, score: 0, status: 'skipped' },
    browser: { max: 0, score: 0, status: 'skipped' },
    api: { max: 0, score: 0, status: 'skipped' },
    environment: { max: 0, score: 0, status: 'skipped' },
    documentation: { max: 0, score: 0, status: 'skipped' },
    security: { max: 0, score: 0, status: 'skipped' },
  };

  for (const cat of Object.keys(CATEGORY_WEIGHTS) as CheckCategory[]) {
    const catChecks = checks.filter((c) => c.category === cat);
    if (catChecks.length === 0) continue;

    const applicableChecks = catChecks.filter((c) => c.status !== 'not_applicable');
    if (applicableChecks.length === 0) {
      categoryScores[cat].status = 'not_applicable';
      continue;
    }
    categoryScores[cat].max = CATEGORY_WEIGHTS[cat];

    const hasBlock = applicableChecks.some((c) => c.status === 'block');
    const hasUnknown = applicableChecks.some((c) => c.status === 'unknown');
    const hasSkipped = applicableChecks.some((c) => c.status === 'skipped');
    const hasWarn = applicableChecks.some((c) => c.status === 'warn');
    const credits = applicableChecks.map((check) => {
      if (check.status === 'pass') return 1;
      if (check.status === 'warn') return 0.5;
      return 0;
    });
    categoryScores[cat].score = Math.round(
      CATEGORY_WEIGHTS[cat] * credits.reduce<number>((sum, credit) => sum + credit, 0) / credits.length
    );

    if (hasBlock) categoryScores[cat].status = 'fail';
    else if (hasUnknown) categoryScores[cat].status = 'unknown';
    else if (hasSkipped) categoryScores[cat].status = 'skipped';
    else if (hasWarn) categoryScores[cat].status = 'warn';
    else categoryScores[cat].status = 'pass';
  }

  let earnedScore = 0;
  let applicableMax = 0;
  for (const cat of Object.keys(categoryScores) as CheckCategory[]) {
    earnedScore += categoryScores[cat].score;
    applicableMax += categoryScores[cat].max;
  }
  const totalScore = applicableMax > 0 ? Math.round((earnedScore / applicableMax) * 100) : 0;

  // Deterministic Verdict Policy:
  // 1. If any blocker exists -> NOT_READY (proven failure)
  // 2. If 0 blockers but unknown checks exist (external infrastructure missing) -> INCOMPLETE
  // 3. If 0 blockers and 0 unknown -> READY
  let verdict: VerificationVerdict = 'READY';
  if (blockers > 0) {
    verdict = 'NOT_READY';
  } else if (checks.length === 0 || unknown > 0 || skipped > 0 || passed + warnings === 0) {
    verdict = 'INCOMPLETE';
  }

  return {
    score: Math.min(100, Math.max(0, totalScore)),
    evidenceCoverage: applicableRequired === 0 ? 0 : observedRequired / applicableRequired,
    verdict,
    categoryScores,
    counts: {
      total: checks.length,
      passed,
      warnings,
      blockers,
      unknown,
      skipped,
      notApplicable,
    },
  };
}
