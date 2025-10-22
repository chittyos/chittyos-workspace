import { PaymentProvider, PayoutDestination, PayoutRail } from '../domain/types.js';

interface MercuryClientOptions {
  apiKey: string;
  baseUrl: string;
}

interface MercuryPaymentResponse {
  id: string;
  status: string;
  estimated_arrival_at?: string;
  estimated_arrival?: string;
}

export class MercuryClient implements PaymentProvider {
  readonly id = 'mercury';
  readonly supportedRails: PayoutRail[] = ['mercury-ach', 'mercury-wire'];

  constructor(private readonly options: MercuryClientOptions) {}

  async sendPayout(input: {
    destination: PayoutDestination;
    amount: number;
    currency: string;
    memo?: string;
    metadata?: Record<string, string>;
  }): Promise<{ reference: string; estimatedArrival: string }> {
    if (!input.destination.bank) {
      throw new Error('Mercury payouts require bank account details');
    }

    const endpoint = this.resolveEndpoint(input.destination.rail);
    const payload = this.buildPayload(input);

    const response = await fetch(`${this.options.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.options.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await this.safeParseError(response);
      throw new Error(`Mercury payout failed (${response.status}): ${errorBody}`);
    }

    const data = (await response.json()) as MercuryPaymentResponse;
    return {
      reference: data.id,
      estimatedArrival:
        data.estimated_arrival_at ?? data.estimated_arrival ?? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    };
  }

  private resolveEndpoint(rail: PayoutRail): string {
    if (rail === 'mercury-wire') {
      return '/v1/wire-payments';
    }
    return '/v1/ach-payments';
  }

  private buildPayload(input: {
    destination: PayoutDestination;
    amount: number;
    currency: string;
    memo?: string;
    metadata?: Record<string, string>;
  }) {
    const bank = input.destination.bank!;
    const type = bank.accountType === 'business' ? 'business-checking' : bank.accountType;

    return {
      amount: {
        currency: input.currency,
        value: Number(input.amount).toFixed(2),
      },
      counterparty: {
        name: input.metadata?.recipientName ?? 'Recipient',
        type,
        routing_number: bank.routingNumber,
        account_number: bank.accountNumber,
      },
      memo: input.memo,
    };
  }

  private async safeParseError(response: Response): Promise<string> {
    try {
      const data = await response.json();
      if (typeof data === 'string') {
        return data;
      }
      if (data && typeof data === 'object') {
        return JSON.stringify(data);
      }
      return 'unknown-error';
    } catch {
      return 'unknown-error';
    }
  }
}
