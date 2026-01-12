/**
 * Provenance Capabilities
 *
 * These are the ONLY way to interact with provenance functionality.
 * Every invocation is instrumented, every outcome tracked.
 *
 * Architecture:
 * - Capabilities export only (no raw functions)
 * - Downstream capabilities require upstream provenance
 * - Automatic rollout based on success metrics
 */

import {
  defineCapability,
  CapabilityResult,
  CapabilityOutcome,
  Provenance,
  isSuccess,
  requireProvenance,
} from '@chittyos/core';
import type { ChittyContext, CapabilityStateStore } from '@chittyos/core';
import { Env } from '../types';
import { generateId, safeJsonParse } from '../utils';
import { CapabilityStateStore as DomainStateStore } from '../services/svc-capabilitystate';

// ============================================================
// Types
// ============================================================

export interface ProvenanceRecord {
  id: string;
  entityType: 'document' | 'entity' | 'authority' | 'gap' | 'correction';
  entityId: string;
  action: string;
  chittyId: string;
  sessionId?: string;
  previousStateHash?: string;
  newStateHash: string;
  delta?: Record<string, any>;
  timestamp: string;
  attestations?: string[];
}

export interface ProvenanceVerificationResult {
  valid: boolean;
  chainLength: number;
  breaks: Array<{
    index: number;
    expected: string;
    actual: string;
    recordId: string;
  }>;
  firstRecord?: {
    id: string;
    action: string;
    timestamp: string;
    actor: string;
  };
  lastRecord?: {
    id: string;
    action: string;
    timestamp: string;
    actor: string;
  };
}

export interface RecordProvenanceInput {
  entityType: ProvenanceRecord['entityType'];
  entityId: string;
  action: string;
  previousState?: unknown;
  newState: unknown;
  sessionId?: string;
  attestations?: string[];
}

export interface GetProvenanceChainInput {
  entityType: string;
  entityId: string;
}

export interface VerifyProvenanceInput {
  entityType: string;
  entityId: string;
}

// Downstream capability: requires provenance from record capability
export interface CertifyProvenanceInput {
  // This REQUIRES output from verifyProvenance capability
  verificationResult: CapabilityResult<ProvenanceVerificationResult>;
  certifierNotes?: string;
}

export interface ProvenanceCertification {
  certificationId: string;
  entityType: string;
  entityId: string;
  verified: boolean;
  certifiedAt: string;
  certifiedBy: string;
  chainLength: number;
  notes?: string;
}

// ============================================================
// Helper Functions (internal only)
// ============================================================

async function hashState(state: unknown): Promise<string> {
  const stateString = JSON.stringify(state, Object.keys(state as object).sort());
  const encoder = new TextEncoder();
  const data = encoder.encode(stateString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function computeDelta(
  oldState: unknown,
  newState: unknown
): Record<string, { old: unknown; new: unknown }> {
  const delta: Record<string, { old: unknown; new: unknown }> = {};
  const oldObj = (oldState || {}) as Record<string, unknown>;
  const newObj = (newState || {}) as Record<string, unknown>;
  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

  for (const key of allKeys) {
    const oldVal = oldObj[key];
    const newVal = newObj[key];

    if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
      delta[key] = { old: oldVal, new: newVal };
    }
  }

  return delta;
}

// ============================================================
// Capability Factory
// ============================================================

/**
 * Adapter to make our DomainStateStore compatible with core's CapabilityStateStore interface
 */
function createStateStoreAdapter(domainStore: DomainStateStore): CapabilityStateStore {
  return {
    async recordInvocation(invocation) {
      await domainStore.recordInvocation(invocation);
    },
    async getMetrics(capabilityId) {
      // Try cached metrics first, fall back to fresh calculation
      const cached = await domainStore.getCachedMetrics(capabilityId);
      if (cached) return cached;
      return domainStore.calculateMetrics(capabilityId);
    },
    async getStatus(capabilityId) {
      const def = await domainStore.getDefinition(capabilityId);
      return def?.status || null;
    },
  };
}

/**
 * Create provenance capabilities bound to an environment
 * This is how Chemists expose capabilities - as a factory
 */
export function createProvenanceCapabilities(env: Env) {
  // Create the domain state store and adapter
  const domainStore = new DomainStateStore(env);
  const stateStore = createStateStoreAdapter(domainStore);
  // ============================================
  // CAPABILITY: Record Provenance
  // ============================================
  const recordProvenance = defineCapability<RecordProvenanceInput, ProvenanceRecord>({
    id: 'evidence.provenance.record',
    name: 'Record Provenance',
    version: '1.0.0',
    domain: 'evidence',
    description: 'Records a provenance entry for an entity state change with cryptographic hashing',
    status: 'general', // Mature capability
    requiredContextGrade: 'C',
    rolloutRules: [
      // Already general, but can be demoted if failure rate spikes
      { gate: 'failure_rate', threshold: 0.15, direction: 'demote', targetStatus: 'limited', windowHours: 24 },
      { gate: 'failure_rate', threshold: 0.30, direction: 'demote', targetStatus: 'quarantined', windowHours: 6 },
    ],
    tags: ['provenance', 'audit', 'core'],
    stateStore, // Persistent invocation tracking

    async handler(execCtx, input): Promise<ProvenanceRecord> {
      const id = generateId();
      const chittyId = execCtx.context.chittyId;

      // Compute state hashes
      const previousStateHash = input.previousState
        ? await hashState(input.previousState)
        : undefined;
      const newStateHash = await hashState(input.newState);

      // Compute delta if we have both states
      const delta = input.previousState
        ? computeDelta(input.previousState, input.newState)
        : undefined;

      await env.DB.prepare(
        `INSERT INTO provenance_records
         (id, entity_type, entity_id, action, chitty_id, session_id, previous_state_hash, new_state_hash, delta, attestations)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        input.entityType,
        input.entityId,
        input.action,
        chittyId,
        input.sessionId || null,
        previousStateHash || null,
        newStateHash,
        delta ? JSON.stringify(delta) : null,
        input.attestations ? JSON.stringify(input.attestations) : null
      ).run();

      return {
        id,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        chittyId,
        sessionId: input.sessionId,
        previousStateHash,
        newStateHash,
        delta,
        timestamp: new Date().toISOString(),
        attestations: input.attestations,
      };
    },
  });

  // ============================================
  // CAPABILITY: Get Provenance Chain
  // ============================================
  const getProvenanceChain = defineCapability<GetProvenanceChainInput, ProvenanceRecord[]>({
    id: 'evidence.provenance.getChain',
    name: 'Get Provenance Chain',
    version: '1.0.0',
    domain: 'evidence',
    description: 'Retrieves the complete provenance chain for an entity',
    status: 'general',
    requiredContextGrade: 'D', // Lower barrier for reads
    rolloutRules: [
      { gate: 'failure_rate', threshold: 0.20, direction: 'demote', targetStatus: 'quarantined', windowHours: 24 },
    ],
    tags: ['provenance', 'query', 'core'],
    stateStore,

    async handler(_execCtx, input): Promise<ProvenanceRecord[]> {
      const results = await env.DB.prepare(
        `SELECT pr.*, ci.name as actor_name, ci.type as actor_type
         FROM provenance_records pr
         LEFT JOIN chitty_ids ci ON pr.chitty_id = ci.id
         WHERE pr.entity_type = ? AND pr.entity_id = ?
         ORDER BY pr.timestamp ASC`
      ).bind(input.entityType, input.entityId).all();

      return (results.results as any[]).map((r) => ({
        id: r.id,
        entityType: r.entity_type,
        entityId: r.entity_id,
        action: r.action,
        chittyId: r.chitty_id,
        sessionId: r.session_id,
        previousStateHash: r.previous_state_hash,
        newStateHash: r.new_state_hash,
        delta: safeJsonParse(r.delta, undefined),
        timestamp: r.timestamp,
        attestations: safeJsonParse(r.attestations, []),
      }));
    },
  });

  // ============================================
  // CAPABILITY: Verify Provenance Chain
  // ============================================
  const verifyProvenance = defineCapability<VerifyProvenanceInput, ProvenanceVerificationResult>({
    id: 'evidence.provenance.verify',
    name: 'Verify Provenance Chain',
    version: '1.0.0',
    domain: 'evidence',
    description: 'Verifies the integrity of a provenance chain by checking hash continuity',
    status: 'limited', // Higher trust required for verification operations
    requiredContextGrade: 'B',
    dependencies: ['evidence.provenance.getChain'],
    rolloutRules: [
      { gate: 'usage_count', threshold: 500, direction: 'promote', targetStatus: 'general' },
      { gate: 'success_rate', threshold: 0.98, direction: 'promote', targetStatus: 'general', windowHours: 168 },
      { gate: 'failure_rate', threshold: 0.10, direction: 'demote', targetStatus: 'experimental', windowHours: 24 },
      { gate: 'failure_rate', threshold: 0.25, direction: 'demote', targetStatus: 'quarantined', windowHours: 6 },
    ],
    tags: ['provenance', 'verification', 'integrity'],
    stateStore,

    async handler(execCtx, input): Promise<ProvenanceVerificationResult> {
      // First, invoke getProvenanceChain capability (demonstrating chained invocation)
      const chainResult = await getProvenanceChain.invoke(
        execCtx.context,
        { entityType: input.entityType, entityId: input.entityId },
        execCtx.parentProvenances
      );

      // Require provenance from upstream - fails fast if chain retrieval failed
      requireProvenance(chainResult);

      const chain = chainResult.value;
      const breaks: ProvenanceVerificationResult['breaks'] = [];

      // Verify hash continuity
      for (let i = 1; i < chain.length; i++) {
        const previous = chain[i - 1];
        const current = chain[i];

        if (current.previousStateHash && current.previousStateHash !== previous.newStateHash) {
          breaks.push({
            index: i,
            expected: previous.newStateHash,
            actual: current.previousStateHash,
            recordId: current.id,
          });
        }
      }

      return {
        valid: breaks.length === 0,
        chainLength: chain.length,
        breaks,
        firstRecord: chain.length > 0 ? {
          id: chain[0].id,
          action: chain[0].action,
          timestamp: chain[0].timestamp,
          actor: chain[0].chittyId,
        } : undefined,
        lastRecord: chain.length > 0 ? {
          id: chain[chain.length - 1].id,
          action: chain[chain.length - 1].action,
          timestamp: chain[chain.length - 1].timestamp,
          actor: chain[chain.length - 1].chittyId,
        } : undefined,
      };
    },
  });

  // ============================================
  // CAPABILITY: Certify Provenance
  // Demonstrates REQUIRING upstream capability output
  // ============================================
  const certifyProvenance = defineCapability<CertifyProvenanceInput, ProvenanceCertification>({
    id: 'evidence.provenance.certify',
    name: 'Certify Provenance',
    version: '1.0.0',
    domain: 'evidence',
    description: 'Issues a certification for a verified provenance chain. REQUIRES verification result.',
    status: 'experimental', // New capability, needs validation
    requiredContextGrade: 'A', // Only highest-trust contexts
    dependencies: ['evidence.provenance.verify'],
    rolloutRules: [
      { gate: 'usage_count', threshold: 50, direction: 'promote', targetStatus: 'limited' },
      { gate: 'success_rate', threshold: 0.95, direction: 'promote', targetStatus: 'general', windowHours: 168 },
      { gate: 'failure_rate', threshold: 0.10, direction: 'demote', targetStatus: 'quarantined', windowHours: 24 },
    ],
    tags: ['provenance', 'certification', 'authority'],
    stateStore,

    async handler(execCtx, input): Promise<ProvenanceCertification> {
      // The input type REQUIRES a CapabilityResult - you can't bypass verification
      const verificationResult = input.verificationResult;

      // Extract the verification data from the capability result
      const verification = verificationResult.value;

      // Only certify valid chains
      if (!verification.valid) {
        const err = new Error('Cannot certify invalid provenance chain');
        (err as any).code = 'INVALID_CHAIN';
        throw err;
      }

      const certificationId = `cert_${generateId()}`;

      // Store certification (in production, this would go to a certifications table)
      await env.DB.prepare(
        `INSERT INTO provenance_records
         (id, entity_type, entity_id, action, chitty_id, session_id, new_state_hash, delta)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        certificationId,
        'certification',
        `${verification.firstRecord?.id || 'unknown'}:${verification.lastRecord?.id || 'unknown'}`,
        'certify_chain',
        execCtx.context.chittyId,
        null,
        await hashState({
          certified: true,
          chainLength: verification.chainLength,
          verificationProvenance: verificationResult.provenance.invocationId,
        }),
        JSON.stringify({
          old: null,
          new: {
            chainLength: verification.chainLength,
            certifiedBy: execCtx.context.chittyId,
            notes: input.certifierNotes,
            // Link to the verification that was required
            verificationProvenance: verificationResult.provenance.invocationId,
          },
        })
      ).run();

      return {
        certificationId,
        entityType: verification.firstRecord?.id ? 'document' : 'unknown',
        entityId: verification.firstRecord?.id || 'unknown',
        verified: verification.valid,
        certifiedAt: new Date().toISOString(),
        certifiedBy: execCtx.context.chittyId,
        chainLength: verification.chainLength,
        notes: input.certifierNotes,
      };
    },
  });

  // Return all capabilities and the store for direct access
  return {
    recordProvenance,
    getProvenanceChain,
    verifyProvenance,
    certifyProvenance,
    // Direct store access for admin operations
    store: domainStore,
  };
}

// ============================================================
// Type exports for consumers
// ============================================================

export type ProvenanceCapabilities = ReturnType<typeof createProvenanceCapabilities>;
