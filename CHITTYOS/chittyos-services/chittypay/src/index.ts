import { loadConfig, AppConfig } from './config/env.js';
import { InMemoryRepository } from './repositories/inMemoryStore.js';
import { CallSignService } from './services/callSignService.js';
import { OnboardingService } from './services/onboardingService.js';
import { MercuryClient } from './adapters/mercuryClient.js';
import { CircleClient } from './adapters/circleClient.js';
import { StripeIssuingClient } from './adapters/stripeIssuingClient.js';
import { ManualReviewProvider } from './adapters/manualReviewProvider.js';
import { DefaultProviderRegistry } from './adapters/providerRegistry.js';
import { PayoutRouter } from './services/payoutRouter.js';
import { ReferralService } from './services/referralService.js';
import { PinHasher } from './utils/pin.js';
import { HttpChittyIdGateway } from './integrations/chittyIdGateway.js';
import { HttpChittyTrustGateway } from './integrations/chittyTrustGateway.js';
import { HttpChittyLedgerGateway } from './integrations/chittyLedgerGateway.js';
import { IntegrationClients } from './integrations/interfaces.js';

export interface OrchestratorServices {
  repository: InMemoryRepository;
  callSigns: CallSignService;
  onboarding: OnboardingService;
  payoutRouter: PayoutRouter;
  referral: ReferralService;
  registry: DefaultProviderRegistry;
  pinHasher: PinHasher;
  integrations: Partial<IntegrationClients>;
}

export function createOrchestrator(config: AppConfig): OrchestratorServices {
  const repository = new InMemoryRepository();
  const callSigns = new CallSignService(repository);

  const integrations: Partial<IntegrationClients> = {};
  if (config.chittyId) {
    integrations.chittyId = new HttpChittyIdGateway(config.chittyId);
  }
  if (config.chittyTrust) {
    integrations.chittyTrust = new HttpChittyTrustGateway(config.chittyTrust);
  }
  if (config.chittyLedger) {
    integrations.chittyLedger = new HttpChittyLedgerGateway(config.chittyLedger);
  }

  const onboarding = new OnboardingService(repository, callSigns, config.baseUrl, integrations);

  const providers = [new MercuryClient(config.mercury)];

  if (config.circle?.apiKey && config.circle.masterWalletId) {
    providers.push(
      new CircleClient({
        apiKey: config.circle.apiKey,
        masterWalletId: config.circle.masterWalletId,
      }),
    );
  }

  if (config.issuers?.stripeApiKey) {
    providers.push(new StripeIssuingClient({ apiKey: config.issuers.stripeApiKey }));
  }

  providers.push(new ManualReviewProvider());
  const registry = new DefaultProviderRegistry(providers);

  const payoutRouter = new PayoutRouter(repository, registry, { enforcePin: true }, integrations);
  const referral = new ReferralService(repository, config.referralBonusUsd ?? 0, integrations);
  const pinHasher = new PinHasher();

  return {
    repository,
    callSigns,
    onboarding,
    payoutRouter,
    referral,
    registry,
    pinHasher,
    integrations,
  };
}

export function bootstrapFromEnv(): OrchestratorServices {
  const config = loadConfig();
  return createOrchestrator(config);
}

export * from './domain/types.js';
