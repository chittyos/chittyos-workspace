import { randomUUID } from 'node:crypto';
import { Pool, PoolClient } from 'pg';
import {
  OnboardingInvite,
  OnboardingSubmission,
  PayoutDestination,
  PayoutDispatch,
  RecipientProfile,
  ReferralEvent,
} from '../domain/types.js';
import { PinHasher } from '../utils/pin.js';
import { RecipientRepository } from './types.js';

interface RecipientRow {
  id: string;
  call_sign: string;
  display_name: string;
  email: string;
  status: string;
  pin_hash: string | null;
  preferred_rail: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

interface DestinationRow {
  id: string;
  recipient_id: string;
  rail: string;
  bank: Record<string, unknown> | null;
  wallet: Record<string, unknown> | null;
  card: Record<string, unknown> | null;
  is_default: boolean;
  created_at: Date;
}

interface InviteRow {
  id: string;
  sender_id: string;
  sender_name: string;
  recipient_email: string;
  call_sign: string;
  onboarding_url: string;
  expires_at: Date;
  status: string;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

function normalizeMetadata(
  input: Record<string, unknown> | string | null | undefined,
): Record<string, string> {
  if (!input) {
    return {};
  }

  let source: Record<string, unknown>;
  if (typeof input === 'string') {
    try {
      source = JSON.parse(input);
    } catch {
      return {};
    }
  } else {
    source = input;
  }

  return Object.entries(source).reduce<Record<string, string>>((acc, [key, value]) => {
    acc[key] = value == null ? '' : String(value);
    return acc;
  }, {});
}

function mapDestination(row: DestinationRow): PayoutDestination {
  return {
    id: row.id,
    rail: row.rail as PayoutDestination['rail'],
    bank: row.bank as PayoutDestination['bank'],
    wallet: row.wallet as PayoutDestination['wallet'],
    card: row.card as PayoutDestination['card'],
    createdAt: row.created_at.toISOString(),
    isDefault: row.is_default || undefined,
  };
}

export class PostgresRecipientRepository implements RecipientRepository {
  private readonly pinHasher = new PinHasher();

  constructor(private readonly pool: Pool) {}

  async reserveCallSign(callSign: string, seed: { displayName: string; email?: string }): Promise<RecipientProfile> {
    const id = randomUUID();
    const reservedEmail = seed.email ?? 'reserved@placeholder.local';
    const metadata = { reserved: 'true' };

    const result = await this.pool.query<RecipientRow>(
      `INSERT INTO recipients (id, call_sign, display_name, email, status, metadata)
       VALUES ($1, $2, $3, $4, 'pending', $5::jsonb)
       ON CONFLICT (call_sign)
       DO UPDATE SET display_name = EXCLUDED.display_name, updated_at = NOW()
       RETURNING *`,
      [id, callSign, seed.displayName, reservedEmail, JSON.stringify(metadata)],
    );

    const row = result.rows[0] ?? (await this.fetchRecipientByCallSign(callSign));
    if (!row) {
      throw new Error('Failed to reserve call sign');
    }
    const destinations = await this.fetchDestinations(row.id);
    return this.mapRecipient(row, destinations);
  }

  async issueInvite(invite: Omit<OnboardingInvite, 'id' | 'status'>): Promise<OnboardingInvite> {
    const id = randomUUID();
    const result = await this.pool.query<InviteRow>(
      `INSERT INTO onboarding_invites (
         id, sender_id, sender_name, recipient_email, call_sign, onboarding_url, expires_at, status, metadata
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'issued', $8::jsonb)
       RETURNING *`,
      [
        id,
        invite.senderId,
        invite.senderName,
        invite.recipientEmail,
        invite.callSign,
        invite.onboardingUrl,
        invite.expiresAt,
        JSON.stringify(invite.metadata ?? {}),
      ],
    );

    return this.mapInvite(result.rows[0]);
  }

  async getInvite(inviteId: string): Promise<OnboardingInvite | undefined> {
    const result = await this.pool.query<InviteRow>(
      `SELECT * FROM onboarding_invites WHERE id = $1`,
      [inviteId],
    );
    const row = result.rows[0];
    if (!row) {
      return undefined;
    }
    return this.mapInvite(row);
  }

  async completeOnboarding(submission: OnboardingSubmission): Promise<RecipientProfile> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const inviteResult = await client.query<InviteRow>(
        `SELECT * FROM onboarding_invites WHERE id = $1 FOR UPDATE`,
        [submission.inviteId],
      );
      const invite = inviteResult.rows[0];
      if (!invite) {
        throw new Error('Invalid invite.');
      }
      if (invite.status === 'expired' || invite.expires_at.getTime() < Date.now()) {
        throw new Error('Invite expired.');
      }

      const recipientRow = await this.fetchRecipientRowByCallSign(client, invite.call_sign);
      if (!recipientRow) {
        throw new Error('Recipient not reserved');
      }

      const pinHash = await this.pinHasher.hashPin(submission.pin);
      const now = new Date();

      await client.query(
        `UPDATE recipients
           SET display_name = $1,
               email = $2,
               status = 'ready',
               pin_hash = $3,
               preferred_rail = $4,
               metadata = COALESCE(metadata, '{}'::jsonb) - 'reserved',
               updated_at = $5
         WHERE id = $6`,
        [
          submission.displayName,
          invite.recipient_email,
          pinHash,
          submission.bank ? 'mercury-ach' : submission.wallet ? 'circle-usdc' : null,
          now,
          recipientRow.id,
        ],
      );

      await client.query(`DELETE FROM recipient_destinations WHERE recipient_id = $1`, [recipientRow.id]);

      if (submission.bank) {
        const destId = randomUUID();
        await client.query(
          `INSERT INTO recipient_destinations (id, recipient_id, rail, bank, is_default, created_at)
           VALUES ($1, $2, 'mercury-ach', $3::jsonb, true, $4)`,
          [destId, recipientRow.id, JSON.stringify(submission.bank), now],
        );
      }

      if (submission.wallet) {
        const destId = randomUUID();
        await client.query(
          `INSERT INTO recipient_destinations (id, recipient_id, rail, wallet, is_default, created_at)
           VALUES ($1, $2, 'circle-usdc', $3::jsonb, $4, $5)`,
          [destId, recipientRow.id, JSON.stringify(submission.wallet), !submission.bank, now],
        );
      }

      if (submission.cardOptIn) {
        const destId = randomUUID();
        const card = {
          provider: 'stripe',
          cardToken: `pending_${Date.now()}`,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        };
        await client.query(
          `INSERT INTO recipient_destinations (id, recipient_id, rail, card, is_default, created_at)
           VALUES ($1, $2, 'stripe-issuing', $3::jsonb, false, $4)`,
          [destId, recipientRow.id, JSON.stringify(card), now],
        );
      }

      await client.query(
        `UPDATE onboarding_invites SET status = 'completed' WHERE id = $1`,
        [submission.inviteId],
      );

      await client.query('COMMIT');

      const updatedRecipient = await this.fetchRecipientByCallSign(invite.call_sign);
      if (!updatedRecipient) {
        throw new Error('Recipient not found after onboarding');
      }
      const updatedDestinations = await this.fetchDestinations(updatedRecipient.id);
      return this.mapRecipient(updatedRecipient, updatedDestinations);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getRecipientByCallSign(callSign: string): Promise<RecipientProfile | undefined> {
    const row = await this.fetchRecipientByCallSign(callSign);
    if (!row) {
      return undefined;
    }
    const destinations = await this.fetchDestinations(row.id);
    return this.mapRecipient(row, destinations);
  }

  async updateRecipient(callSign: string, updates: Partial<RecipientProfile>): Promise<RecipientProfile> {
    const row = await this.fetchRecipientByCallSign(callSign);
    if (!row) {
      throw new Error('Recipient not found');
    }

    const mergedMetadata = {
      ...normalizeMetadata(row.metadata),
      ...(updates.metadata ?? {}),
    };

    await this.pool.query(
      `UPDATE recipients
         SET display_name = COALESCE($1, display_name),
             email = COALESCE($2, email),
             status = COALESCE($3, status),
             pin_hash = COALESCE($4, pin_hash),
             preferred_rail = COALESCE($5, preferred_rail),
             metadata = $6::jsonb,
             updated_at = NOW()
       WHERE call_sign = $7`,
      [
        updates.displayName,
        updates.email,
        updates.status,
        updates.pinHash,
        updates.preferredRail,
        JSON.stringify(mergedMetadata),
        callSign,
      ],
    );

    const updated = await this.fetchRecipientByCallSign(callSign);
    if (!updated) {
      throw new Error('Failed to update recipient');
    }
    const destinations = await this.fetchDestinations(updated.id);
    return this.mapRecipient(updated, destinations);
  }

  async recordReferral(event: ReferralEvent): Promise<void> {
    await this.pool.query(
      `INSERT INTO referral_events (id, sender_id, recipient_id, type, value, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [event.id, event.senderId, event.recipientId, event.type, event.value, event.createdAt],
    );
  }

  async listReferrals(): Promise<ReferralEvent[]> {
    const result = await this.pool.query<ReferralEvent>(
      `SELECT id, sender_id as "senderId", recipient_id as "recipientId", type, value, created_at as "createdAt"
         FROM referral_events
         ORDER BY created_at DESC`,
    );
    return result.rows.map((row) => ({
      ...row,
      createdAt: typeof row.createdAt === 'string' ? row.createdAt : new Date(row.createdAt).toISOString(),
    }));
  }

  async recordPayoutDispatch(dispatch: PayoutDispatch): Promise<void> {
    await this.pool.query(
      `INSERT INTO payout_dispatches (
         external_reference, instruction_id, provider_id, rail, amount, currency, status, metadata, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $9)
       ON CONFLICT (external_reference)
       DO UPDATE SET status = EXCLUDED.status, metadata = EXCLUDED.metadata, updated_at = EXCLUDED.updated_at`,
      [
        dispatch.externalReference,
        dispatch.instructionId,
        dispatch.providerId,
        dispatch.rail,
        dispatch.amount,
        dispatch.currency,
        dispatch.status,
        JSON.stringify(dispatch.metadata ?? {}),
        dispatch.createdAt,
      ],
    );
  }

  async getPayoutDispatch(externalReference: string): Promise<PayoutDispatch | undefined> {
    const result = await this.pool.query(
      `SELECT external_reference,
              instruction_id,
              provider_id,
              rail,
              amount,
              currency,
              status,
              failure_reason,
              metadata,
              created_at,
              updated_at
         FROM payout_dispatches
        WHERE external_reference = $1`,
      [externalReference],
    );

    const row = result.rows[0];
    if (!row) {
      return undefined;
    }

    return {
      instructionId: row.instruction_id,
      providerId: row.provider_id,
      rail: row.rail,
      amount: Number(row.amount),
      currency: row.currency,
      externalReference: row.external_reference,
      status: row.status,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      failureReason: row.failure_reason ?? undefined,
      metadata: normalizeMetadata(row.metadata),
    };
  }

  async updatePayoutStatus(input: {
    externalReference: string;
    status: PayoutDispatch['status'];
    failureReason?: string;
  }): Promise<void> {
    await this.pool.query(
      `UPDATE payout_dispatches
         SET status = $2,
             failure_reason = $3,
             updated_at = NOW()
       WHERE external_reference = $1`,
      [input.externalReference, input.status, input.failureReason ?? null],
    );
  }

  // Helper methods

  private async fetchRecipientByCallSign(callSign: string): Promise<RecipientRow | undefined> {
    const result = await this.pool.query<RecipientRow>(
      `SELECT * FROM recipients WHERE call_sign = $1`,
      [callSign],
    );
    return result.rows[0];
  }

  private async fetchRecipientRowByCallSign(client: PoolClient, callSign: string): Promise<RecipientRow | undefined> {
    const result = await client.query<RecipientRow>(
      `SELECT * FROM recipients WHERE call_sign = $1 FOR UPDATE`,
      [callSign],
    );
    return result.rows[0];
  }

  private async fetchDestinations(recipientId: string): Promise<PayoutDestination[]> {
    const result = await this.pool.query<DestinationRow>(
      `SELECT * FROM recipient_destinations WHERE recipient_id = $1 ORDER BY created_at`,
      [recipientId],
    );
    return result.rows.map(mapDestination);
  }

  private mapRecipient(row: RecipientRow, destinations: PayoutDestination[]): RecipientProfile {
    return {
      id: row.id,
      callSign: row.call_sign,
      displayName: row.display_name,
      email: row.email,
      status: row.status as RecipientProfile['status'],
      pinHash: row.pin_hash ?? undefined,
      preferredRail: (row.preferred_rail ?? undefined) as RecipientProfile['preferredRail'],
      destinations,
      metadata: normalizeMetadata(row.metadata),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private mapInvite(row: InviteRow): OnboardingInvite {
    const invite: OnboardingInvite = {
      id: row.id,
      senderId: row.sender_id,
      senderName: row.sender_name,
      recipientEmail: row.recipient_email,
      callSign: row.call_sign,
      onboardingUrl: row.onboarding_url,
      expiresAt: row.expires_at.toISOString(),
      status: row.status as OnboardingInvite['status'],
      metadata: normalizeMetadata(row.metadata),
    };
    return invite;
  }
}
