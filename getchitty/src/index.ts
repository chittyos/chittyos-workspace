/**
 * GetChitty Discovery & Onboarding - get.chitty.cc
 * Smart discovery and recommendations for ChittyOS services
 *
 * Patterns:
 *   get.chitty.cc/                   -> onboarding wizard
 *   get.chitty.cc/recommend?need=X   -> get recommendations
 *   get.chitty.cc/discover           -> browse all services
 *   get.chitty.cc/onboard/{service}  -> guided setup for service
 *   get.chitty.cc/service/{service}  -> service info page
 */

import { listServices, getService, getPackageMetadata, corsHeaders } from '@chittyos/core'
import type { ServiceRecord, DiscoveryResult } from '@chittyos/core'

interface Env {}

// Keyword to service mapping for recommendations
const NEED_KEYWORDS: Record<string, string[]> = {
  'auth': ['chittyauth', 'chittyid'],
  'authentication': ['chittyauth', 'chittyid'],
  'identity': ['chittyid', 'chittyauth'],
  'verify': ['chittyverify', 'chittycert'],
  'certificate': ['chittycert'],
  'connect': ['chittyconnect'],
  'api': ['chittyapi', 'chittyconnect'],
  'mcp': ['chittymcp'],
  'docs': ['chittydocs'],
  'registry': ['chittyregistry', 'chittyregister'],
  'evidence': ['chittyevidence', 'chittychain'],
  'ledger': ['chittyledger', 'chittychain'],
  'cases': ['chittycases'],
  'legal': ['chittycases', 'chittyevidence'],
  'monitor': ['chittymonitor', 'chittybeacon'],
  'discovery': ['chittydiscovery'],
  'storage': ['chittyconnect'],
  'data': ['chittyschema', 'chittyledger'],
  'schema': ['chittyschema'],
  'trust': ['chittytrust', 'chittycert']
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
    body { font-family: system-ui; max-width: 600px; margin: 0 auto; padding: 2rem; }
    h1 { color: #333; }
    .search { width: 100%; padding: 1rem; font-size: 1.1rem; border: 2px solid #ddd; border-radius: 8px; }
    .search:focus { outline: none; border-color: #0066cc; }
    .results { margin-top: 2rem; }
    .result { padding: 1rem; border: 1px solid #eee; border-radius: 8px; margin: 0.5rem 0; }
    .result:hover { background: #f9f9f9; }
    .result h3 { margin: 0 0 0.5rem 0; }
    .result p { margin: 0; color: #666; }
    .confidence { font-size: 0.8rem; color: #888; }
    a { color: #0066cc; }
    .links { margin-top: 2rem; }
    .links a { display: inline-block; margin-right: 1rem; }
  </style>
</head>
<body>
  <h1>Get Started with ChittyOS</h1>
  <p>What do you need help with?</p>
  <input type="text" class="search" placeholder="e.g., authentication, identity, evidence tracking..." id="search">
  <div class="results" id="results"></div>
  <div class="links">
    <a href="/discover">Browse All Services</a>
    <a href="https://docs.chitty.cc">Documentation</a>
  </div>
  <script>
    const search = document.getElementById('search');
    const results = document.getElementById('results');
    let timeout;
    search.addEventListener('input', () => {
      clearTimeout(timeout);
      timeout = setTimeout(async () => {
        if (!search.value.trim()) { results.innerHTML = ''; return; }
        const res = await fetch('/recommend?need=' + encodeURIComponent(search.value));
        const data = await res.json();
        results.innerHTML = data.recommendations.map(r => \`
          <div class="result">
            <h3><a href="/onboard/\${r.service}">\${r.service}</a></h3>
            <p>\${r.reason}</p>
            <span class="confidence">Confidence: \${Math.round(r.confidence * 100)}%</span>
          </div>
        \`).join('') || '<p>No matches found. <a href="/discover">Browse all services</a></p>';
      }, 300);
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
      return Response.json({ status: 'ok', service: 'getchitty' })
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
