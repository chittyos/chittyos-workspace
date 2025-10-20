/**
 * ContextConsciousness™ Engine
 *
 * Intelligent context detection, loading, and switching
 * Ensures you never show up to the party in a clown costume
 */

export class ContextEngine {
  constructor(env, userId) {
    this.env = env;
    this.userId = userId;
    this.currentContext = null;
  }

  /**
   * Detect current context based on activity signals
   */
  async detectContext(signals) {
    const {
      activeService,      // e.g., 'chittycases', 'chittyfinance'
      recentActivity,     // Array of recent actions
      timeOfDay,          // Time-based context hints
      location,           // Geographic/network context
      chittyDNA           // User's identity and patterns
    } = signals;

    // Get user's learned patterns
    const patterns = await this.getUserPatterns();

    // Analyze signals with AI
    const contextAnalysis = await this.analyzeWithAI({
      activeService,
      recentActivity,
      timeOfDay,
      patterns,
      chittyDNA
    });

    // Determine primary context
    const context = this.selectPrimaryContext(contextAnalysis);

    // Store context transition
    await this.recordContextSwitch(this.currentContext, context);

    this.currentContext = context;
    return context;
  }

  /**
   * Load everything needed for a context
   */
  async loadContext(contextType, params = {}) {
    const contextConfig = this.getContextConfiguration(contextType);

    // Load base context data
    const baseData = await this.loadBaseContext(contextType, params);

    // Load user-specific context
    const userData = await this.loadUserContext(contextType, params);

    // Load relationship data
    const relationshipData = await this.loadRelationships(contextType, params);

    // Load memory from previous sessions
    const memory = await this.loadContextMemory(contextType, params);

    // Load permissions and access
    const access = await this.loadAccessControl(contextType, params);

    // Get AI-powered suggestions
    const suggestions = await this.generateSuggestions(contextType, {
      baseData,
      userData,
      relationshipData,
      memory
    });

    return {
      type: contextType,
      config: contextConfig,
      data: baseData,
      user: userData,
      relationships: relationshipData,
      memory,
      access,
      suggestions,
      loadedAt: new Date().toISOString()
    };
  }

  /**
   * Switch from one context to another intelligently
   */
  async switchContext(fromContext, toContext, options = {}) {
    const { preserve = [], transfer = true } = options;

    // Record the switch
    await this.recordContextSwitch(fromContext, toContext);

    // Determine what to preserve
    const preservedData = transfer
      ? await this.extractTransferableData(fromContext, toContext, preserve)
      : {};

    // Unload current context
    await this.unloadContext(fromContext);

    // Load new context
    const newContext = await this.loadContext(toContext, {
      transferred: preservedData
    });

    // Learn from the switch
    await this.learnFromSwitch(fromContext, toContext, preservedData);

    this.currentContext = toContext;
    return newContext;
  }

  /**
   * Context Configurations
   */
  getContextConfiguration(contextType) {
    const configs = {
      legal_case_review: {
        name: 'Legal Case Review',
        tone: 'professional',
        precision: 'high',
        services: ['chittycases', 'chittyevidence', 'chittychronicle'],
        dataTypes: ['case_files', 'evidence', 'timelines', 'precedents'],
        permissions: ['case_read', 'evidence_view', 'notes_edit'],
        suggestedActions: ['review_evidence', 'draft_motion', 'check_deadlines']
      },

      financial_review: {
        name: 'Financial Review',
        tone: 'analytical',
        precision: 'exact',
        services: ['chittyfinance', 'chittyledger', 'chittychain'],
        dataTypes: ['accounts', 'transactions', 'budgets', 'reports'],
        permissions: ['finance_read', 'transaction_view', 'report_generate'],
        suggestedActions: ['check_balance', 'review_transactions', 'budget_analysis']
      },

      client_meeting: {
        name: 'Client Meeting',
        tone: 'conversational',
        precision: 'medium',
        services: ['chittychat', 'chittychronicle', 'chittycontextual'],
        dataTypes: ['meeting_notes', 'action_items', 'client_history'],
        permissions: ['meeting_participate', 'notes_edit', 'calendar_view'],
        suggestedActions: ['take_notes', 'schedule_followup', 'assign_tasks']
      },

      property_management: {
        name: 'Property Management',
        tone: 'operational',
        precision: 'high',
        services: ['chittycases', 'chittyfinance', 'chittyevidence'],
        dataTypes: ['properties', 'tenants', 'leases', 'maintenance'],
        permissions: ['property_manage', 'tenant_view', 'lease_edit'],
        suggestedActions: ['check_rent', 'schedule_maintenance', 'review_leases']
      },

      evidence_analysis: {
        name: 'Evidence Analysis',
        tone: 'investigative',
        precision: 'very_high',
        services: ['chittyevidence', 'chittyverify', 'chittychain'],
        dataTypes: ['evidence_files', 'chain_of_custody', 'analysis_reports'],
        permissions: ['evidence_read', 'analysis_run', 'verify_authenticity'],
        suggestedActions: ['extract_metadata', 'verify_integrity', 'generate_report']
      },

      development: {
        name: 'Development',
        tone: 'technical',
        precision: 'high',
        services: ['chittychat', 'chittyregistry', 'chittysync'],
        dataTypes: ['code', 'documentation', 'apis', 'deployments'],
        permissions: ['code_read', 'api_test', 'deploy_staging'],
        suggestedActions: ['run_tests', 'check_services', 'review_logs']
      }
    };

    return configs[contextType] || configs.client_meeting; // Default
  }

  /**
   * Load base context data from services
   */
  async loadBaseContext(contextType, params) {
    const config = this.getContextConfiguration(contextType);
    const data = {};

    // Load from each required service
    for (const service of config.services) {
      try {
        data[service] = await this.fetchServiceData(service, contextType, params);
      } catch (error) {
        console.error(`Failed to load ${service} data:`, error);
        data[service] = { error: error.message };
      }
    }

    return data;
  }

  /**
   * Load user-specific context
   */
  async loadUserContext(contextType, params) {
    // Get from MemoryCloude
    const memory = await this.env.MEMORY_CLOUDE.get(
      `context:${this.userId}:${contextType}`
    );

    if (!memory) {
      return { preferences: {}, history: [], patterns: [] };
    }

    return JSON.parse(memory);
  }

  /**
   * Load relationship data from ChittyDNA
   */
  async loadRelationships(contextType, params) {
    try {
      const response = await fetch('https://id.chitty.cc/api/relationships', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.env.CHITTY_ID_TOKEN}`
        },
        body: JSON.stringify({
          userId: this.userId,
          contextType,
          ...params
        })
      });

      return await response.json();
    } catch (error) {
      console.error('Failed to load relationships:', error);
      return { entities: [], connections: [] };
    }
  }

  /**
   * Load context memory from previous sessions
   */
  async loadContextMemory(contextType, params) {
    const stmt = this.env.DB.prepare(`
      SELECT * FROM context_memory
      WHERE user_id = ? AND context_type = ?
      ORDER BY last_accessed DESC
      LIMIT 10
    `).bind(this.userId, contextType);

    const { results } = await stmt.all();
    return results || [];
  }

  /**
   * Load access control for context
   */
  async loadAccessControl(contextType, params) {
    const config = this.getContextConfiguration(contextType);

    // Check user permissions
    const permissions = await this.checkPermissions(
      this.userId,
      config.permissions
    );

    return {
      granted: permissions.filter(p => p.granted),
      denied: permissions.filter(p => !p.granted),
      contextLevel: config.precision
    };
  }

  /**
   * Generate AI-powered suggestions
   */
  async generateSuggestions(contextType, contextData) {
    const config = this.getContextConfiguration(contextType);
    const prompt = this.buildSuggestionPrompt(contextType, contextData, config);

    try {
      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          {
            role: 'system',
            content: 'You are ContextConsciousness™ for It\'s Chitty. Provide intelligent, context-aware suggestions.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 200
      });

      return this.parseSuggestions(response.response);
    } catch (error) {
      console.error('AI suggestion failed:', error);
      return config.suggestedActions; // Fallback to defaults
    }
  }

  /**
   * Analyze context with AI
   */
  async analyzeWithAI(signals) {
    const prompt = `Analyze this activity and determine the user's context:

Active Service: ${signals.activeService}
Recent Activity: ${signals.recentActivity.join(', ')}
Time: ${signals.timeOfDay}
Patterns: ${JSON.stringify(signals.patterns)}

Respond with the most likely context type from:
legal_case_review, financial_review, client_meeting, property_management,
evidence_analysis, development

Just return the context type.`;

    try {
      const response = await this.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 50
      });

      return response.response.trim();
    } catch (error) {
      console.error('AI analysis failed:', error);
      return this.inferContextFromService(signals.activeService);
    }
  }

  /**
   * Get user's learned patterns
   */
  async getUserPatterns() {
    const patterns = await this.env.MEMORY_CLOUDE.get(`patterns:${this.userId}`);
    return patterns ? JSON.parse(patterns) : [];
  }

  /**
   * Record context switch for learning
   */
  async recordContextSwitch(fromContext, toContext) {
    if (!fromContext) return; // First context

    await this.env.DB.prepare(`
      INSERT INTO context_switches (user_id, from_context, to_context, timestamp)
      VALUES (?, ?, ?, ?)
    `).bind(this.userId, fromContext, toContext, Date.now()).run();
  }

  /**
   * Extract data that should transfer between contexts
   */
  async extractTransferableData(fromContext, toContext, preserve) {
    // Load current context data
    const currentData = await this.loadContext(fromContext);

    // Determine what's relevant to new context
    const transferable = {};

    // Always preserve user identity and relationships
    transferable.chittyDNA = currentData.relationships;

    // Preserve specific requested fields
    for (const field of preserve) {
      if (currentData.data[field]) {
        transferable[field] = currentData.data[field];
      }
    }

    // Intelligent transfer based on context relationship
    const relationship = this.getContextRelationship(fromContext, toContext);
    if (relationship === 'related') {
      // Transfer relevant entities
      transferable.relatedEntities = this.findRelatedEntities(
        currentData,
        toContext
      );
    }

    return transferable;
  }

  /**
   * Helpers
   */

  selectPrimaryContext(analysis) {
    // Simple for now - just return AI analysis
    // TODO: Add confidence scoring and fallback logic
    return analysis;
  }

  inferContextFromService(service) {
    const serviceMap = {
      'chittycases': 'legal_case_review',
      'chittyfinance': 'financial_review',
      'chittychat': 'client_meeting',
      'chittyevidence': 'evidence_analysis'
    };
    return serviceMap[service] || 'client_meeting';
  }

  async fetchServiceData(service, contextType, params) {
    // Delegate to connect.chitty.cc
    const response = await fetch(`https://connect.chitty.cc/api/${service}/context`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-ChittyOS-API-Key': this.env.CONNECTOR_API_KEY
      },
      body: JSON.stringify({ contextType, ...params })
    });

    return await response.json();
  }

  async checkPermissions(userId, permissions) {
    // Check with ChittyAuth
    const response = await fetch('https://auth.chitty.cc/api/check-permissions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.env.CHITTY_AUTH_TOKEN}`
      },
      body: JSON.stringify({ userId, permissions })
    });

    return await response.json();
  }

  buildSuggestionPrompt(contextType, contextData, config) {
    return `Context: ${config.name}
Tone: ${config.tone}
Available data: ${Object.keys(contextData.data).join(', ')}
Recent memory: ${contextData.memory.slice(0, 3).map(m => m.summary).join('; ')}

Suggest 3-5 intelligent next actions for the user.`;
  }

  parseSuggestions(aiResponse) {
    // Parse AI response into structured suggestions
    const lines = aiResponse.split('\n').filter(l => l.trim());
    return lines.map(line => ({
      action: line.trim().replace(/^[-*•]\s*/, ''),
      confidence: 0.8 // TODO: Extract from AI
    }));
  }

  getContextRelationship(fromContext, toContext) {
    // Define which contexts are related
    const relationships = {
      'legal_case_review': ['evidence_analysis', 'client_meeting'],
      'financial_review': ['property_management'],
      'property_management': ['financial_review', 'legal_case_review']
    };

    return relationships[fromContext]?.includes(toContext) ? 'related' : 'unrelated';
  }

  findRelatedEntities(currentData, toContext) {
    // Extract entities relevant to new context
    // TODO: Implement entity extraction and relevance scoring
    return [];
  }

  async unloadContext(context) {
    // Save state before unloading
    await this.saveContextState(context);
  }

  async saveContextState(context) {
    // Store context state in MemoryCloude
    await this.env.MEMORY_CLOUDE.put(
      `context:${this.userId}:${context}`,
      JSON.stringify({
        savedAt: new Date().toISOString(),
        data: this.currentContext
      }),
      { expirationTtl: 86400 * 7 } // 7 days
    );
  }

  async learnFromSwitch(fromContext, toContext, transferredData) {
    // Record the pattern for future learning
    await this.env.DB.prepare(`
      INSERT INTO learning_patterns (user_id, pattern_type, from_context, to_context, data)
      VALUES (?, 'context_switch', ?, ?, ?)
    `).bind(
      this.userId,
      fromContext,
      toContext,
      JSON.stringify(transferredData)
    ).run();
  }
}
