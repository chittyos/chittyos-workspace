import { RecipientRepository } from '../repositories/types.js';
import { IntegrationClients } from '../integrations/interfaces.js';
import { webhookCounter } from '../monitoring/metrics.js';

interface MercuryWebhookPayload {
  event: string;
  data: {
    id: string;
    status: string;
    failure_reason?: string;
  };
}

interface CircleWebhookPayload {
  type: string;
  data: {
    id: string;
    status: string;
    failure_reason?: string;
  };
}

interface StripeIssuingPayload {
  type: string;
  data: {
    object: {
      id: string;
      status: string;
      failure_code?: string;
      failure_message?: string;
    };
  };
}

export class WebhookService {
  constructor(
    private readonly repository: RecipientRepository,
    private readonly integrations: Partial<IntegrationClients> = {},
  ) {}

  async handleMercury(payload: MercuryWebhookPayload): Promise<void> {
    const status = this.mapSettlementStatus(payload.data.status);
    await this.repository.updatePayoutStatus({
      externalReference: payload.data.id,
      status,
      failureReason: payload.data.failure_reason,
    });
    await this.recordLedgerSettlement('mercury', payload.data.id, status, payload.data.failure_reason);
    webhookCounter.inc({ provider: 'mercury', status });
  }

  async handleCircle(payload: CircleWebhookPayload): Promise<void> {
    const status = this.mapSettlementStatus(payload.data.status);
    await this.repository.updatePayoutStatus({
      externalReference: payload.data.id,
      status,
      failureReason: payload.data.failure_reason,
    });
    await this.recordLedgerSettlement('circle-usdc', payload.data.id, status, payload.data.failure_reason);
    webhookCounter.inc({ provider: 'circle', status });
  }

  async handleStripeIssuing(payload: StripeIssuingPayload): Promise<void> {
    const status = this.mapSettlementStatus(payload.data.object.status);
    const failureReason = payload.data.object.failure_message ?? payload.data.object.failure_code;
    await this.repository.updatePayoutStatus({
      externalReference: payload.data.object.id,
      status,
      failureReason,
    });
    await this.recordLedgerSettlement('stripe-issuing', payload.data.object.id, status, failureReason);
    webhookCounter.inc({ provider: 'stripe-issuing', status });
  }

  private async recordLedgerSettlement(
    providerId: string,
    reference: string,
    status: 'submitted' | 'settled' | 'failed',
    failureReason?: string,
  ) {
    if (!this.integrations.chittyLedger) {
      return;
    }

    const dispatch = await this.repository.getPayoutDispatch(reference);
    if (!dispatch) {
      return;
    }

    const callSign = dispatch.metadata?.callSign ?? 'unknown';

    await this.integrations.chittyLedger.recordLedgerEntry({
      referenceId: `${reference}:${status}`,
      callSign,
      senderId: dispatch.instructionId,
      amount: dispatch.amount,
      currency: dispatch.currency,
      type: 'payout',
      memo: `Settlement update via ${providerId}: ${status}`,
      metadata: {
        providerId,
        failureReason: failureReason ?? '',
      },
    });
  }

  private mapSettlementStatus(providerStatus: string): 'submitted' | 'settled' | 'failed' {
    const normalized = providerStatus.toLowerCase();
    if (['completed', 'settled', 'success', 'succeeded'].includes(normalized)) {
      return 'settled';
    }
    if (['failed', 'rejected', 'canceled', 'cancelled', 'error'].includes(normalized)) {
      return 'failed';
    }
    return 'submitted';
  }
}
