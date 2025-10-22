import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

export const metricsRegistry = new Registry();
collectDefaultMetrics({ register: metricsRegistry, prefix: 'chittypayout_' });

export const inviteCounter = new Counter({
  name: 'chittypayout_invites_total',
  help: 'Number of onboarding invites created',
  registers: [metricsRegistry],
});

export const onboardingCounter = new Counter({
  name: 'chittypayout_onboardings_total',
  help: 'Number of recipients successfully onboarded',
  registers: [metricsRegistry],
});

export const payoutCounter = new Counter({
  name: 'chittypayout_payouts_total',
  help: 'Number of payouts dispatched',
  labelNames: ['rail', 'provider'],
  registers: [metricsRegistry],
});

export const webhookCounter = new Counter({
  name: 'chittypayout_webhooks_total',
  help: 'Webhook events processed',
  labelNames: ['provider', 'status'],
  registers: [metricsRegistry],
});

export const payoutLatency = new Histogram({
  name: 'chittypayout_payout_latency_seconds',
  help: 'Time spent dispatching payouts',
  labelNames: ['rail', 'provider'],
  buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10],
  registers: [metricsRegistry],
});

export function getMetrics(): Promise<string> {
  return metricsRegistry.metrics();
}

export function resetMetrics(): void {
  metricsRegistry.resetMetrics();
}
