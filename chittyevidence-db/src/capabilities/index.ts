/**
 * ChittyEvidence Capabilities
 *
 * This is the canonical export point for all evidence domain capabilities.
 * Chemists (domain services) expose ONLY capabilities, never raw functions.
 *
 * Usage:
 *   const caps = createEvidenceCapabilities(env);
 *   const result = await caps.provenance.verifyProvenance.invoke(context, input);
 */

import { Env } from '../types';
import { createProvenanceCapabilities } from './cap-provenance';

export * from './cap-provenance';

/**
 * Create all evidence domain capabilities bound to environment
 */
export function createEvidenceCapabilities(env: Env) {
  return {
    provenance: createProvenanceCapabilities(env),
    // Future capabilities:
    // documents: createDocumentCapabilities(env),
    // gaps: createGapCapabilities(env),
    // corrections: createCorrectionCapabilities(env),
  };
}

export type EvidenceCapabilities = ReturnType<typeof createEvidenceCapabilities>;
