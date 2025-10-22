/**
 * Role Discoverer Agent - Identifies file roles & purposes
 */
export class RoleDiscovererAgent {
  constructor(env) {
    this.env = env;
  }

  async handleRequest(action, request) {
    // Delegate to AgentState durable object
    const agentStateId = this.env.AGENT_STATE.idFromName('roleDiscoverer');
    const agentState = this.env.AGENT_STATE.get(agentStateId);

    const response = await agentState.fetch(new Request('https://internal/execute', {
      method: 'POST',
      body: JSON.stringify({
        agent: 'roleDiscoverer',
        input: { action }
      })
    }));

    return await response.json();
  }
}
