/**
 * ChittySweep Interactive Dashboard
 * Modern, multi-page, real-time dashboard with live updates
 */

export function renderDashboard() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ChittySweep - Intelligent Janitor Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    :root {
      --primary: #667eea;
      --secondary: #764ba2;
      --success: #10b981;
      --danger: #ef4444;
      --warning: #f59e0b;
      --dark: #1f2937;
      --light: #f9fafb;
      --border: rgba(255,255,255,0.2);
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
      color: #fff;
      overflow-x: hidden;
    }

    /* Navigation */
    nav {
      background: rgba(0,0,0,0.2);
      backdrop-filter: blur(10px);
      padding: 1rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
    }

    .nav-brand {
      font-size: 1.5rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .nav-tabs {
      display: flex;
      gap: 1rem;
    }

    .nav-tab {
      padding: 0.5rem 1rem;
      background: transparent;
      border: none;
      color: rgba(255,255,255,0.7);
      cursor: pointer;
      border-radius: 8px;
      transition: all 0.3s;
      font-size: 0.95rem;
    }

    .nav-tab:hover {
      background: rgba(255,255,255,0.1);
      color: #fff;
    }

    .nav-tab.active {
      background: rgba(255,255,255,0.15);
      color: #fff;
      font-weight: 600;
    }

    .live-indicator {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
    }

    .pulse {
      width: 8px;
      height: 8px;
      background: var(--success);
      border-radius: 50%;
      animation: pulse 2s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }

    /* Container */
    .container {
      max-width: 1400px;
      margin: 2rem auto;
      padding: 0 2rem;
    }

    /* Pages */
    .page {
      display: none;
      animation: fadeIn 0.3s;
    }

    .page.active {
      display: block;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Cards */
    .card {
      background: rgba(255,255,255,0.1);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      padding: 1.5rem;
      border: 1px solid var(--border);
      margin-bottom: 1.5rem;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .card-title {
      font-size: 1.25rem;
      font-weight: 600;
    }

    /* Metrics Grid */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .metric-card {
      background: rgba(255,255,255,0.15);
      padding: 1.5rem;
      border-radius: 12px;
      text-align: center;
      transition: transform 0.2s;
    }

    .metric-card:hover {
      transform: translateY(-4px);
    }

    .metric-value {
      font-size: 2.5rem;
      font-weight: bold;
      margin: 0.5rem 0;
      background: linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.8) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .metric-label {
      opacity: 0.8;
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .metric-change {
      font-size: 0.875rem;
      margin-top: 0.5rem;
    }

    .metric-change.up { color: var(--success); }
    .metric-change.down { color: var(--danger); }

    /* Agent Grid */
    .agent-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1rem;
    }

    .agent-card {
      background: rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 1.5rem;
      border: 1px solid var(--border);
      transition: all 0.3s;
    }

    .agent-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0,0,0,0.2);
    }

    .agent-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .agent-icon {
      font-size: 2rem;
    }

    .agent-status {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: var(--success);
      padding: 0.25rem 0.75rem;
      border-radius: 999px;
      font-size: 0.875rem;
      margin-top: 0.5rem;
    }

    .agent-stats {
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid var(--border);
      font-size: 0.875rem;
      opacity: 0.9;
    }

    /* Activity Feed */
    .activity-feed {
      max-height: 500px;
      overflow-y: auto;
    }

    .activity-item {
      background: rgba(255,255,255,0.05);
      padding: 1rem;
      border-radius: 8px;
      margin-bottom: 0.75rem;
      border-left: 3px solid var(--primary);
      transition: all 0.2s;
    }

    .activity-item:hover {
      background: rgba(255,255,255,0.1);
    }

    .activity-item.new {
      animation: slideIn 0.3s;
      border-left-color: var(--success);
    }

    @keyframes slideIn {
      from { transform: translateX(-20px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }

    .activity-time {
      font-size: 0.75rem;
      opacity: 0.6;
      margin-top: 0.25rem;
    }

    /* Discovery List */
    .discovery-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .discovery-item {
      background: rgba(255,255,255,0.05);
      padding: 1rem;
      border-radius: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: all 0.2s;
    }

    .discovery-item:hover {
      background: rgba(255,255,255,0.1);
    }

    .discovery-info {
      flex: 1;
    }

    .discovery-path {
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 0.875rem;
      margin-bottom: 0.5rem;
    }

    .discovery-meta {
      display: flex;
      gap: 1rem;
      font-size: 0.75rem;
      opacity: 0.7;
    }

    .discovery-actions {
      display: flex;
      gap: 0.5rem;
    }

    /* Buttons */
    button {
      background: #fff;
      color: var(--primary);
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }

    button:active {
      transform: translateY(0);
    }

    button.secondary {
      background: transparent;
      color: #fff;
      border: 2px solid rgba(255,255,255,0.3);
    }

    button.secondary:hover {
      background: rgba(255,255,255,0.1);
      border-color: rgba(255,255,255,0.5);
    }

    button.danger {
      background: var(--danger);
      color: #fff;
    }

    button.success {
      background: var(--success);
      color: #fff;
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-group {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    /* Badges */
    .badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .badge.success { background: var(--success); }
    .badge.danger { background: var(--danger); }
    .badge.warning { background: var(--warning); }
    .badge.info { background: var(--primary); }

    /* Progress Bar */
    .progress-bar {
      width: 100%;
      height: 8px;
      background: rgba(255,255,255,0.1);
      border-radius: 999px;
      overflow: hidden;
      margin: 1rem 0;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--success) 0%, var(--primary) 100%);
      transition: width 0.3s;
    }

    /* Loading Spinner */
    .spinner {
      border: 3px solid rgba(255,255,255,0.1);
      border-top: 3px solid #fff;
      border-radius: 50%;
      width: 24px;
      height: 24px;
      animation: spin 1s linear infinite;
      display: inline-block;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    /* Chart Container */
    .chart-container {
      background: rgba(255,255,255,0.05);
      border-radius: 8px;
      padding: 1rem;
      margin: 1rem 0;
      min-height: 200px;
    }

    /* Confirmation Modal */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(4px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: fadeIn 0.2s;
    }

    .modal-overlay.active {
      display: flex;
    }

    .modal {
      background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
      border-radius: 16px;
      padding: 2rem;
      max-width: 500px;
      width: 90%;
      border: 2px solid rgba(255,255,255,0.3);
      animation: slideUp 0.3s;
    }

    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .modal-header {
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .modal-body {
      margin-bottom: 1.5rem;
      opacity: 0.9;
      line-height: 1.6;
    }

    .modal-actions {
      display: flex;
      gap: 1rem;
      justify-content: flex-end;
    }

    .modal-info {
      background: rgba(255,255,255,0.1);
      padding: 1rem;
      border-radius: 8px;
      margin: 1rem 0;
      font-family: 'Monaco', 'Courier New', monospace;
      font-size: 0.875rem;
    }

    /* Scrollbar */
    ::-webkit-scrollbar {
      width: 8px;
    }

    ::-webkit-scrollbar-track {
      background: rgba(255,255,255,0.1);
      border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,0.3);
      border-radius: 4px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: rgba(255,255,255,0.5);
    }

    /* Responsive */
    @media (max-width: 768px) {
      .nav-tabs {
        flex-wrap: wrap;
      }

      .metrics-grid {
        grid-template-columns: repeat(2, 1fr);
      }

      .agent-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <!-- Navigation -->
  <nav>
    <div class="nav-brand">
      <span>🧹</span>
      <span>ChittySweep</span>
    </div>
    <div class="nav-tabs">
      <button class="nav-tab active" data-page="overview">Overview</button>
      <button class="nav-tab" data-page="discoveries">Discoveries</button>
      <button class="nav-tab" data-page="sweeps">Sweeps</button>
      <button class="nav-tab" data-page="agents">Agents</button>
      <button class="nav-tab" data-page="recommendations">Recommendations</button>
    </div>
    <div class="live-indicator">
      <div class="pulse"></div>
      <span>Live</span>
    </div>
  </nav>

  <!-- Confirmation Modal -->
  <div class="modal-overlay" id="confirmModal">
    <div class="modal">
      <div class="modal-header" id="modalHeader">
        ⚠️ Confirm Action
      </div>
      <div class="modal-body" id="modalBody">
        Are you sure you want to proceed?
      </div>
      <div class="modal-info" id="modalInfo" style="display: none;"></div>
      <div class="modal-actions">
        <button class="secondary" onclick="closeModal()">Cancel</button>
        <button id="modalConfirmBtn" onclick="confirmAction()">Confirm</button>
      </div>
    </div>
  </div>

  <!-- Container -->
  <div class="container">
    <!-- Overview Page -->
    <div class="page active" id="page-overview">
      <h1 style="margin-bottom: 2rem;">Dashboard Overview</h1>

      <!-- Metrics -->
      <div class="metrics-grid">
        <div class="metric-card">
          <div class="metric-label">Total Cleaned</div>
          <div class="metric-value" id="metric-bytes">0 MB</div>
          <div class="metric-change up">↑ 12% this week</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Files Processed</div>
          <div class="metric-value" id="metric-files">0</div>
          <div class="metric-change up">↑ 24 today</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Success Rate</div>
          <div class="metric-value" id="metric-success">0%</div>
          <div class="metric-change up">↑ 5%</div>
        </div>
        <div class="metric-card">
          <div class="metric-label">Total Sweeps</div>
          <div class="metric-value" id="metric-sweeps">0</div>
          <div class="metric-change up">↑ 8 today</div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Quick Actions</h2>
        </div>
        <div class="btn-group">
          <button onclick="triggerSweep('full')" class="success">🚀 Full Sweep</button>
          <button onclick="triggerSweep('quick')">⚡ Quick Scan</button>
          <button onclick="refreshData()" class="secondary">🔄 Refresh</button>
          <button onclick="viewRecommendations()">📋 View Recommendations</button>
        </div>
      </div>

      <!-- Live Activity -->
      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Live Activity</h2>
          <span class="badge info" id="activity-count">0 events</span>
        </div>
        <div class="activity-feed" id="activity-feed">
          <div style="text-align: center; opacity: 0.5; padding: 2rem;">
            No recent activity
          </div>
        </div>
      </div>
    </div>

    <!-- Discoveries Page -->
    <div class="page" id="page-discoveries">
      <h1 style="margin-bottom: 2rem;">Discoveries</h1>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Recent Discoveries</h2>
          <button onclick="loadDiscoveries()" class="secondary">Refresh</button>
        </div>
        <div class="discovery-list" id="discovery-list">
          <div style="text-align: center; opacity: 0.5; padding: 2rem;">
            Loading discoveries...
          </div>
        </div>
      </div>
    </div>

    <!-- Sweeps Page -->
    <div class="page" id="page-sweeps">
      <h1 style="margin-bottom: 2rem;">Sweep History</h1>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Recent Sweeps</h2>
        </div>
        <div id="sweeps-list">
          <div style="text-align: center; opacity: 0.5; padding: 2rem;">
            No sweeps yet
          </div>
        </div>
      </div>
    </div>

    <!-- Agents Page -->
    <div class="page" id="page-agents">
      <h1 style="margin-bottom: 2rem;">Agent Status</h1>

      <div class="agent-grid">
        <div class="agent-card">
          <div class="agent-header">
            <div class="agent-icon">🔍</div>
            <div>
              <h3>Scout</h3>
              <p style="opacity: 0.7; font-size: 0.875rem;">Discovery Agent</p>
            </div>
          </div>
          <p>Discovers cleanup opportunities across the system</p>
          <span class="agent-status">
            <div class="pulse"></div>
            Active
          </span>
          <div class="agent-stats">
            <div>Last run: <span id="scout-last">Never</span></div>
            <div>Discoveries: <span id="scout-count">0</span></div>
          </div>
        </div>

        <div class="agent-card">
          <div class="agent-header">
            <div class="agent-icon">📊</div>
            <div>
              <h3>Analyzer</h3>
              <p style="opacity: 0.7; font-size: 0.875rem;">Pattern Analysis</p>
            </div>
          </div>
          <p>Analyzes patterns and identifies optimization opportunities</p>
          <span class="agent-status">
            <div class="pulse"></div>
            Active
          </span>
          <div class="agent-stats">
            <div>Patterns found: <span id="analyzer-patterns">0</span></div>
            <div>Avg analysis time: <span id="analyzer-time">0ms</span></div>
          </div>
        </div>

        <div class="agent-card">
          <div class="agent-header">
            <div class="agent-icon">🔮</div>
            <div>
              <h3>Predictor</h3>
              <p style="opacity: 0.7; font-size: 0.875rem;">Future Forecasting</p>
            </div>
          </div>
          <p>Predicts future cleanup needs and growth patterns</p>
          <span class="agent-status">
            <div class="pulse"></div>
            Active
          </span>
          <div class="agent-stats">
            <div>Predictions: <span id="predictor-count">0</span></div>
            <div>Accuracy: <span id="predictor-accuracy">0%</span></div>
          </div>
        </div>

        <div class="agent-card">
          <div class="agent-header">
            <div class="agent-icon">🗺️</div>
            <div>
              <h3>Context Mapper</h3>
              <p style="opacity: 0.7; font-size: 0.875rem;">Dependency Mapping</p>
            </div>
          </div>
          <p>Maps relationships and dependencies between resources</p>
          <span class="agent-status">
            <div class="pulse"></div>
            Active
          </span>
          <div class="agent-stats">
            <div>Relationships: <span id="mapper-relations">0</span></div>
            <div>Clusters: <span id="mapper-clusters">0</span></div>
          </div>
        </div>

        <div class="agent-card">
          <div class="agent-header">
            <div class="agent-icon">🎭</div>
            <div>
              <h3>Role Discoverer</h3>
              <p style="opacity: 0.7; font-size: 0.875rem;">Purpose Identification</p>
            </div>
          </div>
          <p>Identifies file roles and purposes in the system</p>
          <span class="agent-status">
            <div class="pulse"></div>
            Active
          </span>
          <div class="agent-stats">
            <div>Roles identified: <span id="role-count">0</span></div>
            <div>Confidence: <span id="role-confidence">0%</span></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Recommendations Page -->
    <div class="page" id="page-recommendations">
      <h1 style="margin-bottom: 2rem;">Cleanup Recommendations</h1>

      <div class="card">
        <div class="card-header">
          <h2 class="card-title">Recommended Actions</h2>
          <button onclick="loadRecommendations()" class="secondary">Refresh</button>
        </div>
        <div id="recommendations-list">
          <div style="text-align: center; opacity: 0.5; padding: 2rem;">
            <p>Run a sweep to get recommendations</p>
            <button onclick="triggerSweep('full')" style="margin-top: 1rem;" class="success">Run Full Sweep</button>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    // State
    let currentPage = 'overview';
    let activityLog = [];
    let sweepHistory = [];
    let pendingAction = null;

    // Navigation
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const page = tab.dataset.page;
        switchPage(page);
      });
    });

    function switchPage(page) {
      currentPage = page;

      // Update tabs
      document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.page === page);
      });

      // Update pages
      document.querySelectorAll('.page').forEach(p => {
        p.classList.toggle('active', p.id === \`page-\${page}\`);
      });

      // Load data for page
      if (page === 'discoveries') loadDiscoveries();
      if (page === 'recommendations') loadRecommendations();
    }

    // Confirmation modal
    function showModal(header, body, info, confirmText, confirmClass, onConfirm) {
      const modal = document.getElementById('confirmModal');
      const modalHeader = document.getElementById('modalHeader');
      const modalBody = document.getElementById('modalBody');
      const modalInfo = document.getElementById('modalInfo');
      const confirmBtn = document.getElementById('modalConfirmBtn');

      modalHeader.textContent = header;
      modalBody.textContent = body;

      if (info) {
        modalInfo.textContent = info;
        modalInfo.style.display = 'block';
      } else {
        modalInfo.style.display = 'none';
      }

      confirmBtn.textContent = confirmText;
      confirmBtn.className = confirmClass;

      pendingAction = onConfirm;
      modal.classList.add('active');
    }

    function closeModal() {
      document.getElementById('confirmModal').classList.remove('active');
      pendingAction = null;
    }

    function confirmAction() {
      if (pendingAction) {
        pendingAction();
      }
      closeModal();
    }

    // Cleanup actions
    function confirmCleanup(action, path, size) {
      const actionText = action.toUpperCase();
      const icon = action === 'delete' ? '🗑️' : action === 'archive' ? '📦' : '🔧';

      showModal(
        \`\${icon} Confirm \${actionText}\`,
        \`Are you sure you want to \${action} this item?\`,
        \`Path: \${path}\\nSize: \${size}\`,
        \`Yes, \${actionText}\`,
        action === 'delete' ? 'danger' : 'success',
        () => executeCleanup(action, path)
      );
    }

    async function executeCleanup(action, path) {
      addActivity(\`\${action.toUpperCase()}: \${path}...\`, 'info');

      // Lock all action buttons during execution
      const buttons = document.querySelectorAll('.discovery-actions button');
      buttons.forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.5';
      });

      try {
        // Simulate cleanup action (would be real API call)
        await new Promise(resolve => setTimeout(resolve, 1500));

        // Show success
        addActivity(\`✓ Successfully \${action}d: \${path}\`, 'success');

        // Remove item from list
        const items = document.querySelectorAll('.discovery-item');
        items.forEach(item => {
          if (item.textContent.includes(path)) {
            item.style.opacity = '0';
            setTimeout(() => item.remove(), 300);
          }
        });

        refreshData();
      } catch (error) {
        addActivity(\`✗ Failed to \${action}: \${error.message}\`, 'error');
      } finally {
        // Unlock buttons
        buttons.forEach(btn => {
          btn.disabled = false;
          btn.style.opacity = '1';
        });
      }
    }

    function skipRecommendation(path) {
      addActivity(\`Skipped: \${path}\`, 'info');

      // Remove from list
      const items = document.querySelectorAll('.discovery-item');
      items.forEach(item => {
        if (item.textContent.includes(path)) {
          item.style.opacity = '0';
          setTimeout(() => item.remove(), 300);
        }
      });
    }

    // Trigger sweep
    async function triggerSweep(mode) {
      showModal(
        '🚀 Confirm Sweep',
        \`Start a \${mode} sweep of your system?\`,
        'This will scan for cleanup opportunities and generate recommendations.',
        'Start Sweep',
        'success',
        () => executeSweep(mode)
      );
    }

    async function executeSweep(mode) {
      addActivity(\`Starting \${mode} sweep...\`, 'info');

      // Lock sweep buttons
      const sweepBtns = document.querySelectorAll('button');
      sweepBtns.forEach(btn => {
        if (btn.textContent.includes('Sweep') || btn.textContent.includes('Scan')) {
          btn.disabled = true;
          btn.innerHTML = '<div class="spinner"></div> Running...';
        }
      });

      try {
        const response = await fetch('/api/sweep', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode })
        });

        const result = await response.json();

        if (result.success) {
          addActivity(\`✓ Sweep completed: \${result.discoveries} discoveries, \${result.decisions} decisions\`, 'success');
          sweepHistory.unshift(result);
          refreshData();
        } else {
          addActivity(\`✗ Sweep failed: \${result.error}\`, 'error');
        }
      } catch (error) {
        addActivity(\`✗ Error: \${error.message}\`, 'error');
      } finally {
        // Unlock sweep buttons
        sweepBtns.forEach(btn => {
          if (btn.innerHTML.includes('Running')) {
            btn.disabled = false;
            if (btn.innerHTML.includes('Full')) {
              btn.innerHTML = '🚀 Full Sweep';
            } else if (btn.innerHTML.includes('Quick')) {
              btn.innerHTML = '⚡ Quick Scan';
            }
          }
        });
      }
    }

    // Load discoveries
    async function loadDiscoveries() {
      try {
        const response = await fetch('/api/discoveries?limit=50');
        const data = await response.json();

        const list = document.getElementById('discovery-list');
        if (data.discoveries.length === 0) {
          list.innerHTML = '<div style="text-align: center; opacity: 0.5; padding: 2rem;">No discoveries yet</div>';
          return;
        }

        list.innerHTML = data.discoveries.map(d => \`
          <div class="discovery-item">
            <div class="discovery-info">
              <div class="discovery-path">\${d.path}</div>
              <div class="discovery-meta">
                <span class="badge info">\${d.type}</span>
                <span>\${d.size || 'Unknown size'}</span>
                <span>Priority: \${d.priority}/10</span>
                <span>\${new Date(d.timestamp).toLocaleString()}</span>
              </div>
            </div>
            <div class="discovery-actions">
              <button onclick="viewDiscovery('\${d.path}')">View</button>
            </div>
          </div>
        \`).join('');
      } catch (error) {
        console.error('Failed to load discoveries:', error);
      }
    }

    // Load recommendations
    async function loadRecommendations() {
      const list = document.getElementById('recommendations-list');
      list.innerHTML = '<div style="text-align: center;"><div class="spinner"></div><p style="margin-top: 1rem;">Loading recommendations...</p></div>';

      // This would fetch actual recommendations from the sweep results
      // For now showing example structure
      setTimeout(() => {
        list.innerHTML = \`
          <div class="discovery-list">
            <div class="discovery-item">
              <div class="discovery-info">
                <div class="discovery-path">/tmp/.cache</div>
                <div class="discovery-meta">
                  <span class="badge success">Safe to clean</span>
                  <span>250 MB</span>
                  <span>Safety Score: 90/100</span>
                </div>
                <p style="margin-top: 0.5rem; opacity: 0.8;">Recommendation: DELETE - Large cache directory safe to clean</p>
              </div>
              <div class="discovery-actions">
                <button class="danger" onclick="confirmCleanup('delete', '/tmp/.cache', '250 MB')">Delete</button>
                <button class="secondary" onclick="skipRecommendation('/tmp/.cache')">Skip</button>
              </div>
            </div>
            <div class="discovery-item">
              <div class="discovery-info">
                <div class="discovery-path">/builds/dist-2024-09</div>
                <div class="discovery-meta">
                  <span class="badge warning">Review recommended</span>
                  <span>150 MB</span>
                  <span>Safety Score: 80/100</span>
                </div>
                <p style="margin-top: 0.5rem; opacity: 0.8;">Recommendation: ARCHIVE - Old build artifact, safe to archive</p>
              </div>
              <div class="discovery-actions">
                <button class="success" onclick="confirmCleanup('archive', '/builds/dist-2024-09', '150 MB')">Archive</button>
                <button class="secondary" onclick="skipRecommendation('/builds/dist-2024-09')">Skip</button>
              </div>
            </div>
          </div>
        \`;
      }, 500);
    }

    // Refresh data
    async function refreshData() {
      try {
        const response = await fetch('/api/metrics?period=24h');
        const data = await response.json();
        const m = data.metrics;

        document.getElementById('metric-bytes').textContent =
          (m.totalBytesCleaned / 1024 / 1024).toFixed(1) + ' MB';
        document.getElementById('metric-files').textContent =
          m.totalFilesProcessed.toLocaleString();
        document.getElementById('metric-success').textContent =
          m.successRate + '%';
        document.getElementById('metric-sweeps').textContent =
          m.totalSweeps;

        addActivity('Metrics refreshed', 'info');
      } catch (error) {
        console.error('Failed to refresh:', error);
      }
    }

    // Add activity
    function addActivity(message, type = 'info') {
      const feed = document.getElementById('activity-feed');
      const item = document.createElement('div');
      item.className = 'activity-item new';

      let icon = '•';
      if (type === 'success') icon = '✓';
      if (type === 'error') icon = '✗';
      if (type === 'warning') icon = '⚠';

      item.innerHTML = \`
        <div>\${icon} \${message}</div>
        <div class="activity-time">\${new Date().toLocaleTimeString()}</div>
      \`;

      if (feed.children.length === 0 || feed.children[0].textContent.includes('No recent')) {
        feed.innerHTML = '';
      }

      feed.insertBefore(item, feed.firstChild);

      // Keep only last 20 items
      while (feed.children.length > 20) {
        feed.removeChild(feed.lastChild);
      }

      // Update count
      document.getElementById('activity-count').textContent = feed.children.length + ' events';
    }

    function viewDiscovery(path) {
      alert('Viewing: ' + path);
    }

    function viewRecommendations() {
      switchPage('recommendations');
    }

    // Initial load
    refreshData();
    addActivity('Dashboard initialized', 'success');

    // Auto-refresh every 10 seconds
    setInterval(() => {
      refreshData();
      if (currentPage === 'discoveries') loadDiscoveries();
    }, 10000);
  </script>
</body>
</html>`;
}
