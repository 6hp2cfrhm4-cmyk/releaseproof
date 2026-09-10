/**
 * Central secret redaction layer for ReleaseProof.
 * Guarantees that sensitive secrets never leak into stdout, JSON, HTML, or AI markdown.
 */

const SECRET_REPLACEMENT_PATTERNS: { pattern: RegExp; replace: (match: string) => string }[] = [
  // 1. Private keys
  {
    pattern: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/g,
    replace: () => '[REDACTED_PRIVATE_KEY]',
  },
  // 2. AWS Access Key IDs
  {
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
    replace: (val) => `${val.slice(0, 4)}****************`,
  },
  // 3. Database URLs with passwords (postgres, mysql, mongodb, redis, etc.)
  {
    pattern: /([a-zA-Z0-9+]+:\/\/)([^:]+):([^@\s]+)@/g,
    replace: ((_match: string, p1: string, p2: string) => `${p1}${p2}:[REDACTED_PASSWORD]@`) as any,
  },
  // 4. GitHub Personal Access Tokens
  {
    pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,255}\b/g,
    replace: (val) => `${val.slice(0, 4)}********************************`,
  },
  // 5. Slack tokens
  {
    pattern: /\bxox[baprs]-[0-9a-zA-Z]{10,48}\b/g,
    replace: (val) => `${val.slice(0, 4)}****************`,
  },
  // 6. Generic high-entropy secret assignments (e.g. SECRET_KEY = "...")
  {
    pattern: /((?:api[_-]?key|secret|password|token|bearer)\s*[:=]\s*['"]?)([a-zA-Z0-9\-_./+=]{8,})(['"]?)/gi,
    replace: ((_match: string, p1: string, _p2: string, p3: string) => `${p1}[REDACTED_SECRET]${p3 || ''}`) as any,
  },
];

/**
 * Redacts known sensitive secrets from a string.
 */
export function redactSecrets(text: string): string {
  if (!text || typeof text !== 'string') return text;

  let redacted = text;
  for (const item of SECRET_REPLACEMENT_PATTERNS) {
    redacted = redacted.replace(item.pattern, item.replace as any);
  }
  return redacted;
}

/**
 * Deeply traverses an object or array and redacts all string values.
 */
export function redactObject<T>(target: T): T {
  if (target === null || target === undefined) return target;

  if (typeof target === 'string') {
    return redactSecrets(target) as unknown as T;
  }

  if (Array.isArray(target)) {
    return target.map((item) => redactObject(item)) as unknown as T;
  }

  if (typeof target === 'object') {
    const copy: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(target)) {
      copy[key] = redactObject(value);
    }
    return copy as T;
  }

  return target;
}
