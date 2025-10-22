import { PaymentProvider, PayoutDestination, PayoutRail } from '../domain/types.js';

interface StripeIssuingOptions {
  apiKey: string;
}

export class StripeIssuingClient implements PaymentProvider {
  readonly id = 'stripe-issuing';
  readonly supportedRails: PayoutRail[] = ['stripe-issuing'];

  constructor(private readonly options: StripeIssuingOptions) {}

  async sendPayout(input: {
    destination: PayoutDestination;
    amount: number;
    currency: string;
    memo?: string;
    metadata?: Record<string, string>;
  }): Promise<{ reference: string; estimatedArrival: string }> {
    if (!input.destination.card) {
      throw new Error('Stripe Issuing payouts require card token');
    }

    await new Promise((resolve) => setTimeout(resolve, 20));
    return {
      reference: `stripe_issue_${Date.now()}`,
      estimatedArrival: new Date(Date.now() + 60 * 1000).toISOString(),
    };
  }
}
