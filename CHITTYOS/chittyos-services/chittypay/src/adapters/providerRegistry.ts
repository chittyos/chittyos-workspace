import { PaymentProvider, ProviderRegistry, PayoutRail } from '../domain/types.js';

export class DefaultProviderRegistry implements ProviderRegistry {
  private readonly providers = new Map<PayoutRail, PaymentProvider>();

  constructor(providers: PaymentProvider[]) {
    providers.forEach((provider) => {
      provider.supportedRails.forEach((rail) => {
        this.providers.set(rail, provider);
      });
    });
  }

  resolveProvider(rail: PayoutRail): PaymentProvider | undefined {
    return this.providers.get(rail);
  }

  listProviders(): PaymentProvider[] {
    return [...new Set(this.providers.values())];
  }
}
