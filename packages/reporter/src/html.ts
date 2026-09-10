import { VerificationReport } from '@releaseproof/schemas';
import { generateAiHandoffMarkdown } from './ai-handoff.js';

function serializeSafeJson(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export function generateHtmlReport(report: VerificationReport): string {
  const isReady = report.verdict === 'READY';
  const aiMarkdown = generateAiHandoffMarkdown(report);
  const jsonReportSafe = serializeSafeJson(report);
  const aiMarkdownSafe = serializeSafeJson(aiMarkdown);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ReleaseProof Report — ${escapeHtml(report.projectName)}</title>
  <style>
    :root {
      --bg: #0d1117;
      --card-bg: #161b22;
      --border: #30363d;
      --text: #c9d1d9;
      --text-heading: #f0f6fc;
      --text-muted: #8b949e;
      --red: #f85149;
      --red-bg: rgba(248, 81, 73, 0.15);
      --green: #3fb950;
      --green-bg: rgba(63, 185, 80, 0.15);
      --yellow: #d29922;
      --yellow-bg: rgba(210, 153, 34, 0.15);
      --blue: #58a6ff;
      --code-bg: #090d13;
    }
    @media (prefers-color-scheme: light) {
      :root {
        --bg: #f6f8fa;
        --card-bg: #ffffff;
        --border: #d0d7de;
        --text: #24292f;
        --text-heading: #1f2328;
        --text-muted: #57606a;
        --red: #cf222e;
        --red-bg: #ffebe9;
        --green: #1a7f37;
        --green-bg: #dafbe1;
        --yellow: #9a6700;
        --yellow-bg: #fff8c5;
        --blue: #0969da;
        --code-bg: #f6f8fa;
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      padding: 2rem 1rem;
    }
    .container {
      max-width: 1000px;
      margin: 0 auto;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--border);
    }
    .brand {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-heading);
    }
    .brand span {
      color: var(--blue);
    }
    .meta {
      color: var(--text-muted);
      font-size: 0.875rem;
    }
    .verdict-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.5rem 2rem;
      border-radius: 8px;
      margin-bottom: 2rem;
      border: 1px solid;
    }
    .verdict-banner.ready {
      background: var(--green-bg);
      border-color: var(--green);
    }
    .verdict-banner.not-ready {
      background: var(--red-bg);
      border-color: var(--red);
    }
    .verdict-title {
      font-size: 1.75rem;
      font-weight: 800;
      color: ${isReady ? 'var(--green)' : 'var(--red)'};
    }
    .verdict-subtitle {
      color: var(--text);
      font-size: 0.95rem;
      margin-top: 0.25rem;
    }
    .score-badge {
      font-size: 2.25rem;
      font-weight: 800;
      text-align: right;
    }
    .score-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-muted);
    }
    .btn {
      display: inline-flex;
      align-items: center;
      padding: 0.5rem 1rem;
      font-size: 0.875rem;
      font-weight: 600;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: var(--card-bg);
      color: var(--text-heading);
      cursor: pointer;
      text-decoration: none;
      transition: background 0.15s ease;
    }
    .btn:hover {
      filter: brightness(1.1);
    }
    .btn-primary {
      background: var(--blue);
      border-color: var(--blue);
      color: #fff;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .category-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 1rem;
      text-align: center;
    }
    .category-name {
      font-size: 0.8rem;
      text-transform: capitalize;
      color: var(--text-muted);
      margin-bottom: 0.5rem;
    }
    .category-status {
      font-weight: 700;
      font-size: 0.9rem;
    }
    .status-pass { color: var(--green); }
    .status-warn { color: var(--yellow); }
    .status-fail { color: var(--red); }
    .status-skip { color: var(--text-muted); }
    .category-score {
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-top: 0.25rem;
    }
    .section-title {
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--text-heading);
      margin-bottom: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .issues-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .issue-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1.25rem;
    }
    .issue-card.blocker {
      border-left: 4px solid var(--red);
    }
    .issue-card.warn {
      border-left: 4px solid var(--yellow);
    }
    .issue-card.pass {
      border-left: 4px solid var(--green);
    }
    .issue-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.5rem;
    }
    .badge {
      font-size: 0.7rem;
      font-weight: 700;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .badge-blocker { background: var(--red-bg); color: var(--red); }
    .badge-warn { background: var(--yellow-bg); color: var(--yellow); }
    .badge-pass { background: var(--green-bg); color: var(--green); }
    .issue-title {
      font-size: 1rem;
      font-weight: 600;
      color: var(--text-heading);
    }
    .issue-summary {
      font-size: 0.9rem;
      color: var(--text);
      margin-bottom: 0.75rem;
    }
    .evidence-block {
      background: var(--code-bg);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 0.75rem;
      font-family: monospace;
      font-size: 0.8rem;
      overflow-x: auto;
      white-space: pre-wrap;
      color: var(--text-muted);
      margin-bottom: 0.75rem;
    }
    .remediation {
      background: rgba(88, 166, 255, 0.1);
      border-left: 3px solid var(--blue);
      padding: 0.5rem 0.75rem;
      font-size: 0.85rem;
      color: var(--text);
    }
    .toast {
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      background: var(--green);
      color: #fff;
      padding: 0.75rem 1.25rem;
      border-radius: 6px;
      font-weight: 600;
      display: none;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <div class="brand">Release<span>Proof</span></div>
        <div class="meta">${escapeHtml(report.projectName)} &bull; ${new Date(report.timestamp).toLocaleString()} &bull; ${(report.durationMs / 1000).toFixed(1)}s</div>
      </div>
      <div>
        <button class="btn btn-primary" onclick="copyForAi()">Copy for AI</button>
      </div>
    </header>

    <div class="verdict-banner ${isReady ? 'ready' : 'not-ready'}">
      <div>
        <div class="verdict-title">${report.verdict === 'READY' ? 'READY TO SHIP' : 'NOT READY TO SHIP'}</div>
        <div class="verdict-subtitle">
          ${report.counts.blockers} Blocker(s) &bull; ${report.counts.warnings} Warning(s) &bull; ${report.counts.passed} Passed
        </div>
      </div>
      <div>
        <div class="score-badge" style="color: ${isReady ? 'var(--green)' : 'var(--red)'}">${report.score}</div>
        <div class="score-label">Release Score / 100</div>
      </div>
    </div>

    <div class="grid">
      ${Object.entries(report.categoryScores)
        .map(([cat, val]) => `
        <div class="category-card">
          <div class="category-name">${escapeHtml(cat)}</div>
          <div class="category-status status-${(val?.status || 'pass') === 'pass' ? 'pass' : (val?.status || 'pass') === 'warn' ? 'warn' : (val?.status || 'pass') === 'skipped' ? 'skip' : 'fail'}">
            ${(val?.status || 'pass').toUpperCase()}
          </div>
          <div class="category-score">${val?.score ?? 0} / ${val?.max ?? 0} pts</div>
        </div>
      `).join('')}
    </div>

    <div class="section-title">
      <span>Verified Findings (${report.checks.length})</span>
    </div>

    <div class="issues-list">
      ${report.checks
        .map((chk) => {
          const isBlocker = chk.severity === 'blocker' || chk.status === 'block';
          const isWarn = chk.status === 'warn' || chk.severity === 'high';
          const cardClass = isBlocker ? 'blocker' : isWarn ? 'warn' : 'pass';
          const badgeClass = isBlocker ? 'badge-blocker' : isWarn ? 'badge-warn' : 'badge-pass';
          const badgeText = isBlocker ? 'BLOCKER' : isWarn ? 'WARN' : 'PASS';

          return `
          <div class="issue-card ${cardClass}">
            <div class="issue-header">
              <span class="badge ${badgeClass}">${badgeText}</span>
              <span class="badge" style="background:var(--border);color:var(--text-muted)">${escapeHtml(chk.category)}</span>
              <span class="issue-title">${escapeHtml(chk.title)}</span>
            </div>
            <div class="issue-summary">${escapeHtml(chk.summary)}</div>
            ${chk.evidence && chk.evidence.length > 0 ? `
              <div class="evidence-block">${escapeHtml(JSON.stringify(chk.evidence, null, 2))}</div>
            ` : ''}
            ${chk.remediation ? `
              <div class="remediation"><strong>Fix:</strong> ${escapeHtml(chk.remediation)}</div>
            ` : ''}
          </div>
          `;
        }).join('')}
    </div>
  </div>

  <div id="toast" class="toast">Copied AI Fix Prompt to clipboard!</div>

  <script id="releaseproof-raw-report" type="application/json">
    ${jsonReportSafe}
  </script>

  <script>
    const aiContext = ${aiMarkdownSafe};
    function copyForAi() {
      navigator.clipboard.writeText(aiContext).then(() => {
        const toast = document.getElementById('toast');
        toast.style.display = 'block';
        setTimeout(() => { toast.style.display = 'none'; }, 3000);
      });
    }
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
