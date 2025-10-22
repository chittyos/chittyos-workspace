/**
 * ChittyChain - Blockchain Anchoring & Immutability Service
 * Deployed at: chain.chitty.cc
 */

import {
  anchorToBlockchain,
  getAnchorTransaction,
  verifyAnchor,
  hashData,
  AnchorRequest,
} from "./blockchain";
import { MerkleTree, createMerkleProof, verifyMerkleProof } from "./merkle";

interface Env {
  ENVIRONMENT: string;
  SERVICE_NAME: string;
  D1: D1Database;
}

interface AnchorChainRequest {
  data: any;
  chittyid?: string;
  entity_type?: string;
  network?: "polygon" | "ethereum" | "mock";
}

interface BatchAnchorRequest {
  items: Array<{
    data: any;
    chittyid?: string;
    metadata?: any;
  }>;
  network?: "polygon" | "ethereum" | "mock";
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Health endpoint
      if (url.pathname === "/health") {
        return jsonResponse(
          {
            status: "healthy",
            service: "ChittyChain",
            version: "1.0.0",
            timestamp: new Date().toISOString(),
            environment: env.ENVIRONMENT || "production",
            features: [
              "blockchain-anchoring",
              "merkle-proofs",
              "batch-processing",
            ],
          },
          corsHeaders,
        );
      }

      // Root endpoint
      if (url.pathname === "/") {
        return jsonResponse(
          {
            service: "ChittyChain",
            version: "1.0.0",
            description:
              "Blockchain anchoring and immutability service for ChittyOS",
            endpoints: {
              health: "/health",
              anchor: "/api/v1/anchor (POST)",
              batchAnchor: "/api/v1/anchor/batch (POST)",
              verify: "/api/v1/verify (POST)",
              transaction: "/api/v1/transaction/:txHash (GET)",
              merkleProof: "/api/v1/merkle/proof (POST)",
            },
          },
          corsHeaders,
        );
      }

      // Anchor single data item
      if (url.pathname === "/api/v1/anchor" && request.method === "POST") {
        return await handleAnchor(request, env, corsHeaders);
      }

      // Batch anchor multiple items
      if (
        url.pathname === "/api/v1/anchor/batch" &&
        request.method === "POST"
      ) {
        return await handleBatchAnchor(request, env, corsHeaders);
      }

      // Verify anchored data
      if (url.pathname === "/api/v1/verify" && request.method === "POST") {
        return await handleVerify(request, env, corsHeaders);
      }

      // Get transaction details
      if (url.pathname.startsWith("/api/v1/transaction/")) {
        const txHash = url.pathname.split("/").pop();
        return await handleGetTransaction(txHash!, env, corsHeaders);
      }

      // Generate Merkle proof
      if (
        url.pathname === "/api/v1/merkle/proof" &&
        request.method === "POST"
      ) {
        return await handleMerkleProof(request, env, corsHeaders);
      }

      return jsonResponse({ error: "Not found" }, corsHeaders, 404);
    } catch (error) {
      console.error("ChittyChain error:", error);
      return jsonResponse(
        {
          error: "Internal server error",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        corsHeaders,
        500,
      );
    }
  },
};

/**
 * Handle single data anchoring
 */
async function handleAnchor(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const body: AnchorChainRequest = await request.json();

  if (!body.data) {
    return jsonResponse({ error: "data field is required" }, corsHeaders, 400);
  }

  // Hash the data
  const dataHash = await hashData(body.data);

  // Create single-item Merkle tree
  const merkleTree = new MerkleTree([dataHash]);
  const merkleRoot = merkleTree.getRoot();

  // Anchor to blockchain
  const anchorRequest: AnchorRequest = {
    data_hash: dataHash,
    metadata: {
      chittyid: body.chittyid,
      entity_type: body.entity_type,
      timestamp: Date.now(),
    },
    network: body.network || "mock",
  };

  const result = await anchorToBlockchain(anchorRequest, merkleRoot);

  return jsonResponse(
    {
      success: true,
      data_hash: dataHash,
      merkle_root: merkleRoot,
      transaction: result,
      anchored_at: new Date().toISOString(),
    },
    corsHeaders,
  );
}

/**
 * Handle batch anchoring with Merkle tree
 */
async function handleBatchAnchor(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const body: BatchAnchorRequest = await request.json();

  if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
    return jsonResponse(
      { error: "items array is required and must not be empty" },
      corsHeaders,
      400,
    );
  }

  // Hash all items
  const itemHashes = await Promise.all(
    body.items.map(async (item) => ({
      data: item.data,
      chittyid: item.chittyid,
      hash: await hashData(item.data),
    })),
  );

  // Create Merkle tree
  const hashes = itemHashes.map((item) => item.hash);
  const merkleTree = new MerkleTree(hashes);
  const merkleRoot = merkleTree.getRoot();

  // Anchor root to blockchain
  const anchorRequest: AnchorRequest = {
    data_hash: merkleRoot,
    metadata: {
      batch_size: body.items.length,
      timestamp: Date.now(),
    },
    network: body.network || "mock",
  };

  const result = await anchorToBlockchain(anchorRequest, merkleRoot);

  // Generate proofs for each item
  const itemsWithProofs = itemHashes.map((item, index) => ({
    chittyid: item.chittyid,
    data_hash: item.hash,
    merkle_proof: createMerkleProof(merkleTree, index),
  }));

  return jsonResponse(
    {
      success: true,
      batch_size: body.items.length,
      merkle_root: merkleRoot,
      transaction: result,
      items: itemsWithProofs,
      anchored_at: new Date().toISOString(),
    },
    corsHeaders,
  );
}

/**
 * Handle verification
 */
async function handleVerify(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const body: {
    tx_hash: string;
    data_hash: string;
  } = await request.json();

  if (!body.tx_hash || !body.data_hash) {
    return jsonResponse(
      { error: "tx_hash and data_hash are required" },
      corsHeaders,
      400,
    );
  }

  const isValid = await verifyAnchor(body.tx_hash, body.data_hash);

  return jsonResponse(
    {
      valid: isValid,
      tx_hash: body.tx_hash,
      data_hash: body.data_hash,
      verified_at: new Date().toISOString(),
    },
    corsHeaders,
  );
}

/**
 * Handle get transaction
 */
async function handleGetTransaction(
  txHash: string,
  env: Env,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const transaction = await getAnchorTransaction(txHash);

  if (!transaction) {
    return jsonResponse({ error: "Transaction not found" }, corsHeaders, 404);
  }

  return jsonResponse(transaction, corsHeaders);
}

/**
 * Handle Merkle proof generation
 */
async function handleMerkleProof(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const body: {
    merkle_root: string;
    data_hash: string;
    leaf_index: number;
    tree_hashes: string[];
  } = await request.json();

  if (!body.tree_hashes || !Array.isArray(body.tree_hashes)) {
    return jsonResponse(
      { error: "tree_hashes array is required" },
      corsHeaders,
      400,
    );
  }

  const merkleTree = new MerkleTree(body.tree_hashes);
  const proof = createMerkleProof(merkleTree, body.leaf_index);

  // Verify the proof
  const isValid = verifyMerkleProof(body.data_hash, proof, body.merkle_root);

  return jsonResponse(
    {
      proof,
      valid: isValid,
      merkle_root: merkleTree.getRoot(),
    },
    corsHeaders,
  );
}

/**
 * Helper: JSON response
 */
function jsonResponse(
  data: any,
  corsHeaders: Record<string, string>,
  status: number = 200,
): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}
