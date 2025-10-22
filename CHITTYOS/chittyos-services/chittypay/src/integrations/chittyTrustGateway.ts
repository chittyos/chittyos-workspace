import { ChittyTrustGateway } from './interfaces.js';

interface ChittyTrustConfig {
  baseUrl: string;
  apiKey?: string;
}

export class HttpChittyTrustGateway implements ChittyTrustGateway {
  constructor(private readonly config: ChittyTrustConfig) {}

  async enqueueKycCheck(input: {
    recipientId: string;
    displayName: string;
    email: string;
    callSign: string;
  }): Promise<{ status: 'queued' | 'verified' | 'manual'; referenceId: string }> {
    const response = await fetch(`${this.config.baseUrl}/kyc/checks`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.config.apiKey ? { authorization: `Bearer ${this.config.apiKey}` } : {}),
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(`Failed to enqueue KYC check via ChittyTrust (${response.status})`);
    }

    const data = (await response.json()) as {
      status: 'queued' | 'verified' | 'manual';
      referenceId: string;
    };

    return data;
  }
}
