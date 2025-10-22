/**
 * Blockchain Operations for ChittyChain
 *
 * Handles anchoring data hashes to blockchain networks
 * Initially implements mock blockchain, can be extended to real chains
 */

export interface AnchorRequest {
  data_hash: string;
  metadata: {
    chittyid?: string;
    entity_type?: string;
    timestamp: number;
  };
  network: "polygon" | "ethereum" | "mock";
}

export interface AnchorResult {
  tx_hash: string;
  block_number: number;
  network: string;
  timestamp: number;
  data_hash: string;
  merkle_root: string;
  status: "pending" | "confirmed" | "failed";
}

/**
 * Mock blockchain implementation
 * Used for testing and development, can be replaced with real blockchain
 */
class MockBlockchain {
  private blockHeight = 1000000;
  private transactions: Map<string, AnchorResult> = new Map();

  async anchor(
    dataHash: string,
    merkleRoot: string,
    metadata: any,
  ): Promise<AnchorResult> {
    // Simulate blockchain transaction
    const txHash = await this.generateTxHash(dataHash);
    this.blockHeight++;

    const result: AnchorResult = {
      tx_hash: txHash,
      block_number: this.blockHeight,
      network: "mock",
      timestamp: Date.now(),
      data_hash: dataHash,
      merkle_root: merkleRoot,
      status: "confirmed",
    };

    this.transactions.set(txHash, result);

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    return result;
  }

  async getTransaction(txHash: string): Promise<AnchorResult | null> {
    return this.transactions.get(txHash) || null;
  }

  private async generateTxHash(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const rand = new Uint32Array(1);
    crypto.getRandomValues(rand);
    const buffer = encoder.encode(data + String(rand[0]));
    const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return (
      "0x" + hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
    );
  }
}

/**
 * Blockchain client singleton
 */
const mockBlockchain = new MockBlockchain();

/**
 * Anchor data hash to blockchain
 */
export async function anchorToBlockchain(
  request: AnchorRequest,
  merkleRoot: string,
): Promise<AnchorResult> {
  const { data_hash, metadata, network } = request;

  // For now, always use mock blockchain
  // TODO: Add real blockchain integration based on network parameter
  if (network === "mock" || network === "polygon" || network === "ethereum") {
    return await mockBlockchain.anchor(data_hash, merkleRoot, metadata);
  }

  throw new Error(`Unsupported network: ${network}`);
}

/**
 * Get transaction details
 */
export async function getAnchorTransaction(
  txHash: string,
): Promise<AnchorResult | null> {
  return await mockBlockchain.getTransaction(txHash);
}

/**
 * Verify blockchain anchor
 */
export async function verifyAnchor(
  txHash: string,
  expectedHash: string,
): Promise<boolean> {
  const transaction = await getAnchorTransaction(txHash);

  if (!transaction) {
    return false;
  }

  return (
    transaction.data_hash === expectedHash && transaction.status === "confirmed"
  );
}

/**
 * Hash data using SHA-256
 */
export async function hashData(data: string | object): Promise<string> {
  const dataStr = typeof data === "string" ? data : JSON.stringify(data);
  const encoder = new TextEncoder();
  const buffer = encoder.encode(dataStr);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
