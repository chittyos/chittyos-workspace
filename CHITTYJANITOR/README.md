# ChittyJanitor - Adaptive AI Cleanup Agent

**Intelligent, self-learning cache cleanup system with predictive capabilities**

## Overview

ChittyJanitor is an autonomous agent that:
- ✅ Learns patterns and optimizes over time
- ✅ Discovers cleanup opportunities autonomously
- ✅ Understands environment and user habits
- ✅ Coordinates with colleague processes
- ✅ **Performs proactive predictive cleanup**
- ✅ **Organizes and improves UX automatically**
- ✅ **Designed for Cloudflare Workers with multi-model support**

## Architecture

```
ChittyJanitor (Core Agent)
├── Analyzer Assistant - Pattern analysis & efficiency scoring
├── Predictor Assistant - Predictive cleanup timing
├── Scout Assistant - Discovery & exploration
├── Role Discoverer - Auto-creates new assistants
└── Context Mapper - Environment awareness
```

## Local Usage

```bash
# Basic cleanup
/Users/nb/.claude/projects/-/chittychat/janitor-agent-adaptive.sh aggressive

# Proactive prediction
/Users/nb/.claude/projects/-/chittychat/janitor-assistants/predictor.sh

# Discover new roles
/Users/nb/.claude/projects/-/chittychat/janitor-assistants/role-discoverer.sh discover

# View intelligence
/Users/nb/.claude/projects/-/chittychat/janitor-agent-adaptive.sh intelligence
```

## Cloudflare Workers Deployment

ChittyJanitor is designed to run as a Cloudflare Worker with:

### Multi-Model Support
- **Claude (Anthropic)**: Strategic planning & pattern analysis
- **GPT-4 (OpenAI)**: Predictive modeling & forecasting
- **Gemini (Google)**: Large-scale data analysis
- **LLaMA (Meta/Replicate)**: Fast, cost-effective operations

### Architecture for CF Workers

```typescript
// worker.ts
interface JanitorConfig {
  models: {
    planner: 'claude-3-5-sonnet',
    predictor: 'gpt-4-turbo',
    analyzer: 'gemini-pro',
    executor: 'llama-3-70b'
  },
  schedule: '0 */6 * * *',  // Every 6 hours
  adaptive: true
}
```

### Key Features for Cloudflare

1. **Proactive Predictive Cleanup**
   - Analyzes usage patterns
   - Predicts disk pressure before it happens
   - Schedules cleanup during low-activity periods

2. **UX Organization**
   - Auto-categorizes cleanup targets
   - Generates user-friendly reports
   - Creates actionable insights dashboard

3. **Multi-Model Orchestration**
   - Routes tasks to optimal models
   - Cost optimization via model selection
   - Fallback chains for reliability

## Cloudflare Workers Integration

### 1. Create Worker

```bash
cd /Users/nb/.claude/projects/-/CHITTYJANITOR
npm init -y
npm install -D wrangler @cloudflare/workers-types
```

### 2. Configure `wrangler.toml`

```toml
name = "chitty-janitor"
main = "src/worker.ts"
compatibility_date = "2025-01-15"

[triggers]
crons = ["0 */6 * * *"]

[vars]
ENVIRONMENT = "production"

[[kv_namespaces]]
binding = "JANITOR_STATE"
id = "your-kv-namespace-id"

[[r2_buckets]]
binding = "JANITOR_METRICS"
bucket_name = "chitty-janitor-metrics"
```

### 3. Multi-Model Router

```typescript
// src/models/router.ts
export class ModelRouter {
  async route(task: JanitorTask): Promise<ModelProvider> {
    switch (task.type) {
      case 'analyze':
        return new ClaudeProvider();
      case 'predict':
        return new GPT4Provider();
      case 'discover':
        return new GeminiProvider();
      case 'execute':
        return new LlamaProvider();
      default:
        return new ClaudeProvider();
    }
  }
}
```

### 4. Predictive Engine

```typescript
// src/predictor.ts
export class PredictiveJanitor {
  async predictCleanupNeeds(): Promise<CleanupPrediction> {
    const metrics = await this.getHistoricalMetrics();
    const patterns = await this.analyzePatterns(metrics);

    return {
      nextCleanup: this.calculateOptimalTime(patterns),
      expectedSavings: this.forecastSavings(patterns),
      priority: this.assessPriority(patterns)
    };
  }

  async proactiveCleanup(): Promise<void> {
    const prediction = await this.predictCleanupNeeds();

    if (prediction.priority > 7) {
      await this.executeCleanup('aggressive');
    } else if (prediction.priority > 4) {
      await this.executeCleanup('conservative');
    }
  }
}
```

### 5. UX Dashboard

```typescript
// src/dashboard.ts
export class JanitorDashboard {
  async generate(): Promise<DashboardData> {
    return {
      overview: await this.getOverview(),
      predictions: await this.getPredictions(),
      insights: await this.generateInsights(),
      recommendations: await this.getRecommendations(),
      timeline: await this.getCleanupTimeline()
    };
  }

  private async generateInsights(): Promise<Insight[]> {
    const model = new ClaudeProvider();
    return await model.analyze({
      task: 'Generate user-friendly insights',
      data: await this.getMetrics()
    });
  }
}
```

## State Persistence

Uses Cloudflare KV for persistent state:

```typescript
interface JanitorState {
  intelligence_level: number;
  total_runs: number;
  total_saved_bytes: number;
  patterns: PatternMap;
  predictions: PredictionHistory;
  discovered_roles: Role[];
}
```

## API Endpoints

```typescript
// GET /status - Current status & intelligence
// GET /predict - Predictive analysis
// POST /cleanup - Trigger cleanup
// GET /insights - UX-friendly insights
// GET /dashboard - Full dashboard data
```

## Deployment

```bash
# Deploy to Cloudflare
cd /Users/nb/.claude/projects/-/CHITTYJANITOR
wrangler deploy

# Set secrets
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put OPENAI_API_KEY
wrangler secret put GOOGLE_API_KEY
```

## Intelligence Features

### Proactive Predictions
- **Disk Pressure Forecasting**: Predicts when disk will reach capacity
- **Optimal Timing**: Determines best cleanup windows
- **Pattern Recognition**: Learns user activity patterns

### UX Organization
- **Smart Categorization**: Groups cleanup targets by impact
- **Visual Reports**: Generates charts and insights
- **Actionable Recommendations**: Clear next steps

### Multi-Model Benefits
- **Cost Optimization**: Uses cheaper models for simple tasks
- **Performance**: Parallel processing across models
- **Reliability**: Automatic failover between providers

## Monitoring

```bash
# View logs
wrangler tail

# Check metrics
curl https://chitty-janitor.workers.dev/status
```

## Evolution

ChittyJanitor continuously:
- Discovers new cleanup targets
- Creates specialized assistant roles
- Optimizes cleanup strategies
- Improves prediction accuracy
- Enhances user experience

---

**Version**: 3.0.0
**Status**: Production Ready
**License**: MIT
**ChittyOS Integration**: Full
