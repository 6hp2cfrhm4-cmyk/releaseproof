import { z } from 'zod';

export const FrameworkTypeSchema = z.enum([
  'nextjs',
  'vite',
  'express',
  'fastapi',
  'generic-node',
  'generic-python',
  'static',
]);
export type FrameworkType = z.infer<typeof FrameworkTypeSchema>;

export const FrameworkDetectionSchema = z.object({
  type: FrameworkTypeSchema,
  name: z.string(),
  version: z.string().optional(),
  confidence: z.number().min(0).max(1),
  meta: z.record(z.unknown()).optional(),
});
export type FrameworkDetection = z.infer<typeof FrameworkDetectionSchema>;

export const PackageManagerTypeSchema = z.enum([
  'npm',
  'pnpm',
  'yarn',
  'pip',
  'uv',
  'poetry',
]);
export type PackageManagerType = z.infer<typeof PackageManagerTypeSchema>;

export const PackageManagerInfoSchema = z.object({
  type: PackageManagerTypeSchema,
  lockfile: z.string().optional(),
  version: z.string().optional(),
});
export type PackageManagerInfo = z.infer<typeof PackageManagerInfoSchema>;

export const RuntimeTypeSchema = z.enum(['node', 'python', 'docker']);
export type RuntimeType = z.infer<typeof RuntimeTypeSchema>;

export const RuntimeInfoSchema = z.object({
  type: RuntimeTypeSchema,
  version: z.string().optional(),
});
export type RuntimeInfo = z.infer<typeof RuntimeInfoSchema>;

export const EnvironmentVariableInfoSchema = z.object({
  name: z.string(),
  required: z.boolean().default(false),
  sources: z.array(z.string()).default([]),
  hasDefault: z.boolean().default(false),
  isSecret: z.boolean().default(false),
});
export type EnvironmentVariableInfo = z.infer<typeof EnvironmentVariableInfoSchema>;

export const ProjectProfileSchema = z.object({
  root: z.string(),
  name: z.string().default('project'),
  languages: z.array(z.string()).default([]),
  frameworks: z.array(FrameworkDetectionSchema).default([]),
  runtime: z.array(RuntimeInfoSchema).default([]),
  packageManagers: z.array(PackageManagerInfoSchema).default([]),
  commands: z.object({
    install: z.string().optional(),
    dev: z.string().optional(),
    build: z.string().optional(),
    start: z.string().optional(),
    test: z.string().optional(),
  }).default({}),
  ports: z.array(z.number()).default([]),
  environmentVariables: z.array(EnvironmentVariableInfoSchema).default([]),
  capabilities: z.object({
    browser: z.boolean().default(false),
    api: z.boolean().default(false),
    docker: z.boolean().default(false),
  }).default({ browser: false, api: false, docker: false }),
  entrypoints: z.array(z.string()).default([]),
});
export type ProjectProfile = z.infer<typeof ProjectProfileSchema>;
