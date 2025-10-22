import { PaymentProvider, PayoutDestination, PayoutRail } from '../domain/types.js';

export class ManualReviewProvider implements PaymentProvider {
  readonly id = 'manual-review';
  readonly supportedRails: PayoutRail[] = ['manual-review'];

  async sendPayout(input: {
    destination: PayoutDestination;
    amount: number;
    currency: string;
    memo?: string;
    metadata?: Record<string, string>;
  }): Promise<{ reference: string; estimatedArrival: string }> {
    return {
      reference: `manual_${Date.now()}`,
      estimatedArrival: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };
  }
}
