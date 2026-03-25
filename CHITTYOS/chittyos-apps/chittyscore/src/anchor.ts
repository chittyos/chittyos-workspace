/**
 * ChittyChain Anchor — Hard-Mint for Material Mutations
 *
 * When a DRL reckoning differs from the last cached value by >5%,
 * the reckoning is anchored to ChittyChain, making it tamper-evident.
 *
 * STATUS: ChittyChain's POST /api/v1/anchor endpoint is documented in
 * its CLAUDE.md but NOT YET IMPLEMENTED in server/routes.ts or
 * server/simple-routes.ts. This module will fail until that endpoint
 * exists. Failures are surfaced in the response, not swallowed.
 */

import type { DRLReckoning, Env } from "./types";

export interface AnchorResult {
  success: boolean;
  reckoning: DRLReckoning;
  error?: string;
}

/**
 * Anchor a reckoning to ChittyChain via Hard-Mint.
 * Posts SHA-256 hash of the reckoning data to chain.chitty.cc.
 *
 * Failures are returned explicitly — never swallowed.
 */
export async function anchorReckoning(
  reckoning: DRLReckoning,
  env: Env,
): Promise<AnchorResult> {
  // Build the data to hash — deterministic JSON of the scoring values
  const hashPayload = JSON.stringify({
    chittyId: reckoning.chittyId,
    ty: reckoning.ty,
    vy: reckoning.vy,
    ry: reckoning.ry,
    reckonedAt: reckoning.tau.reckonedAt,
    signalCount: reckoning.tau.signalCount,
  });

  // SHA-256 hash
  const encoder = new TextEncoder();
  const data = encoder.encode(hashPayload);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const dataHash = "0x" + hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  let resp: Response;
  try {
    resp = await fetch(`${env.CHAIN_URL}/api/v1/anchor`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Source-Service": "chittyscore",
      },
      body: JSON.stringify({
        data_hash: dataHash,
        metadata: {
          chittyid: reckoning.chittyId,
          entity_type: "E",
          timestamp: reckoning.tau.reckonedAt,
          ty: reckoning.ty,
          vy: reckoning.vy,
          ry: reckoning.ry,
        },
      }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown fetch error";
    console.error("[Anchor] ChittyChain unreachable:", message);
    return {
      success: false,
      reckoning,
      error: `ChittyChain unreachable: ${message}`,
    };
  }

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    const error = `ChittyChain returned ${resp.status}: ${body}`;
    console.error(`[Anchor] ${error}`);
    return { success: false, reckoning, error };
  }

  const result = await resp.json() as {
    tx_hash?: string;
    txHash?: string;
    block_number?: number;
    blockNumber?: number;
  };

  return {
    success: true,
    reckoning: {
      ...reckoning,
      anchored: {
        txHash: result.tx_hash ?? result.txHash ?? dataHash,
        blockNumber: result.block_number ?? result.blockNumber ?? 0,
        anchoredAt: new Date().toISOString(),
      },
    },
  };
}
