/**
 * MemoryCloude Client
 *
 * Client for existing MemoryCloude service
 * Handles conversation history, user preferences, and learned patterns
 */

export class MemoryCloudeClient {
  constructor(env, userId) {
    this.env = env;
    this.userId = userId;
    this.baseUrl = env.MEMORY_CLOUDE_URL || 'https://memory.chitty.cc';
  }

  /**
   * Store conversation in MemoryCloude
   */
  async storeConversation(conversation) {
    const response = await fetch(`${this.baseUrl}/api/conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.env.MEMORY_CLOUDE_TOKEN}`
      },
      body: JSON.stringify({
        userId: this.userId,
        chittyId: conversation.chittyId,
        contextType: conversation.contextType,
        sessionId: conversation.sessionId,
        messages: conversation.messages,
        metadata: conversation.metadata,
        timestamp: Date.now()
      })
    });

    return await response.json();
  }

  /**
   * Retrieve conversation history
   */
  async getConversationHistory(contextType, options = {}) {
    const { limit = 10, sessionId, since } = options;

    const params = new URLSearchParams({
      userId: this.userId,
      contextType,
      limit: limit.toString()
    });

    if (sessionId) params.append('sessionId', sessionId);
    if (since) params.append('since', since.toString());

    const response = await fetch(
      `${this.baseUrl}/api/conversations?${params.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${this.env.MEMORY_CLOUDE_TOKEN}`
        }
      }
    );

    return await response.json();
  }

  /**
   * Store user preference
   */
  async storePreference(key, value, contextScope = null) {
    const response = await fetch(`${this.baseUrl}/api/preferences`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.env.MEMORY_CLOUDE_TOKEN}`
      },
      body: JSON.stringify({
        userId: this.userId,
        preferenceKey: key,
        preferenceValue: value,
        contextScope,
        source: 'explicit',
        timestamp: Date.now()
      })
    });

    return await response.json();
  }

  /**
   * Get user preferences
   */
  async getPreferences(contextScope = null) {
    const params = new URLSearchParams({ userId: this.userId });
    if (contextScope) params.append('contextScope', contextScope);

    const response = await fetch(
      `${this.baseUrl}/api/preferences?${params.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${this.env.MEMORY_CLOUDE_TOKEN}`
        }
      }
    );

    return await response.json();
  }

  /**
   * Store learned pattern
   */
  async storePattern(pattern) {
    const response = await fetch(`${this.baseUrl}/api/patterns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.env.MEMORY_CLOUDE_TOKEN}`
      },
      body: JSON.stringify({
        userId: this.userId,
        patternType: pattern.type,
        data: pattern.data,
        confidence: pattern.confidence || 0.5,
        timestamp: Date.now()
      })
    });

    return await response.json();
  }

  /**
   * Get learned patterns
   */
  async getPatterns(patternType = null) {
    const params = new URLSearchParams({ userId: this.userId });
    if (patternType) params.append('patternType', patternType);

    const response = await fetch(
      `${this.baseUrl}/api/patterns?${params.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${this.env.MEMORY_CLOUDE_TOKEN}`
        }
      }
    );

    return await response.json();
  }

  /**
   * Store context memory
   */
  async storeContextMemory(contextType, memory) {
    const response = await fetch(`${this.baseUrl}/api/context-memory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.env.MEMORY_CLOUDE_TOKEN}`
      },
      body: JSON.stringify({
        userId: this.userId,
        chittyId: memory.chittyId,
        contextType,
        sessionId: memory.sessionId,
        data: memory.data,
        summary: memory.summary,
        entities: memory.entities,
        timestamp: Date.now()
      })
    });

    return await response.json();
  }

  /**
   * Get context memory
   */
  async getContextMemory(contextType, options = {}) {
    const { limit = 10, sessionId } = options;

    const params = new URLSearchParams({
      userId: this.userId,
      contextType,
      limit: limit.toString()
    });

    if (sessionId) params.append('sessionId', sessionId);

    const response = await fetch(
      `${this.baseUrl}/api/context-memory?${params.toString()}`,
      {
        headers: {
          'Authorization': `Bearer ${this.env.MEMORY_CLOUDE_TOKEN}`
        }
      }
    );

    return await response.json();
  }

  /**
   * Search memory semantically
   */
  async searchMemory(query, options = {}) {
    const { contextType, limit = 10, threshold = 0.7 } = options;

    const response = await fetch(`${this.baseUrl}/api/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.env.MEMORY_CLOUDE_TOKEN}`
      },
      body: JSON.stringify({
        userId: this.userId,
        query,
        contextType,
        limit,
        threshold
      })
    });

    return await response.json();
  }

  /**
   * Get memory statistics
   */
  async getStats() {
    const response = await fetch(
      `${this.baseUrl}/api/stats?userId=${this.userId}`,
      {
        headers: {
          'Authorization': `Bearer ${this.env.MEMORY_CLOUDE_TOKEN}`
        }
      }
    );

    return await response.json();
  }

  /**
   * Prune old memories (GDPR compliance)
   */
  async pruneMemories(olderThan) {
    const response = await fetch(`${this.baseUrl}/api/prune`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.env.MEMORY_CLOUDE_TOKEN}`
      },
      body: JSON.stringify({
        userId: this.userId,
        olderThan // timestamp
      })
    });

    return await response.json();
  }

  /**
   * Export all user memories (data portability)
   */
  async exportMemories() {
    const response = await fetch(
      `${this.baseUrl}/api/export?userId=${this.userId}`,
      {
        headers: {
          'Authorization': `Bearer ${this.env.MEMORY_CLOUDE_TOKEN}`
        }
      }
    );

    return await response.json();
  }

  /**
   * Delete all user memories (GDPR right to be forgotten)
   */
  async deleteAllMemories() {
    const response = await fetch(
      `${this.baseUrl}/api/delete-all?userId=${this.userId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.env.MEMORY_CLOUDE_TOKEN}`
        }
      }
    );

    return await response.json();
  }
}
