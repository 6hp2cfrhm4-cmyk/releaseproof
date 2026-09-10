import { z } from 'zod';
import { CheckResultSchema, CheckCategorySchema } from './check.js';
import { ProjectProfileSchema } from './profile.js';

export const CategoryScoreSchema = z.object({
  max: z.number(),
  score: z.number(),
  status: z.enum(['pass', 'warn', 'fail', 'skipped', 'unknown']),
});
export type CategoryScore = z.infer<typeof CategoryScoreSchema>;

export const VerificationVerdictSchema = z.enum(['READY', 'NOT_READY', 'INCOMPLETE']);
export type VerificationVerdict = z.infer<typeof VerificationVerdictSchema>;

export const VerificationReportSchema = z.object({
  id: z.string(),
  version: z.string().default('0.1.0'),
  timestamp: z.string(),
  projectName: z.string(),
  projectPath: z.string(),
  profile: ProjectProfileSchema,
  verdict: VerificationVerdictSchema,
  score: z.number().min(0).max(100),
  categoryScores: z.record(CheckCategorySchema, CategoryScoreSchema),
  counts: z.object({
    total: z.number(),
    passed: z.number(),
    warnings: z.number(),
    blockers: z.number(),
    unknown: z.number(),
    skipped: z.number(),
  }),
  checks: z.array(CheckResultSchema),
  durationMs: z.number(),
  artifactsDir: z.string(),
  fixPromptPath: z.string().optional(),
  htmlReportPath: z.string().optional(),
  jsonReportPath: z.string().optional(),
});
export type VerificationReport = z.infer<typeof VerificationReportSchema>;
