# ChittySync Workspace Optimization Module

**Version**: 1.0.0
**Created**: 2025-10-17
**Purpose**: Automated workspace token optimization via ChittySync
**Integration**: ChittySync Worker + Cloudflare Cron

---

## Executive Summary

Integrate workspace optimization (Phase 1-3) into ChittySync as an automated maintenance job. Run scheduled cleanup via Cloudflare Cron Triggers to ensure token efficiency remains optimal across all sessions.

**Goals**:
- Automate CLAUDE.md monitoring and consolidation
- Auto-archive completion/summary docs monthly
- Maintain clean git status (<50 untracked)
- Scheduled optimization: Daily + Weekly + Monthly
- Report optimization metrics via ChittySync API

---

## Architecture

### Integration Points

```
ChittySync Worker (gateway.chitty.cc/api/sync)
├── /api/sync/optimize           # Manual trigger
├── /api/sync/optimize/status    # Optimization metrics
└── /api/sync/optimize/schedule  # View scheduled jobs

Cloudflare Cron Triggers
├── 0 3 * * *    # Daily: Git cleanup
├── 0 4 * * 0    # Weekly: CLAUDE.md audit
└── 0 5 1 * *    # Monthly: Archive old docs
```

### Optimization Module Location

```
CHITTYOS/chittyos-services/chittysync/worker/src/
├── index.ts                    # Main worker (add routes)
├── optimize/
│   ├── workspace-optimizer.ts  # Core optimization logic
│   ├── claude-md-monitor.ts    # CLAUDE.md consolidation check
│   ├── doc-archiver.ts         # Archive completion docs
│   ├── git-cleaner.ts          # Git status optimization
│   └── metrics-reporter.ts     # Track optimization impact
└── types.ts                    # Add OptimizationMetrics type
```

---

## Implementation Design

### 1. Workspace Optimizer Core

**File**: `worker/src/optimize/workspace-optimizer.ts`

```typescript
import type { Env } from "../types";

export interface OptimizationMetrics {
  timestamp: number;
  claudeMdLines: {
    before: number;
    after: number;
    reduction: number;
  };
  gitStatus: {
    before: number;
    after: number;
    reduction: number;
  };
  archivedDocs: number;
  tokenSavingsEstimate: number; // Percentage
  status: "success" | "partial" | "failed";
  errors: string[];
}

export class WorkspaceOptimizer {
  constructor(
    private env: Env,
    private workspacePath: string = "/Users/nb/.claude/projects/-"
  ) {}

  async runOptimization(level: "daily" | "weekly" | "monthly"): Promise<OptimizationMetrics> {
    const metrics: OptimizationMetrics = {
      timestamp: Date.now(),
      claudeMdLines: { before: 0, after: 0, reduction: 0 },
      gitStatus: { before: 0, after: 0, reduction: 0 },
      archivedDocs: 0,
      tokenSavingsEstimate: 0,
      status: "success",
      errors: [],
    };

    try {
      // Daily: Git cleanup
      if (level === "daily") {
        await this.cleanGitStatus(metrics);
      }

      // Weekly: CLAUDE.md audit
      if (level === "weekly") {
        await this.auditClaudeMd(metrics);
      }

      // Monthly: Archive docs
      if (level === "monthly") {
        await this.archiveOldDocs(metrics);
      }

      // Calculate token savings
      metrics.tokenSavingsEstimate = this.calculateSavings(metrics);

      // Store metrics in D1
      await this.storeMetrics(metrics);

      return metrics;
    } catch (error) {
      metrics.status = "failed";
      metrics.errors.push(error.message);
      return metrics;
    }
  }

  private async cleanGitStatus(metrics: OptimizationMetrics): Promise<void> {
    // Run git status count
    // Check .gitignore effectiveness
    // Identify new artifacts to ignore
  }

  private async auditClaudeMd(metrics: OptimizationMetrics): Promise<void> {
    // Count lines in CLAUDE.md files
    // Check for duplication creep
    // Alert if exceeds thresholds
  }

  private async archiveOldDocs(metrics: OptimizationMetrics): Promise<void> {
    // Find *COMPLETE*.md, *SUMMARY*.md > 30 days old
    // Move to .archive/YYYY/MM/
    // Update metrics
  }

  private calculateSavings(metrics: OptimizationMetrics): number {
    // Estimate token reduction based on line counts
    const lineReduction = metrics.claudeMdLines.reduction + metrics.gitStatus.reduction;
    return Math.round((lineReduction / 1000) * 100); // Rough estimate
  }

  private async storeMetrics(metrics: OptimizationMetrics): Promise<void> {
    // Store in D1 database for historical tracking
    await this.env.CHITTY_SYNC_DB.prepare(
      `INSERT INTO optimization_metrics (timestamp, data) VALUES (?, ?)`
    ).bind(metrics.timestamp, JSON.stringify(metrics)).run();
  }
}
```

---

### 2. CLAUDE.md Monitor

**File**: `worker/src/optimize/claude-md-monitor.ts`

```typescript
export class ClaudeMdMonitor {
  private readonly CLAUDE_MD_PATHS = [
    "/Users/nb/.claude/CLAUDE.md",
    "/Users/nb/CLAUDE.md",
    "/Users/nb/.claude/projects/-/CLAUDE.md",
    "/Users/nb/.claude/projects/-/CLAUDE_CORE.md",
  ];

  private readonly THRESHOLDS = {
    core: 200,    // CLAUDE_CORE.md should be <200 lines
    global: 100,  // Global CLAUDE.md <100 lines
    project: 100, // Project CLAUDE.md <100 lines
  };

  async auditClaudeMd(): Promise<{
    compliant: boolean;
    violations: Array<{ file: string; lines: number; threshold: number }>;
    totalLines: number;
  }> {
    const violations = [];
    let totalLines = 0;

    for (const path of this.CLAUDE_MD_PATHS) {
      const lineCount = await this.countLines(path);
      totalLines += lineCount;

      const threshold = this.getThreshold(path);
      if (lineCount > threshold) {
        violations.push({ file: path, lines: lineCount, threshold });
      }
    }

    return {
      compliant: violations.length === 0,
      violations,
      totalLines,
    };
  }

  private async countLines(path: string): Promise<number> {
    // Execute wc -l via Workers subprocess or read file
    // For now, return estimate based on file size
    return 0; // Implement based on available APIs
  }

  private getThreshold(path: string): number {
    if (path.includes("CLAUDE_CORE")) return this.THRESHOLDS.core;
    if (path.includes("/.claude/CLAUDE.md")) return this.THRESHOLDS.global;
    return this.THRESHOLDS.project;
  }
}
```

---

### 3. Doc Archiver

**File**: `worker/src/optimize/doc-archiver.ts`

```typescript
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export class DocArchiver {
  private readonly ARCHIVE_PATH = "CHITTYOS/.archive";

  async archiveOldDocs(daysSinceModified: number = 30): Promise<number> {
    const archiveDir = `${this.ARCHIVE_PATH}/${new Date().getFullYear()}/${new Date().getMonth() + 1}`;

    // Find completion/summary docs older than threshold
    const findCmd = `find . -maxdepth 3 \\
      \\( -name "*COMPLETE*.md" -o -name "*SUMMARY*.md" -o -name "*SESSION*.md" \\) \\
      -mtime +${daysSinceModified} \\
      ! -path "*/node_modules/*" \\
      ! -path "*/.archive/*"`;

    const { stdout } = await execAsync(findCmd);
    const files = stdout.trim().split("\n").filter(Boolean);

    if (files.length === 0) return 0;

    // Create archive directory
    await execAsync(`mkdir -p ${archiveDir}`);

    // Move files
    for (const file of files) {
      await execAsync(`mv "${file}" "${archiveDir}/"`);
    }

    return files.length;
  }

  async getArchiveStats(): Promise<{
    totalArchived: number;
    oldestDate: string;
    newestDate: string;
  }> {
    const { stdout } = await execAsync(`find ${this.ARCHIVE_PATH} -name "*.md" | wc -l`);
    const totalArchived = parseInt(stdout.trim());

    return {
      totalArchived,
      oldestDate: "2025-01-01", // TODO: Implement actual date detection
      newestDate: new Date().toISOString(),
    };
  }
}
```

---

### 4. Git Cleaner

**File**: `worker/src/optimize/git-cleaner.ts`

```typescript
export class GitCleaner {
  async getGitStatus(): Promise<{ untrackedCount: number; modifiedCount: number }> {
    const { stdout } = await execAsync("git status --short");
    const lines = stdout.trim().split("\n");

    const untracked = lines.filter((l) => l.startsWith("??")).length;
    const modified = lines.filter((l) => l.startsWith(" M") || l.startsWith("M ")).length;

    return {
      untrackedCount: untracked,
      modifiedCount: modified,
    };
  }

  async suggestGitignoreAdditions(): Promise<string[]> {
    const { stdout } = await execAsync("git status --short | grep '^??' | head -20");
    const untrackedFiles = stdout.trim().split("\n");

    // Analyze patterns
    const patterns = new Set<string>();
    for (const line of untrackedFiles) {
      const file = line.replace(/^\?\?\s+/, "");

      // Check for common patterns
      if (file.includes("SUMMARY")) patterns.add("*SUMMARY*.md");
      if (file.includes("COMPLETE")) patterns.add("*COMPLETE*.md");
      if (file.includes("SESSION")) patterns.add("*SESSION*.md");
      if (file.endsWith(".backup")) patterns.add("*.backup");
      // Add more pattern detection
    }

    return Array.from(patterns);
  }
}
```

---

### 5. API Routes

**File**: `worker/src/index.ts` (add routes)

```typescript
// Add to main fetch handler

// POST /api/sync/optimize - Manual trigger
if (url.pathname === "/api/sync/optimize" && request.method === "POST") {
  return await handleOptimize(request, env);
}

// GET /api/sync/optimize/status - Get current metrics
if (url.pathname === "/api/sync/optimize/status" && request.method === "GET") {
  return await handleOptimizeStatus(env);
}

// GET /api/sync/optimize/history - Historical metrics
if (url.pathname === "/api/sync/optimize/history" && request.method === "GET") {
  return await handleOptimizeHistory(env);
}

// Handler implementations
async function handleOptimize(request: Request, env: Env): Promise<Response> {
  const { level } = await request.json() as { level: "daily" | "weekly" | "monthly" };

  const optimizer = new WorkspaceOptimizer(env);
  const metrics = await optimizer.runOptimization(level);

  return jsonResponse({ success: true, metrics });
}

async function handleOptimizeStatus(env: Env): Promise<Response> {
  // Get latest metrics from D1
  const result = await env.CHITTY_SYNC_DB.prepare(
    "SELECT * FROM optimization_metrics ORDER BY timestamp DESC LIMIT 1"
  ).first();

  return jsonResponse({ metrics: result ? JSON.parse(result.data) : null });
}
```

---

### 6. Cloudflare Cron Triggers

**File**: `wrangler.toml` (update)

```toml
[triggers]
crons = [
  "0 3 * * *",   # Daily at 3am UTC: Git cleanup
  "0 4 * * 0",   # Weekly Sunday 4am UTC: CLAUDE.md audit
  "0 5 1 * *"    # Monthly 1st 5am UTC: Archive old docs
]

# Add scheduled handler to worker
```

**File**: `worker/src/index.ts` (add scheduled handler)

```typescript
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // ... existing fetch handler
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const optimizer = new WorkspaceOptimizer(env);

    const hour = new Date().getUTCHours();
    const day = new Date().getUTCDay();
    const date = new Date().getUTCDate();

    // Daily at 3am UTC
    if (hour === 3) {
      await optimizer.runOptimization("daily");
    }

    // Weekly on Sunday at 4am UTC
    if (hour === 4 && day === 0) {
      await optimizer.runOptimization("weekly");
    }

    // Monthly on 1st at 5am UTC
    if (hour === 5 && date === 1) {
      await optimizer.runOptimization("monthly");
    }
  },
};
```

---

### 7. Database Schema

**File**: `migrations/0003_add_optimization_metrics.sql`

```sql
-- Optimization metrics tracking
CREATE TABLE IF NOT EXISTS optimization_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER NOT NULL,
  data TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_optimization_timestamp ON optimization_metrics(timestamp);
```

---

## Usage Examples

### Manual Trigger

```bash
# Trigger daily optimization
curl -X POST https://gateway.chitty.cc/api/sync/optimize \
  -H "Authorization: Bearer $CHITTY_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"level": "daily"}'

# Trigger weekly optimization
curl -X POST https://gateway.chitty.cc/api/sync/optimize \
  -H "Authorization: Bearer $CHITTY_ID_TOKEN" \
  -d '{"level": "weekly"}'

# Get current status
curl https://gateway.chitty.cc/api/sync/optimize/status \
  -H "Authorization: Bearer $CHITTY_ID_TOKEN"
```

### Response Format

```json
{
  "success": true,
  "metrics": {
    "timestamp": 1729180800000,
    "claudeMdLines": {
      "before": 301,
      "after": 301,
      "reduction": 0
    },
    "gitStatus": {
      "before": 202,
      "after": 45,
      "reduction": 157
    },
    "archivedDocs": 12,
    "tokenSavingsEstimate": 15,
    "status": "success",
    "errors": []
  }
}
```

---

## Monitoring & Alerts

### Slack Notifications

When optimization runs, post summary to Slack:

```typescript
async notifySlack(metrics: OptimizationMetrics): Promise<void> {
  const message = {
    text: `🧹 Workspace Optimization Complete`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Token Savings*: ~${metrics.tokenSavingsEstimate}%\n*Archived Docs*: ${metrics.archivedDocs}\n*Git Status Reduction*: ${metrics.gitStatus.reduction} files`,
        },
      },
    ],
  };

  await fetch(this.env.SLACK_WEBHOOK_URL, {
    method: "POST",
    body: JSON.stringify(message),
  });
}
```

### Dashboard Integration

Add optimization metrics to ChittySync dashboard:

```
/api/sync/dashboard → Include optimization section
- Last optimization: 2 hours ago
- Token savings: 45% (cumulative)
- Archived docs: 127 total
- Git status: 38 untracked (target: <50)
```

---

## Success Metrics

**Target KPIs**:
- CLAUDE.md total lines: <300 (currently 301 ✅)
- Git untracked files: <50 (currently ~200 ⚠️)
- Archived docs/month: >10
- Token savings: >40% vs baseline

**Alerts**:
- Warning: CLAUDE.md exceeds 350 lines
- Critical: Git untracked > 100 files
- Info: Monthly archive completed

---

## Implementation Phases

### Phase 1: Core Module (Week 1)
- ✅ Design complete (this doc)
- ⏳ Implement WorkspaceOptimizer class
- ⏳ Add API routes to ChittySync worker
- ⏳ Create D1 migration for metrics table

### Phase 2: Automation (Week 2)
- ⏳ Implement Cloudflare Cron handlers
- ⏳ Add CLAUDE.md monitoring
- ⏳ Add doc archiver
- ⏳ Add git cleaner

### Phase 3: Monitoring (Week 3)
- ⏳ Slack notifications
- ⏳ Dashboard integration
- ⏳ Historical metrics API
- ⏳ Alert system

---

## Security Considerations

- **Auth**: All endpoints require `CHITTY_ID_TOKEN`
- **Rate Limiting**: 1 manual trigger per hour
- **File Access**: Limited to workspace path only
- **Audit Trail**: All optimizations logged to D1

---

## Next Steps

1. Review this design
2. Create feature branch: `feature/workspace-optimization`
3. Implement Phase 1 (core module)
4. Deploy to staging for testing
5. Enable cron triggers in production

---

**Status**: Design Complete - Ready for Implementation
**Estimated Effort**: 3 weeks (1 week per phase)
**Dependencies**: ChittySync worker, Cloudflare Cron, D1 database
