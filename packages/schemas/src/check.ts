import { z } from 'zod';
import { EvidenceSchema } from './evidence.js';

export const CheckStatusSchema = z.enum([
  'pass',
  'warn',
  'block',
  'unknown',
  'skipped',
]);
export type CheckStatus = z.infer<typeof CheckStatusSchema>;

export const SeveritySchema = z.enum([
  'blocker',
  'high',
  'medium',
  'low',
  'info',
]);
export type Severity = z.infer<typeof SeveritySchema>;

export const CheckCategorySchema = z.enum([
  'install',
  'build',
  'runtime',
  'browser',
  'api',
  'environment',
  'documentation',
  'security',
]);
export type CheckCategory = z.infer<typeof CheckCategorySchema>;

export const CheckResultSchema = z.object({
  id: z.string(),
  title: z.string(),
  category: CheckCategorySchema,
  status: CheckStatusSchema,
  severity: SeveritySchema,
  summary: stringSchema(),
  evidence: z.array(EvidenceSchema).default([]),
  remediation: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});
export type CheckResult = z.infer<typeof CheckResultSchema>;

function stringSchema() {
  return z.string();
}
