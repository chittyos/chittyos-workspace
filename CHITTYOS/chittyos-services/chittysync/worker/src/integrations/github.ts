/**
 * GitHub Integration Handler
 *
 * Handles GitHub integrations (Issues, PRs, Actions, Releases).
 * Syncs issues to todos, automates PR workflows, triggers actions.
 */

import { Env } from '../types';
import { ChittyIdClient } from '../chittyid-client';

/**
 * Handle GitHub integration requests
 */
export async function handleGitHubIntegration(
  request: Request,
  env: Env,
  path: string
): Promise<Response> {
  // POST /api/integrations/github/issues/sync - Sync issues to todos
  if (path === '/issues/sync' && request.method === 'POST') {
    return handleIssueSync(request, env);
  }

  // POST /api/integrations/github/webhooks - Webhook handler
  if (path === '/webhooks' && request.method === 'POST') {
    return handleWebhook(request, env);
  }

  // POST /api/integrations/github/actions/trigger - Trigger workflow
  if (path === '/actions/trigger' && request.method === 'POST') {
    return handleActionsTrigger(request, env);
  }

  // GET /api/integrations/github/status - Integration status
  if (path === '/status' && request.method === 'GET') {
    return handleGitHubStatus(request, env);
  }

  return new Response('Not Found', { status: 404 });
}

/**
 * Sync GitHub issues to todos
 */
async function handleIssueSync(request: Request, env: Env): Promise<Response> {
  const token = env.GITHUB_TOKEN;
  if (!token) {
    return new Response(
      JSON.stringify({ success: false, error: 'GITHUB_TOKEN not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const body = await request.json() as {
    repo?: string;
    labels?: string[];
    state?: string;
  };

  const repo = body.repo || env.GITHUB_REPO || 'chittyos/chittyos';
  const labels = body.labels || ['todo'];
  const state = body.state || 'open';

  // Fetch issues
  const labelsQuery = labels.map(l => `label:"${l}"`).join(',');
  const url = `https://api.github.com/repos/${repo}/issues?state=${state}&labels=${labels.join(',')}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'ChittySync/2.0'
    }
  });

  if (!response.ok) {
    return new Response(
      JSON.stringify({ success: false, error: `GitHub API error: ${response.status}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const issues = await response.json() as any[];

  // Convert issues to todos
  const chittyIdClient = new ChittyIdClient(env.CHITTYID_SERVICE_URL || 'https://id.chitty.cc/v1');
  const token2 = env.CHITTY_ID_TOKEN || '';

  const todos = [];
  for (const issue of issues) {
    // Mint ChittyID for todo
    const chittyId = await chittyIdClient.mint(
      'todo',
      'github-issue',
      { issueNumber: issue.number, repo },
      token2
    );

    const todo = {
      id: chittyId,
      content: issue.title,
      status: issue.state === 'open' ? 'pending' : 'completed',
      platform: 'github',
      metadata: {
        issueNumber: issue.number,
        url: issue.html_url,
        labels: issue.labels.map((l: any) => l.name),
        createdAt: issue.created_at,
        updatedAt: issue.updated_at
      }
    };

    todos.push(todo);

    // TODO: Insert todo into D1 database
  }

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        imported: todos.length,
        todos
      }
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Handle GitHub webhooks
 */
async function handleWebhook(request: Request, env: Env): Promise<Response> {
  const event = request.headers.get('X-GitHub-Event');
  const body = await request.json();

  // Handle different webhook events
  switch (event) {
    case 'issues':
      return handleIssueWebhook(body, env);
    case 'pull_request':
      return handlePRWebhook(body, env);
    case 'push':
      return handlePushWebhook(body, env);
    default:
      return new Response(
        JSON.stringify({ success: true, message: 'Event ignored' }),
        { headers: { 'Content-Type': 'application/json' } }
      );
  }
}

/**
 * Handle issue webhook
 */
async function handleIssueWebhook(body: any, env: Env): Promise<Response> {
  // TODO: Sync issue change to todo
  return new Response(
    JSON.stringify({ success: true }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Handle PR webhook
 */
async function handlePRWebhook(body: any, env: Env): Promise<Response> {
  // TODO: Handle PR events (opened, merged, etc.)
  return new Response(
    JSON.stringify({ success: true }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Handle push webhook
 */
async function handlePushWebhook(body: any, env: Env): Promise<Response> {
  // TODO: Handle push events (trigger deployments, etc.)
  return new Response(
    JSON.stringify({ success: true }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Trigger GitHub Actions workflow
 */
async function handleActionsTrigger(request: Request, env: Env): Promise<Response> {
  const token = env.GITHUB_TOKEN;
  if (!token) {
    return new Response(
      JSON.stringify({ success: false, error: 'GITHUB_TOKEN not configured' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const body = await request.json() as {
    repo: string;
    workflow: string;
    ref?: string;
    inputs?: Record<string, any>;
  };

  const repo = body.repo || env.GITHUB_REPO || 'chittyos/chittyos';
  const ref = body.ref || 'main';

  const url = `https://api.github.com/repos/${repo}/actions/workflows/${body.workflow}/dispatches`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'ChittySync/2.0',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ref,
      inputs: body.inputs || {}
    })
  });

  if (!response.ok) {
    return new Response(
      JSON.stringify({ success: false, error: `GitHub API error: ${response.status}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

/**
 * Get GitHub integration status
 */
async function handleGitHubStatus(request: Request, env: Env): Promise<Response> {
  const status = {
    configured: !!env.GITHUB_TOKEN,
    repo: env.GITHUB_REPO || 'chittyos/chittyos'
  };

  return new Response(
    JSON.stringify({ success: true, data: status }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}
