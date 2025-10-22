/**
 * Graph Algorithms for Trust Network Analysis
 * Implements PageRank, centrality measures, and clustering
 */

export interface Node {
  id: string;
  type: string;
}

export interface Edge {
  from: string;
  to: string;
  type: "ownership" | "control" | "affiliation";
  strength: number;
}

export interface Graph {
  nodes: Map<string, Node>;
  edges: Edge[];
  adjacencyList: Map<string, string[]>;
  reverseAdjacencyList: Map<string, string[]>;
}

/**
 * Build a graph from nodes and edges
 */
export function buildGraph(nodes: Node[], edges: Edge[]): Graph {
  const nodeMap = new Map<string, Node>();
  const adjacencyList = new Map<string, string[]>();
  const reverseAdjacencyList = new Map<string, string[]>();

  // Initialize nodes
  for (const node of nodes) {
    nodeMap.set(node.id, node);
    adjacencyList.set(node.id, []);
    reverseAdjacencyList.set(node.id, []);
  }

  // Build adjacency lists
  for (const edge of edges) {
    const neighbors = adjacencyList.get(edge.from) || [];
    neighbors.push(edge.to);
    adjacencyList.set(edge.from, neighbors);

    const reverseNeighbors = reverseAdjacencyList.get(edge.to) || [];
    reverseNeighbors.push(edge.from);
    reverseAdjacencyList.set(edge.to, reverseNeighbors);
  }

  return {
    nodes: nodeMap,
    edges,
    adjacencyList,
    reverseAdjacencyList,
  };
}

/**
 * Calculate PageRank for all nodes
 * Simplified implementation with 5 iterations
 */
export function calculatePageRank(
  graph: Graph,
  iterations = 5,
  dampingFactor = 0.85,
): Map<string, number> {
  const nodeIds = Array.from(graph.nodes.keys());
  const n = nodeIds.length;

  if (n === 0) return new Map();

  // Initialize PageRank values
  const pagerank = new Map<string, number>();
  const initialValue = 1.0 / n;

  for (const id of nodeIds) {
    pagerank.set(id, initialValue);
  }

  // Run iterations
  for (let iter = 0; iter < iterations; iter++) {
    const newPagerank = new Map<string, number>();

    for (const nodeId of nodeIds) {
      let rank = (1 - dampingFactor) / n;

      // Add contributions from incoming edges
      const incomingNodes = graph.reverseAdjacencyList.get(nodeId) || [];
      for (const incomingId of incomingNodes) {
        const incomingRank = pagerank.get(incomingId) || 0;
        const outDegree = (graph.adjacencyList.get(incomingId) || []).length;

        if (outDegree > 0) {
          rank += dampingFactor * (incomingRank / outDegree);
        }
      }

      newPagerank.set(nodeId, rank);
    }

    // Update pagerank for next iteration
    for (const [id, rank] of newPagerank) {
      pagerank.set(id, rank);
    }
  }

  return pagerank;
}

/**
 * Calculate degree centrality (number of connections)
 */
export function calculateDegree(graph: Graph, nodeId: string): number {
  const outDegree = (graph.adjacencyList.get(nodeId) || []).length;
  const inDegree = (graph.reverseAdjacencyList.get(nodeId) || []).length;
  return outDegree + inDegree;
}

/**
 * Calculate betweenness centrality (simplified)
 * Measures how often a node appears on shortest paths between other nodes
 */
export function calculateBetweenness(graph: Graph, nodeId: string): number {
  const nodeIds = Array.from(graph.nodes.keys());
  let betweenness = 0;

  // For each pair of nodes (s, t)
  for (const s of nodeIds) {
    if (s === nodeId) continue;

    const distances = new Map<string, number>();
    const pathCount = new Map<string, number>();
    const queue: string[] = [s];

    distances.set(s, 0);
    pathCount.set(s, 1);

    // BFS to find shortest paths
    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentDist = distances.get(current) || 0;
      const neighbors = graph.adjacencyList.get(current) || [];

      for (const neighbor of neighbors) {
        if (!distances.has(neighbor)) {
          distances.set(neighbor, currentDist + 1);
          pathCount.set(neighbor, 0);
          queue.push(neighbor);
        }

        if (distances.get(neighbor) === currentDist + 1) {
          const count = pathCount.get(neighbor) || 0;
          pathCount.set(neighbor, count + (pathCount.get(current) || 0));
        }
      }
    }

    // Count paths through nodeId
    for (const t of nodeIds) {
      if (t === s || t === nodeId) continue;

      const pathsToT = pathCount.get(t) || 0;
      if (pathsToT > 0) {
        const pathsThroughNode = pathCount.get(nodeId) || 0;
        betweenness += pathsThroughNode / pathsToT;
      }
    }
  }

  const n = nodeIds.length;
  return n > 2 ? betweenness / ((n - 1) * (n - 2)) : 0;
}

/**
 * Calculate clustering coefficient
 * Measures how connected a node's neighbors are
 */
export function calculateClustering(graph: Graph, nodeId: string): number {
  const neighbors = graph.adjacencyList.get(nodeId) || [];
  const k = neighbors.length;

  if (k < 2) return 0;

  // Count edges between neighbors
  let edgeCount = 0;
  for (let i = 0; i < neighbors.length; i++) {
    const n1 = neighbors[i];
    const n1Neighbors = graph.adjacencyList.get(n1) || [];

    for (let j = i + 1; j < neighbors.length; j++) {
      const n2 = neighbors[j];
      if (n1Neighbors.includes(n2)) {
        edgeCount++;
      }
    }
  }

  // Clustering coefficient formula
  return (2 * edgeCount) / (k * (k - 1));
}

/**
 * Detect communities using label propagation algorithm
 */
export function detectCommunities(
  graph: Graph,
  maxIterations = 10,
): Map<string, string> {
  const nodeIds = Array.from(graph.nodes.keys());
  const labels = new Map<string, string>();

  // Initialize each node with its own label
  for (const id of nodeIds) {
    labels.set(id, id);
  }

  // Iterate until convergence or max iterations
  for (let iter = 0; iter < maxIterations; iter++) {
    let changed = false;

    // Process nodes in random order
    const shuffled = [...nodeIds].sort(() => Math.random() - 0.5);

    for (const nodeId of shuffled) {
      // Count labels of neighbors
      const neighbors = [
        ...(graph.adjacencyList.get(nodeId) || []),
        ...(graph.reverseAdjacencyList.get(nodeId) || []),
      ];

      if (neighbors.length === 0) continue;

      const labelCounts = new Map<string, number>();
      for (const neighbor of neighbors) {
        const label = labels.get(neighbor) || neighbor;
        labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
      }

      // Find most common label
      let maxCount = 0;
      let mostCommonLabel = labels.get(nodeId) || nodeId;

      for (const [label, count] of labelCounts) {
        if (count > maxCount) {
          maxCount = count;
          mostCommonLabel = label;
        }
      }

      // Update label if changed
      if (labels.get(nodeId) !== mostCommonLabel) {
        labels.set(nodeId, mostCommonLabel);
        changed = true;
      }
    }

    // Converged if no changes
    if (!changed) break;
  }

  return labels;
}

/**
 * Calculate network metrics for a specific node
 */
export function calculateNetworkMetrics(graph: Graph, nodeId: string) {
  const pagerank = calculatePageRank(graph);

  return {
    degree: calculateDegree(graph, nodeId),
    betweenness: calculateBetweenness(graph, nodeId),
    clustering: calculateClustering(graph, nodeId),
    pagerank: pagerank.get(nodeId) || 0,
  };
}

/**
 * Get trust clusters with statistics
 */
export function getTrustClusters(graph: Graph) {
  const communities = detectCommunities(graph);
  const pagerank = calculatePageRank(graph);

  // Group nodes by community
  const clusters = new Map<string, string[]>();
  for (const [nodeId, clusterId] of communities) {
    const members = clusters.get(clusterId) || [];
    members.push(nodeId);
    clusters.set(clusterId, members);
  }

  // Calculate cluster statistics
  const clusterStats = [];
  for (const [clusterId, members] of clusters) {
    let totalTrust = 0;
    for (const memberId of members) {
      totalTrust += pagerank.get(memberId) || 0;
    }

    clusterStats.push({
      cluster_id: clusterId,
      entities: members.length,
      cluster_trust: totalTrust / members.length,
    });
  }

  return clusterStats;
}
