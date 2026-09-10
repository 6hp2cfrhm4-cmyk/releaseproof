const http = require('node:http');

// Runtime dependency mistakenly placed in devDependencies
// const jwt = require('jsonwebtoken');

// Undocumented & client-exposed sensitive environment variables
const stripeKey = process.env.STRIPE_SECRET_KEY;
const exposedClientSecret = process.env.NEXT_PUBLIC_STRIPE_SECRET_KEY;

const port = process.env.PORT || 3000;
const isProduction = process.env.NODE_ENV === 'production';

const server = http.createServer((req, res) => {
  const url = req.url || '/';

  if (url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
        <head><title>SaaS Dashboard Pro</title></head>
        <body style="font-family: sans-serif; padding: 40px; text-align: center;">
          <h1>Welcome to SaaS Dashboard Pro</h1>
          <p>Built with AI in 15 minutes.</p>
          <a href="/dashboard" style="display:inline-block; margin-top:20px; padding:10px 20px; background:#0066ff; color:white; border-radius:6px; text-decoration:none;">Go to Dashboard</a>
        </body>
      </html>
    `);
    return;
  }

  if (url === '/dashboard') {
    // In local dev, it "works" with mock data!
    // But in production, it fails because user context is missing.
    if (!isProduction) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>Dashboard (Development Preview - Works on My Machine)</h1>');
      return;
    }

    // In production: CRASH!
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('TypeError: Cannot read properties of undefined (reading "tier") at /dashboard');
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(port, () => {
  console.log(`SaaS Dashboard running at http://127.0.0.1:${port} (NODE_ENV=${process.env.NODE_ENV})`);
});
