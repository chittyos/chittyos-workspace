/**
 * Context Mapper Agent - Maps relationships & dependencies
 */
export class ContextMapperAgent {
  constructor(env) {
    this.env = env;
  }

  async handleRequest(action, request) {
    // Delegate to AgentState durable object
    const agentStateId = this.env.AGENT_STATE.idFromName('contextMapper');
    const agentState = this.env.AGENT_STATE.get(agentStateId);

    const response = await agentState.fetch(new Request('https://internal/execute', {
      method: 'POST',
      body: JSON.stringify({
        agent: 'contextMapper',
        input: { action }
      })
    }));

    return await response.json();
  }
}
