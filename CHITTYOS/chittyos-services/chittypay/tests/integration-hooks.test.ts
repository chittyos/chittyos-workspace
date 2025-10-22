import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InMemoryRepository } from '../src/repositories/inMemoryStore.js';
import { CallSignService } from '../src/services/callSignService.js';
import { OnboardingService } from '../src/services/onboardingService.js';
import { PayoutRouter } from '../src/services/payoutRouter.js';
import { DefaultProviderRegistry } from '../src/adapters/providerRegistry.js';
import { ManualReviewProvider } from '../src/adapters/manualReviewProvider.js';
import { IntegrationClients } from '../src/integrations/interfaces.js';

const baseUrl = 'https://pay.example.com';

describe('Integration hooks', () => {
  let repository: InMemoryRepository;
  let callSigns: CallSignService;
  let integrations: Partial<IntegrationClients>;

  beforeEach(() => {
    repository = new InMemoryRepository();
    callSigns = new CallSignService(repository);
    integrations = {};
  });

  it('reserves call sign via ChittyID and stores placeholder profile', async () => {
    const reserveCallSign = vi.fn().mockResolvedValue({ callSign: '/mock-signer' });
    integrations.chittyId = { reserveCallSign };

    const onboarding = new OnboardingService(repository, callSigns, baseUrl, integrations);
    const invite = await onboarding.createInvite({
      senderId: 'sender-1',
      senderName: 'Sender Co',
      recipientEmail: 'person@example.com',
      displayName: 'Person Example',
    });

    expect(reserveCallSign).toHaveBeenCalledOnce();
    expect(invite.callSign).toBe('/mock-signer');
    const reserved = await repository.getRecipientByCallSign('/mock-signer');
    expect(reserved?.status).toBe('pending');
  });

  it('queues KYC via ChittyTrust and records status metadata', async () => {
    integrations.chittyTrust = {
      enqueueKycCheck: vi.fn().mockResolvedValue({ status: 'queued', referenceId: 'kyc-1' }),
    };

    const onboarding = new OnboardingService(repository, callSigns, baseUrl, integrations);
    const invite = await onboarding.createInvite({
      senderId: 'sender-1',
      senderName: 'Sender Co',
      recipientEmail: 'kyc@example.com',
      displayName: 'Kyc Example',
    });

    const profile = await onboarding.completeOnboarding({
      inviteId: invite.id,
      displayName: 'Kyc Example',
      pin: '4321',
      bank: {
        accountNumber: '000111222',
        routingNumber: '021000021',
        bankName: 'Chitty Bank',
        accountType: 'checking',
      },
    });

    expect(integrations.chittyTrust?.enqueueKycCheck).toHaveBeenCalledOnce();
    expect(profile.metadata?.kycStatus).toBe('queued');
    expect(profile.metadata?.kycReference).toBe('kyc-1');
  });

  it('records ledger entry when payout dispatch occurs', async () => {
    const ledgerSpy = vi.fn().mockResolvedValue(undefined);
    integrations.chittyLedger = {
      recordLedgerEntry: ledgerSpy,
    };

    const onboarding = new OnboardingService(repository, callSigns, baseUrl, integrations);
    const invite = await onboarding.createInvite({
      senderId: 'sender-1',
      senderName: 'Sender Co',
      recipientEmail: 'ledger@example.com',
      displayName: 'Ledger Example',
    });

    await onboarding.completeOnboarding({
      inviteId: invite.id,
      displayName: 'Ledger Example',
      pin: '9999',
      bank: {
        accountNumber: '999999999',
        routingNumber: '021000021',
        bankName: 'Chitty Bank',
        accountType: 'business',
      },
    });

    const registry = new DefaultProviderRegistry([new ManualReviewProvider()]);
    const router = new PayoutRouter(repository, registry, { enforcePin: false }, integrations);

    await router.dispatch(
      {
        requestId: 'req-ledger',
        senderId: 'sender-1',
        recipientCallSign: invite.callSign,
        amount: 42,
        currency: 'USD',
        memo: 'Test payout',
        requestedRail: 'manual-review',
      },
      undefined,
    );

    expect(ledgerSpy).toHaveBeenCalledOnce();
    expect(ledgerSpy.mock.calls[0][0]).toMatchObject({
      type: 'payout',
      amount: 42,
      callSign: invite.callSign,
    });
  });
});
