/**
 * DRL Reckoning Engine
 *
 * Implements "Reckoning, not record" — assembles TY/VY/RY at query time
 * from every ledger entry that touched the entity, weighted by credibility
 * of contributing nodes.
 *
 * Per the TY-VY-RY White Paper v2.1:
 * - TY (Identity Substrate) precedes VY precedes RY
 * - Temporal decay via Tau envelope (Mortality Discount Rate)
 * - Ledger Gravity: gaming attempts increase evidence density
 * - Material mutations (>5% delta) trigger ChittyChain anchor
 */

import type { DRLReckoning, DRLSignal, LedgerEntry, Env } from "./types";

/** Decay half-life in days — signals lose half their weight after this many days */
const DECAY_HALF_LIFE_DAYS = 180;

/** Decay horizon in days — signals older than this are fully decayed */
const DECAY_HORIZON_DAYS = 730;

/** Material mutation threshold — reckoning delta above this triggers anchor */
const MATERIAL_MUTATION_THRESHOLD = 0.05;

/** Response cache TTL in seconds (short-lived, for dedup) */
const CACHE_TTL = 60;

/** Mutation baseline TTL in seconds (long-lived, prevents false material mutations) */
const BASELINE_TTL = 86400;

// --- Signal classification ---

/** Entry types that contribute to TY (Identity Substrate) */
const TY_ENTRY_TYPES = new Set([
  "entity_creation",
  "identity_verification",
  "schema_registration",
  "governance_binding",
  "credential_issuance",
  "identity_update",
  "entity_registration",
]);

/** Entry types that contribute to VY (Verified Yesterday / network experience) */
const VY_ENTRY_TYPES = new Set([
  "attestation",
  "endorsement",
  "correction",
  "approval",
  "collaboration",
  "review",
  "reference",
  "sibling_attestation",
]);

/** Entry types that contribute to RY (Reach and Authority) */
const RY_ENTRY_TYPES = new Set([
  "scope_grant",
  "authority_delegation",
  "certification",
  "achievement",
  "cycle_completion",
  "governance_vote",
  "authority_earned",
]);

/**
 * Classify a ledger entry into a DRL signal.
 *
 * ChittyLedger columns used:
 *   entity_type: broad category ('transaction', 'evidence', 'custody', 'audit')
 *   action: specific action string (e.g. 'identity_verification', 'attestation')
 *
 * We classify primarily on `action` since `entity_type` is coarse-grained.
 */
function classifyEntry(entry: LedgerEntry): DRLSignal | null {
  const entityType = entry.entity_type?.toLowerCase() ?? "";
  const action = entry.action?.toLowerCase() ?? "";
  const combined = `${entityType}_${action}`;

  let dimension: DRLSignal["dimension"] | null = null;

  // Classify by action (most specific), then combined, then entity_type
  if (TY_ENTRY_TYPES.has(action) || TY_ENTRY_TYPES.has(combined) || TY_ENTRY_TYPES.has(entityType)) {
    dimension = "ty";
  } else if (VY_ENTRY_TYPES.has(action) || VY_ENTRY_TYPES.has(combined) || VY_ENTRY_TYPES.has(entityType)) {
    dimension = "vy";
  } else if (RY_ENTRY_TYPES.has(action) || RY_ENTRY_TYPES.has(combined) || RY_ENTRY_TYPES.has(entityType)) {
    dimension = "ry";
  }

  if (!dimension) return null;

  // Base weight: positive actions get 1.0, negative get -0.5
  const isNegative = action.includes("revoke") || action.includes("dispute") || action.includes("reject");
  const weight = isNegative ? -0.5 : 1.0;

  return {
    dimension,
    weight,
    timestamp: entry.created_at,
    contributorId: entry.actor,
    entryType: action || entityType,
  };
}

/**
 * Apply temporal decay (Tau envelope) to a signal weight.
 * Uses exponential decay with half-life. Signals beyond decay horizon → 0.
 */
function applyDecay(weight: number, signalTime: string, now: number): number {
  const signalMs = new Date(signalTime).getTime();
  if (Number.isNaN(signalMs)) return 0; // skip malformed timestamps
  const ageMs = now - signalMs;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);

  if (ageDays > DECAY_HORIZON_DAYS) return 0;
  if (ageDays <= 0) return weight;

  // Exponential decay: w * (0.5 ^ (age / halfLife))
  const decayFactor = Math.pow(0.5, ageDays / DECAY_HALF_LIFE_DAYS);
  return weight * decayFactor;
}

/**
 * Normalize accumulated signal weights to 0-1 range.
 * Uses sigmoid-like saturation so more signals asymptotically approach 1.
 * Ledger Gravity: more entries = more data = higher confidence, not unbounded score.
 */
function normalize(rawScore: number, signalCount: number): number {
  if (signalCount === 0) return 0;
  // Saturation curve: score / (score + k) where k controls saturation rate
  // With k=3, ~3 full-weight signals reach 0.5, ~10 reach ~0.77, ~30 reach ~0.91
  const k = 3;
  const clamped = Math.max(0, rawScore);
  return clamped / (clamped + k);
}

/**
 * Apply ordering principle: TY precedes VY precedes RY.
 * If TY degrades, VY and RY cascade downstream (weighted floor).
 */
function applyOrderingPrinciple(ty: number, vy: number, ry: number): { ty: number; vy: number; ry: number } {
  // VY cannot exceed TY + 0.2 (some grace for network effects on new entities)
  const vyFloor = Math.min(vy, ty + 0.2);
  // RY cannot exceed VY + 0.1
  const ryFloor = Math.min(ry, vyFloor + 0.1);

  return {
    ty,
    vy: Math.max(0, vyFloor),
    ry: Math.max(0, ryFloor),
  };
}

/**
 * Fetch ledger entries for an entity from ChittyLedger.
 *
 * ChittyLedger API (ledger.chitty.cc):
 *   GET /entries?entityId={id}&limit=500
 *   Returns bare array of chitty_ledger_entries rows (snake_case columns).
 *
 * DB columns: id, sequence_number, timestamp, entity_type, entity_id,
 *   action, actor, actor_type, metadata, previous_hash, entry_hash,
 *   signature, status, created_at
 */
async function fetchLedgerEntries(chittyId: string, env: Env): Promise<LedgerEntry[]> {
  const url = `${env.LEDGER_URL}/entries?entityId=${encodeURIComponent(chittyId)}&limit=500`;

  const headers: Record<string, string> = {
    "X-Source-Service": "chittyscore",
    "Content-Type": "application/json",
  };
  if (env.CHITTYLEDGER_TOKEN) {
    headers["Authorization"] = `Bearer ${env.CHITTYLEDGER_TOKEN}`;
  }

  const resp = await fetch(url, { headers });

  if (!resp.ok) {
    console.error(`[DRL] Ledger fetch failed: ${resp.status} for ${chittyId}`);
    return [];
  }

  // ChittyLedger returns a bare array of row objects
  const data = await resp.json();
  if (Array.isArray(data)) return data as LedgerEntry[];
  // Tolerate wrapped responses from aggregated routes (api.chitty.cc)
  const wrapped = data as { entries?: LedgerEntry[]; data?: LedgerEntry[] };
  return wrapped.entries ?? wrapped.data ?? [];
}

/**
 * Compute DRL reckoning for an entity.
 * This is the core algorithm — assembles TY/VY/RY from ledger entries at query time.
 */
export async function reckon(chittyId: string, env: Env): Promise<DRLReckoning> {
  const now = Date.now();

  // 1. Fetch all ledger entries for this entity
  const entries = await fetchLedgerEntries(chittyId, env);

  // 2. Classify entries into signals
  const signals: DRLSignal[] = [];
  for (const entry of entries) {
    const signal = classifyEntry(entry);
    if (signal) signals.push(signal);
  }

  // 3. Accumulate weighted scores per dimension with temporal decay
  const accum = { ty: 0, vy: 0, ry: 0 };
  const counts = { ty: 0, vy: 0, ry: 0 };

  for (const signal of signals) {
    const decayed = applyDecay(signal.weight, signal.timestamp, now);
    if (decayed !== 0) {
      accum[signal.dimension] += decayed;
      counts[signal.dimension]++;
    }
  }

  // 4. Normalize to 0-1
  let ty = normalize(accum.ty, counts.ty);
  let vy = normalize(accum.vy, counts.vy);
  let ry = normalize(accum.ry, counts.ry);

  // 5. Apply ordering principle: TY → VY → RY cascade
  ({ ty, vy, ry } = applyOrderingPrinciple(ty, vy, ry));

  // 6. Compute confidence based on total signal density
  const totalSignals = signals.length;
  // Confidence saturates: 10 signals → ~0.77, 50 → ~0.94
  const confidence = totalSignals / (totalSignals + 3);

  // 7. Build tau envelope
  const timestamps = signals.map((s) => s.timestamp).sort();
  const decayHorizon = new Date(now - DECAY_HORIZON_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // 8. Check for material mutation against long-lived baseline (not the 60s response cache)
  let materialMutation = false;
  try {
    const baselineRaw = await env.SCORE_CACHE.get(`baseline:${chittyId}`);
    if (baselineRaw) {
      const baseline = JSON.parse(baselineRaw) as Pick<DRLReckoning, 'ty' | 'vy' | 'ry'>;
      const delta = Math.max(
        Math.abs(ty - baseline.ty),
        Math.abs(vy - baseline.vy),
        Math.abs(ry - baseline.ry),
      );
      materialMutation = delta > MATERIAL_MUTATION_THRESHOLD;
    } else {
      // First reckoning is always a material mutation
      materialMutation = totalSignals > 0;
    }
  } catch {
    // KV failure — treat as no baseline
    materialMutation = totalSignals > 0;
  }

  const reckoning: DRLReckoning = {
    chittyId,
    ty: round4(ty),
    vy: round4(vy),
    ry: round4(ry),
    tau: {
      reckonedAt: new Date(now).toISOString(),
      signalCount: totalSignals,
      oldestSignal: timestamps[0] ?? new Date(now).toISOString(),
      newestSignal: timestamps[timestamps.length - 1] ?? new Date(now).toISOString(),
      decayHorizon,
    },
    confidence: round4(confidence),
    materialMutation,
  };

  // 9. Cache the reckoning (short-lived, 60s TTL for response dedup)
  try {
    await env.SCORE_CACHE.put(
      `reckoning:${chittyId}`,
      JSON.stringify(reckoning),
      { expirationTtl: CACHE_TTL },
    );
  } catch (err) {
    console.error("[DRL] Cache write failed:", err);
  }

  // 10. Update mutation baseline (long-lived, 24h TTL)
  try {
    await env.SCORE_CACHE.put(
      `baseline:${chittyId}`,
      JSON.stringify({ ty: reckoning.ty, vy: reckoning.vy, ry: reckoning.ry }),
      { expirationTtl: BASELINE_TTL },
    );
  } catch (err) {
    console.error("[DRL] Baseline write failed:", err);
  }

  return reckoning;
}

/**
 * Get cached reckoning if available, otherwise compute fresh.
 */
export async function getCachedReckoning(chittyId: string, env: Env): Promise<DRLReckoning | null> {
  try {
    const cached = await env.SCORE_CACHE.get(`reckoning:${chittyId}`);
    if (cached) {
      return JSON.parse(cached) as DRLReckoning;
    }
  } catch {
    // KV failure — fall through to null
  }
  return null;
}

/** Round to 4 decimal places */
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
