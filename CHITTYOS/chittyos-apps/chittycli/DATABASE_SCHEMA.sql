-- ChittyID Database Schema
-- Supports audit trail, minting status tracking, and immutability enforcement

-- Main identity table with minting status
CREATE TABLE IF NOT EXISTS chitty_identity (
    chitty_id VARCHAR(50) PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Minting status progression
    minting_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (minting_status IN ('PENDING', 'SOFT_MINTED', 'HARD_MINTED', 'FAILED')),

    -- Soft mint fields
    soft_minted_at TIMESTAMP WITH TIME ZONE,
    soft_mint_hash VARCHAR(64),
    verified BOOLEAN DEFAULT FALSE,

    -- Hard mint fields (immutable after set)
    hard_minted_at TIMESTAMP WITH TIME ZONE,
    transaction_hash VARCHAR(66), -- Ethereum tx hash
    block_number BIGINT,
    gas_used BIGINT,
    irreversible_at TIMESTAMP WITH TIME ZONE,
    chain_anchor VARCHAR(255),

    -- Metadata
    identity_type VARCHAR(50),
    source_system VARCHAR(50),
    attributes JSONB,

    -- Validation tracking
    last_validated_at TIMESTAMP WITH TIME ZONE,
    validation_count INTEGER DEFAULT 0,
    validation_failures INTEGER DEFAULT 0,

    -- Security fields
    created_by VARCHAR(255),
    api_key_hash VARCHAR(64),

    -- Ensure immutability after hard mint
    CONSTRAINT no_update_after_hard_mint CHECK (
        (minting_status != 'HARD_MINTED') OR
        (minting_status = 'HARD_MINTED' AND hard_minted_at = updated_at)
    )
);

-- Indexes for performance
CREATE INDEX idx_chitty_identity_minting_status ON chitty_identity(minting_status);
CREATE INDEX idx_chitty_identity_created_at ON chitty_identity(created_at);
CREATE INDEX idx_chitty_identity_source_system ON chitty_identity(source_system);
CREATE INDEX idx_chitty_identity_verified ON chitty_identity(verified);

-- Append-only audit trail table
CREATE TABLE IF NOT EXISTS chitty_audit_trail (
    id BIGSERIAL PRIMARY KEY,
    chitty_id VARCHAR(50) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

    -- Event details
    actor VARCHAR(255) NOT NULL,
    action VARCHAR(100) NOT NULL,
    details JSONB,

    -- Validation specific
    validation_result BOOLEAN,
    validation_reason VARCHAR(255),
    validation_latency_ms INTEGER,

    -- Cryptographic proof
    proof_hash VARCHAR(64) NOT NULL,
    previous_hash VARCHAR(64),

    -- Chain anchoring (future)
    chain_tx VARCHAR(66),
    chain_block BIGINT,

    -- Metadata
    ip_address INET,
    user_agent TEXT,
    api_version VARCHAR(20),

    FOREIGN KEY (chitty_id) REFERENCES chitty_identity(chitty_id)
);

-- Indexes for audit queries
CREATE INDEX idx_audit_chitty_id ON chitty_audit_trail(chitty_id);
CREATE INDEX idx_audit_event_timestamp ON chitty_audit_trail(event_timestamp);
CREATE INDEX idx_audit_event_type ON chitty_audit_trail(event_type);
CREATE INDEX idx_audit_actor ON chitty_audit_trail(actor);

-- Prevent updates and deletes on audit trail (append-only)
CREATE RULE no_update_audit AS ON UPDATE TO chitty_audit_trail DO INSTEAD NOTHING;
CREATE RULE no_delete_audit AS ON DELETE TO chitty_audit_trail DO INSTEAD NOTHING;

-- Validation cache table (for performance)
CREATE TABLE IF NOT EXISTS chitty_validation_cache (
    chitty_id VARCHAR(50) PRIMARY KEY,
    is_valid BOOLEAN NOT NULL,
    validated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() + INTERVAL '5 minutes',
    validation_source VARCHAR(50),
    response_data JSONB
);

-- Auto-cleanup expired cache entries
CREATE INDEX idx_validation_cache_expires ON chitty_validation_cache(expires_at);

-- Metrics table for monitoring
CREATE TABLE IF NOT EXISTS chitty_metrics (
    metric_date DATE NOT NULL,
    metric_hour INTEGER NOT NULL CHECK (metric_hour >= 0 AND metric_hour < 24),

    -- Counters
    ids_generated INTEGER DEFAULT 0,
    ids_validated INTEGER DEFAULT 0,
    validation_failures INTEGER DEFAULT 0,
    soft_mints INTEGER DEFAULT 0,
    hard_mints INTEGER DEFAULT 0,

    -- Performance
    avg_validation_latency_ms NUMERIC(10, 2),
    p95_validation_latency_ms NUMERIC(10, 2),
    p99_validation_latency_ms NUMERIC(10, 2),

    -- Cache stats
    cache_hits INTEGER DEFAULT 0,
    cache_misses INTEGER DEFAULT 0,

    PRIMARY KEY (metric_date, metric_hour)
);

-- Function to enforce immutability after hard mint
CREATE OR REPLACE FUNCTION enforce_hard_mint_immutability()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.minting_status = 'HARD_MINTED' THEN
        RAISE EXCEPTION 'Cannot modify ChittyID % after hard mint', OLD.chitty_id;
    END IF;

    -- Update timestamp only if not hard minted
    NEW.updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce immutability
CREATE TRIGGER enforce_immutability
BEFORE UPDATE ON chitty_identity
FOR EACH ROW
EXECUTE FUNCTION enforce_hard_mint_immutability();

-- Function to record audit trail
CREATE OR REPLACE FUNCTION record_audit_trail()
RETURNS TRIGGER AS $$
DECLARE
    v_proof_hash VARCHAR(64);
    v_previous_hash VARCHAR(64);
BEGIN
    -- Get previous hash for chain
    SELECT proof_hash INTO v_previous_hash
    FROM chitty_audit_trail
    WHERE chitty_id = NEW.chitty_id
    ORDER BY id DESC
    LIMIT 1;

    -- Generate proof hash (simplified - use proper crypto in production)
    v_proof_hash := encode(sha256(
        (NEW.chitty_id || TG_OP || NOW()::TEXT || COALESCE(v_previous_hash, ''))::bytea
    ), 'hex');

    -- Insert audit record
    INSERT INTO chitty_audit_trail (
        chitty_id, event_type, actor, action, details,
        proof_hash, previous_hash
    ) VALUES (
        NEW.chitty_id,
        TG_OP,
        current_user,
        TG_OP || '_' || NEW.minting_status,
        to_jsonb(NEW),
        v_proof_hash,
        v_previous_hash
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to record all changes
CREATE TRIGGER audit_trail_trigger
AFTER INSERT OR UPDATE ON chitty_identity
FOR EACH ROW
EXECUTE FUNCTION record_audit_trail();

-- Function to clean expired cache
CREATE OR REPLACE FUNCTION clean_expired_cache()
RETURNS void AS $$
BEGIN
    DELETE FROM chitty_validation_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- View for current minting status summary
CREATE VIEW chitty_minting_summary AS
SELECT
    minting_status,
    COUNT(*) as count,
    MAX(updated_at) as last_update
FROM chitty_identity
GROUP BY minting_status;

-- View for validation metrics
CREATE VIEW chitty_validation_metrics AS
SELECT
    DATE(event_timestamp) as date,
    COUNT(*) FILTER (WHERE validation_result = true) as valid_count,
    COUNT(*) FILTER (WHERE validation_result = false) as invalid_count,
    AVG(validation_latency_ms) as avg_latency,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY validation_latency_ms) as p95_latency,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY validation_latency_ms) as p99_latency
FROM chitty_audit_trail
WHERE event_type = 'VALIDATION'
GROUP BY DATE(event_timestamp);