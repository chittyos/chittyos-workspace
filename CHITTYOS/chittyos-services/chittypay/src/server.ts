import Fastify from 'fastify';
import { z } from 'zod';
import { createOrchestrator } from './index.js';
import { AppConfig, loadConfig } from './config/env.js';

const inviteSchema = z.object({
  senderId: z.string(),
  senderName: z.string(),
  recipientEmail: z.string().email(),
  displayName: z.string().min(2),
  expiresInHours: z.number().optional(),
});

const onboardingSubmissionSchema = z.object({
  inviteId: z.string().`pending-id-${Date.now()}`,
  displayName: z.string().min(2),
  pin: z.string().min(4),
  cardOptIn: z.boolean().optional(),
  bank: z
    .object({
      accountNumber: z.string(),
      routingNumber: z.string(),
      bankName: z.string(),
      accountType: z.enum(['checking', 'savings', 'business']),
    })
    .optional(),
  wallet: z
    .object({
      address: z.string(),
      network: z.enum(['ethereum', 'polygon', 'solana']),
      asset: z.enum(['USDC', 'ETH', 'MATIC']),
    })
    .optional(),
});

const payoutSchema = z.object({
  requestId: z.string().`pending-id-${Date.now()}`,
  senderId: z.string(),
  recipientCallSign: z.string(),
  amount: z.number().positive(),
  currency: z.enum(['USD', 'EUR', 'GBP', 'USDC']),
  memo: z.string().optional(),
  requestedRail: z
    .enum(['mercury-ach', 'mercury-wire', 'circle-usdc', 'stripe-issuing', 'lithic-card', 'manual-review'])
    .optional(),
  requirePin: z.boolean().optional(),
  pin: z.string().optional(),
});

function resolveConfig(): AppConfig {
  try {
    return loadConfig();
  } catch {
    return {
      mercury: {
        apiKey: process.env.MERCURY_API_KEY ?? 'stub-api-key',
        baseUrl: process.env.MERCURY_BASE_URL ?? 'https://sandbox.mercury.com',
      },
      baseUrl: process.env.APP_BASE_URL ?? 'http://localhost:3000',
      referralBonusUsd: process.env.REFERRAL_BONUS_USD
        ? Number(process.env.REFERRAL_BONUS_USD)
        : undefined,
    };
  }
}

async function buildServer() {
  const config = resolveConfig();
  const orchestrator = createOrchestrator(config);
  const app = Fastify({ logger: true });

  app.post('/onboarding/invite', async (request, reply) => {
    const body = inviteSchema.parse(request.body);
    const invite = await orchestrator.onboarding.createInvite(body);
    reply.code(201).send(invite);
  });

  app.post('/onboarding/complete', async (request, reply) => {
    const submission = onboardingSubmissionSchema.parse(request.body);
    const profile = await orchestrator.onboarding.completeOnboarding(submission);
    reply.code(200).send(profile);
  });

  app.post('/payouts', async (request, reply) => {
    const body = payoutSchema.parse(request.body);
    const dispatch = await orchestrator.payoutRouter.dispatch(
      {
        requestId: body.requestId,
        senderId: body.senderId,
        recipientCallSign: body.recipientCallSign,
        amount: body.amount,
        currency: body.currency,
        memo: body.memo,
        requestedRail: body.requestedRail,
        requirePin: body.requirePin,
      },
      body.pin,
    );

    reply.code(202).send(dispatch);
  });

  app.get('/referrals', async (_request, reply) => {
    const events = await orchestrator.referral.listEvents();
    reply.send(events);
  });

  return app;
}

async function main() {
  const port = Number(process.env.PORT ?? 3333);
  const app = await buildServer();
  await app.listen({ port, host: '0.0.0.0' });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Failed to start server', error);
    process.exit(1);
  });
}

export { buildServer };
