/**
 * GetChitty Discovery & Onboarding - get.chitty.cc
 * Smart discovery and NL gateway for ChittyOS services
 *
 * Patterns:
 *   get.chitty.cc/                   -> onboarding wizard
 *   get.chitty.cc/ask                -> NL query endpoint (POST)
 *   get.chitty.cc/recommend?need=X   -> get recommendations
 *   get.chitty.cc/discover           -> browse all services
 *   get.chitty.cc/onboard/{service}  -> guided setup for service
 *   get.chitty.cc/service/{service}  -> service info page
 */

import {
  listServices,
  getService,
  getPackageMetadata,
  corsHeaders,
  contextFromRequest,
  createAuditEvent,
  logAudit,
  addContextHeaders
} from '@chittyos/core'
import type { ServiceRecord, DiscoveryResult, ContextEnv, ChittyContext } from '@chittyos/core'
import { classifyIntent, handleIntent, askChittyClaw, GetChittyEnv } from './intent'

interface Env extends GetChittyEnv {
  CHITTY_KV?: KVNamespace
}

// Keyword to service mapping for recommendations
// Uses short service names matching api.chitty.cc/{service} pattern
const NEED_KEYWORDS: Record<string, string[]> = {
  'auth': ['auth', 'id'],
  'authentication': ['auth', 'id'],
  'identity': ['id', 'auth'],
  'verify': ['verify', 'certify'],
  'certificate': ['certify'],
  'connect': ['connect'],
  'api': ['connect'],
  'mcp': ['mcp'],
  'docs': ['docs'],
  'registry': ['registry'],
  'evidence': ['ledger'],
  'ledger': ['ledger'],
  'cases': ['resolution'],
  'legal': ['resolution'],
  'monitor': ['beacon'],
  'discovery': ['get'],
  'storage': ['connect'],
  'data': ['schema', 'ledger'],
  'schema': ['schema'],
  'trust': ['trust', 'certify'],
  'finance': ['finance'],
  'credit': ['credit'],
  'brand': ['brand'],
  'chat': ['chat'],
  'flow': ['flow'],
  'force': ['force'],
  'forge': ['forge'],
  'dna': ['dna'],
  'canon': ['canon'],
  'package': ['git'],
  'install': ['git', 'get']
}

function recommendServices(need: string): DiscoveryResult[] {
  const keywords = need.toLowerCase().split(/[\s,]+/)
  const scores: Map<string, { score: number; reasons: string[] }> = new Map()

  for (const keyword of keywords) {
    const matches = NEED_KEYWORDS[keyword] || []
    for (const service of matches) {
      const existing = scores.get(service) || { score: 0, reasons: [] }
      existing.score += 1
      existing.reasons.push(`matches "${keyword}"`)
      scores.set(service, existing)
    }
  }

  return Array.from(scores.entries())
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, 5)
    .map(([service, { score, reasons }]) => ({
      service,
      confidence: Math.min(score / keywords.length, 1),
      reason: reasons.join(', '),
      install_method: 'npm' as const,
      onboard_url: `https://get.chitty.cc/onboard/${service}`
    }))
}

function generateWizardHTML(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ChittyOS Gateway</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-base: #050505;
      --bg-surface: #111111;
      --bg-glass: rgba(255, 255, 255, 0.03);
      --border-glass: rgba(255, 255, 255, 0.08);
      --primary: #4F46E5;
      --primary-hover: #6366F1;
      --accent: #0ea5e9;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --glow: rgba(79, 70, 229, 0.15);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background: var(--bg-base);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 4rem 1.5rem;
      position: relative;
      overflow-x: hidden;
    }
    /* Dynamic background blobs */
    body::before, body::after {
      content: '';
      position: fixed;
      width: 600px;
      height: 600px;
      border-radius: 50%;
      filter: blur(120px);
      z-index: -1;
      opacity: 0.4;
      animation: drift 20s ease-in-out infinite alternate;
    }
    body::before {
      background: radial-gradient(circle, var(--primary) 0%, transparent 70%);
      top: -200px;
      left: -200px;
    }
    body::after {
      background: radial-gradient(circle, var(--accent) 0%, transparent 70%);
      bottom: -200px;
      right: -200px;
      animation-delay: -10s;
    }
    @keyframes drift {
      0% { transform: translate(0, 0) scale(1); }
      100% { transform: translate(100px, 50px) scale(1.1); }
    }
    .container {
      width: 100%;
      max-width: 760px;
      position: relative;
      z-index: 1;
    }
    h1 {
      font-family: 'Outfit', sans-serif;
      font-size: 3.5rem;
      font-weight: 700;
      text-align: center;
      margin-bottom: 0.5rem;
      background: linear-gradient(135deg, #fff 0%, #a5b4fc 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      letter-spacing: -0.02em;
    }
    .subtitle {
      text-align: center;
      color: var(--text-muted);
      font-size: 1.1rem;
      margin-bottom: 3rem;
      font-weight: 400;
    }
    .card {
      background: var(--bg-surface);
      border: 1px solid var(--border-glass);
      border-radius: 20px;
      padding: 2rem;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.1);
      backdrop-filter: blur(20px);
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }
    .tabs {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 2rem;
      background: rgba(0,0,0,0.3);
      padding: 0.5rem;
      border-radius: 12px;
      border: 1px solid var(--border-glass);
    }
    .tab {
      flex: 1;
      padding: 0.75rem 1rem;
      border: none;
      background: transparent;
      color: var(--text-muted);
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.95rem;
      font-weight: 500;
      transition: all 0.2s ease;
      font-family: inherit;
    }
    .tab:hover { color: var(--text-main); }
    .tab.active {
      background: var(--border-glass);
      color: var(--text-main);
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .search-container {
      position: relative;
      display: flex;
      gap: 0.75rem;
    }
    .search {
      flex: 1;
      padding: 1.25rem 1.5rem;
      font-size: 1.1rem;
      color: var(--text-main);
      background: rgba(0,0,0,0.2);
      border: 1px solid var(--border-glass);
      border-radius: 12px;
      font-family: inherit;
      transition: all 0.3s ease;
    }
    .search:focus {
      outline: none;
      border-color: var(--primary);
      box-shadow: 0 0 0 4px var(--glow);
      background: rgba(0,0,0,0.4);
    }
    .search::placeholder { color: #475569; }
    .search-btn {
      padding: 0 2rem;
      background: linear-gradient(135deg, var(--primary), var(--accent));
      color: white;
      border: none;
      border-radius: 12px;
      font-size: 1.05rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: inherit;
      box-shadow: 0 4px 15px var(--glow);
    }
    .search-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px var(--glow);
      filter: brightness(1.1);
    }
    .search-btn:active { transform: translateY(0); }
    .results { margin-top: 2rem; }
    .result {
      padding: 1.5rem;
      border: 1px solid var(--border-glass);
      border-radius: 12px;
      margin-bottom: 1rem;
      background: var(--bg-glass);
      transition: all 0.2s ease;
      animation: slideUp 0.4s ease forwards;
      opacity: 0;
      transform: translateY(10px);
    }
    .result:hover {
      border-color: var(--primary);
      background: rgba(255,255,255,0.05);
      transform: translateY(-2px);
    }
    .result h3 { margin: 0 0 0.5rem 0; font-family: 'Outfit', sans-serif; }
    .result h3 a { color: var(--text-main); text-decoration: none; }
    .result p { margin: 0; color: var(--text-muted); font-size: 0.95rem; line-height: 1.5; }
    .result .meta { font-size: 0.85rem; color: #64748b; margin-top: 0.75rem; }
    .answer {
      padding: 1.5rem;
      background: rgba(79, 70, 229, 0.05);
      border: 1px solid var(--primary);
      border-radius: 12px;
      margin: 1.5rem 0;
      animation: slideUp 0.4s ease;
    }
    .answer h3 { margin: 0 0 1rem 0; font-family: 'Outfit', sans-serif; color: var(--text-main); display: flex; align-items: center; gap: 0.75rem; }
    .answer p { margin: 0.75rem 0; line-height: 1.6; color: #cbd5e1; }
    .answer pre { background: #000; padding: 1.25rem; border-radius: 8px; border: 1px solid var(--border-glass); overflow-x: auto; margin: 1rem 0; }
    .answer code { font-family: 'SF Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 0.9rem; color: #e2e8f0; }
    .actions { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-top: 1.5rem; }
    .action {
      padding: 0.5rem 1.25rem;
      background: var(--bg-glass);
      border: 1px solid var(--border-glass);
      color: var(--text-main);
      text-decoration: none;
      border-radius: 8px;
      font-size: 0.9rem;
      font-weight: 500;
      transition: all 0.2s;
    }
    .action:hover {
      background: var(--primary);
      border-color: var(--primary);
      transform: translateY(-1px);
    }
    .intent-badge {
      padding: 0.25rem 0.75rem;
      background: var(--primary);
      color: white;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }
    .loading {
      text-align: center;
      padding: 3rem;
      color: var(--text-muted);
      font-weight: 500;
      animation: pulse 1.5s infinite ease-in-out;
    }
    .links {
      margin-top: 3rem;
      display: flex;
      justify-content: center;
      gap: 2rem;
    }
    .links a {
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.95rem;
      font-weight: 500;
      transition: color 0.2s;
    }
    .links a:hover { color: var(--text-main); }
    @keyframes slideUp {
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes pulse {
      0%, 100% { opacity: 0.5; }
      50% { opacity: 1; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>ChittyOS Gateway</h1>
    <p class="subtitle">Your intelligent portal to the ChittyOS ecosystem</p>

    <div class="card">
      <div class="tabs">
        <button class="tab active" data-mode="ask">Ask an Assistant</button>
        <button class="tab" data-mode="search">Service Directory</button>
      </div>

      <div class="search-container">
        <input type="text" class="search" placeholder="e.g., How do I install chittyauth?" id="search" autocomplete="off">
        <button class="search-btn" id="submit">Search</button>
      </div>

      <div class="results" id="results"></div>
    </div>

    <div class="links">
      <a href="/discover">Browse Services</a>
      <a href="https://docs.chitty.cc">Documentation</a>
      <a href="https://git.chitty.cc">Package Registry</a>
    </div>
  </div>

  <script>
    const search = document.getElementById('search');
    const results = document.getElementById('results');
    const submitBtn = document.getElementById('submit');
    const tabs = document.querySelectorAll('.tab');
    let mode = 'ask';
    let timeout;

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        mode = tab.dataset.mode;
        search.placeholder = mode === 'ask'
          ? 'e.g., How do I install chittyauth?'
          : 'e.g., authentication, identity, evidence...';
        results.innerHTML = '';
      });
    });

    async function doSearch() {
      const query = search.value.trim();
      if (!query) { results.innerHTML = ''; return; }

      results.innerHTML = '<div class="loading">Analyzing intent...</div>';

      try {
        if (mode === 'ask') {
          const res = await fetch('/ask?q=' + encodeURIComponent(query));
          const data = await res.json();

          let html = '<div class="answer">';
          html += '<h3>Intelligence <span class="intent-badge">' + data.intent.category + '</span></h3>';
          html += '<div class="markdown-body">' + formatMarkdown(data.answer) + '</div>';

          if (data.services && data.services.length > 0) {
            html += '<div style="margin-top: 1.5rem; border-top: 1px solid var(--border-glass); padding-top: 1rem;">';
            html += '<h4 style="color:var(--text-muted); margin-bottom:1rem; font-weight:500;">Recommended Services</h4>';
            data.services.forEach((s, idx) => {
              html += '<div class="result" style="animation-delay: ' + (idx * 0.1) + 's">';
              html += '<h3><a href="/onboard/' + s.service_name + '">' + s.service_name + '</a></h3>';
              html += '<p>' + s.category + ' &bull; ' + s.status + '</p></div>';
            });
            html += '</div>';
          }

          if (data.actions && data.actions.length > 0) {
            html += '<div class="actions">';
            data.actions.forEach(a => {
              html += '<a class="action" href="' + a.url + '">' + a.label + '</a>';
            });
            html += '</div>';
          }
          html += '</div>';
          results.innerHTML = html;
        } else {
          const res = await fetch('/recommend?need=' + encodeURIComponent(query));
          const data = await res.json();
          results.innerHTML = data.recommendations.map((r, idx) => `
            <div class="result" style="animation-delay: ${r.confidence * 0.1}s">
              <h3><a href="/onboard/${r.service}">${r.service}</a></h3>
              <p>${r.reason}</p>
              <div class="meta">Match Confidence: ${Math.round(r.confidence * 100)}%</div>
            </div>
          `).join('') || '<div class="result"><p>No matches found. Try browsing the <a href="/discover" style="color:var(--primary);">full directory</a>.</p></div>';
        }
      } catch (err) {
        results.innerHTML = '<div class="result" style="border-color:#ef4444;"><p style="color:#ef4444;">Connection failed. Please try again.</p></div>';
      }
    }

    function formatMarkdown(text) {
      if(!text) return '';
      return text
        .replace(/\*\*(.+?)\*\*/g, '<strong style="color:white;">$1</strong>')
        .replace(/\`\`\`(\w*)\n([\s\S]*?)\`\`\`/g, '<pre><code>$2</code></pre>')
        .replace(/\`([^\`]+)\`/g, '<code style="background:rgba(255,255,255,0.1);padding:0.2em 0.4em;border-radius:4px;color:#cbd5e1;">$1</code>')
        .replace(/\n/g, '<br>');
    }

    submitBtn.addEventListener('click', doSearch);
    search.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') doSearch();
    });

    search.addEventListener('input', () => {
      if (mode !== 'search') return;
      clearTimeout(timeout);
      timeout = setTimeout(doSearch, 400);
    });
  </script>
</body>
</html>`
}

async function generateOnboardPage(service: ServiceRecord): Promise<string> {
  const pkg = await getPackageMetadata(service.service_name)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Get ${service.service_name} - ChittyOS</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Outfit:wght@500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-base: #050505;
      --bg-surface: #111111;
      --bg-glass: rgba(255, 255, 255, 0.03);
      --border-glass: rgba(255, 255, 255, 0.08);
      --primary: #4F46E5;
      --primary-hover: #6366F1;
      --accent: #0ea5e9;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', system-ui, sans-serif;
      background: var(--bg-base);
      color: var(--text-main);
      min-height: 100vh;
      padding: 4rem 1.5rem;
      position: relative;
      overflow-x: hidden;
    }
    body::before, body::after {
      content: '';
      position: fixed;
      width: 500px;
      height: 500px;
      border-radius: 50%;
      filter: blur(100px);
      z-index: -1;
      opacity: 0.3;
    }
    body::before { background: radial-gradient(circle, var(--accent) 0%, transparent 70%); top: -100px; left: -100px; }
    .container {
      max-width: 700px;
      margin: 0 auto;
      background: var(--bg-surface);
      border: 1px solid var(--border-glass);
      border-radius: 20px;
      padding: 3rem;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      position: relative;
      z-index: 1;
      backdrop-filter: blur(20px);
      animation: slideUp 0.5s ease-out;
    }
    @keyframes slideUp { from { opacity:0; transform: translateY(20px); } to { opacity:1; transform: translateY(0); } }
    .header { margin-bottom: 3rem; border-bottom: 1px solid var(--border-glass); padding-bottom: 2rem; }
    h1 { font-family: 'Outfit', sans-serif; font-size: 3rem; font-weight: 700; margin-bottom: 1rem; color: #fff; }
    .badge-container { display: flex; gap: 1rem; align-items: center; margin-bottom: 1.5rem; }
    .status { padding: 0.35rem 0.85rem; border-radius: 20px; font-size: 0.85rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
    .status.live { background: rgba(16, 185, 129, 0.1); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.2); }
    .status.other { background: rgba(245, 158, 11, 0.1); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.2); }
    .category { color: var(--text-muted); font-size: 1.1rem; }
    h2 { font-family: 'Outfit', sans-serif; font-size: 1.5rem; margin: 2rem 0 1rem 0; color: #fff; }
    .method {
      margin: 1.5rem 0;
      padding: 1.5rem;
      background: var(--bg-glass);
      border: 1px solid var(--border-glass);
      border-radius: 12px;
      transition: transform 0.2s, border-color 0.2s;
    }
    .method:hover { transform: translateY(-2px); border-color: var(--primary); }
    .method h3 { margin: 0 0 1rem 0; color: var(--text-main); font-size: 1.1rem; }
    pre {
      background: #000;
      padding: 1.25rem;
      border-radius: 8px;
      border: 1px solid var(--border-glass);
      overflow-x: auto;
    }
    code { font-family: 'SF Mono', monospace; font-size: 0.95rem; color: #e2e8f0; }
    .links { display: flex; gap: 1.5rem; margin-top: 2rem; flex-wrap: wrap; }
    .links a {
      padding: 0.75rem 1.5rem;
      background: rgba(255,255,255,0.05);
      border: 1px solid var(--border-glass);
      color: var(--text-main);
      text-decoration: none;
      border-radius: 8px;
      font-weight: 500;
      transition: all 0.2s;
    }
    .links a:hover { background: var(--primary); border-color: var(--primary); }
    .back-btn { display: inline-block; margin-top: 3rem; color: var(--text-muted); text-decoration: none; transition: color 0.2s; }
    .back-btn:hover { color: #fff; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${service.service_name}</h1>
      <div class="badge-container">
        <span class="status ${service.status === 'Live' ? 'live' : 'other'}">${service.status}</span>
        <span class="category">${service.category}</span>
      </div>
    </div>

    <h2>Installation Methods</h2>

    <div class="method">
      <h3>Quick Install (Shell)</h3>
      <pre><code>curl -fsSL https://git.chitty.cc/${service.service_name}/install | bash</code></pre>
    </div>

    ${pkg?.platforms.includes('npm') ? `
    <div class="method">
      <h3>NPM Package</h3>
      <pre><code>npm install ${pkg.npm || service.service_name}</code></pre>
    </div>
    ` : ''}

    ${pkg?.platforms.includes('brew') ? `
    <div class="method">
      <h3>Homebrew Tap</h3>
      <pre><code>brew install ${pkg.brew || service.service_name}</code></pre>
    </div>
    ` : ''}

    <h2>Resources</h2>
    <div class="links">
      <a href="https://docs.chitty.cc/${service.service_name}/">📚 Documentation</a>
      <a href="https://api.chitty.cc/${service.service_name}/">⚡ API Reference</a>
      <a href="${service.github_repo}">💻 Source Code</a>
    </div>

    <a href="/" class="back-btn">&larr; Back to directory</a>
  </div>
</body>
</html>`
}


export default {
  async fetch(request: Request, env: Env, execCtx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(request.headers.get('Origin') || undefined) })
    }

    if (url.pathname === '/health') {
      return Response.json({ status: 'ok', service: 'getchitty', features: ['nl-gateway', 'discovery', 'onboarding', 'audit'] })
    }

    // Create context for traceability
    const chittyCtx = contextFromRequest(request, 'conversation')

    // Natural Language Query endpoint
    if (url.pathname === '/ask') {
      if (request.method === 'GET') {
        const query = url.searchParams.get('q')
        if (!query) {
          return Response.json({ error: 'Missing "q" parameter. Use: /ask?q=your+question' }, { status: 400 })
        }
        const response = await askChittyClaw(query, env)
        const intent = response.intent

        // Audit the NL query
        execCtx.waitUntil(logAudit(env, createAuditEvent(
          chittyCtx,
          'gateway.ask',
          'classify',
          '/ask',
          {
            intent: intent.category,
            confidence: intent.confidence,
            services: intent.services,
            query: query.slice(0, 100) // truncate for privacy
          }
        )))

        const headers = new Headers(corsHeaders(request.headers.get('Origin') || undefined))
        addContextHeaders(headers, chittyCtx)

        return Response.json({
          ...response,
          _context: {
            id: chittyCtx.id,
            requestId: chittyCtx.requestId,
            grade: chittyCtx.grade
          }
        }, { headers })
      }

      if (request.method === 'POST') {
        try {
          const body = await request.json() as { query?: string; q?: string }
          const query = body.query || body.q
          if (!query) {
            return Response.json({ error: 'Missing "query" or "q" in request body' }, { status: 400 })
          }
          const response = await askChittyClaw(query, env)
          const intent = response.intent

          // Audit the NL query
          execCtx.waitUntil(logAudit(env, createAuditEvent(
            chittyCtx,
            'gateway.ask',
            'classify',
            '/ask',
            {
              intent: intent.category,
              confidence: intent.confidence,
              services: intent.services
            }
          )))

          const headers = new Headers(corsHeaders(request.headers.get('Origin') || undefined))
          addContextHeaders(headers, chittyCtx)

          return Response.json({
            ...response,
            _context: {
              id: chittyCtx.id,
              requestId: chittyCtx.requestId,
              grade: chittyCtx.grade
            }
          }, { headers })
        } catch {
          return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
        }
      }

      return Response.json({ error: 'Method not allowed. Use GET or POST.' }, { status: 405 })
    }

    // Wizard / home
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return new Response(generateWizardHTML(), {
        headers: { 'Content-Type': 'text/html' }
      })
    }

    // Recommendations API
    if (url.pathname === '/recommend') {
      const need = url.searchParams.get('need')
      if (!need) {
        return Response.json({ error: 'Missing "need" parameter' }, { status: 400 })
      }
      return Response.json({
        query: need,
        recommendations: recommendServices(need)
      })
    }

    // Discover / browse all
    if (url.pathname === '/discover') {
      const services = await listServices()
      return Response.json({
        total: services.length,
        services: services.map(s => ({
          name: s.service_name,
          category: s.category,
          status: s.status,
          onboard_url: `https://get.chitty.cc/onboard/${s.service_name}`
        }))
      })
    }

    // Onboard specific service
    if (url.pathname.startsWith('/onboard/')) {
      const serviceName = url.pathname.replace('/onboard/', '').replace(/\/$/, '')
      const service = await getService(serviceName)

      if (!service) {
        return Response.json({ error: `Service '${serviceName}' not found` }, { status: 404 })
      }

      // Audit onboarding access
      execCtx.waitUntil(logAudit(env, createAuditEvent(
        chittyCtx,
        'gateway.onboard',
        'view',
        `/onboard/${serviceName}`,
        { service: serviceName, category: service.category }
      )))

      return new Response(await generateOnboardPage(service), {
        headers: { 'Content-Type': 'text/html' }
      })
    }

    // Service info (JSON)
    if (url.pathname.startsWith('/service/')) {
      const serviceName = url.pathname.replace('/service/', '').replace(/\/$/, '')
      const service = await getService(serviceName)

      if (!service) {
        return Response.json({ error: `Service '${serviceName}' not found` }, { status: 404 })
      }

      const pkg = await getPackageMetadata(serviceName)
      return Response.json({ service, package: pkg })
    }

    return Response.json({ error: 'Not found' }, { status: 404 })
  }
}
