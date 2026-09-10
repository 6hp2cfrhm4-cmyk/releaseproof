import { z } from 'zod';

export const CommandEvidenceSchema = z.object({
  type: z.literal('command'),
  command: z.string(),
  exitCode: z.number().nullable(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
  durationMs: z.number().optional(),
});
export type CommandEvidence = z.infer<typeof CommandEvidenceSchema>;

export const HttpEvidenceSchema = z.object({
  type: z.literal('http'),
  url: z.string(),
  method: z.string().default('GET'),
  statusCode: z.number(),
  statusText: z.string().optional(),
  durationMs: z.number().optional(),
  headers: z.record(z.string()).optional(),
  responsePreview: z.string().optional(),
});
export type HttpEvidence = z.infer<typeof HttpEvidenceSchema>;

export const BrowserEvidenceSchema = z.object({
  type: z.literal('browser'),
  url: z.string(),
  consoleErrors: z.array(z.string()).default([]),
  pageErrors: z.array(z.string()).default([]),
  failedRequests: z.array(z.object({
    url: z.string(),
    status: z.number().optional(),
    errorText: z.string().optional(),
  })).default([]),
  title: z.string().optional(),
  domState: z.enum(['loaded', 'blank', 'error_boundary', 'crashed']).optional(),
});
export type BrowserEvidence = z.infer<typeof BrowserEvidenceSchema>;

export const ScreenshotEvidenceSchema = z.object({
  type: z.literal('screenshot'),
  name: z.string(),
  path: z.string(),
  relativePath: z.string(),
  base64: z.string().optional(),
  caption: z.string().optional(),
});
export type ScreenshotEvidence = z.infer<typeof ScreenshotEvidenceSchema>;

export const FilesystemEvidenceSchema = z.object({
  type: z.literal('filesystem'),
  path: z.string(),
  exists: z.boolean(),
  isDirectory: z.boolean().optional(),
  size: z.number().optional(),
  contentPreview: z.string().optional(),
});
export type FilesystemEvidence = z.infer<typeof FilesystemEvidenceSchema>;

export const ProcessEvidenceSchema = z.object({
  type: z.literal('process'),
  pid: z.number().optional(),
  alive: z.boolean(),
  exitCode: z.number().nullable().optional(),
  signal: z.string().nullable().optional(),
  port: z.number().optional(),
  listening: z.boolean().optional(),
  stdoutTail: z.string().optional(),
  stderrTail: z.string().optional(),
});
export type ProcessEvidence = z.infer<typeof ProcessEvidenceSchema>;

export const EnvironmentEvidenceSchema = z.object({
  type: z.literal('environment'),
  variable: z.string(),
  defined: z.boolean(),
  usedInFiles: z.array(z.string()).default([]),
  documentedInExample: z.boolean().default(false),
  exposedToClient: z.boolean().default(false),
});
export type EnvironmentEvidence = z.infer<typeof EnvironmentEvidenceSchema>;

export const ReproductionEvidenceSchema = z.object({
  type: z.literal('reproduction'),
  steps: z.array(z.string()),
  runs: z.number(),
  failures: z.number(),
});
export type ReproductionEvidence = z.infer<typeof ReproductionEvidenceSchema>;

export const EvidenceSchema = z.discriminatedUnion('type', [
  CommandEvidenceSchema,
  HttpEvidenceSchema,
  BrowserEvidenceSchema,
  ScreenshotEvidenceSchema,
  FilesystemEvidenceSchema,
  ProcessEvidenceSchema,
  EnvironmentEvidenceSchema,
  ReproductionEvidenceSchema,
]);
export type Evidence = z.infer<typeof EvidenceSchema>;
