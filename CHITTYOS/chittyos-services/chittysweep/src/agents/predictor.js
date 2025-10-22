/**
 * Predictor Agent - Predicts future cleanup needs
 */
export class PredictorAgent {
  constructor(env) {
    this.env = env;
  }

  async handleRequest(action, request) {
    // Delegate to AgentState durable object
    const agentStateId = this.env.AGENT_STATE.idFromName('predictor');
    const agentState = this.env.AGENT_STATE.get(agentStateId);

    const response = await agentState.fetch(new Request('https://internal/execute', {
      method: 'POST',
      body: JSON.stringify({
        agent: 'predictor',
        input: { action }
      })
    }));

    return await response.json();
  }
}
