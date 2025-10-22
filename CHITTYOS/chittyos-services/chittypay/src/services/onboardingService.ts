import { randomUUID } from 'node:crypto';
import { RecipientRepository } from '../repositories/types.js';
import { CallSignService } from './callSignService.js';
import { OnboardingInvite, OnboardingSubmission, RecipientProfile } from '../domain/types.js';
import { IntegrationClients } from '../integrations/interfaces.js';
import { inviteCounter, onboardingCounter } from '../monitoring/metrics.js';

interface CreateInviteInput {
  senderId: string;
  senderName: string;
  recipientEmail: string;
  displayName: string;
  expiresInHours?: number;
}

export class OnboardingService {
  constructor(
    private readonly repository: RecipientRepository,
    private readonly callSignService: CallSignService,
    private readonly baseUrl: string,
    private readonly integrations: Partial<IntegrationClients> = {},
  ) {}

  async createInvite(input: CreateInviteInput): Promise<OnboardingInvite> {
    const callSign = await this.resolveCallSign(input);

    const invite = await this.repository.issueInvite({
      senderId: input.senderId,
      senderName: input.senderName,
      recipientEmail: input.recipientEmail,
      callSign,
      onboardingUrl: this.buildOnboardingUrl(callSign),
      expiresAt: this.computeExpiry(input.expiresInHours ?? 72),
      metadata: { displayName: input.displayName },
    });

    await this.integrations.chittyLedger?.recordLedgerEntry({
      referenceId: invite.id,
      callSign,
      senderId: input.senderId,
      amount: 0,
      currency: 'USD',
      type: 'invite',
      memo: 'Recipient invite issued',
      metadata: {
        senderName: input.senderName,
        recipientEmail: input.recipientEmail,
      },
    });

    inviteCounter.inc();

    return invite;
  }

  async completeOnboarding(submission: OnboardingSubmission): Promise<RecipientProfile> {
    const invite = await this.repository.getInvite(submission.inviteId);
    if (!invite || invite.status === 'expired') {
      throw new Error('Invalid or expired invite.');
    }

    const profile = await this.repository.completeOnboarding(submission);

    try {
      if (this.integrations.chittyTrust) {
        const trustResult = await this.integrations.chittyTrust.enqueueKycCheck({
          recipientId: profile.id,
          displayName: profile.displayName,
          email: profile.email,
          callSign: profile.callSign,
        });

        await this.repository.updateRecipient(profile.callSign, {
          metadata: {
            ...(profile.metadata ?? {}),
            kycStatus: trustResult.status,
            kycReference: trustResult.referenceId,
          },
        });
      }
    } catch (error) {
      await this.repository.updateRecipient(profile.callSign, {
        metadata: {
          ...(profile.metadata ?? {}),
          kycStatus: 'manual',
          kycError: error instanceof Error ? error.message : 'unknown-error',
        },
      });
    }

    await this.integrations.chittyLedger?.recordLedgerEntry({
      referenceId: randomUUID(),
      callSign: profile.callSign,
      senderId: invite.senderId,
      amount: 0,
      currency: 'USD',
      type: 'onboarding',
      memo: 'Recipient onboarding completed',
    });

    onboardingCounter.inc();

    return (await this.repository.getRecipientByCallSign(profile.callSign)) ?? profile;
  }

  private async resolveCallSign(input: CreateInviteInput): Promise<string> {
    if (this.integrations.chittyId) {
      const { callSign } = await this.integrations.chittyId.reserveCallSign({
        displayName: input.displayName,
        email: input.recipientEmail,
      });
      const normalized = callSign.startsWith('/') ? callSign : `/${callSign}`;
      await this.callSignService.reserveCallSign(normalized, {
        displayName: input.displayName,
        email: input.recipientEmail,
      });
      return normalized;
    }

    return this.callSignService.generateCallSign(input.displayName, {
      reserve: true,
      email: input.recipientEmail,
    });
  }

  private buildOnboardingUrl(callSign: string): string {
    return `${this.baseUrl}/onboard${callSign}`;
  }

  private computeExpiry(hours: number): string {
    const expires = new Date(Date.now() + hours * 60 * 60 * 1000);
    return expires.toISOString();
  }

  issueMagicLink(): string {
    return `${this.baseUrl}/magic/${randomUUID()}`;
  }
}
