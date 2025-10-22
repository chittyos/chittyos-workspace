import { randomUUID } from 'node:crypto';
import {
  OnboardingInvite,
  OnboardingSubmission,
  PayoutDestination,
  RecipientProfile,
  ReferralEvent,
} from '../domain/types.js';
import { PinHasher } from '../utils/pin.js';

interface RecipientStore {
  recipients: Map<string, RecipientProfile>;
  invites: Map<string, OnboardingInvite>;
  referrals: ReferralEvent[];
}

export class InMemoryRepository {
  private readonly store: RecipientStore;
  private readonly pinHasher: PinHasher;

  constructor(store?: RecipientStore) {
    this.store =
      store ?? {
        recipients: new Map(),
        invites: new Map(),
        referrals: [],
      };
    this.pinHasher = new PinHasher();
  }

  reserveCallSign(callSign: string, seed: { displayName: string; email?: string }): RecipientProfile {
    const existing = this.store.recipients.get(callSign);
    if (existing) {
      return existing;
    }

    const now = new Date().toISOString();
    const placeholder: RecipientProfile = {
      id: randomUUID(),
      callSign,
      displayName: seed.displayName,
      email: seed.email ?? 'reserved@placeholder.local',
      status: 'pending',
      destinations: [],
      metadata: { reserved: 'true' },
      createdAt: now,
      updatedAt: now,
    };

    this.store.recipients.set(callSign, placeholder);
    return placeholder;
  }

  issueInvite(invite: Omit<OnboardingInvite, 'id' | 'status'>): OnboardingInvite {
    const id = randomUUID();
    const record: OnboardingInvite = { ...invite, id, status: 'issued' };
    this.store.invites.set(id, record);
    return record;
  }

  getInvite(inviteId: string): OnboardingInvite | undefined {
    const invite = this.store.invites.get(inviteId);
    if (!invite) {
      return undefined;
    }

    if (new Date(invite.expiresAt).getTime() < Date.now()) {
      invite.status = 'expired';
    }
    return invite;
  }

  async completeOnboarding(submission: OnboardingSubmission): Promise<RecipientProfile> {
    const invite = this.getInvite(submission.inviteId);
    if (!invite) {
      throw new Error('Invalid invite.');
    }

    if (invite.status === 'expired') {
      throw new Error('Invite expired.');
    }

    const id = randomUUID();
    const pinHash = await this.pinHasher.hashPin(submission.pin);
    const now = new Date().toISOString();
    const destinations: PayoutDestination[] = [];

    if (submission.bank) {
      destinations.push({
        id: randomUUID(),
        rail: 'mercury-ach',
        bank: submission.bank,
        createdAt: now,
        isDefault: true,
      });
    }

    if (submission.wallet) {
      destinations.push({
        id: randomUUID(),
        rail: 'circle-usdc',
        wallet: submission.wallet,
        createdAt: now,
      });
    }

    if (submission.cardOptIn) {
      destinations.push({
        id: randomUUID(),
        rail: 'stripe-issuing',
        card: {
          provider: 'stripe',
          cardToken: `pending_${Date.now()}`,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        },
        createdAt: now,
      });
    }

    const profile: RecipientProfile = {
      id,
      callSign: invite.callSign,
      displayName: submission.displayName,
      email: invite.recipientEmail,
      status: 'ready',
      pinHash,
      preferredRail: destinations.find((item) => item.isDefault)?.rail,
      destinations,
      metadata: {},
      createdAt: now,
      updatedAt: now,
    };

    this.store.recipients.set(profile.callSign, profile);
    invite.status = 'completed';
    return profile;
  }

  getRecipientByCallSign(callSign: string): RecipientProfile | undefined {
    return this.store.recipients.get(callSign);
  }

  updateRecipient(callSign: string, updates: Partial<RecipientProfile>): RecipientProfile {
    const existing = this.store.recipients.get(callSign);
    if (!existing) {
      throw new Error('Recipient not found');
    }

    const updated: RecipientProfile = {
      ...existing,
      ...updates,
      destinations: updates.destinations ?? existing.destinations,
      updatedAt: new Date().toISOString(),
    };

    this.store.recipients.set(callSign, updated);
    return updated;
  }

  recordReferral(event: ReferralEvent): void {
    this.store.referrals.push(event);
  }

  listReferrals(): ReferralEvent[] {
    return [...this.store.referrals];
  }
}
