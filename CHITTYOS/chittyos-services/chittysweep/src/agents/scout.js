/**
 * Scout Agent - Discovers cleanup opportunities
 */
export class ScoutAgent {
  constructor(env) {
    this.env = env;
  }

  async handleRequest(action, request) {
    // Delegate to AgentState durable object
    const agentStateId = this.env.AGENT_STATE.idFromName('scout');
    const agentState = this.env.AGENT_STATE.get(agentStateId);

    const response = await agentState.fetch(new Request('https://internal/execute', {
      method: 'POST',
      body: JSON.stringify({
        agent: 'scout',
        input: { action }
      })
    }));

    return await response.json();
  }
}
