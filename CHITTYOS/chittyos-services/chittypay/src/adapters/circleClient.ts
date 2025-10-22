import { PaymentProvider, PayoutDestination, PayoutRail } from '../domain/types.js';

interface CircleClientOptions {
  apiKey: string;
  masterWalletId: string;
}

export class CircleClient implements PaymentProvider {
  readonly id = 'circle-usdc';
  readonly supportedRails: PayoutRail[] = ['circle-usdc'];

  constructor(private readonly options: CircleClientOptions) {}

  async sendPayout(input: {
    destination: PayoutDestination;
    amount: number;
    currency: string;
    memo?: string;
    metadata?: Record<string, string>;
  }): Promise<{ reference: string; estimatedArrival: string }> {
    if (!input.destination.wallet) {
      throw new Error('Circle payouts require wallet details');
    }

    await new Promise((resolve) => setTimeout(resolve, 30));
    const reference = `circle_${Date.now()}`;
    return {
      reference,
      estimatedArrival: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    };
  }
}
