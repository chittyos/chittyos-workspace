import { randomUUID } from 'node:crypto';
import { RecipientRepository } from '../repositories/types.js';
import { ReferralEvent } from '../domain/types.js';
import { IntegrationClients } from '../integrations/interfaces.js';

interface ReferralTriggerInput {
  senderId: string;
  recipientId: string;
  type: ReferralEvent['type'];
  value?: number;
}

export class ReferralService {
  constructor(
    private readonly repository: RecipientRepository,
    private readonly bonusUsd = 0,
    private readonly integrations: Partial<IntegrationClients> = {},
  ) {}

  async trackEvent(input: ReferralTriggerInput): Promise<ReferralEvent> {
    const event: ReferralEvent = {
      id: randomUUID(),
      senderId: input.senderId,
      recipientId: input.recipientId,
      type: input.type,
      value: input.value ?? this.defaultValue(input.type),
      createdAt: new Date().toISOString(),
    };

    await this.repository.recordReferral(event);

    await this.integrations.chittyLedger?.recordLedgerEntry({
      referenceId: event.id,
      callSign: input.recipientId,
      senderId: input.senderId,
      amount: event.value,
      currency: 'USD',
      type: 'referral',
      memo: `Referral event: ${input.type}`,
    });

    return event;
  }

  async listEvents(): Promise<ReferralEvent[]> {
    return this.repository.listReferrals();
  }

  private defaultValue(type: ReferralEvent['type']): number {
    if (type === 'recipient-verified') {
      return this.bonusUsd;
    }
    return 0;
  }
}
