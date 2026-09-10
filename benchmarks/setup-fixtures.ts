import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesRoot = path.resolve(__dirname, '..', 'fixtures');

export interface FixtureDefinition {
  name: string;
  files: Record<string, string>;
  expected: {
    expectedVerdict: 'READY' | 'NOT_READY' | 'INCOMPLETE';
    expectedBlockerCategory?: string;
    expectedWarningCategory?: string;
    minBlockers?: number;
    minWarnings?: number;
  };
}

export const allFixtures: FixtureDefinition[] = [
  // 1. Next.js working
  {
    name: 'next-working',
    files: {
      'package.json': JSON.stringify({
        name: 'next-working',
        dependencies: { next: '^14.2.0', react: '^18.3.1', 'react-dom': '^18.3.1' },
        scripts: {
          build: 'node -e "process.exit(0)"',
          start: 'node -e "const http=require(\'http\'); http.createServer((q,r)=>{ r.writeHead(200,{\'Content-Type\':\'text/html\'}); r.end(\'<h1>Next Home</h1>\'); }).listen(3000);"',
        },
      }),
      'README.md': '# Next Working\n```bash\nnpm run build\nnpm start\n```\n',
      'app/page.tsx': 'export default function Page() { return <h1>Next Home</h1>; }',
    },
    expected: { expectedVerdict: 'READY', minBlockers: 0 },
  },

  // 2. Next.js build failure
  {
    name: 'next-build-failure',
    files: {
      'package.json': JSON.stringify({
        name: 'next-build-failure',
        dependencies: { next: '14.2.0' },
        scripts: {
          build: 'node -e "console.error(\'Type error: Property x does not exist\'); process.exit(1)"',
        },
      }),
      'app/page.tsx': 'export default function Page() { return <div>Error</div>; }',
    },
    expected: { expectedVerdict: 'NOT_READY', expectedBlockerCategory: 'build', minBlockers: 1 },
  },

  // 3. Next.js missing environment variable
  {
    name: 'next-missing-env',
    files: {
      'package.json': JSON.stringify({
        name: 'next-missing-env',
        dependencies: { next: '14.2.0' },
        scripts: {
          build: 'node -e "process.exit(0)"',
          start: 'node -e "const http=require(\'http\'); http.createServer((q,r)=>{ r.end(\'ok\'); }).listen(3000);"',
        },
      }),
      'src/lib/stripe.ts': 'const key = process.env.STRIPE_SECRET_KEY;',
      '.env.example': 'PORT=3000\nDATABASE_URL=\n',
    },
    expected: { expectedVerdict: 'READY', expectedWarningCategory: 'environment', minWarnings: 1 },
  },

  // 4. Next.js runtime crash
  {
    name: 'next-runtime-crash',
    files: {
      'package.json': JSON.stringify({
        name: 'next-runtime-crash',
        dependencies: { next: '14.2.0' },
        scripts: {
          build: 'node -e "process.exit(0)"',
          start: 'node -e "console.error(\'Fatal Error: Cannot connect to Redis cluster\'); process.exit(1)"',
        },
      }),
    },
    expected: { expectedVerdict: 'NOT_READY', expectedBlockerCategory: 'runtime', minBlockers: 1 },
  },

  // 5. Next.js API 500 error
  {
    name: 'next-api-500',
    files: {
      'package.json': JSON.stringify({
        name: 'next-api-500',
        dependencies: { next: '14.2.0' },
        scripts: {
          build: 'node -e "process.exit(0)"',
          start: 'node -e "const http=require(\'http\'); http.createServer((q,r)=>{ if(q.url===\'/api/users\'){ r.writeHead(500); r.end(\'DB Crash\'); } else { r.writeHead(200,{\'Content-Type\':\'text/html\'}); r.end(\'<a href=\\\'/api/users\\\'>API</a>\'); } }).listen(3000);"',
        },
      }),
      'app/api/users/route.ts': 'export async function GET() { throw new Error(); }',
      'app/page.tsx': 'export default () => <a href="/api/users">API</a>;',
    },
    expected: { expectedVerdict: 'NOT_READY', expectedBlockerCategory: 'browser', minBlockers: 1 },
  },

  // 6. Next.js browser error
  {
    name: 'next-browser-error',
    files: {
      'package.json': JSON.stringify({
        name: 'next-browser-error',
        dependencies: { next: '14.2.0' },
        scripts: {
          build: 'node -e "process.exit(0)"',
          start: 'node -e "const http=require(\'http\'); http.createServer((q,r)=>{ r.writeHead(200,{\'Content-Type\':\'text/html\'}); r.end(\'<html><body><div id=root></div><script>throw new Error(\\\'Uncaught React Hydration Error in Dashboard\\\');</script></body></html>\'); }).listen(3000);"',
        },
      }),
      'app/page.tsx': 'export default () => <div>Home</div>;',
    },
    expected: { expectedVerdict: 'NOT_READY', expectedBlockerCategory: 'browser', minBlockers: 1 },
  },

  // 7. Next.js missing asset
  {
    name: 'next-missing-asset',
    files: {
      'package.json': JSON.stringify({
        name: 'next-missing-asset',
        dependencies: { next: '14.2.0' },
        scripts: {
          build: 'node -e "process.exit(0)"',
          start: 'node -e "const http=require(\'http\'); http.createServer((q,r)=>{ if(q.url===\'/logo.png\'){ r.writeHead(404); r.end(); } else { r.writeHead(200,{\'Content-Type\':\'text/html\'}); r.end(\'<img src=\\\'/logo.png\\\' />\'); } }).listen(3000);"',
        },
      }),
      'app/page.tsx': 'export default () => <div><img src="/logo.png" /></div>;',
    },
    expected: { expectedVerdict: 'READY' },
  },

  // 8. Vite working
  {
    name: 'vite-working',
    files: {
      'package.json': JSON.stringify({
        name: 'vite-working',
        dependencies: { vite: '6.0.0', react: '18.3.1' },
        scripts: {
          build: 'node -e "process.exit(0)"',
          preview: 'node -e "const http=require(\'http\'); http.createServer((q,r)=>{ r.writeHead(200,{\'Content-Type\':\'text/html\'}); r.end(\'<h1>Vite App</h1>\'); }).listen(5173);"',
        },
      }),
      'src/App.tsx': 'export default () => <h1>Vite App</h1>;',
    },
    expected: { expectedVerdict: 'READY', minBlockers: 0 },
  },

  // 9. Vite missing dependency
  {
    name: 'vite-missing-dependency',
    files: {
      'package.json': JSON.stringify({
        name: 'vite-missing-dependency',
        dependencies: { vite: '6.0.0' },
        scripts: {
          build: 'node -e "console.error(\'Error: Cannot find module lodash-es\'); process.exit(1)"',
        },
      }),
      'src/main.ts': 'import { cloneDeep } from "lodash-es";',
    },
    expected: { expectedVerdict: 'NOT_READY', expectedBlockerCategory: 'build', minBlockers: 1 },
  },

  // 10. Vite console error
  {
    name: 'vite-console-error',
    files: {
      'package.json': JSON.stringify({
        name: 'vite-console-error',
        dependencies: { vite: '6.0.0' },
        scripts: {
          build: 'node -e "process.exit(0)"',
          preview: 'node -e "const http=require(\'http\'); http.createServer((q,r)=>{ r.writeHead(200,{\'Content-Type\':\'text/html\'}); r.end(\'<html><body><script>console.error(\\\'Warning: Failed prop type in Button\\\');</script><h1>Vite</h1></body></html>\'); }).listen(5173);"',
        },
      }),
    },
    expected: { expectedVerdict: 'READY', expectedWarningCategory: 'browser', minWarnings: 1 },
  },

  // 11. Express working
  {
    name: 'express-working',
    files: {
      'package.json': JSON.stringify({
        name: 'express-working',
        dependencies: { express: '4.21.0' },
        scripts: {
          start: 'node -e "const http=require(\'http\'); http.createServer((q,r)=>{ r.writeHead(200,{\'Content-Type\':\'application/json\'}); r.end(JSON.stringify({status:\'ok\'})); }).listen(3000);"',
        },
      }),
      'src/server.ts': 'import express from "express"; const app = express(); app.get("/", (req, res) => res.json({status: "ok"}));',
    },
    expected: { expectedVerdict: 'READY', minBlockers: 0 },
  },

  // 12. Express production crash
  {
    name: 'express-production-crash',
    files: {
      'package.json': JSON.stringify({
        name: 'express-production-crash',
        dependencies: { express: '4.21.0' },
        scripts: {
          start: 'node -e "console.error(\'Error: DATABASE_URL not set\'); process.exit(1)"',
        },
      }),
    },
    expected: { expectedVerdict: 'NOT_READY', expectedBlockerCategory: 'runtime', minBlockers: 1 },
  },

  // 13. Express dev-prod mismatch
  {
    name: 'express-dev-prod-mismatch',
    files: {
      'package.json': JSON.stringify({
        name: 'express-dev-prod-mismatch',
        dependencies: { express: '4.21.0' },
        devDependencies: { jsonwebtoken: '9.0.0' },
        scripts: {
          start: 'node -e "const http=require(\'http\'); http.createServer((q,r)=>{ r.end(\'ok\'); }).listen(3000);"',
        },
      }),
      'src/server.ts': 'import express from "express";\nimport jwt from "jsonwebtoken";\nconst app = express(); app.listen(3000);',
    },
    expected: { expectedVerdict: 'NOT_READY', expectedBlockerCategory: 'runtime', minBlockers: 1 },
  },

  // 14. FastAPI working
  {
    name: 'fastapi-working',
    files: {
      'requirements.txt': 'fastapi==0.115.0\nuvicorn==0.32.0\n',
      'main.py': 'from fastapi import FastAPI\napp = FastAPI()\n@app.get("/")\ndef root(): return {"message": "Hello FastAPI"}',
    },
    expected: { expectedVerdict: 'READY', minBlockers: 0 },
  },

  // 15. FastAPI missing dependency
  {
    name: 'fastapi-missing-dependency',
    files: {
      'requirements.txt': 'fastapi==0.115.0\n',
      'main.py': 'from fastapi import FastAPI\nimport non_existent_pkg_12345\napp = FastAPI()',
    },
    expected: { expectedVerdict: 'NOT_READY', expectedBlockerCategory: 'runtime', minBlockers: 1 },
  },

  // 16. FastAPI env error
  {
    name: 'fastapi-env-error',
    files: {
      'requirements.txt': 'fastapi==0.115.0\n',
      'main.py': 'import os\nfrom fastapi import FastAPI\napp = FastAPI()\nif not os.environ.get("DATABASE_URL"): raise RuntimeError("DATABASE_URL required!")',
      '.env.example': 'PORT=8000\n',
    },
    expected: { expectedVerdict: 'NOT_READY', expectedBlockerCategory: 'runtime', minBlockers: 1 },
  },

  // 17. Bad README command
  {
    name: 'bad-readme-command',
    files: {
      'package.json': JSON.stringify({
        name: 'bad-readme-command',
        scripts: { build: 'node -e "process.exit(0)"', start: 'node -e "const http=require(\'http\'); http.createServer((q,r)=>r.end(\'ok\')).listen(3000);"' },
      }),
      'README.md': '# Project\n```bash\nnpm run setup-database-and-start\n```\n',
    },
    expected: { expectedVerdict: 'NOT_READY', expectedBlockerCategory: 'documentation', minBlockers: 1 },
  },

  // 18. README port mismatch
  {
    name: 'readme-port-mismatch',
    files: {
      'package.json': JSON.stringify({
        name: 'readme-port-mismatch',
        scripts: { start: 'node -e "const http=require(\'http\'); http.createServer((q,r)=>r.end(\'ok\')).listen(8080);"' },
      }),
      'README.md': '# Port Mismatch\nApp runs at http://localhost:3000\n',
    },
    expected: { expectedVerdict: 'READY', expectedWarningCategory: 'documentation', minWarnings: 1 },
  },

  // 19. Secrets leak
  {
    name: 'secrets-leak',
    files: {
      'package.json': JSON.stringify({ name: 'secrets-leak' }),
      'src/index.ts': 'export const api = "https://api.com";',
      '.env': 'AWS_SECRET_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE\nSECRET_KEY=supersecretkey12345678\n',
    },
    expected: { expectedVerdict: 'NOT_READY', expectedBlockerCategory: 'security', minBlockers: 1 },
  },

  // 20. Hanging start command
  {
    name: 'hanging-start-command',
    files: {
      'package.json': JSON.stringify({
        name: 'hanging-start-command',
        scripts: { start: 'node -e "setInterval(()=>{}, 10000);"' },
      }),
    },
    expected: { expectedVerdict: 'NOT_READY', expectedBlockerCategory: 'runtime', minBlockers: 1 },
  },

  // 21. Client secret exposed
  {
    name: 'client-secret-exposed',
    files: {
      'package.json': JSON.stringify({ name: 'client-secret-exposed' }),
      'src/config.ts': 'const secret = process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY;',
    },
    expected: { expectedVerdict: 'NOT_READY', expectedBlockerCategory: 'environment', minBlockers: 1 },
  },

  // ─── 10 NEGATIVE CONTROL FIXTURES (SUSPICIOUS BUT VALID) ───

  // 22. Negative Control: Legitimate 401 Unauthorized on protected route
  {
    name: 'nc-legitimate-401',
    files: {
      'package.json': JSON.stringify({
        name: 'nc-legitimate-401',
        scripts: {
          start: 'node -e "const http=require(\'http\'); http.createServer((q,r)=>{ if(q.url===\'/admin\'){ r.writeHead(401,{\'Content-Type\':\'text/plain\'}); r.end(\'Unauthorized\'); } else { r.writeHead(200,{\'Content-Type\':\'text/html\'}); r.end(\'<a href=\\\'/admin\\\'>Admin Login</a>\'); } }).listen(3000);"',
        },
      }),
      'README.md': '# Admin App\nRuns on port 3000.\n',
    },
    expected: { expectedVerdict: 'READY', minBlockers: 0 },
  },

  // 23. Negative Control: Legitimate 404 page for old/missing exploratory link
  {
    name: 'nc-legitimate-404',
    files: {
      'package.json': JSON.stringify({
        name: 'nc-legitimate-404',
        scripts: {
          start: 'node -e "const http=require(\'http\'); http.createServer((q,r)=>{ if(q.url===\'/legacy\'){ r.writeHead(404); r.end(\'Page removed\'); } else { r.writeHead(200,{\'Content-Type\':\'text/html\'}); r.end(\'<a href=\\\'/legacy\\\'>Old Link</a>\'); } }).listen(3000);"',
        },
      }),
    },
    expected: { expectedVerdict: 'READY', minBlockers: 0 },
  },

  // 24. Negative Control: Console error from optional non-fatal component
  {
    name: 'nc-optional-console-error',
    files: {
      'package.json': JSON.stringify({
        name: 'nc-optional-console-error',
        scripts: {
          start: 'node -e "const http=require(\'http\'); http.createServer((q,r)=>{ r.writeHead(200,{\'Content-Type\':\'text/html\'}); r.end(\'<html><body><script>console.error(\\\'Warning: Analytics script delayed loading\\\');</script><h1>Dashboard</h1></body></html>\'); }).listen(3000);"',
        },
      }),
    },
    expected: { expectedVerdict: 'READY', minBlockers: 0, minWarnings: 1 },
  },

  // 25. Negative Control: Optional environment variable with default fallback
  {
    name: 'nc-optional-env',
    files: {
      'package.json': JSON.stringify({
        name: 'nc-optional-env',
        scripts: {
          start: 'node -e "const http=require(\'http\'); http.createServer((q,r)=>r.end(\'ok\')).listen(3000);"',
        },
      }),
      'src/config.ts': 'export const analyticsId = process.env.OPTIONAL_ANALYTICS_ID || "default-id";',
      '.env.example': 'PORT=3000\nOPTIONAL_ANALYTICS_ID=\n',
    },
    expected: { expectedVerdict: 'READY', minBlockers: 0 },
  },

  // 26. Negative Control: App without browser (pure API or CLI service)
  {
    name: 'nc-app-without-browser',
    files: {
      'package.json': JSON.stringify({
        name: 'nc-app-without-browser',
        scripts: {
          start: 'node -e "const http=require(\'http\'); http.createServer((q,r)=>{ r.writeHead(200,{\'Content-Type\':\'application/json\'}); r.end(JSON.stringify({status:\'healthy\'})); }).listen(3000);"',
        },
      }),
      'src/server.ts': 'console.log("Starting pure API server");',
    },
    expected: { expectedVerdict: 'READY', minBlockers: 0 },
  },

  // 27. Negative Control: Delayed startup (takes 1.2s to initialize then listens)
  {
    name: 'nc-delayed-startup',
    files: {
      'package.json': JSON.stringify({
        name: 'nc-delayed-startup',
        scripts: {
          start: 'node -e "setTimeout(()=>{ const http=require(\'http\'); http.createServer((q,r)=>r.end(\'ready\')).listen(3000); }, 1200);"',
        },
      }),
    },
    expected: { expectedVerdict: 'READY', minBlockers: 0 },
  },

  // 28. Negative Control: Dynamic parameterized route (/users/:id)
  {
    name: 'nc-dynamic-route',
    files: {
      'package.json': JSON.stringify({
        name: 'nc-dynamic-route',
        scripts: {
          start: 'node -e "const http=require(\'http\'); http.createServer((q,r)=>{ r.writeHead(200,{\'Content-Type\':\'text/html\'}); r.end(\'<a href=\\\'/users/123\\\'>Profile</a>\'); }).listen(3000);"',
        },
      }),
      'src/routes.ts': 'app.get("/users/:id", (req, res) => res.send("user"));',
    },
    expected: { expectedVerdict: 'READY', minBlockers: 0 },
  },

  // 29. Negative Control: Non-critical asset (missing favicon.ico)
  {
    name: 'nc-expected-failed-image',
    files: {
      'package.json': JSON.stringify({
        name: 'nc-expected-failed-image',
        scripts: {
          start: 'node -e "const http=require(\'http\'); http.createServer((q,r)=>{ if(q.url===\'/favicon.ico\'){ r.writeHead(404); r.end(); } else { r.writeHead(200,{\'Content-Type\':\'text/html\'}); r.end(\'<h1>With Favicon</h1><link rel=\\\'icon\\\' href=\\\'/favicon.ico\\\'>\'); } }).listen(3000);"',
        },
      }),
    },
    expected: { expectedVerdict: 'READY', minBlockers: 0 },
  },

  // 30. Negative Control: Health endpoint returning 200 after warmup
  {
    name: 'nc-warmup-health',
    files: {
      'package.json': JSON.stringify({
        name: 'nc-warmup-health',
        scripts: {
          start: 'node -e "const http=require(\'http\'); http.createServer((q,r)=>{ r.writeHead(200); r.end(\'healthy\'); }).listen(3000);"',
        },
      }),
    },
    expected: { expectedVerdict: 'READY', minBlockers: 0 },
  },

  // 31. Negative Control: Unusual but valid start command with flags
  {
    name: 'nc-unusual-start-command',
    files: {
      'package.json': JSON.stringify({
        name: 'nc-unusual-start-command',
        scripts: {
          start: 'node --no-warnings -e "const http=require(\'http\'); http.createServer((q,r)=>r.end(\'ok\')).listen(3000);"',
        },
      }),
    },
    expected: { expectedVerdict: 'READY', minBlockers: 0 },
  },

  // 32. Negative Control: Expected 403 Forbidden on protected route
  {
    name: 'nc-expected-403',
    files: {
      'package.json': JSON.stringify({
        name: 'nc-expected-403',
        scripts: {
          start: 'node -e "const http=require(\'http\'); http.createServer((q,r)=>{ if(q.url===\'/forbidden\'){ r.writeHead(403,{\'Content-Type\':\'text/plain\'}); r.end(\'Forbidden\'); } else { r.writeHead(200,{\'Content-Type\':\'text/html\'}); r.end(\'<a href=\\\'/forbidden\\\'>Protected</a>\'); } }).listen(3000);"',
        },
      }),
    },
    expected: { expectedVerdict: 'READY', minBlockers: 0 },
  },

  // 33. Negative Control: API endpoint returns 400 Bad Request on invalid input
  {
    name: 'nc-api-400-invalid-input',
    files: {
      'package.json': JSON.stringify({
        name: 'nc-api-400-invalid-input',
        scripts: {
          start: 'node -e "const http=require(\'http\'); http.createServer((q,r)=>{ if(q.url===\'/api/item\'){ r.writeHead(400,{\'Content-Type\':\'application/json\'}); r.end(JSON.stringify({error:\'Missing id\'})); } else { r.writeHead(200,{\'Content-Type\':\'text/html\'}); r.end(\'<a href=\\\'/api/item\\\'>API Call</a>\'); } }).listen(3000);"',
        },
      }),
    },
    expected: { expectedVerdict: 'READY', minBlockers: 0 },
  },

  // 34. Negative Control: HTTP 302 Redirect
  {
    name: 'nc-redirect-302',
    files: {
      'package.json': JSON.stringify({
        name: 'nc-redirect-302',
        scripts: {
          start: 'node -e "const http=require(\'http\'); http.createServer((q,r)=>{ if(q.url===\'/old-url\'){ r.writeHead(302, { Location: \'/\' }); r.end(); } else { r.writeHead(200,{\'Content-Type\':\'text/html\'}); r.end(\'<h1>Redirected Home</h1><a href=\\\'/old-url\\\'>Old Link</a>\'); } }).listen(3000);"',
        },
      }),
    },
    expected: { expectedVerdict: 'READY', minBlockers: 0 },
  },

  // 35. Negative Control: Page with no <a> links
  {
    name: 'nc-page-without-links',
    files: {
      'package.json': JSON.stringify({
        name: 'nc-page-without-links',
        scripts: {
          start: 'node -e "const http=require(\'http\'); http.createServer((q,r)=>{ r.writeHead(200,{\'Content-Type\':\'text/html\'}); r.end(\'<html><body><h1>Single Page View</h1><p>Welcome to our solitary view without outbound links.</p></body></html>\'); }).listen(3000);"',
        },
      }),
    },
    expected: { expectedVerdict: 'READY', minBlockers: 0 },
  },

  // 36. Negative Control: devDependency legitimately used during build only
  {
    name: 'nc-devdep-build-tool',
    files: {
      'package.json': JSON.stringify({
        name: 'nc-devdep-build-tool',
        devDependencies: {
          typescript: '^5.0.0',
        },
        scripts: {
          build: 'node -e "console.log(\'transpiling via dev tool\')"',
          start: 'node -e "const http=require(\'http\'); http.createServer((q,r)=>r.end(\'ok\')).listen(3000);"',
        },
      }),
      'src/server.js': 'const http = require("node:http"); console.log("pure node runtime, zero devdep imports");',
    },
    expected: { expectedVerdict: 'READY', minBlockers: 0 },
  },

  // 37. Environment Blocked: external PostgreSQL instance required
  {
    name: 'env-blocked-postgres',
    files: {
      'package.json': JSON.stringify({
        name: 'env-blocked-postgres',
        dependencies: { express: '^4.19.2', pg: '^8.11.0' },
        scripts: {
          start: 'node -e "console.error(\'ConnectionRefusedError: connect ECONNREFUSED 127.0.0.1:5432\'); process.exit(1)"',
        },
      }),
      'index.js': 'const express = require("express");',
    },
    expected: { expectedVerdict: 'INCOMPLETE', minBlockers: 0 },
  },

  // 38. Environment Blocked: external MongoDB instance required
  {
    name: 'env-blocked-mongodb',
    files: {
      'package.json': JSON.stringify({
        name: 'env-blocked-mongodb',
        dependencies: { express: '^4.19.2', mongoose: '^8.0.0' },
        scripts: {
          start: 'node -e "console.error(\'MongooseServerSelectionError: connect ECONNREFUSED 127.0.0.1:27017\'); process.exit(1)"',
        },
      }),
      'index.js': 'const express = require("express");',
    },
    expected: { expectedVerdict: 'INCOMPLETE', minBlockers: 0 },
  },

  // 39. Environment Blocked: external Redis instance required
  {
    name: 'env-blocked-redis',
    files: {
      'package.json': JSON.stringify({
        name: 'env-blocked-redis',
        dependencies: { express: '^4.19.2', ioredis: '^5.3.0' },
        scripts: {
          start: 'node -e "console.error(\'Error: Redis connection to 127.0.0.1:6379 failed - connect ECONNREFUSED 127.0.0.1:6379\'); process.exit(1)"',
        },
      }),
      'index.js': 'const express = require("express");',
    },
    expected: { expectedVerdict: 'INCOMPLETE', minBlockers: 0 },
  },

  // 40. Environment Blocked: third-party API credential (Clerk auth)
  {
    name: 'env-blocked-third-party-api',
    files: {
      'package.json': JSON.stringify({
        name: 'env-blocked-third-party-api',
        dependencies: { '@clerk/nextjs': '^5.0.0', next: '14.2.0' },
        scripts: {
          build: 'node -e "process.exit(0)"',
          start: 'node -e "console.error(\'ClerkPublishableKeyError: Missing publishableKey. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY\'); process.exit(1)"',
        },
      }),
      'app/layout.tsx': 'export default function Layout() {}',
    },
    expected: { expectedVerdict: 'INCOMPLETE', minBlockers: 0 },
  },

  // 41. Environment Blocked: optional Stripe integration credential
  {
    name: 'env-blocked-optional-stripe',
    files: {
      'package.json': JSON.stringify({
        name: 'env-blocked-optional-stripe',
        dependencies: { stripe: '^14.0.0', express: '^4.19.2' },
        scripts: {
          start: 'node -e "console.error(\'StripeInitializationError: No API key provided. Set STRIPE_SECRET_KEY in environment\'); process.exit(1)"',
        },
      }),
      'server.js': 'const express = require("express");',
    },
    expected: { expectedVerdict: 'INCOMPLETE', minBlockers: 0 },
  },

  // 42. Environment Blocked: optional OAuth provider (NextAuth secret)
  {
    name: 'env-blocked-oauth-provider',
    files: {
      'package.json': JSON.stringify({
        name: 'env-blocked-oauth-provider',
        dependencies: { 'next-auth': '^4.24.0', next: '14.2.0' },
        scripts: {
          build: 'node -e "process.exit(0)"',
          start: 'node -e "console.error(\'[next-auth][error][NO_SECRET]: Missing NEXTAUTH_SECRET. In production, this environment variable is required.\'); process.exit(1)"',
        },
      }),
      'pages/api/auth/[...nextauth].ts': 'export default function auth() {}',
    },
    expected: { expectedVerdict: 'INCOMPLETE', minBlockers: 0 },
  },
];

export async function setupFixtures(): Promise<void> {
  await fs.mkdir(fixturesRoot, { recursive: true });

  for (const fixture of allFixtures) {
    const fixDir = path.join(fixturesRoot, fixture.name);
    await fs.mkdir(fixDir, { recursive: true });

    for (const [relPath, content] of Object.entries(fixture.files)) {
      const fullPath = path.join(fixDir, relPath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, 'utf-8');
    }

    const expectedPath = path.join(fixDir, 'expected.json');
    await fs.writeFile(expectedPath, JSON.stringify(fixture.expected, null, 2), 'utf-8');
  }

  console.log(`✓ Successfully configured ${allFixtures.length} test fixtures in fixtures/`);
}

if (process.argv[1] && process.argv[1].endsWith('setup-fixtures.ts')) {
  setupFixtures().catch(console.error);
}
