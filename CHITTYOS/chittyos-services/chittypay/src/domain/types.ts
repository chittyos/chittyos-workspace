export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'USDC';

export type PayoutRail =
  | 'mercury-ach'
  | 'mercury-wire'
  | 'circle-usdc'
  | 'stripe-issuing'
  | 'lithic-card'
  | 'manual-review';

export type RecipientStatus = 'pending' | 'ready' | 'suspended';

export interface BankAccountDetails {
  accountNumber: string;
  routingNumber: string;
  bankName: string;
  accountType: 'checking' | 'savings' | 'business';
}

export interface WalletDetails {
  address: string;
  network: 'ethereum' | 'polygon' | 'solana';
  asset: 'USDC' | 'ETH' | 'MATIC';
}

export interface CardAccessDetails {
  provider: 'stripe' | 'lithic';
  cardToken: string;
  expiresAt: string;
}

export interface PayoutDestination {
  id: string;
  rail: PayoutRail;
  bank?: BankAccountDetails;
  wallet?: WalletDetails;
  card?: CardAccessDetails;
  createdAt: string;
  isDefault?: boolean;
}

export interface RecipientProfile {
  id: string;
  callSign: string;
  displayName: string;
  email: string;
  status: RecipientStatus;
  pinHash?: string;
  preferredRail?: PayoutRail;
  destinations: PayoutDestination[];
  metadata?: Record<string, string>;
  referralCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingInvite {
  id: string;
  senderId: string;
  senderName: string;
  recipientEmail: string;
  callSign: string;
  onboardingUrl: string;
  expiresAt: string;
  status: 'issued' | 'completed' | 'expired';
  metadata?: Record<string, string>;
}

export interface OnboardingSubmission {
  inviteId: string;
  displayName: string;
  pin: string;
  bank?: BankAccountDetails;
  wallet?: WalletDetails;
  cardOptIn?: boolean;
}

export interface ReferralEvent {
  id: string;
  senderId: string;
  recipientId: string;
  type: 'invite-sent' | 'recipient-verified' | 'wallet-opt-in' | 'card-issued';
  value: number;
  createdAt: string;
}

export interface PayoutInstruction {
  requestId: string;
  senderId: string;
  recipientCallSign: string;
  amount: number;
  currency: CurrencyCode;
  memo?: string;
  requestedRail?: PayoutRail;
  requirePin?: boolean;
  metadata?: Record<string, string>;
}

export interface PayoutDispatch {
  instructionId: string;
  providerId: string;
  rail: PayoutRail;
  amount: number;
  currency: CurrencyCode;
  externalReference: string;
  status: 'submitted' | 'settled' | 'failed';
  createdAt: string;
  updatedAt: string;
  failureReason?: string;
  metadata?: Record<string, string>;
}

export interface PaymentProvider {
  id: string;
  supportedRails: PayoutRail[];
  sendPayout: (input: {
    destination: PayoutDestination;
    amount: number;
    currency: CurrencyCode;
    memo?: string;
    metadata?: Record<string, string>;
  }) => Promise<{ reference: string; estimatedArrival: string }>;
}

export interface ProviderRegistry {
  resolveProvider: (rail: PayoutRail) => PaymentProvider | undefined;
  listProviders: () => PaymentProvider[];
}

export interface PinVerifier {
  hashPin: (pin: string) => Promise<string>;
  verifyPin: (pin: string, hash: string) => Promise<boolean>;
}
