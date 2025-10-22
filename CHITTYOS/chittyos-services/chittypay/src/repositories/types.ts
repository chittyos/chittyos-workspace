import {
  OnboardingInvite,
  OnboardingSubmission,
  PayoutDispatch,
  RecipientProfile,
  ReferralEvent,
} from '../domain/types.js';

export interface RecipientRepository {
  reserveCallSign(callSign: string, seed: { displayName: string; email?: string }): Promise<RecipientProfile>;
  issueInvite(invite: Omit<OnboardingInvite, 'id' | 'status'>): Promise<OnboardingInvite>;
  getInvite(inviteId: string): Promise<OnboardingInvite | undefined>;
  completeOnboarding(submission: OnboardingSubmission): Promise<RecipientProfile>;
  getRecipientByCallSign(callSign: string): Promise<RecipientProfile | undefined>;
  updateRecipient(callSign: string, updates: Partial<RecipientProfile>): Promise<RecipientProfile>;
  recordReferral(event: ReferralEvent): Promise<void>;
  listReferrals(): Promise<ReferralEvent[]>;
  recordPayoutDispatch(dispatch: PayoutDispatch): Promise<void>;
  getPayoutDispatch(externalReference: string): Promise<PayoutDispatch | undefined>;
  updatePayoutStatus(input: {
    externalReference: string;
    status: PayoutDispatch['status'];
    failureReason?: string;
  }): Promise<void>;
}
