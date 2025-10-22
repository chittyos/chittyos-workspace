# ChittySweep Architecture

## 🏗️ System Overview

ChittySweep is a multi-agent cleanup system built on Cloudflare Workers, using Workers AI for intelligent decision-making. It coordinates five specialized agents through a central orchestrator.

## 🧠 Agent Swarm Architecture

```
                    ┌─────────────────────────┐
                    │  Agent Orchestrator     │
                    │  (Durable Object)       │
                    └───────────┬─────────────┘
                                │
                    ┌───────────┴───────────┐
                    │   Cloudflare AI       │
                    │   Decision Synthesis  │
                    └───────────┬───────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
    Phase 1               Phase 2-3                 Phase 4-5
        │                       │                       │
        v                       v                       v
  ┌──────────┐      ┌────────────────────┐      ┌──────────────┐
  │  Scout   │      │  Analyzer          │      │  Predictor   │
  │  Agent   │──┐   │  Context Mapper    │──┐   │  Agent       │
  └──────────┘  │   │  Role Discoverer   │  │   └──────────────┘
                │   └────────────────────┘  │
                │                           │
                v                           v
          ┌──────────┐              ┌──────────────┐
          │   KV:    │              │     R2:      │
          │ Discover │              │  Audit Logs  │
          └──────────┘              └──────────────┘
```

## 🔄 Execution Flow

### 1. Sweep Initialization
```javascript
POST /api/sweep
{
  "mode": "full|quick|targeted",
  "targets": ["optional", "specific", "paths"]
}
```

### 2. Phase Execution

**Phase 1: Discovery (Scout Agent)**
- Scans system for cleanup opportunities
- Identifies caches, old artifacts, logs, duplicates
- Prioritizes by size, age, and type
- Output: Array of discoveries with metadata

**Phase 2-3: Analysis & Mapping (Parallel)**
- **Analyzer**: Calculates efficiency scores, patterns
- **Context Mapper**: Maps dependencies and relationships
- **Role Discoverer**: Identifies file purposes and classifications
- Output: Contextual understanding of discovered items

**Phase 4: Prediction (Predictor Agent)**
- Forecasts future cleanup needs
- Analyzes growth rates
- Recommends optimal sweep schedules
- Output: Predictions and recommendations

**Phase 5: AI Synthesis**
- Orchestrator sends all agent outputs to Workers AI
- AI generates cleanup decisions with safety scores
- Only decisions with safetyScore >= 70 are approved
- Output: Prioritized action list

## 🗄️ Data Storage

### KV Namespaces

**SWEEP_STATE**
- Current sweep state
- Sweep history (last 100)
- Orchestrator status
- TTL: 7 days

**SWEEP_DISCOVERIES**
- Individual discoveries from Scout
- Metadata and classifications
- TTL: 30 days

**SWEEP_METRICS**
- Sweep performance metrics
- Agent execution stats
- Efficiency scores
- TTL: 90 days

### R2 Buckets

**chittysweep-logs**
- Detailed sweep reports
- Audit trail of all actions
- AI decision logs
- Long-term storage (no TTL)

### Durable Objects

**AgentOrchestrator**
- Single instance per account
- Named ID: "default"
- Coordinates all agent execution
- Maintains sweep state machine

**AgentState**
- One instance per agent type
- Named IDs: "scout", "analyzer", etc.
- Executes agent-specific logic
- Maintains agent execution context

## 🤖 Agent Implementations

### Scout Agent
```javascript
// Discovers cleanup opportunities
{
  type: 'cache|old_artifact|large_log|duplicate',
  path: '/path/to/item',
  size: '250MB',
  priority: 1-10,
  timestamp: ISO8601
}
```

**Discovery Patterns:**
- Cache directories (*.cache, .npm, .yarn, etc.)
- Build artifacts older than 30 days
- Log files larger than 10MB
- Duplicate large files

### Analyzer Agent
```javascript
// Analyzes patterns and efficiency
{
  totalSize: bytes,
  byType: { cache: count, artifact: count },
  highPriority: count,
  efficiencyScores: [{
    target: string,
    efficiency: bytes_per_ms,
    totalSavings: bytes
  }],
  optimalOrder: [targets...]
}
```

### Context Mapper Agent
```javascript
// Maps relationships
{
  dependencies: [{from: path, to: path, type: string}],
  clusters: {
    '/dir': [discoveries...],
    ...
  }
}
```

### Role Discoverer Agent
```javascript
// Identifies file roles
{
  path: string,
  role: 'temporary|artifact|dependency|critical',
  confidence: 0.0-1.0,
  reasons: [string...]
}
```

### Predictor Agent
```javascript
// Forecasts future needs
{
  nextSweepRecommended: timestamp,
  growthRate: 'low|moderate|high',
  items: [{
    type: string,
    predictedSize: string,
    timeframe: string
  }]
}
```

## 🧪 AI Decision Synthesis

### Input to Workers AI
```javascript
{
  discoveries: [...],
  analysis: {...},
  contextMap: {...},
  roles: [...],
  predictions: {...}
}
```

### AI Model
- **Model**: `@cf/meta/llama-3.1-8b-instruct`
- **Max Tokens**: 2048
- **Temperature**: Default
- **System Prompt**: "You are an intelligent janitor AI"

### Output Format
```javascript
[
  {
    path: '/path/to/clean',
    action: 'delete|archive|compress|skip',
    reason: 'explanation',
    priority: 1-5,
    safetyScore: 0-100,
    estimatedSavings: 'size'
  }
]
```

### Safety Filters
- `safetyScore >= 70` required for execution
- Rule-based fallback if AI fails
- Context-aware dependency checking
- Manual review flag for edge cases

## ⏱️ Cron Schedule

### Full Sweep (Daily)
```
0 2 * * *  (2 AM UTC)
```
- All agents execute
- Complete AI synthesis
- Comprehensive cleanup

### Quick Scan (Every 6 hours)
```
0 */6 * * *
```
- Scout + Analyzer only
- Quick wins
- High-priority targets

### Metric Collection (Every 15 min)
```
*/15 * * * *
```
- Lightweight metrics
- Trend tracking
- No cleanup actions

## 🌐 API Architecture

### HTTP Routes

```
GET  /health                    → Health check
GET  /                          → Dashboard UI
GET  /api/agents/status         → Agent status
POST /api/sweep                 → Trigger sweep
GET  /api/discoveries           → List discoveries
GET  /api/metrics               → Get metrics
GET  /api/agent/{name}/{action} → Agent-specific endpoint
```

### Internal Routes (Durable Objects)

```
Orchestrator:
  GET  /status    → Get orchestrator status
  POST /sweep     → Execute coordinated sweep

AgentState:
  POST /execute   → Execute specific agent
```

## 🔐 Security Model

### Authentication
- Public endpoints: `/health`, `/dashboard`
- Protected endpoints: Require ChittyOS auth token
- Internal Durable Object calls: Not exposed externally

### Authorization
- Read operations: Anyone with valid token
- Write operations: Admin role required
- Sweep execution: Service account or admin

### Data Privacy
- Discoveries contain path metadata only
- No file contents stored
- Audit logs track all actions
- GDPR-compliant retention (90 days max for metrics)

## 📊 Performance Characteristics

### Latency
- Health check: <10ms
- Agent status: <50ms
- Trigger sweep: <100ms (async execution)
- Full sweep: 30-60 seconds (scheduled, async)

### Throughput
- Handles 1000+ requests/minute
- Durable Object coordination: <100ms overhead
- AI synthesis: 2-5 seconds (batched)

### Resource Usage
- CPU: 10-50ms per request
- Memory: KV storage only (minimal worker memory)
- AI: ~2048 tokens per decision synthesis

## 🔄 State Machine

```
Sweep States:
  pending → running → completed
                   → failed

Agent States (per phase):
  pending → running → completed
                   → failed

Orchestrator State:
  online → executing → online
        → error → online (recovery)
```

## 🎯 Design Decisions

### Why Durable Objects?
- Coordination requires shared state
- Strong consistency for sweep orchestration
- Built-in persistence for history

### Why Cloudflare AI?
- Integrated with Workers platform
- Low latency (edge execution)
- No external API calls needed
- Cost-effective

### Why Multi-Agent?
- Separation of concerns
- Parallel execution where possible
- Easier to test and debug
- Extensible (add new agents)

### Why KV + R2?
- KV for fast access, short TTL
- R2 for long-term audit storage
- Cost optimization

## 🚀 Future Enhancements

### Planned Features
- [ ] Machine learning-based pattern detection
- [ ] Integration with ChittyLedger for evidence tracking
- [ ] Webhook notifications for sweep completion
- [ ] Custom agent plugins
- [ ] Multi-account support
- [ ] Sweep scheduling UI
- [ ] Real-time dashboard with WebSockets
- [ ] Advanced analytics and reporting

### Scalability Path
1. Add more agent types (security scanner, optimizer, etc.)
2. Multi-region deployment
3. Vectorize for similarity detection
4. Custom AI model training on historical data

---

**ChittySweep Architecture** - Intelligent, autonomous, and scalable
