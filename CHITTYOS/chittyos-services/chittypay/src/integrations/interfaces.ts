export interface ChittyIdGateway {
  reserveCallSign: (input: {
    displayName: string;
    email: string;
  }) => Promise<{ callSign: string; externalId?: string }>;
}

export interface ChittyTrustGateway {
  enqueueKycCheck: (input: {
    recipientId: string;
    displayName: string;
    email: string;
    callSign: string;
  }) => Promise<{ status: 'queued' | 'verified' | 'manual'; referenceId: string }>;
}

export interface ChittyLedgerGateway {
  recordLedgerEntry: (input: {
    referenceId: string;
    callSign: string;
    senderId: string;
    amount: number;
    currency: string;
    type: 'invite' | 'onboarding' | 'payout' | 'referral';
    memo?: string;
    metadata?: Record<string, string>;
  }) => Promise<void>;
}

export interface IntegrationClients {
  chittyId: ChittyIdGateway;
  chittyTrust: ChittyTrustGateway;
  chittyLedger: ChittyLedgerGateway;
}
