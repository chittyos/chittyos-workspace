import { ChittyIdGateway } from './interfaces.js';

interface ChittyIdConfig {
  baseUrl: string;
  apiKey?: string;
}

export class HttpChittyIdGateway implements ChittyIdGateway {
  constructor(private readonly config: ChittyIdConfig) {}

  async reserveCallSign(input: {
    displayName: string;
    email: string;
  }): Promise<{ callSign: string; externalId?: string }> {
    const response = await fetch(`${this.config.baseUrl}/callsigns/reserve`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.config.apiKey ? { authorization: `Bearer ${this.config.apiKey}` } : {}),
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(`Failed to reserve call sign via ChittyID (${response.status})`);
    }

    const data = (await response.json()) as { callSign: string; externalId?: string };
    return data;
  }
}
