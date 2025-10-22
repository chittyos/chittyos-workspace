import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeEach } from 'vitest';
import { createOrchestrator } from '../src/index.js';

const baseConfig = {
  mercury: { apiKey: 'test', baseUrl: 'https://example.com' },
  baseUrl: 'https://pay.example.com',
};

describe('Payout Router', () => {
  let orchestrator: ReturnType<typeof createOrchestrator>;
  let callSign: string;

  beforeEach(async () => {
    orchestrator = createOrchestrator(baseConfig);
    const invite = await orchestrator.onboarding.createInvite({
      senderId: 'sender-1',
      senderName: 'Lambda LLC',
      recipientEmail: 'router@example.com',
      displayName: 'Router Example',
    });

    callSign = invite.callSign;

    await orchestrator.onboarding.completeOnboarding({
      inviteId: invite.id,
      displayName: 'Router Example',
      pin: '5678',
      bank: {
        accountNumber: '987654321',
        routingNumber: '021000021',
        bankName: 'Chitty Bank',
        accountType: 'business',
      },
    });
  });

  it('rejects payouts missing required PIN', async () => {
    await expect(
      orchestrator.payoutRouter.dispatch({
        requestId: randomUUID(),
        senderId: 'sender-1',
        recipientCallSign: callSign,
        amount: 150,
        currency: 'USD',
        requirePin: true,
      }, undefined),
    ).rejects.toThrow('PIN is required');
  });

  it('dispatches payout when PIN is valid', async () => {
    const result = await orchestrator.payoutRouter.dispatch(
      {
        requestId: randomUUID(),
        senderId: 'sender-1',
        recipientCallSign: callSign,
        amount: 150,
        currency: 'USD',
        requirePin: true,
      },
      '5678',
    );

    expect(result.providerId).toBe('mercury');
    expect(result.status).toBe('submitted');
  });

  it('fails with invalid PIN', async () => {
    await expect(
      orchestrator.payoutRouter.dispatch(
        {
          requestId: randomUUID(),
          senderId: 'sender-1',
          recipientCallSign: callSign,
          amount: 150,
          currency: 'USD',
          requirePin: true,
        },
        '1234',
      ),
    ).rejects.toThrow('Invalid PIN');
  });
});
