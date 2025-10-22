/**
 * ChittyCLI Complete Pipeline Orchestrator
 * Manages the end-to-end evidence processing flow
 */

import crypto from 'crypto';
import { DataOrchestrator } from './data-architecture.mjs';
import { AdvancedOrchestrator } from './cloudflare-advanced.mjs';
import { validate, isReservedCommand } from './index.mjs';
import fallback from './fallback.mjs';

export class PipelineOrchestrator {
  constructor() {
    this.data = new DataOrchestrator();
    this.advanced = new AdvancedOrchestrator();
    this.stages = new Map();
    this.metrics = new PipelineMetrics();
  }

  /**
   * COMPLETE PIPELINE EXECUTION
   */
  async execute(chittyId, evidence, options = {}) {
    const execution = new PipelineExecution(chittyId, evidence, options);

    try {
      console.log(`🚀 Starting pipeline for ChittyID: ${chittyId}`);
      execution.start();

      // Stage 1: Validation Pipeline
      await this.validationStage(execution);

      // Stage 2: Ingestion Pipeline
      await this.ingestionStage(execution);

      // Stage 3: Advanced Processing Pipeline
      await this.advancedStage(execution);

      // Stage 4: AI Enrichment Pipeline
      await this.aiStage(execution);

      // Stage 5: Minting Decision Pipeline
      await this.mintingStage(execution);

      // Stage 6: Storage & Sync Pipeline
      await this.storageStage(execution);

      // Stage 7: Monitoring Pipeline
      await this.monitoringStage(execution);

      execution.complete();
      return execution.getResult();

    } catch (error) {
      execution.fail(error);
      await this.handleError(execution, error);
      throw error;
    }
  }

  /**
   * STAGE 1: VALIDATION PIPELINE
   */
  async validationStage(execution) {
    execution.enterStage('validation');

    // 1. Format Validation
    try {
      await validate(execution.chittyId);
      execution.addResult('format_valid', true);
    } catch (error) {
      execution.addResult('format_valid', false);
      execution.addResult('format_error', error.message);

      // Check if it's a fallback ID
      const fallbackStatus = fallback.decodeFallbackStatus(execution.chittyId);
      if (fallbackStatus?.isFallback) {
        execution.addResult('fallback_detected', fallbackStatus);
        return this.handleFallback(execution, fallbackStatus);
      }

      throw error;
    }

    // 2. Reserved Command Check
    const reserved = isReservedCommand(execution.chittyId);
    if (reserved.isReserved) {
      execution.addResult('reserved_command', reserved);
      return this.handleReservedCommand(execution, reserved);
    }

    // 3. Security Validation
    await this.securityValidation(execution);

    execution.exitStage('validation');
  }

  async securityValidation(execution) {
    const securityChecks = [
      { name: 'injection_scan', check: () => this.scanForInjection(execution.evidence) },
      { name: 'pii_detection', check: () => this.detectPII(execution.evidence) },
      { name: 'malware_scan', check: () => this.scanMalware(execution.evidence) }
    ];

    for (const check of securityChecks) {
      const result = await check.check();
      execution.addResult(`security_${check.name}`, result);

      if (result.blocked) {
        throw new Error(`Security check failed: ${check.name} - ${result.reason}`);
      }
    }
  }

  /**
   * STAGE 2: INGESTION PIPELINE
   */
  async ingestionStage(execution) {
    execution.enterStage('ingestion');

    // 1. Hash Generation
    const hash = crypto.createHash('sha256')
      .update(execution.evidence.content)
      .digest('hex');
    execution.addResult('content_hash', hash);

    // 2. R2 Storage
    const storageResult = await this.data.cloudflare.storeEvidence(
      execution.chittyId,
      execution.evidence.content,
      execution.evidence.metadata
    );
    execution.addResult('r2_storage', storageResult);

    // 3. D1 Tracking
    await this.data.cloudflare.trackEvidence(execution.chittyId, storageResult);
    execution.addResult('d1_tracked', true);

    execution.exitStage('ingestion');
  }

  /**
   * STAGE 3: ADVANCED PROCESSING PIPELINE
   */
  async advancedStage(execution) {
    execution.enterStage('advanced');

    const tasks = [];

    // Browser Rendering Pipeline
    if (execution.evidence.url) {
      tasks.push(this.browserPipeline(execution));
    }

    // Container Processing Pipeline
    if (execution.options.useContainer) {
      tasks.push(this.containerPipeline(execution));
    }

    // Image Processing Pipeline
    if (execution.evidence.type === 'image') {
      tasks.push(this.imagePipeline(execution));
    }

    // Privacy Pipeline
    if (execution.options.redactPII) {
      tasks.push(this.privacyPipeline(execution));
    }

    // Execute all advanced pipelines in parallel
    const results = await Promise.all(tasks);
    execution.addResult('advanced_processing', results);

    execution.exitStage('advanced');
  }

  async browserPipeline(execution) {
    const browser = this.advanced.browser;
    const result = await browser.captureWebEvidence(
      execution.evidence.url,
      execution.chittyId
    );
    return { type: 'browser', result };
  }

  async containerPipeline(execution) {
    const containers = this.advanced.containers;
    const result = await containers.runIsolatedAnalysis(
      execution.chittyId,
      execution.evidence.content
    );
    return { type: 'container', result };
  }

  async imagePipeline(execution) {
    const images = this.advanced.images;
    const result = await images.processEvidenceImage(
      execution.chittyId,
      execution.evidence.content
    );
    return { type: 'image', result };
  }

  async privacyPipeline(execution) {
    const privacy = this.advanced.privacy;
    const result = await privacy.redactPII(
      execution.chittyId,
      execution.evidence.content
    );

    // Update evidence with redacted content
    execution.evidence.content = result.redacted;
    execution.addResult('pii_redacted', result.piiDetected);

    return { type: 'privacy', result };
  }

  /**
   * STAGE 4: AI ENRICHMENT PIPELINE
   */
  async aiStage(execution) {
    execution.enterStage('ai');

    // 1. LLaMA Analysis
    const analysis = await this.performAIAnalysis(execution);
    execution.addResult('ai_analysis', analysis);

    // 2. Vectorization
    const vectors = await this.data.cloudflare.vectorize.process(
      execution.evidence.content,
      execution.chittyId
    );
    execution.addResult('vectors', vectors);

    // 3. Classification
    const classification = await this.classifyEvidence(execution, analysis);
    execution.addResult('classification', classification);

    // 4. Critical Score
    const criticalScore = this.calculateCriticalScore(execution);
    execution.addResult('critical_score', criticalScore);

    execution.exitStage('ai');
  }

  async performAIAnalysis(execution) {
    // Simulated AI analysis - replace with actual Cloudflare AI
    return {
      confidence: Math.random() * 100,
      legalSignificance: Math.random() > 0.5,
      keyFacts: ['fact1', 'fact2', 'fact3'],
      sentiment: 'neutral',
      language: 'en'
    };
  }

  async classifyEvidence(execution, analysis) {
    const categories = ['legal', 'financial', 'medical', 'personal', 'business'];
    const category = categories[Math.floor(Math.random() * categories.length)];

    return {
      category,
      confidence: analysis.confidence,
      subcategory: `${category}_document`,
      tags: ['evidence', category]
    };
  }

  calculateCriticalScore(execution) {
    const factors = {
      aiConfidence: execution.getResult('ai_analysis').confidence || 0,
      legalBinding: execution.evidence.metadata?.legalBinding || false,
      courtEvidence: execution.evidence.metadata?.courtEvidence || false,
      classification: execution.getResult('classification').category
    };

    let score = factors.aiConfidence;
    if (factors.legalBinding) score += 20;
    if (factors.courtEvidence) score += 30;
    if (factors.classification === 'legal') score += 15;

    return Math.min(score, 100);
  }

  /**
   * STAGE 5: MINTING DECISION PIPELINE
   */
  async mintingStage(execution) {
    execution.enterStage('minting');

    const criticalScore = execution.getResult('critical_score');
    const classification = execution.getResult('classification');

    // Minting decision logic
    const shouldHardMint = (
      criticalScore > 95 ||
      classification.category === 'legal' ||
      execution.evidence.metadata?.courtEvidence ||
      execution.evidence.metadata?.contractual
    );

    if (shouldHardMint) {
      // Hard Mint Pipeline (1%)
      await this.hardMintPipeline(execution);
    } else {
      // Soft Mint Pipeline (99%)
      await this.softMintPipeline(execution);
    }

    execution.exitStage('minting');
  }

  async hardMintPipeline(execution) {
    console.log(`⛓️ Hard minting ${execution.chittyId}`);

    // 1. Gas estimation
    const gasEstimate = await this.data.chain.estimateGas();
    execution.addResult('gas_estimate', gasEstimate);

    // 2. Blockchain transaction
    const txResult = await this.data.chain.hardMint(
      execution.chittyId,
      execution.getResult('content_hash'),
      execution.evidence.metadata
    );
    execution.addResult('blockchain_tx', txResult);
    execution.addResult('minting_type', 'HARD');

    // 3. Store proof
    await this.data.cloudflare.kv.put(`chain:${execution.chittyId}`, txResult);
  }

  async softMintPipeline(execution) {
    console.log(`💾 Soft minting ${execution.chittyId}`);

    // 1. KV storage with TTL
    const softResult = await this.data.cloudflare.kv.softMint(
      execution.chittyId,
      {
        hash: execution.getResult('content_hash'),
        analysis: execution.getResult('ai_analysis'),
        classification: execution.getResult('classification')
      }
    );
    execution.addResult('soft_mint', softResult);
    execution.addResult('minting_type', 'SOFT');
  }

  /**
   * STAGE 6: STORAGE & SYNC PIPELINE
   */
  async storageStage(execution) {
    execution.enterStage('storage');

    // Parallel storage operations
    const storageOps = [
      this.neonSync(execution),
      this.notionSync(execution),
      this.githubSync(execution)
    ];

    const results = await Promise.all(storageOps);
    execution.addResult('storage_sync', results);

    execution.exitStage('storage');
  }

  async neonSync(execution) {
    return this.data.neon.trackChittyId(
      execution.chittyId,
      'PIPELINE_COMPLETE',
      {
        stages: execution.stages,
        results: execution.results,
        duration: execution.getDuration()
      }
    );
  }

  async notionSync(execution) {
    return this.data.notion.syncEvidence(execution.chittyId, {
      hash: execution.getResult('content_hash'),
      status: 'PROCESSED',
      mintingStatus: execution.getResult('minting_type'),
      confidence: execution.getResult('ai_analysis').confidence
    });
  }

  async githubSync(execution) {
    if (execution.options.createIssue) {
      return this.data.github.createIssueForEvidence(
        execution.chittyId,
        execution.getResult('r2_storage')
      );
    }
    return null;
  }

  /**
   * STAGE 7: MONITORING PIPELINE
   */
  async monitoringStage(execution) {
    execution.enterStage('monitoring');

    // Record metrics
    await this.metrics.record({
      chittyId: execution.chittyId,
      duration: execution.getDuration(),
      stages: execution.stages.size,
      status: execution.status,
      minting_type: execution.getResult('minting_type'),
      critical_score: execution.getResult('critical_score')
    });

    // Update system status
    await this.updateSystemStatus(execution);

    execution.exitStage('monitoring');
  }

  async updateSystemStatus(execution) {
    const status = {
      lastProcessed: execution.chittyId,
      timestamp: new Date().toISOString(),
      success: execution.status === 'completed',
      duration: execution.getDuration()
    };

    await this.data.cloudflare.kv.put('status:current', status, 3600);
  }

  /**
   * ERROR HANDLING
   */
  async handleError(execution, error) {
    console.error(`❌ Pipeline failed for ${execution.chittyId}:`, error.message);

    // Store error for analysis
    await this.data.cloudflare.kv.put(`error:${execution.chittyId}`, {
      error: error.message,
      stack: error.stack,
      stage: execution.currentStage,
      timestamp: new Date().toISOString(),
      results: execution.results
    });

    // Dead letter queue
    await this.data.cloudflare.r2.put(
      `/errors/${Date.now()}/${execution.chittyId}.json`,
      JSON.stringify({
        chittyId: execution.chittyId,
        error: error.message,
        execution: execution.toJSON()
      })
    );
  }

  // Utility methods for security checks
  async scanForInjection(evidence) {
    // Basic injection detection
    const dangerous = ['<script', 'javascript:', 'eval(', 'DROP TABLE'];
    const content = evidence.content.toString().toLowerCase();

    for (const pattern of dangerous) {
      if (content.includes(pattern.toLowerCase())) {
        return { blocked: true, reason: `Injection detected: ${pattern}` };
      }
    }

    return { blocked: false };
  }

  async detectPII(evidence) {
    // Basic PII detection
    const piiPatterns = [
      /\d{3}-\d{2}-\d{4}/, // SSN
      /\d{4}-\d{4}-\d{4}-\d{4}/, // Credit card
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/ // Email
    ];

    const content = evidence.content.toString();
    const detected = [];

    for (const pattern of piiPatterns) {
      if (pattern.test(content)) {
        detected.push(pattern.source);
      }
    }

    return { blocked: false, detected };
  }

  async scanMalware(evidence) {
    // Placeholder for malware scanning
    return { blocked: false };
  }

  async handleFallback(execution, fallbackStatus) {
    execution.addResult('fallback_action', await fallback.handleFallbackId(execution.chittyId));
    return execution.getResult();
  }

  async handleReservedCommand(execution, reserved) {
    execution.addResult('command_result', `Executed: ${reserved.command}`);
    return execution.getResult();
  }
}

/**
 * Pipeline Execution Context
 */
class PipelineExecution {
  constructor(chittyId, evidence, options) {
    this.chittyId = chittyId;
    this.evidence = evidence;
    this.options = options;
    this.startTime = Date.now();
    this.stages = new Map();
    this.results = new Map();
    this.status = 'starting';
    this.currentStage = null;
  }

  start() {
    this.status = 'running';
    console.log(`📊 Pipeline execution started for ${this.chittyId}`);
  }

  complete() {
    this.status = 'completed';
    this.endTime = Date.now();
    console.log(`✅ Pipeline completed for ${this.chittyId} in ${this.getDuration()}ms`);
  }

  fail(error) {
    this.status = 'failed';
    this.endTime = Date.now();
    this.error = error;
    console.log(`❌ Pipeline failed for ${this.chittyId} after ${this.getDuration()}ms`);
  }

  enterStage(stageName) {
    this.currentStage = stageName;
    this.stages.set(stageName, { startTime: Date.now() });
    console.log(`  🔄 Entering stage: ${stageName}`);
  }

  exitStage(stageName) {
    const stage = this.stages.get(stageName);
    stage.endTime = Date.now();
    stage.duration = stage.endTime - stage.startTime;
    console.log(`  ✅ Completed stage: ${stageName} (${stage.duration}ms)`);
    this.currentStage = null;
  }

  addResult(key, value) {
    this.results.set(key, value);
  }

  getResult(key) {
    return this.results.get(key);
  }

  getDuration() {
    return (this.endTime || Date.now()) - this.startTime;
  }

  getResult() {
    return {
      chittyId: this.chittyId,
      status: this.status,
      duration: this.getDuration(),
      stages: Object.fromEntries(this.stages),
      results: Object.fromEntries(this.results),
      error: this.error?.message
    };
  }

  toJSON() {
    return this.getResult();
  }
}

/**
 * Pipeline Metrics Collection
 */
class PipelineMetrics {
  constructor() {
    this.metrics = new Map();
  }

  async record(data) {
    const key = `metrics:${Date.now()}`;
    this.metrics.set(key, {
      ...data,
      timestamp: new Date().toISOString()
    });

    // Emit to analytics
    console.log(`📈 Metrics recorded:`, data);
  }

  getMetrics() {
    return Array.from(this.metrics.values());
  }
}

export default PipelineOrchestrator;