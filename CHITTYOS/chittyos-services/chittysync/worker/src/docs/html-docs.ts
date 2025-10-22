/**
 * HTML Documentation Page for ChittySync Hub API
 */

export const HTML_DOCS = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ChittySync Hub API Documentation</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
    }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px 20px;
      text-align: center;
      margin-bottom: 30px;
      border-radius: 8px;
    }
    header h1 { font-size: 2.5em; margin-bottom: 10px; }
    header p { font-size: 1.2em; opacity: 0.9; }
    .badge {
      display: inline-block;
      background: rgba(255,255,255,0.2);
      padding: 5px 15px;
      border-radius: 20px;
      margin: 10px 5px;
      font-size: 0.9em;
    }
    .section {
      background: white;
      padding: 30px;
      margin-bottom: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    h2 {
      color: #667eea;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #667eea;
    }
    h3 {
      color: #764ba2;
      margin-top: 20px;
      margin-bottom: 10px;
    }
    .endpoint {
      background: #f8f9fa;
      padding: 15px;
      margin: 15px 0;
      border-left: 4px solid #667eea;
      border-radius: 4px;
    }
    .method {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 4px;
      font-weight: bold;
      font-size: 0.85em;
      margin-right: 10px;
    }
    .method.get { background: #61affe; color: white; }
    .method.post { background: #49cc90; color: white; }
    .method.put { background: #fca130; color: white; }
    .method.delete { background: #f93e3e; color: white; }
    .path {
      font-family: 'Courier New', monospace;
      font-size: 1.1em;
      color: #333;
    }
    .description {
      margin-top: 10px;
      color: #666;
      font-size: 0.95em;
    }
    code {
      background: #f4f4f4;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
    }
    pre {
      background: #282c34;
      color: #abb2bf;
      padding: 20px;
      border-radius: 4px;
      overflow-x: auto;
      margin: 15px 0;
    }
    pre code {
      background: none;
      color: #abb2bf;
      padding: 0;
    }
    .feature-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin: 20px 0;
    }
    .feature-card {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      border-left: 4px solid #667eea;
    }
    .feature-card h4 {
      color: #667eea;
      margin-bottom: 10px;
    }
    .links {
      display: flex;
      gap: 15px;
      margin-top: 20px;
    }
    .btn {
      display: inline-block;
      padding: 10px 20px;
      background: #667eea;
      color: white;
      text-decoration: none;
      border-radius: 5px;
      transition: background 0.3s;
    }
    .btn:hover { background: #764ba2; }
    .btn.secondary {
      background: #6c757d;
    }
    .btn.secondary:hover {
      background: #5a6268;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🔄 ChittySync Hub API</h1>
      <p>Git-like omnidirectional todo synchronization</p>
      <div>
        <span class="badge">v2.2.0</span>
        <span class="badge">Session Sync</span>
        <span class="badge">Three-Tier Architecture</span>
      </div>
    </header>

    <div class="section">
      <h2>Overview</h2>
      <p>ChittySync Hub provides distributed todo management across Claude Code, ChatGPT, Claude Desktop, and custom AI platforms with:</p>
      <div class="feature-grid">
        <div class="feature-card">
          <h4>🔀 Three-Way Merge</h4>
          <p>Git-style conflict resolution with vector clocks for causality tracking</p>
        </div>
        <div class="feature-card">
          <h4>⚡ Real-Time Sync</h4>
          <p>Multi-session coordination in the same project with instant updates</p>
        </div>
        <div class="feature-card">
          <h4>📊 Topic Organization</h4>
          <p>Auto-detect topics from content and track across projects</p>
        </div>
        <div class="feature-card">
          <h4>🔐 ChittyID Authority</h4>
          <p>Verifiable identifiers from id.chitty.cc with cryptographic integrity</p>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>Authentication</h2>
      <p>All endpoints (except <code>/health</code>) require Bearer token authentication:</p>
      <pre><code>Authorization: Bearer YOUR_CHITTY_ID_TOKEN</code></pre>
    </div>

    <div class="section">
      <h2>Base URLs</h2>
      <ul>
        <li><strong>Production:</strong> <code>https://sync.chitty.cc</code></li>
        <li><strong>Gateway:</strong> <code>https://gateway.chitty.cc/api/todos</code></li>
      </ul>
    </div>

    <div class="section">
      <h2>Core Endpoints</h2>

      <div class="endpoint">
        <span class="method get">GET</span>
        <span class="path">/health</span>
        <div class="description">Health check (no auth required). Returns service status, database connection, and ChittyID service availability.</div>
      </div>

      <div class="endpoint">
        <span class="method post">POST</span>
        <span class="path">/api/todos</span>
        <div class="description">Create a new todo with ChittyID from id.chitty.cc</div>
        <pre><code>{
  "content": "Deploy to production",
  "status": "pending",
  "platform": "claude-code",
  "session_id": "session-abc123",
  "project_id": "chittyrouter"
}</code></pre>
      </div>

      <div class="endpoint">
        <span class="method get">GET</span>
        <span class="path">/api/todos</span>
        <div class="description">List todos with filters: <code>?status=pending&platform=claude-code&limit=100</code></div>
      </div>

      <div class="endpoint">
        <span class="method get">GET</span>
        <span class="path">/api/todos/{id}</span>
        <div class="description">Get single todo by ChittyID</div>
      </div>

      <div class="endpoint">
        <span class="method put">PUT</span>
        <span class="path">/api/todos/{id}</span>
        <div class="description">Update todo status or content</div>
      </div>

      <div class="endpoint">
        <span class="method delete">DELETE</span>
        <span class="path">/api/todos/{id}</span>
        <div class="description">Soft delete a todo (sets deleted_at timestamp)</div>
      </div>

      <div class="endpoint">
        <span class="method post">POST</span>
        <span class="path">/api/todos/sync</span>
        <div class="description">Bulk sync with conflict detection and resolution</div>
      </div>

      <div class="endpoint">
        <span class="method get">GET</span>
        <span class="path">/api/todos/since/{timestamp}</span>
        <div class="description">Delta sync - get todos updated since timestamp</div>
      </div>
    </div>

    <div class="section">
      <h2>Session Sync (Tier 1)</h2>

      <div class="endpoint">
        <span class="method post">POST</span>
        <span class="path">/api/sessions/register</span>
        <div class="description">Register or update a working session</div>
        <pre><code>{
  "session_id": "session-abc123",
  "project_id": "chittyrouter-hash",
  "project_path": "/Users/nb/.../chittyrouter",
  "git_branch": "main",
  "git_commit": "a6e6448",
  "platform": "claude-code"
}</code></pre>
      </div>

      <div class="endpoint">
        <span class="method post">POST</span>
        <span class="path">/api/sessions/{sessionId}/sync</span>
        <div class="description">Sync session todos to project canonical state. Returns merged state from all active sessions.</div>
      </div>

      <div class="endpoint">
        <span class="method get">GET</span>
        <span class="path">/api/sessions/{sessionId}</span>
        <div class="description">Get session details and status</div>
      </div>

      <div class="endpoint">
        <span class="method post">POST</span>
        <span class="path">/api/sessions/{sessionId}/end</span>
        <div class="description">Mark session as inactive</div>
      </div>

      <div class="endpoint">
        <span class="method get">GET</span>
        <span class="path">/api/projects/{projectId}/sessions</span>
        <div class="description">List all active sessions for a project</div>
      </div>

      <div class="endpoint">
        <span class="method get">GET</span>
        <span class="path">/api/projects/{projectId}/canonical</span>
        <div class="description">Get project's canonical state merged from all sessions</div>
      </div>
    </div>

    <div class="section">
      <h2>Topic Sync (Tier 3)</h2>

      <div class="endpoint">
        <span class="method get">GET</span>
        <span class="path">/api/topics</span>
        <div class="description">List all topics across projects</div>
      </div>

      <div class="endpoint">
        <span class="method get">GET</span>
        <span class="path">/api/topics/{topicId}</span>
        <div class="description">Get topic details and statistics</div>
      </div>

      <div class="endpoint">
        <span class="method get">GET</span>
        <span class="path">/api/topics/{topicId}/todos</span>
        <div class="description">Get all todos for a topic across projects. Filter by project: <code>?project_id=chittyrouter</code></div>
      </div>
    </div>

    <div class="section">
      <h2>Three-Tier Architecture</h2>
      <h3>1. Session (Temporal) - When you're working</h3>
      <ul>
        <li>Multiple parallel sessions in same project sync in real-time</li>
        <li>Git worktree-aware session lifecycle</li>
        <li>Auto-consolidation on session end</li>
      </ul>

      <h3>2. Project (Spatial) - What codebase</h3>
      <ul>
        <li>Singular canonical state across all sessions</li>
        <li>One <code>.chitty/todos.json</code> per project</li>
        <li>Auto-commits to Git with topic metadata</li>
      </ul>

      <h3>3. Topic (Conceptual) - Which aspect</h3>
      <ul>
        <li>Auto-detect topics from content (auth, music, api, etc.)</li>
        <li>Organize by topic within projects</li>
        <li>Track topics across multiple repositories</li>
      </ul>
    </div>

    <div class="section">
      <h2>Resources</h2>
      <div class="links">
        <a href="/docs/openapi.yaml" class="btn">OpenAPI YAML</a>
        <a href="/docs/openapi.json" class="btn secondary">OpenAPI JSON</a>
        <a href="https://chitty.cc/docs" class="btn secondary">Full Documentation</a>
      </div>
    </div>
  </div>
</body>
</html>
`;
