import { z } from 'zod';
import { CheckResultSchema, CheckCategorySchema } from './check.js';
import { ProjectProfileSchema } from './profile.js';

export const CategoryScoreSchema = z.object({
  max: z.number(),
  score: z.number(),
  status: z.enum(['pass', 'warn', 'fail', 'skipped', 'unknown', 'not_applicable']),
});
export type CategoryScore = z.infer<typeof CategoryScoreSchema>;

export const VerificationVerdictSchema = z.enum(['READY', 'NOT_READY', 'INCOMPLETE', 'CANCELLED']);
export type VerificationVerdict = z.infer<typeof VerificationVerdictSchema>;

export const VerificationRunStatusSchema = z.enum(['completed', 'cancelled', 'internal_error']);

export const BrowserVerificationStatusSchema = z.enum([
  'VERIFIED',
  'HTTP_FALLBACK',
  'UNAVAILABLE',
  'SKIPPED',
]);
export type BrowserVerificationStatus = z.infer<typeof BrowserVerificationStatusSchema>;

/**
 * The report contract is versioned independently from the application.  Keep
 * this deliberately small and additive: consumers can render the known
 * capability keys while preserving unknown future keys from the JSON file.
 */
export const ReportCapabilityStatusSchema = z.enum([
  'verified',
  'unavailable',
  'failed',
  'skipped',
  'not_applicable',
]);

export const ReportCapabilitySchema = z.object({
  status: ReportCapabilityStatusSchema,
  reason: z.string().optional(),
});

export const ReportCapabilitiesSchema = z.record(ReportCapabilitySchema).default({});

export const ReportCleanupSchema = z.object({
  status: z.enum(['clean', 'failed', 'cancelled']).default('clean'),
  errors: z.array(z.string()).default([]),
}).default({ status: 'clean', errors: [] });

export const VerificationReportSchema = z.object({
  // Optional on input for backwards-compatible readers; Core always emits it.
  schemaVersion: z.string().optional(),
  id: z.string(),
  version: z.string().default('0.2.0-dev.0'),
  runStatus: VerificationRunStatusSchema.default('completed'),
  timestamp: z.string(),
  projectName: z.string(),
  projectPath: z.string(),
  profile: ProjectProfileSchema,
  verdict: VerificationVerdictSchema,
  score: z.number().min(0).max(100),
  evidenceCoverage: z.number().min(0).max(1).default(0),
  categoryScores: z.record(CheckCategorySchema, CategoryScoreSchema),
  counts: z.object({
    total: z.number(),
    passed: z.number(),
    warnings: z.number(),
    blockers: z.number(),
    unknown: z.number(),
    skipped: z.number(),
    notApplicable: z.number(),
  }),
  browserVerification: z.object({
    status: BrowserVerificationStatusSchema,
    reason: z.string().optional(),
  }).default({ status: 'SKIPPED' }),
  /** Capability is intentionally separate from verdict: unavailable evidence
   * is not an application failure and must remain visible to every consumer. */
  capabilities: ReportCapabilitiesSchema.optional(),
  cleanup: ReportCleanupSchema.optional(),
  checks: z.array(CheckResultSchema),
  durationMs: z.number(),
  artifactsDir: z.string(),
  fixPromptPath: z.string().optional(),
  htmlReportPath: z.string().optional(),
  jsonReportPath: z.string().optional(),
}).superRefine((report, context) => {
  if (report.runStatus === 'cancelled' && report.verdict !== 'CANCELLED') {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['verdict'], message: 'Cancelled runs must not contain a shipping verdict.' });
  }
  if (report.verdict === 'CANCELLED' && report.runStatus !== 'cancelled') {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['runStatus'], message: 'A cancelled verdict requires cancelled run status.' });
  }
  if (report.runStatus === 'cancelled' && report.score !== 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['score'], message: 'Cancelled runs cannot receive a readiness score.' });
  }
  if (report.verdict === 'READY' && report.checks.some((check) => check.status === 'block')) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['verdict'], message: 'A report with a blocker cannot be READY.' });
  }
});
export type VerificationReport = z.infer<typeof VerificationReportSchema>;
