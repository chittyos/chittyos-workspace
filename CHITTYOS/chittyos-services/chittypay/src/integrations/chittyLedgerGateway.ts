import { ChittyLedgerGateway } from './interfaces.js';

interface ChittyLedgerConfig {
  baseUrl: string;
  apiKey?: string;
}

export class HttpChittyLedgerGateway implements ChittyLedgerGateway {
  constructor(private readonly config: ChittyLedgerConfig) {}

  async recordLedgerEntry(input: {
    referenceId: string;
    callSign: string;
    senderId: string;
    amount: number;
    currency: string;
    type: 'invite' | 'onboarding' | 'payout' | 'referral';
    memo?: string;
    metadata?: Record<string, string>;
  }): Promise<void> {
    const response = await fetch(`${this.config.baseUrl}/ledger/entries`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(this.config.apiKey ? { authorization: `Bearer ${this.config.apiKey}` } : {}),
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error(`Failed to record ledger entry via ChittyLedger (${response.status})`);
    }
  }
}
