/**
 * Merkle Tree Implementation for ChittyChain
 *
 * Provides cryptographic proof of data inclusion in a blockchain anchor
 */

export interface MerkleNode {
  hash: string;
  left?: MerkleNode;
  right?: MerkleNode;
}

export interface MerkleProof {
  leaf: string;
  siblings: Array<{ hash: string; position: "left" | "right" }>;
  root: string;
}

/**
 * Hash data using SHA-256
 */
async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Build a Merkle tree from an array of data hashes
 */
export async function buildMerkleTree(
  dataHashes: string[],
): Promise<MerkleNode> {
  if (dataHashes.length === 0) {
    throw new Error("Cannot build Merkle tree from empty array");
  }

  // Create leaf nodes
  let nodes: MerkleNode[] = dataHashes.map((hash) => ({ hash }));

  // Build tree bottom-up
  while (nodes.length > 1) {
    const nextLevel: MerkleNode[] = [];

    for (let i = 0; i < nodes.length; i += 2) {
      const left = nodes[i];
      const right = nodes[i + 1] || left; // Duplicate last node if odd number

      // Hash the concatenation of left and right
      const combinedHash = await sha256(left.hash + right.hash);

      nextLevel.push({
        hash: combinedHash,
        left,
        right: nodes[i + 1] ? right : undefined,
      });
    }

    nodes = nextLevel;
  }

  return nodes[0]; // Root node
}

/**
 * Generate a Merkle proof for a specific leaf
 */
export async function generateMerkleProof(
  dataHashes: string[],
  targetHash: string,
): Promise<MerkleProof> {
  const tree = await buildMerkleTree(dataHashes);
  const siblings: Array<{ hash: string; position: "left" | "right" }> = [];

  // Find the leaf index
  const leafIndex = dataHashes.indexOf(targetHash);
  if (leafIndex === -1) {
    throw new Error("Target hash not found in data");
  }

  // Generate proof by traversing tree
  let currentLevel = dataHashes.map((hash) => ({ hash }));
  let currentIndex = leafIndex;

  while (currentLevel.length > 1) {
    const nextLevel: MerkleNode[] = [];

    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = currentLevel[i + 1] || left;

      // If this pair contains our target, record the sibling
      if (i === currentIndex || i + 1 === currentIndex) {
        if (i === currentIndex && currentLevel[i + 1]) {
          // Target is on the left, sibling is on the right
          siblings.push({ hash: right.hash, position: "right" });
        } else if (i + 1 === currentIndex) {
          // Target is on the right, sibling is on the left
          siblings.push({ hash: left.hash, position: "left" });
        }
      }

      const combinedHash = await sha256(left.hash + right.hash);
      nextLevel.push({ hash: combinedHash });
    }

    currentLevel = nextLevel;
    currentIndex = Math.floor(currentIndex / 2);
  }

  return {
    leaf: targetHash,
    siblings,
    root: tree.hash,
  };
}

/**
 * Verify a Merkle proof (async version using proper hashing)
 */
export async function verifyMerkleProofAsync(
  proof: MerkleProof,
): Promise<boolean> {
  let currentHash = proof.leaf;

  // Reconstruct root by applying siblings
  for (const sibling of proof.siblings) {
    if (sibling.position === "left") {
      currentHash = await sha256(sibling.hash + currentHash);
    } else {
      currentHash = await sha256(currentHash + sibling.hash);
    }
  }

  return currentHash === proof.root;
}

/**
 * Get the Merkle root from a tree
 */
export function getMerkleRoot(tree: MerkleNode): string {
  return tree.hash;
}

/**
 * MerkleTree class for simpler usage
 */
export class MerkleTree {
  private hashes: string[];
  private root: string = "";

  constructor(hashes: string[]) {
    this.hashes = hashes;
    this.buildTree();
  }

  private buildTree(): void {
    if (this.hashes.length === 0) {
      throw new Error("Cannot build Merkle tree from empty array");
    }

    let nodes = [...this.hashes];

    while (nodes.length > 1) {
      const nextLevel: string[] = [];

      for (let i = 0; i < nodes.length; i += 2) {
        const left = nodes[i];
        const right = nodes[i + 1] || left;
        const combined = this.hashPair(left, right);
        nextLevel.push(combined);
      }

      nodes = nextLevel;
    }

    this.root = nodes[0];
  }

  private hashPair(left: string, right: string): string {
    // Synchronous hash for simplicity
    const combined = left + right;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(64, "0");
  }

  getRoot(): string {
    return this.root;
  }

  getProof(index: number): Array<{ hash: string; position: "left" | "right" }> {
    const proof: Array<{ hash: string; position: "left" | "right" }> = [];
    let nodes = [...this.hashes];
    let currentIndex = index;

    while (nodes.length > 1) {
      if (currentIndex % 2 === 0) {
        if (currentIndex + 1 < nodes.length) {
          proof.push({ hash: nodes[currentIndex + 1], position: "right" });
        }
      } else {
        proof.push({ hash: nodes[currentIndex - 1], position: "left" });
      }

      const nextLevel: string[] = [];
      for (let i = 0; i < nodes.length; i += 2) {
        const left = nodes[i];
        const right = nodes[i + 1] || left;
        nextLevel.push(this.hashPair(left, right));
      }

      nodes = nextLevel;
      currentIndex = Math.floor(currentIndex / 2);
    }

    return proof;
  }
}

/**
 * Create a Merkle proof for a specific index
 */
export function createMerkleProof(
  tree: MerkleTree,
  index: number,
): Array<{ hash: string; position: "left" | "right" }> {
  return tree.getProof(index);
}

/**
 * Verify a Merkle proof (simplified version)
 */
export function verifyMerkleProof(
  leafHash: string,
  proof: Array<{ hash: string; position: "left" | "right" }>,
  expectedRoot: string,
): boolean {
  let currentHash = leafHash;

  for (const sibling of proof) {
    const left = sibling.position === "left" ? sibling.hash : currentHash;
    const right = sibling.position === "left" ? currentHash : sibling.hash;

    // Simple hash combination
    const combined = left + right;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    currentHash = Math.abs(hash).toString(16).padStart(64, "0");
  }

  return currentHash === expectedRoot;
}
