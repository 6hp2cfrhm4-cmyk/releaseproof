export interface ExternalServiceInfo {
  name: string;
  category: 'database' | 'auth' | 'cache' | 'saas';
  reason: string;
  remediation: string;
}

interface PatternRule {
  name: string;
  category: 'database' | 'auth' | 'cache' | 'saas';
  patterns: RegExp[];
  reason: string;
  remediation: string;
}

const SERVICE_RULES: PatternRule[] = [
  {
    name: 'PostgreSQL',
    category: 'database',
    patterns: [
      /ECONNREFUSED.*5432/i,
      /could not connect to server:\s*Connection refused.*5432/i,
      /psycopg2\.OperationalError.*connection.*refused/i,
      /psycopg2\.OperationalError.*could not connect to server/i,
      /PrismaClientInitializationError.*Can't reach database server.*5432/i,
      /SequelizeConnectionRefusedError.*5432/i,
      /connect ECONNREFUSED 127\.0\.0\.1:5432/i,
      /connection to server at ".*", port 5432 failed/i,
      /could not translate host name ".*" to address/i,
    ],
    reason: 'Application requires a reachable PostgreSQL database instance (port 5432) for startup or data queries.',
    remediation: 'Start a test PostgreSQL database (e.g. docker run -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres) or set a mock DATABASE_URL.',
  },
  {
    name: 'MongoDB',
    category: 'database',
    patterns: [
      /MongooseServerSelectionError/i,
      /MongoNetworkError/i,
      /MongoServerError/i,
      /ECONNREFUSED.*27017/i,
      /connect ECONNREFUSED 127\.0\.0\.1:27017/i,
      /connect ECONNREFUSED localhost:27017/i,
      /failed to connect to server .* on first connect \[Error: connect ECONNREFUSED/i,
    ],
    reason: 'Application requires a reachable MongoDB instance (port 27017) to initialize its data store.',
    remediation: 'Start a local or containerized MongoDB instance (e.g. docker run -p 27017:27017 mongo) or configure MONGODB_URI.',
  },
  {
    name: 'Redis',
    category: 'cache',
    patterns: [
      /ECONNREFUSED.*6379/i,
      /connect ECONNREFUSED 127\.0\.0\.1:6379/i,
      /Redis connection to .* failed/i,
      /MaxRetriesPerRequestError.*redis/i,
      /ioredis.*ECONNREFUSED/i,
      /Connection to Redis failed/i,
    ],
    reason: 'Application requires a reachable Redis instance (port 6379) for caching, sessions, or job queues.',
    remediation: 'Start a Redis instance (e.g. docker run -p 6379:6379 redis) or configure REDIS_URL.',
  },
  {
    name: 'MySQL',
    category: 'database',
    patterns: [
      /ECONNREFUSED.*3306/i,
      /connect ECONNREFUSED 127\.0\.0\.1:3306/i,
      /ER_ACCESS_DENIED_ERROR.*mysql/i,
      /PROTOCOL_CONNECTION_LOST.*mysql/i,
    ],
    reason: 'Application requires a reachable MySQL database instance (port 3306).',
    remediation: 'Start a local or containerized MySQL instance (e.g. docker run -p 3306:3306 mysql) or configure MYSQL_URL.',
  },
  {
    name: 'Clerk Authentication',
    category: 'auth',
    patterns: [
      /ClerkPublishableKeyError/i,
      /Missing publishableKey/i,
      /NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY/i,
      /@clerk\/nextjs.*apiKey/i,
      /@clerk\/clerk-sdk-node/i,
    ],
    reason: 'Application requires Clerk authentication keys to initialize auth middleware.',
    remediation: 'Provide valid or mock CLERK_SECRET_KEY and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY environment variables.',
  },
  {
    name: 'Stripe',
    category: 'saas',
    patterns: [
      /StripeInitializationError/i,
      /No API key provided.*stripe/i,
      /Did you forget to pass an API key\?.*stripe/i,
      /STRIPE_SECRET_KEY/i,
    ],
    reason: 'Application requires Stripe API credentials to initialize payment client.',
    remediation: 'Configure STRIPE_SECRET_KEY in test environment or mock the Stripe client.',
  },
  {
    name: 'Supabase',
    category: 'saas',
    patterns: [
      /supabaseKey is required/i,
      /supabaseUrl is required/i,
      /Invalid supabaseUrl/i,
    ],
    reason: 'Application requires Supabase project URL and anon/service keys.',
    remediation: 'Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
  },
  {
    name: 'NextAuth / Auth.js',
    category: 'auth',
    patterns: [
      /\[next-auth\]\[error\]\[NO_SECRET\]/i,
      /Missing NEXTAUTH_SECRET/i,
      /Please define a `secret` in `NextAuth`/i,
    ],
    reason: 'Application requires NEXTAUTH_SECRET to encrypt user session cookies.',
    remediation: 'Set NEXTAUTH_SECRET in your environment or .env file.',
  },
  {
    name: 'Turso (LibSQL)',
    category: 'database',
    patterns: [
      /LibsqlError: URL_INVALID/i,
      /TURSO_DATABASE_URL/i,
      /URL_SCHEME_NOT_SUPPORTED.*libsql/i,
    ],
    reason: 'Application requires Turso / LibSQL database URL and auth token.',
    remediation: 'Configure TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.',
  },
];

/**
 * Inspects process output (stdout/stderr) or error messages to detect
 * if the failure was caused by unavailable external infrastructure
 * rather than broken application source code.
 */
export function detectExternalServiceDependency(logs: string): ExternalServiceInfo | null {
  if (!logs) return null;

  for (const rule of SERVICE_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(logs)) {
        return {
          name: rule.name,
          category: rule.category,
          reason: rule.reason,
          remediation: rule.remediation,
        };
      }
    }
  }

  // Fallback for general database connection refused
  if (/connect ECONNREFUSED/i.test(logs) && /(db|database|pool|client|query|knex|prisma|typeorm|sequelize|psycopg)/i.test(logs)) {
    return {
      name: 'External Database',
      category: 'database',
      reason: 'Application attempted to connect to an external database host that was not reachable.',
      remediation: 'Ensure test database service is accessible and configured in environment variables.',
    };
  }

  return null;
}
