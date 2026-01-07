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

import { listServices, getService, getPackageMetadata, corsHeaders } from '@chittyos/core'
import type { ServiceRecord, DiscoveryResult } from '@chittyos/core'
import { classifyIntent, handleIntent } from './intent'

interface Env {}

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
<html>
<head>
  <title>Get Started with ChittyOS</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui; max-width: 700px; margin: 0 auto; padding: 2rem; background: #fafafa; }
    h1 { color: #333; margin-bottom: 0.5rem; }
    .subtitle { color: #666; margin-bottom: 2rem; }
    .tabs { display: flex; gap: 1rem; margin-bottom: 1.5rem; }
    .tab { padding: 0.5rem 1rem; border: none; background: #eee; border-radius: 6px; cursor: pointer; font-size: 0.9rem; }
    .tab.active { background: #0066cc; color: white; }
    .search-container { position: relative; }
    .search { width: 100%; padding: 1rem 3rem 1rem 1rem; font-size: 1.1rem; border: 2px solid #ddd; border-radius: 8px; background: white; }
    .search:focus { outline: none; border-color: #0066cc; }
    .search-btn { position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%); padding: 0.5rem 1rem; background: #0066cc; color: white; border: none; border-radius: 6px; cursor: pointer; }
    .search-btn:hover { background: #0055aa; }
    .results { margin-top: 1.5rem; }
    .result { padding: 1rem; border: 1px solid #e0e0e0; border-radius: 8px; margin: 0.5rem 0; background: white; }
    .result:hover { border-color: #0066cc; }
    .result h3 { margin: 0 0 0.5rem 0; }
    .result p { margin: 0; color: #666; }
    .result .meta { font-size: 0.85rem; color: #888; margin-top: 0.5rem; }
    .answer { padding: 1.5rem; background: white; border: 1px solid #e0e0e0; border-radius: 8px; margin: 1rem 0; }
    .answer h3 { margin: 0 0 1rem 0; color: #333; }
    .answer p { margin: 0.5rem 0; line-height: 1.6; }
    .answer pre { background: #f4f4f4; padding: 1rem; border-radius: 6px; overflow-x: auto; }
    .answer code { font-family: 'SF Mono', Monaco, monospace; font-size: 0.9rem; }
    .actions { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 1rem; }
    .action { padding: 0.5rem 1rem; background: #0066cc; color: white; text-decoration: none; border-radius: 6px; font-size: 0.9rem; }
    .action:hover { background: #0055aa; }
    .confidence { font-size: 0.8rem; color: #888; }
    a { color: #0066cc; }
    .links { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #eee; }
    .links a { display: inline-block; margin-right: 1.5rem; color: #666; }
    .links a:hover { color: #0066cc; }
    .intent-badge { display: inline-block; padding: 0.2rem 0.5rem; background: #e8f4fd; color: #0066cc; border-radius: 4px; font-size: 0.75rem; margin-left: 0.5rem; }
    .loading { text-align: center; padding: 2rem; color: #666; }
  </style>
</head>
<body>
  <h1>ChittyOS Gateway</h1>
  <p class="subtitle">Ask questions or search for services</p>

  <div class="tabs">
    <button class="tab active" data-mode="ask">Ask a Question</button>
    <button class="tab" data-mode="search">Keyword Search</button>
  </div>

  <div class="search-container">
    <input type="text" class="search" placeholder="e.g., How do I install chittyauth?" id="search">
    <button class="search-btn" id="submit">Ask</button>
  </div>

  <div class="results" id="results"></div>

  <div class="links">
    <a href="/discover">Browse All Services</a>
    <a href="https://docs.chitty.cc">Documentation</a>
    <a href="https://git.chitty.cc">Package Registry</a>
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
        submitBtn.textContent = mode === 'ask' ? 'Ask' : 'Search';
        results.innerHTML = '';
      });
    });

    async function doSearch() {
      const query = search.value.trim();
      if (!query) { results.innerHTML = ''; return; }

      results.innerHTML = '<div class="loading">Thinking...</div>';

      if (mode === 'ask') {
        const res = await fetch('/ask?q=' + encodeURIComponent(query));
        const data = await res.json();

        let html = '<div class="answer">';
        html += '<h3>Answer <span class="intent-badge">' + data.intent.category + '</span></h3>';
        html += '<div>' + formatMarkdown(data.answer) + '</div>';

        if (data.services && data.services.length > 0) {
          html += '<div style="margin-top: 1rem;">';
          data.services.forEach(s => {
            html += '<div class="result"><h3><a href="/onboard/' + s.service_name + '">' + s.service_name + '</a></h3>';
            html += '<p>' + s.category + ' - ' + s.status + '</p></div>';
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
        results.innerHTML = data.recommendations.map(r => \`
          <div class="result">
            <h3><a href="/onboard/\${r.service}">\${r.service}</a></h3>
            <p>\${r.reason}</p>
            <div class="meta">Confidence: \${Math.round(r.confidence * 100)}%</div>
          </div>
        \`).join('') || '<p>No matches found. <a href="/discover">Browse all services</a></p>';
      }
    }

    function formatMarkdown(text) {
      return text
        .replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>')
        .replace(/\\\`\\\`\\\`(\\w*)\\n([\\s\\S]*?)\\\`\\\`\\\`/g, '<pre><code>$2</code></pre>')
        .replace(/\\\`([^\\\`]+)\\\`/g, '<code>$1</code>')
        .replace(/\\n/g, '<br>');
    }

    submitBtn.addEventListener('click', doSearch);
    search.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') doSearch();
    });

    // Debounced input for keyword mode
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
<html>
<head>
  <title>Get ${service.service_name} - ChittyOS</title>
  <style>
    body { font-family: system-ui; max-width: 700px; margin: 0 auto; padding: 2rem; }
    h1 { color: #333; }
    .status { display: inline-block; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem; }
    .status.live { background: #d4edda; color: #155724; }
    .status.other { background: #fff3cd; color: #856404; }
    pre { background: #f4f4f4; padding: 1rem; border-radius: 8px; overflow-x: auto; }
    code { font-family: monospace; }
    .methods { margin: 2rem 0; }
    .method { margin: 1rem 0; padding: 1rem; border: 1px solid #eee; border-radius: 8px; }
    .method h3 { margin: 0 0 0.5rem 0; }
    a { color: #0066cc; }
  </style>
</head>
<body>
  <h1>${service.service_name}</h1>
  <span class="status ${service.status === 'Live' ? 'live' : 'other'}">${service.status}</span>
  <p>Category: ${service.category}</p>

  <div class="methods">
    <h2>Installation Methods</h2>

    <div class="method">
      <h3>Quick Install</h3>
      <pre><code>curl -fsSL https://git.chitty.cc/${service.service_name}/install | bash</code></pre>
    </div>

    ${pkg?.platforms.includes('npm') ? `
    <div class="method">
      <h3>npm</h3>
      <pre><code>npm install ${pkg.npm || service.service_name}</code></pre>
    </div>
    ` : ''}

    ${pkg?.platforms.includes('brew') ? `
    <div class="method">
      <h3>Homebrew</h3>
      <pre><code>brew install ${pkg.brew || service.service_name}</code></pre>
    </div>
    ` : ''}
  </div>

  <h2>Links</h2>
  <ul>
    <li><a href="https://docs.chitty.cc/${service.service_name}/">Documentation</a></li>
    <li><a href="https://api.chitty.cc/${service.service_name}/">API</a></li>
    <li><a href="${service.github_repo}">GitHub Repository</a></li>
  </ul>

  <p><a href="/">&larr; Back to discovery</a></p>
</body>
</html>`
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(request.headers.get('Origin') || undefined) })
    }

    if (url.pathname === '/health') {
      return Response.json({ status: 'ok', service: 'getchitty', features: ['nl-gateway', 'discovery', 'onboarding'] })
    }

    // Natural Language Query endpoint
    if (url.pathname === '/ask') {
      if (request.method === 'GET') {
        const query = url.searchParams.get('q')
        if (!query) {
          return Response.json({ error: 'Missing "q" parameter. Use: /ask?q=your+question' }, { status: 400 })
        }
        const intent = classifyIntent(query)
        const response = await handleIntent(intent)
        return Response.json(response, { headers: corsHeaders(request.headers.get('Origin') || undefined) })
      }

      if (request.method === 'POST') {
        try {
          const body = await request.json() as { query?: string; q?: string }
          const query = body.query || body.q
          if (!query) {
            return Response.json({ error: 'Missing "query" or "q" in request body' }, { status: 400 })
          }
          const intent = classifyIntent(query)
          const response = await handleIntent(intent)
          return Response.json(response, { headers: corsHeaders(request.headers.get('Origin') || undefined) })
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
