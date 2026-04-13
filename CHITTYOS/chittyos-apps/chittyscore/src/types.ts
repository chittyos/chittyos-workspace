/**
 * ChittyScore DRL Types
 * TY/VY/RY reckoning model per TY-VY-RY White Paper v2.1
 *
 * @canon: chittycanon://gov/governance#core-types
 */

/** DRL Reckoning result — assembled at query time, not stored */
export interface DRLReckoning {
  chittyId: string;
  /** idenTitY (0-1) — TY precedes VY precedes RY */
  ty: number;
  /** connectiVitY / behavioral record and network experience (0-1) */
  vy: number;
  /** authoRitY / earned, revocable authority (0-1) */
  ry: number;
  /** Temporal envelope metadata */
  tau: {
    reckonedAt: string;
    signalCount: number;
    oldestSignal: string;
    newestSignal: string;
    /** ISO timestamp — signals older than this are fully decayed */
    decayHorizon: string;
  };
  /** Confidence in reckoning (0-1), based on signal density */
  confidence: number;
  /** Whether this reckoning differs from last cached by >5% */
  materialMutation: boolean;
  /** ChittyChain anchor data, present if anchored */
  anchored?: {
    txHash: string;
    blockNumber: number;
    anchoredAt: string;
  };
}

/** A signal extracted from a ledger entry for DRL reckoning */
export interface DRLSignal {
  /** Which dimension this signal contributes to */
  dimension: "ty" | "vy" | "ry";
  /** Raw weight before decay (0-1) */
  weight: number;
  /** ISO timestamp of the originating event */
  timestamp: string;
  /** ChittyID of the contributing actor (for credibility weighting) */
  contributorId?: string;
  /** The ledger entry type that produced this signal */
  entryType: string;
}

/**
 * Ledger entry shape — matches chitty_ledger_entries DB columns.
 * ChittyLedger returns snake_case rows directly from Neon.
 */
export interface LedgerEntry {
  id: string;
  sequence_number: number;
  timestamp: string;
  entity_type: string;
  entity_id: string;
  action: string;
  actor?: string;
  actor_type?: string;
  metadata?: Record<string, unknown>;
  previous_hash?: string;
  entry_hash?: string;
  status?: string;
  created_at: string;
}

/** Worker environment bindings */
export interface Env {
  ENVIRONMENT: string;
  SERVICE_NAME: string;
  VERSION: string;
  LEDGER_URL: string;
  CHITTYLEDGER_TOKEN?: string;
  CHAIN_URL: string;
  SCORE_CACHE: KVNamespace;
}
