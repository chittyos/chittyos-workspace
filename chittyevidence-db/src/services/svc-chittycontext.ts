// ============================================
// CHITTYID / CONTEXTCONSCIOUSNESS INTEGRATION
// Provenance, Experience, Expertise, Accountability
// ============================================

import { Env } from '../types';
import { generateId, safeJsonParse } from '../utils';
import type {
  ChittyContext,
  ContextType,
  ContextStatus,
  ContextGrade,
  AuditEvent,
} from '@chittyos/core';
import {
  createContext,
  contextFromRequest,
  createAuditEvent,
  scoreToGrade,
} from '@chittyos/core';

// Re-export canonical types for convenience
export type { ChittyContext, ContextType, ContextStatus, ContextGrade, AuditEvent };
export { createContext, contextFromRequest, createAuditEvent, scoreToGrade };

/**
 * ChittyContextService provides identity-aware provenance tracking:
 * - WHO performed an action (ChittyID via ChittyConnect)
 * - WHAT context they were operating in (ContextConsciousness)
 * - HOW their expertise has grown (experience tracking)
 * - WHERE the outcomes can be traced (provenance chains)
 * - WHEN accountability is needed (audit trails)
 */

// ============================================
// EVIDENCE-SPECIFIC TYPES
// (extend canonical types for domain needs)
// ============================================

/**
 * EvidenceIdentity - Local identity cache that syncs with ChittyConnect
 * The canonical ChittyID is managed by ChittyConnect; this is the local representation
 */
export interface EvidenceIdentity {
  id: string;  // Canonical ChittyID from ChittyConnect
  type: 'user' | 'agent' | 'service' | 'workflow';
  name: string;
  credentials?: {
    publicKey?: string;
    attestations?: Attestation[];
  };
  metadata?: Record<string, unknown>;
  createdAt: string;
  syncedAt?: string;  // Last sync with ChittyConnect
}

export interface Attestation {
  id: string;
  issuer: string;
  claim: string;
  evidence?: string;
  issuedAt: string;
  expiresAt?: string;
  signature?: string;
}

export interface ContextSession {
  id: string;
  chittyId: string;
  sessionType: 'extraction' | 'review' | 'correction' | 'query' | 'audit';
  startedAt: string;
  endedAt?: string;
  state: Record<string, any>;
  parentSessionId?: string; // For nested contexts
  metadata?: Record<string, any>;
}

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

export interface ExpertiseProfile {
  chittyId: string;
  domain: string;
  metrics: {
    totalActions: number;
    successfulActions: number;
    accuracyRate: number;
    lastActiveAt: string;
  };
  competencies: Competency[];
  certifications: Certification[];
}

export interface Competency {
  skill: string;
  level: 'novice' | 'intermediate' | 'proficient' | 'expert';
  evidenceCount: number;
  lastDemonstrated: string;
}

export interface Certification {
  name: string;
  issuedBy: string;
  issuedAt: string;
  expiresAt?: string;
  verificationUrl?: string;
}

export interface AccountabilityRecord {
  id: string;
  chittyId: string;
  sessionId?: string;
  action: string;
  outcome: 'success' | 'failure' | 'pending' | 'disputed';
  impact: {
    documentsAffected: number;
    entitiesAffected: number;
    authoritiesAffected: number;
  };
  verification?: {
    verifiedBy: string;
    verifiedAt: string;
    notes?: string;
  };
  disputeInfo?: {
    raisedBy: string;
    raisedAt: string;
    reason: string;
    resolution?: string;
    resolvedAt?: string;
  };
  timestamp: string;
}

// ============================================
// SCHEMA ADDITIONS (add to migrations)
// ============================================

export const CHITTY_CONTEXT_SCHEMA = `
-- ChittyID Registry
CREATE TABLE IF NOT EXISTS chitty_ids (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    credentials JSON,
    metadata JSON,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Context Sessions (ContextConsciousness)
CREATE TABLE IF NOT EXISTS context_sessions (
    id TEXT PRIMARY KEY,
    chitty_id TEXT NOT NULL REFERENCES chitty_ids(id),
    session_type TEXT NOT NULL,
    started_at TEXT DEFAULT (datetime('now')),
    ended_at TEXT,
    state JSON,
    parent_session_id TEXT REFERENCES context_sessions(id),
    metadata JSON
);

-- Provenance Chain
CREATE TABLE IF NOT EXISTS provenance_records (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    chitty_id TEXT NOT NULL REFERENCES chitty_ids(id),
    session_id TEXT REFERENCES context_sessions(id),
    previous_state_hash TEXT,
    new_state_hash TEXT NOT NULL,
    delta JSON,
    attestations JSON,
    timestamp TEXT DEFAULT (datetime('now'))
);

-- Expertise Tracking
CREATE TABLE IF NOT EXISTS expertise_profiles (
    chitty_id TEXT NOT NULL REFERENCES chitty_ids(id),
    domain TEXT NOT NULL,
    total_actions INTEGER DEFAULT 0,
    successful_actions INTEGER DEFAULT 0,
    accuracy_rate REAL DEFAULT 0,
    last_active_at TEXT,
    competencies JSON,
    certifications JSON,
    PRIMARY KEY (chitty_id, domain)
);

-- Accountability Records
CREATE TABLE IF NOT EXISTS accountability_records (
    id TEXT PRIMARY KEY,
    chitty_id TEXT NOT NULL REFERENCES chitty_ids(id),
    session_id TEXT REFERENCES context_sessions(id),
    action TEXT NOT NULL,
    outcome TEXT NOT NULL,
    impact JSON,
    verification JSON,
    dispute_info JSON,
    timestamp TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_provenance_entity ON provenance_records(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_provenance_chitty ON provenance_records(chitty_id);
CREATE INDEX IF NOT EXISTS idx_provenance_session ON provenance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_chitty ON context_sessions(chitty_id);
CREATE INDEX IF NOT EXISTS idx_accountability_chitty ON accountability_records(chitty_id);
CREATE INDEX IF NOT EXISTS idx_accountability_outcome ON accountability_records(outcome);
`;

// ============================================
// SERVICE IMPLEMENTATION
// ============================================

export class ChittyContextService {
  constructor(private env: Env) {}

  // ============================================
  // CHITTYID MANAGEMENT
  // ============================================

  async registerChittyId(input: {
    type: EvidenceIdentity['type'];
    name: string;
    metadata?: Record<string, any>;
  }): Promise<EvidenceIdentity> {
    const id = `chitty_${generateId()}`;

    await this.env.DB.prepare(
      `INSERT INTO chitty_ids (id, type, name, metadata)
       VALUES (?, ?, ?, ?)`
    ).bind(id, input.type, input.name, JSON.stringify(input.metadata || {})).run();

    return {
      id,
      type: input.type,
      name: input.name,
      metadata: input.metadata,
      createdAt: new Date().toISOString(),
    };
  }

  async getChittyId(id: string): Promise<EvidenceIdentity | null> {
    const result = await this.env.DB.prepare(
      `SELECT * FROM chitty_ids WHERE id = ?`
    ).bind(id).first();

    if (!result) return null;

    return {
      id: result.id as string,
      type: result.type as EvidenceIdentity['type'],
      name: result.name as string,
      credentials: safeJsonParse(result.credentials as string, undefined),
      metadata: safeJsonParse(result.metadata as string, {}),
      createdAt: result.created_at as string,
    };
  }

  async addAttestation(chittyId: string, attestation: Omit<Attestation, 'id'>): Promise<Attestation> {
    const id = generateId();
    const fullAttestation: Attestation = { id, ...attestation };

    const current = await this.env.DB.prepare(
      `SELECT credentials FROM chitty_ids WHERE id = ?`
    ).bind(chittyId).first<{ credentials: string }>();

    const credentials = safeJsonParse<{ attestations?: Attestation[] }>(
      current?.credentials,
      { attestations: [] }
    );

    credentials.attestations = credentials.attestations || [];
    credentials.attestations.push(fullAttestation);

    await this.env.DB.prepare(
      `UPDATE chitty_ids SET credentials = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(JSON.stringify(credentials), chittyId).run();

    return fullAttestation;
  }

  // ============================================
  // CONTEXT SESSIONS (ContextConsciousness)
  // ============================================

  async startSession(input: {
    chittyId: string;
    sessionType: ContextSession['sessionType'];
    parentSessionId?: string;
    initialState?: Record<string, any>;
    metadata?: Record<string, any>;
  }): Promise<ContextSession> {
    const id = `session_${generateId()}`;

    await this.env.DB.prepare(
      `INSERT INTO context_sessions (id, chitty_id, session_type, state, parent_session_id, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      input.chittyId,
      input.sessionType,
      JSON.stringify(input.initialState || {}),
      input.parentSessionId || null,
      JSON.stringify(input.metadata || {})
    ).run();

    return {
      id,
      chittyId: input.chittyId,
      sessionType: input.sessionType,
      startedAt: new Date().toISOString(),
      state: input.initialState || {},
      parentSessionId: input.parentSessionId,
      metadata: input.metadata,
    };
  }

  async updateSessionState(sessionId: string, state: Record<string, any>): Promise<void> {
    await this.env.DB.prepare(
      `UPDATE context_sessions SET state = ? WHERE id = ?`
    ).bind(JSON.stringify(state), sessionId).run();
  }

  async endSession(sessionId: string, finalState?: Record<string, any>): Promise<void> {
    if (finalState) {
      await this.env.DB.prepare(
        `UPDATE context_sessions SET state = ?, ended_at = datetime('now') WHERE id = ?`
      ).bind(JSON.stringify(finalState), sessionId).run();
    } else {
      await this.env.DB.prepare(
        `UPDATE context_sessions SET ended_at = datetime('now') WHERE id = ?`
      ).bind(sessionId).run();
    }
  }

  async getSession(sessionId: string): Promise<ContextSession | null> {
    const result = await this.env.DB.prepare(
      `SELECT * FROM context_sessions WHERE id = ?`
    ).bind(sessionId).first();

    if (!result) return null;

    return {
      id: result.id as string,
      chittyId: result.chitty_id as string,
      sessionType: result.session_type as ContextSession['sessionType'],
      startedAt: result.started_at as string,
      endedAt: result.ended_at as string | undefined,
      state: safeJsonParse(result.state as string, {}),
      parentSessionId: result.parent_session_id as string | undefined,
      metadata: safeJsonParse(result.metadata as string, {}),
    };
  }

  async getSessionHistory(chittyId: string, limit = 50): Promise<ContextSession[]> {
    const results = await this.env.DB.prepare(
      `SELECT * FROM context_sessions WHERE chitty_id = ? ORDER BY started_at DESC LIMIT ?`
    ).bind(chittyId, limit).all();

    return (results.results as any[]).map((r) => ({
      id: r.id,
      chittyId: r.chitty_id,
      sessionType: r.session_type,
      startedAt: r.started_at,
      endedAt: r.ended_at,
      state: safeJsonParse(r.state, {}),
      parentSessionId: r.parent_session_id,
      metadata: safeJsonParse(r.metadata, {}),
    }));
  }

  // ============================================
  // PROVENANCE TRACKING
  // ============================================

  async recordProvenance(input: {
    entityType: ProvenanceRecord['entityType'];
    entityId: string;
    action: string;
    chittyId: string;
    sessionId?: string;
    previousState?: any;
    newState: any;
    attestations?: string[];
  }): Promise<ProvenanceRecord> {
    const id = generateId();

    // Compute state hashes
    const previousStateHash = input.previousState
      ? await this.hashState(input.previousState)
      : undefined;
    const newStateHash = await this.hashState(input.newState);

    // Compute delta if we have both states
    const delta = input.previousState
      ? this.computeDelta(input.previousState, input.newState)
      : undefined;

    await this.env.DB.prepare(
      `INSERT INTO provenance_records
       (id, entity_type, entity_id, action, chitty_id, session_id, previous_state_hash, new_state_hash, delta, attestations)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      input.entityType,
      input.entityId,
      input.action,
      input.chittyId,
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
      chittyId: input.chittyId,
      sessionId: input.sessionId,
      previousStateHash,
      newStateHash,
      delta,
      timestamp: new Date().toISOString(),
      attestations: input.attestations,
    };
  }

  async getProvenanceChain(
    entityType: string,
    entityId: string
  ): Promise<ProvenanceRecord[]> {
    const results = await this.env.DB.prepare(
      `SELECT pr.*, ci.name as actor_name, ci.type as actor_type
       FROM provenance_records pr
       JOIN chitty_ids ci ON pr.chitty_id = ci.id
       WHERE pr.entity_type = ? AND pr.entity_id = ?
       ORDER BY pr.timestamp ASC`
    ).bind(entityType, entityId).all();

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
  }

  async verifyProvenance(entityType: string, entityId: string): Promise<{
    valid: boolean;
    breaks: { index: number; expected: string; actual: string }[];
  }> {
    const chain = await this.getProvenanceChain(entityType, entityId);
    const breaks: { index: number; expected: string; actual: string }[] = [];

    for (let i = 1; i < chain.length; i++) {
      const previous = chain[i - 1];
      const current = chain[i];

      if (current.previousStateHash && current.previousStateHash !== previous.newStateHash) {
        breaks.push({
          index: i,
          expected: previous.newStateHash,
          actual: current.previousStateHash,
        });
      }
    }

    return { valid: breaks.length === 0, breaks };
  }

  // ============================================
  // EXPERTISE TRACKING
  // ============================================

  async recordAction(input: {
    chittyId: string;
    domain: string;
    action: string;
    success: boolean;
    competencyDemonstrated?: string;
  }): Promise<void> {
    // Get or create expertise profile
    const existing = await this.env.DB.prepare(
      `SELECT * FROM expertise_profiles WHERE chitty_id = ? AND domain = ?`
    ).bind(input.chittyId, input.domain).first();

    if (existing) {
      const newTotal = (existing.total_actions as number) + 1;
      const newSuccessful = (existing.successful_actions as number) + (input.success ? 1 : 0);
      const newAccuracy = newSuccessful / newTotal;

      let competencies = safeJsonParse<Competency[]>(existing.competencies as string, []);

      if (input.competencyDemonstrated) {
        competencies = this.updateCompetency(competencies, input.competencyDemonstrated);
      }

      await this.env.DB.prepare(
        `UPDATE expertise_profiles
         SET total_actions = ?, successful_actions = ?, accuracy_rate = ?, last_active_at = datetime('now'), competencies = ?
         WHERE chitty_id = ? AND domain = ?`
      ).bind(newTotal, newSuccessful, newAccuracy, JSON.stringify(competencies), input.chittyId, input.domain).run();
    } else {
      const competencies = input.competencyDemonstrated
        ? [{ skill: input.competencyDemonstrated, level: 'novice', evidenceCount: 1, lastDemonstrated: new Date().toISOString() }]
        : [];

      await this.env.DB.prepare(
        `INSERT INTO expertise_profiles (chitty_id, domain, total_actions, successful_actions, accuracy_rate, last_active_at, competencies, certifications)
         VALUES (?, ?, 1, ?, ?, datetime('now'), ?, '[]')`
      ).bind(input.chittyId, input.domain, input.success ? 1 : 0, input.success ? 1.0 : 0.0, JSON.stringify(competencies)).run();
    }
  }

  private updateCompetency(competencies: Competency[], skill: string): Competency[] {
    const existing = competencies.find((c) => c.skill === skill);

    if (existing) {
      existing.evidenceCount++;
      existing.lastDemonstrated = new Date().toISOString();

      // Level up based on evidence count
      if (existing.evidenceCount >= 100) existing.level = 'expert';
      else if (existing.evidenceCount >= 50) existing.level = 'proficient';
      else if (existing.evidenceCount >= 10) existing.level = 'intermediate';
    } else {
      competencies.push({
        skill,
        level: 'novice',
        evidenceCount: 1,
        lastDemonstrated: new Date().toISOString(),
      });
    }

    return competencies;
  }

  async getExpertiseProfile(chittyId: string): Promise<ExpertiseProfile[]> {
    const results = await this.env.DB.prepare(
      `SELECT * FROM expertise_profiles WHERE chitty_id = ?`
    ).bind(chittyId).all();

    return (results.results as any[]).map((r) => ({
      chittyId: r.chitty_id,
      domain: r.domain,
      metrics: {
        totalActions: r.total_actions,
        successfulActions: r.successful_actions,
        accuracyRate: r.accuracy_rate,
        lastActiveAt: r.last_active_at,
      },
      competencies: safeJsonParse(r.competencies, []),
      certifications: safeJsonParse(r.certifications, []),
    }));
  }

  async addCertification(
    chittyId: string,
    domain: string,
    certification: Certification
  ): Promise<void> {
    const existing = await this.env.DB.prepare(
      `SELECT certifications FROM expertise_profiles WHERE chitty_id = ? AND domain = ?`
    ).bind(chittyId, domain).first<{ certifications: string }>();

    const certifications = safeJsonParse<Certification[]>(existing?.certifications, []);
    certifications.push(certification);

    await this.env.DB.prepare(
      `UPDATE expertise_profiles SET certifications = ? WHERE chitty_id = ? AND domain = ?`
    ).bind(JSON.stringify(certifications), chittyId, domain).run();
  }

  // ============================================
  // ACCOUNTABILITY
  // ============================================

  async recordAccountability(input: {
    chittyId: string;
    sessionId?: string;
    action: string;
    outcome: AccountabilityRecord['outcome'];
    impact: AccountabilityRecord['impact'];
  }): Promise<AccountabilityRecord> {
    const id = generateId();

    await this.env.DB.prepare(
      `INSERT INTO accountability_records (id, chitty_id, session_id, action, outcome, impact)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      input.chittyId,
      input.sessionId || null,
      input.action,
      input.outcome,
      JSON.stringify(input.impact)
    ).run();

    return {
      id,
      chittyId: input.chittyId,
      sessionId: input.sessionId,
      action: input.action,
      outcome: input.outcome,
      impact: input.impact,
      timestamp: new Date().toISOString(),
    };
  }

  async verifyAccountability(
    recordId: string,
    verifiedBy: string,
    notes?: string
  ): Promise<void> {
    const verification = {
      verifiedBy,
      verifiedAt: new Date().toISOString(),
      notes,
    };

    await this.env.DB.prepare(
      `UPDATE accountability_records SET verification = ? WHERE id = ?`
    ).bind(JSON.stringify(verification), recordId).run();
  }

  async disputeAccountability(
    recordId: string,
    disputedBy: string,
    reason: string
  ): Promise<void> {
    const disputeInfo = {
      raisedBy: disputedBy,
      raisedAt: new Date().toISOString(),
      reason,
    };

    await this.env.DB.prepare(
      `UPDATE accountability_records SET outcome = 'disputed', dispute_info = ? WHERE id = ?`
    ).bind(JSON.stringify(disputeInfo), recordId).run();
  }

  async resolveDispute(
    recordId: string,
    resolution: string,
    newOutcome: AccountabilityRecord['outcome']
  ): Promise<void> {
    const existing = await this.env.DB.prepare(
      `SELECT dispute_info FROM accountability_records WHERE id = ?`
    ).bind(recordId).first<{ dispute_info: string }>();

    const disputeInfo = safeJsonParse<any>(existing?.dispute_info, {});
    disputeInfo.resolution = resolution;
    disputeInfo.resolvedAt = new Date().toISOString();

    await this.env.DB.prepare(
      `UPDATE accountability_records SET outcome = ?, dispute_info = ? WHERE id = ?`
    ).bind(newOutcome, JSON.stringify(disputeInfo), recordId).run();
  }

  async getAccountabilityReport(chittyId: string): Promise<{
    profile: EvidenceIdentity | null;
    expertise: ExpertiseProfile[];
    recentActions: AccountabilityRecord[];
    stats: {
      totalActions: number;
      successRate: number;
      disputeRate: number;
      verificationRate: number;
    };
  }> {
    const profile = await this.getChittyId(chittyId);
    const expertise = await this.getExpertiseProfile(chittyId);

    const recentActions = await this.env.DB.prepare(
      `SELECT * FROM accountability_records WHERE chitty_id = ? ORDER BY timestamp DESC LIMIT 50`
    ).bind(chittyId).all();

    const stats = await this.env.DB.prepare(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) as successes,
         SUM(CASE WHEN outcome = 'disputed' THEN 1 ELSE 0 END) as disputes,
         SUM(CASE WHEN verification IS NOT NULL THEN 1 ELSE 0 END) as verified
       FROM accountability_records WHERE chitty_id = ?`
    ).bind(chittyId).first<{
      total: number;
      successes: number;
      disputes: number;
      verified: number;
    }>();

    return {
      profile,
      expertise,
      recentActions: (recentActions.results as any[]).map((r) => ({
        id: r.id,
        chittyId: r.chitty_id,
        sessionId: r.session_id,
        action: r.action,
        outcome: r.outcome,
        impact: safeJsonParse(r.impact, { documentsAffected: 0, entitiesAffected: 0, authoritiesAffected: 0 }),
        verification: safeJsonParse(r.verification, undefined),
        disputeInfo: safeJsonParse(r.dispute_info, undefined),
        timestamp: r.timestamp,
      })) as AccountabilityRecord[],
      stats: {
        totalActions: stats?.total || 0,
        successRate: stats?.total ? (stats.successes / stats.total) : 0,
        disputeRate: stats?.total ? (stats.disputes / stats.total) : 0,
        verificationRate: stats?.total ? (stats.verified / stats.total) : 0,
      },
    };
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private async hashState(state: any): Promise<string> {
    const stateString = JSON.stringify(state, Object.keys(state).sort());
    const encoder = new TextEncoder();
    const data = encoder.encode(stateString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  private computeDelta(oldState: any, newState: any): Record<string, { old: any; new: any }> {
    const delta: Record<string, { old: any; new: any }> = {};
    const allKeys = new Set([...Object.keys(oldState || {}), ...Object.keys(newState || {})]);

    for (const key of allKeys) {
      const oldVal = oldState?.[key];
      const newVal = newState?.[key];

      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        delta[key] = { old: oldVal, new: newVal };
      }
    }

    return delta;
  }
}
