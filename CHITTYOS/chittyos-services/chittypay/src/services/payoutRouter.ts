import {
  PayoutInstruction,
  PayoutDispatch,
  RecipientProfile,
  PaymentProvider,
  PayoutDestination,
  ProviderRegistry,
} from '../domain/types.js';
import { RecipientRepository } from '../repositories/types.js';
import { PinHasher } from '../utils/pin.js';
import { IntegrationClients } from '../integrations/interfaces.js';
import { payoutCounter, payoutLatency } from '../monitoring/metrics.js';

interface PayoutRouterOptions {
  enforcePin?: boolean;
}

export class PayoutRouter {
  private readonly pinHasher: PinHasher;

  constructor(
    private readonly repository: RecipientRepository,
    private readonly registry: ProviderRegistry,
    private readonly options: PayoutRouterOptions = {},
    private readonly integrations: Partial<IntegrationClients> = {},
  ) {
    this.pinHasher = new PinHasher();
  }

  async dispatch(instruction: PayoutInstruction, pin?: string): Promise<PayoutDispatch> {
    const recipient = await this.requireRecipient(instruction.recipientCallSign);
    const destination = this.resolveDestination(recipient, instruction);
    const provider = this.requireProvider(destination);

    if (this.options.enforcePin || instruction.requirePin || recipient.pinHash) {
      if (!pin) {
        throw new Error('PIN is required for the first payout.');
      }

      if (!recipient.pinHash) {
        throw new Error('Recipient PIN is not set.');
      }

      const valid = await this.pinHasher.verifyPin(pin, recipient.pinHash);
      if (!valid) {
        throw new Error('Invalid PIN.');
      }
    }

    const stopTimer = payoutLatency.startTimer({ rail: destination.rail, provider: provider.id });
    let reference: string;
    let estimatedArrival: string;
    try {
      const result = await provider.sendPayout({
        destination,
        amount: instruction.amount,
        currency: instruction.currency,
        memo: instruction.memo,
        metadata: {
          ...instruction.metadata,
          recipientName: recipient.displayName,
          callSign: recipient.callSign,
        },
      });
      reference = result.reference;
      estimatedArrival = result.estimatedArrival;
    } finally {
      stopTimer();
    }

    const dispatch: PayoutDispatch = {
      instructionId: instruction.requestId,
      providerId: provider.id,
      rail: destination.rail,
      amount: instruction.amount,
      currency: instruction.currency,
      externalReference: reference,
      status: 'submitted',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        estimatedArrival,
        callSign: recipient.callSign,
      },
    };

    await this.repository.recordPayoutDispatch(dispatch);

    await this.integrations.chittyLedger?.recordLedgerEntry({
      referenceId: dispatch.externalReference,
      callSign: recipient.callSign,
      senderId: instruction.senderId,
      amount: instruction.amount,
      currency: instruction.currency,
      type: 'payout',
      memo: instruction.memo,
      metadata: {
        rail: destination.rail,
        providerId: provider.id,
      },
    });

    payoutCounter.inc({ rail: destination.rail, provider: provider.id });

    return dispatch;
  }

  private async requireRecipient(callSign: string): Promise<RecipientProfile> {
    const recipient = await this.repository.getRecipientByCallSign(callSign);
    if (!recipient) {
      throw new Error(`Recipient ${callSign} not found`);
    }
    if (recipient.status !== 'ready') {
      throw new Error(`Recipient ${callSign} is not ready for payouts`);
    }
    return recipient;
  }

  private resolveDestination(
    recipient: RecipientProfile,
    instruction: PayoutInstruction,
  ): PayoutDestination {
    const { requestedRail } = instruction;

    if (requestedRail) {
      const match = recipient.destinations.find((dest) => dest.rail === requestedRail);
      if (!match) {
        throw new Error(`Recipient does not support requested rail ${requestedRail}`);
      }
      return match;
    }

    const defaultDestination =
      recipient.destinations.find((dest) => dest.isDefault) ?? recipient.destinations[0];

    if (!defaultDestination) {
      throw new Error('Recipient does not have any payout destinations');
    }

    return defaultDestination;
  }

  private requireProvider(destination: PayoutDestination): PaymentProvider {
    const provider = this.registry.resolveProvider(destination.rail);
    if (!provider) {
      throw new Error(`No provider configured for rail ${destination.rail}`);
    }
    return provider;
  }
}
