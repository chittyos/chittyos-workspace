import { describe, it, expect } from 'vitest';
import { createOrchestrator } from '../src/index.js';

const baseConfig = {
  mercury: { apiKey: 'test', baseUrl: 'https://example.com' },
  baseUrl: 'https://pay.example.com',
};

describe('Onboarding Service', () => {
  it('creates a self-serve invite with a reserved call sign', async () => {
    const orchestrator = createOrchestrator(baseConfig);
    const invite = await orchestrator.onboarding.createInvite({
      senderId: 'sender-1',
      senderName: 'Lambda LLC',
      recipientEmail: 'contractor@example.com',
      displayName: 'Contractor Example',
    });

    expect(invite.onboardingUrl).toContain('/onboard/');
    expect(invite.callSign).toMatch(/^\/[a-z0-9-]+$/);
  });

  it('completes onboarding and stores payout destinations', async () => {
    const orchestrator = createOrchestrator(baseConfig);
    const invite = await orchestrator.onboarding.createInvite({
      senderId: 'sender-1',
      senderName: 'Lambda LLC',
      recipientEmail: 'create@example.com',
      displayName: 'Create Example',
    });

    const profile = await orchestrator.onboarding.completeOnboarding({
      inviteId: invite.id,
      displayName: 'Create Example',
      pin: '1234',
      bank: {
        accountNumber: '123456789',
        routingNumber: '021000021',
        bankName: 'Chitty Bank',
        accountType: 'checking',
      },
      wallet: {
        address: '0xabc123',
        network: 'ethereum',
        asset: 'USDC',
      },
      cardOptIn: true,
    });

    expect(profile.destinations).toHaveLength(3);
    expect(profile.destinations.some((dest) => dest.rail === 'mercury-ach')).toBe(true);
    expect(profile.destinations.some((dest) => dest.rail === 'circle-usdc')).toBe(true);
    expect(profile.destinations.some((dest) => dest.rail === 'stripe-issuing')).toBe(true);
  });
});
