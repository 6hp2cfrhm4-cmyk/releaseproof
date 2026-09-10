import { z } from 'zod';

export const ReleaseProofConfigSchema = z.object({
  ignoreDirs: z.array(z.string()).default([]),
  build: z.object({
    command: z.string().optional(),
    timeoutMs: z.number().default(120000),
  }).default({}),
  start: z.object({
    command: z.string().optional(),
    port: z.number().optional(),
    timeoutMs: z.number().default(30000),
    healthCheckPath: z.string().default('/'),
  }).default({}),
  browser: z.object({
    enabled: z.boolean().default(true),
    headless: z.boolean().default(true),
    maxPages: z.number().default(15),
    maxDepth: z.number().default(3),
    timeoutMs: z.number().default(15000),
    ignorePatterns: z.array(z.string()).default([]),
  }).default({}),
  environment: z.object({
    required: z.array(z.string()).default([]),
    envFile: z.string().optional(),
    allowUnknown: z.boolean().default(false),
  }).default({}),
  checks: z.object({
    install: z.boolean().default(true),
    build: z.boolean().default(true),
    startup: z.boolean().default(true),
    browser: z.boolean().default(true),
    routes: z.boolean().default(true),
    environment: z.boolean().default(true),
    secrets: z.boolean().default(true),
    documentation: z.boolean().default(true),
    devProd: z.boolean().default(true),
  }).default({}),
  ci: z.boolean().default(false),
  verbose: z.boolean().default(false),
  noCache: z.boolean().default(false),
});
export type ReleaseProofConfig = z.infer<typeof ReleaseProofConfigSchema>;

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type ReleaseProofUserConfig = DeepPartial<ReleaseProofConfig>;
