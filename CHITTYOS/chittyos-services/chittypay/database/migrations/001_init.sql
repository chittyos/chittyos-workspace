CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS recipients (
    id UUID PRIMARY KEY,
    call_sign TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    email TEXT NOT NULL,
    status TEXT NOT NULL,
    pin_hash TEXT,
    preferred_rail TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipient_destinations (
    id UUID PRIMARY KEY,
    recipient_id UUID NOT NULL REFERENCES recipients(id) ON DELETE CASCADE,
    rail TEXT NOT NULL,
    bank JSONB,
    wallet JSONB,
    card JSONB,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS onboarding_invites (
    id UUID PRIMARY KEY,
    sender_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    call_sign TEXT NOT NULL REFERENCES recipients(call_sign),
    onboarding_url TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referral_events (
    id UUID PRIMARY KEY,
    sender_id TEXT NOT NULL,
    recipient_id TEXT NOT NULL,
    type TEXT NOT NULL,
    value NUMERIC(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payout_dispatches (
    external_reference TEXT PRIMARY KEY,
    instruction_id TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    rail TEXT NOT NULL,
    amount NUMERIC(14,2) NOT NULL,
    currency TEXT NOT NULL,
    status TEXT NOT NULL,
    failure_reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recipients_status ON recipients(status);
CREATE INDEX IF NOT EXISTS idx_destinations_recipient ON recipient_destinations(recipient_id);
CREATE INDEX IF NOT EXISTS idx_invites_email ON onboarding_invites(recipient_email);
CREATE INDEX IF NOT EXISTS idx_dispatches_status ON payout_dispatches(status);
