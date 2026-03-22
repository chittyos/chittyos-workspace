-- ChittyChain Universal Data Framework - Neutral Schema v1.1
-- @canon: chittycanon://gov/governance#core-types
-- Neutralized and abstracted foundations for universal application
-- Removes legal bias and creates platform-agnostic data structures
-- Entity types: P (Person), L (Location), T (Thing), E (Event), A (Authority)

-- =============================================================================
-- CORE ENTITY ABSTRACTION LAYER
-- =============================================================================

-- Universal entity registry - replaces domain-specific tables
CREATE TABLE entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chitty_id TEXT UNIQUE NOT NULL,
    tenant_id TEXT,  -- NULL = shared/global; set for tenant isolation (project-per-tenant or RLS)
    -- @canon: chittycanon://gov/governance#core-types
    entity_type TEXT NOT NULL, -- P (Person), L (Location), T (Thing), E (Event), A (Authority)
    entity_subtype TEXT,
    name TEXT NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    status TEXT DEFAULT 'active',
    visibility TEXT DEFAULT 'public', -- public, restricted, private
    classification TEXT, -- Neutral classification system
    context_tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID,

    -- Temporal validity
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_to TIMESTAMPTZ DEFAULT 'infinity',
    version_number INTEGER DEFAULT 1,

    -- Verification status
    verification_status TEXT DEFAULT 'unverified',
    verification_method TEXT,
    verified_at TIMESTAMPTZ,
    verified_by UUID,

    -- Access control
    access_level TEXT DEFAULT 'standard',
    restrictions JSONB DEFAULT '{}',

    CONSTRAINT valid_entity_type CHECK (entity_type IN ('P', 'L', 'T', 'E', 'A')),
    CONSTRAINT valid_status CHECK (status IN ('active', 'inactive', 'archived', 'deleted')),
    CONSTRAINT valid_visibility CHECK (visibility IN ('public', 'restricted', 'private')),
    CONSTRAINT valid_verification CHECK (verification_status IN ('unverified', 'pending', 'verified', 'disputed', 'rejected'))
);

-- Universal relationship mapping - neutral connections between entities
CREATE TABLE entity_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chitty_id TEXT UNIQUE NOT NULL,
    source_entity_id UUID NOT NULL REFERENCES entities(id),
    target_entity_id UUID NOT NULL REFERENCES entities(id),
    relationship_type TEXT NOT NULL,
    relationship_subtype TEXT,
    direction TEXT DEFAULT 'bidirectional', -- unidirectional, bidirectional
    strength_score NUMERIC(3,2) DEFAULT 0.5,
    confidence_score NUMERIC(3,2) DEFAULT 0.5,
    context JSONB DEFAULT '{}',
    evidence_ids UUID[] DEFAULT '{}',

    -- Temporal relationship
    relationship_start TIMESTAMPTZ,
    relationship_end TIMESTAMPTZ,
    is_current BOOLEAN DEFAULT true,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    verified_at TIMESTAMPTZ,
    verified_by UUID,

    -- Access control
    visibility TEXT DEFAULT 'public',
    access_restrictions JSONB DEFAULT '{}',

    CONSTRAINT no_self_reference CHECK (source_entity_id != target_entity_id),
    CONSTRAINT valid_direction CHECK (direction IN ('unidirectional', 'bidirectional')),
    CONSTRAINT valid_scores CHECK (strength_score BETWEEN 0 AND 1 AND confidence_score BETWEEN 0 AND 1)
);

-- =============================================================================
-- NEUTRAL INFORMATION FRAMEWORK
-- =============================================================================

-- Universal information registry - replaces evidence/document tables
CREATE TABLE information_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chitty_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    content_type TEXT NOT NULL, -- document, image, audio, video, data, communication
    content_format TEXT, -- pdf, jpg, mp3, csv, email, etc.
    content_summary TEXT,
    content_hash TEXT, -- SHA256 hash for integrity
    content_size BIGINT,
    content_location TEXT, -- URL, file path, or storage reference

    -- Information classification
    information_tier TEXT NOT NULL, -- Trust/reliability tier
    source_type TEXT, -- origin classification
    authenticity_status TEXT DEFAULT 'unverified',

    -- Temporal information
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    content_date TIMESTAMPTZ, -- When the information was originally created
    received_date TIMESTAMPTZ, -- When it was received/acquired

    -- Provenance
    source_entity_id UUID REFERENCES entities(id),
    contributor_id UUID,
    collection_method TEXT,
    chain_of_custody JSONB DEFAULT '[]',

    -- Access and classification
    sensitivity_level TEXT DEFAULT 'standard',
    access_restrictions JSONB DEFAULT '{}',
    retention_period INTERVAL,
    disposal_date TIMESTAMPTZ,

    -- Verification
    verification_status TEXT DEFAULT 'pending',
    verification_method TEXT,
    verified_at TIMESTAMPTZ,
    verified_by UUID,

    -- Metadata
    tags TEXT[] DEFAULT '{}',
    custom_metadata JSONB DEFAULT '{}',

    CONSTRAINT valid_content_type CHECK (content_type IN ('document', 'image', 'audio', 'video', 'data', 'communication', 'physical', 'other')),
    CONSTRAINT valid_tier CHECK (information_tier IN ('PRIMARY_SOURCE', 'OFFICIAL_RECORD', 'INSTITUTIONAL', 'THIRD_PARTY', 'DERIVED', 'REPORTED', 'UNVERIFIED')),
    CONSTRAINT valid_authenticity CHECK (authenticity_status IN ('authentic', 'unverified', 'disputed', 'fabricated')),
    CONSTRAINT valid_sensitivity CHECK (sensitivity_level IN ('public', 'standard', 'sensitive', 'restricted', 'confidential'))
);

-- Universal atomic facts - neutral knowledge extraction
CREATE TABLE atomic_facts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chitty_id TEXT UNIQUE NOT NULL,
    fact_statement TEXT NOT NULL,
    fact_type TEXT NOT NULL, -- observation, measurement, assertion, derived, etc.
    subject_entity_id UUID REFERENCES entities(id),
    predicate TEXT NOT NULL, -- The relationship/property being asserted
    object_value TEXT, -- The value or target of the relationship
    object_entity_id UUID REFERENCES entities(id),

    -- Fact classification
    classification TEXT NOT NULL,
    certainty_level NUMERIC(3,2) DEFAULT 0.5, -- 0 to 1
    confidence_score NUMERIC(3,2) DEFAULT 0.5,
    weight NUMERIC(3,2) DEFAULT 0.5,

    -- Source information
    source_information_id UUID NOT NULL REFERENCES information_items(id),
    extracted_by TEXT, -- human, ai, system
    extraction_method TEXT,
    extraction_confidence NUMERIC(3,2),

    -- Temporal context
    fact_timestamp TIMESTAMPTZ, -- When the fact was true/occurred
    observed_at TIMESTAMPTZ, -- When the fact was observed
    recorded_at TIMESTAMPTZ DEFAULT NOW(),

    -- Verification
    verification_status TEXT DEFAULT 'pending',
    verified_at TIMESTAMPTZ,
    verified_by UUID,
    verification_method TEXT,

    -- Context and relationships
    context JSONB DEFAULT '{}',
    related_facts UUID[] DEFAULT '{}',
    contradicts_facts UUID[] DEFAULT '{}',
    supports_facts UUID[] DEFAULT '{}',

    -- Access control
    sensitivity_level TEXT DEFAULT 'standard',
    access_restrictions JSONB DEFAULT '{}',

    CONSTRAINT valid_classification CHECK (classification IN ('OBSERVATION', 'MEASUREMENT', 'ASSERTION', 'INFERENCE', 'DERIVED', 'OPINION', 'HYPOTHESIS')),
    CONSTRAINT valid_certainty CHECK (certainty_level BETWEEN 0 AND 1),
    CONSTRAINT valid_confidence CHECK (confidence_score BETWEEN 0 AND 1),
    CONSTRAINT valid_weight CHECK (weight BETWEEN 0 AND 1),
    CONSTRAINT valid_extraction_confidence CHECK (extraction_confidence BETWEEN 0 AND 1)
);

-- =============================================================================
-- NEUTRAL CONFLICT RESOLUTION FRAMEWORK
-- =============================================================================

-- Universal contradiction tracking - neutral conflict detection
CREATE TABLE information_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chitty_id TEXT UNIQUE NOT NULL,
    conflict_type TEXT NOT NULL,
    conflict_severity TEXT DEFAULT 'moderate',
    primary_fact_id UUID NOT NULL REFERENCES atomic_facts(id),
    conflicting_fact_id UUID NOT NULL REFERENCES atomic_facts(id),

    -- Conflict analysis
    conflict_description TEXT,
    conflict_category TEXT, -- temporal, logical, source, measurement, etc.
    conflict_basis TEXT, -- What makes these facts conflict
    resolution_method TEXT,
    resolution_status TEXT DEFAULT 'unresolved',

    -- Resolution tracking
    resolved_at TIMESTAMPTZ,
    resolved_by UUID,
    resolution_rationale TEXT,
    authoritative_fact_id UUID REFERENCES atomic_facts(id),

    -- Impact assessment
    impact_score NUMERIC(3,2) DEFAULT 0.5,
    affected_entities UUID[] DEFAULT '{}',
    cascade_effects JSONB DEFAULT '{}',

    -- Metadata
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    detected_by TEXT, -- system, human, ai
    detection_method TEXT,

    CONSTRAINT valid_conflict_type CHECK (conflict_type IN ('DIRECT', 'TEMPORAL', 'LOGICAL', 'SOURCE', 'MEASUREMENT', 'INTERPRETATION')),
    CONSTRAINT valid_severity CHECK (conflict_severity IN ('low', 'moderate', 'high', 'critical')),
    CONSTRAINT valid_resolution_status CHECK (resolution_status IN ('unresolved', 'pending', 'resolved', 'permanent'))
);

-- =============================================================================
-- UNIVERSAL CONTEXT FRAMEWORK
-- =============================================================================

-- Neutral context/workspace management - replaces case-specific structures
CREATE TABLE contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chitty_id TEXT UNIQUE NOT NULL,
    context_name TEXT NOT NULL,
    context_type TEXT NOT NULL, -- project, investigation, analysis, etc.
    context_subtype TEXT,
    description TEXT,

    -- Context metadata
    purpose TEXT,
    scope JSONB DEFAULT '{}',
    objectives TEXT[],
    success_criteria JSONB DEFAULT '{}',

    -- Temporal boundaries
    start_date TIMESTAMPTZ,
    target_end_date TIMESTAMPTZ,
    actual_end_date TIMESTAMPTZ,

    -- Status tracking
    status TEXT DEFAULT 'active',
    progress_percentage NUMERIC(5,2) DEFAULT 0,
    milestones JSONB DEFAULT '[]',

    -- Access and ownership
    owner_id UUID,
    participants UUID[] DEFAULT '{}',
    access_level TEXT DEFAULT 'standard',
    visibility TEXT DEFAULT 'restricted',

    -- Relationships
    parent_context_id UUID REFERENCES contexts(id),
    related_contexts UUID[] DEFAULT '{}',

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    tags TEXT[] DEFAULT '{}',
    custom_fields JSONB DEFAULT '{}',

    CONSTRAINT valid_context_type CHECK (context_type IN ('PROJECT', 'INVESTIGATION', 'ANALYSIS', 'RESEARCH', 'MONITORING', 'ARCHIVE')),
    CONSTRAINT valid_status CHECK (status IN ('planning', 'active', 'paused', 'completed', 'cancelled', 'archived'))
);

-- Context-Entity associations - what entities are relevant to which contexts
CREATE TABLE context_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    context_id UUID NOT NULL REFERENCES contexts(id),
    entity_id UUID NOT NULL REFERENCES entities(id),
    role_in_context TEXT,
    relevance_score NUMERIC(3,2) DEFAULT 0.5,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    added_by UUID,
    notes TEXT,

    UNIQUE(context_id, entity_id)
);

-- Context-Information associations
CREATE TABLE context_information (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    context_id UUID NOT NULL REFERENCES contexts(id),
    information_id UUID NOT NULL REFERENCES information_items(id),
    relevance_score NUMERIC(3,2) DEFAULT 0.5,
    role_description TEXT,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    added_by UUID,

    UNIQUE(context_id, information_id)
);

-- =============================================================================
-- UNIVERSAL AUDIT AND IMMUTABILITY FRAMEWORK
-- =============================================================================

-- Event sourcing - immutable record of all changes
CREATE TABLE event_store (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chitty_id TEXT UNIQUE NOT NULL,
    aggregate_type TEXT NOT NULL, -- entity, information, fact, etc.
    aggregate_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    event_version INTEGER NOT NULL,
    event_data JSONB NOT NULL,
    event_metadata JSONB DEFAULT '{}',

    -- Cryptographic integrity
    event_hash TEXT NOT NULL,
    previous_hash TEXT,
    merkle_root TEXT,

    -- Event context
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    actor_id UUID,
    actor_type TEXT, -- user, system, api, etc.
    source_system TEXT,
    correlation_id UUID,
    causation_id UUID,

    -- Chain verification
    sequence_number BIGINT,
    block_hash TEXT,

    UNIQUE(aggregate_id, event_version)
);

-- Universal audit log - comprehensive activity tracking
CREATE TABLE activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chitty_id TEXT UNIQUE NOT NULL,
    activity_type TEXT NOT NULL,
    activity_category TEXT,
    resource_type TEXT NOT NULL,
    resource_id UUID NOT NULL,

    -- Activity details
    action TEXT NOT NULL,
    actor_id UUID,
    actor_type TEXT,
    actor_context JSONB DEFAULT '{}',

    -- Request/Response tracking
    request_data JSONB,
    response_data JSONB,
    status_code INTEGER,

    -- Temporal tracking
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,

    -- Context and metadata
    session_id TEXT,
    correlation_id UUID,
    ip_address INET,
    user_agent TEXT,
    source_system TEXT,
    environment TEXT,

    -- Security tracking
    security_context JSONB DEFAULT '{}',
    risk_score NUMERIC(3,2),
    anomaly_detected BOOLEAN DEFAULT FALSE,

    CONSTRAINT valid_activity_type CHECK (activity_type IN ('CREATE', 'READ', 'UPDATE', 'DELETE', 'EXECUTE', 'AUTHENTICATE', 'AUTHORIZE'))
);

-- =============================================================================
-- NEUTRAL ACTOR AND ACCESS FRAMEWORK
-- =============================================================================

-- Actors ARE entities (type P = Person, including synthetic persons like AI/bots/services)
-- @canon: chittycanon://gov/governance#core-types — Claude contexts are Person (P), Synthetic
-- This view replaces the standalone actors table to eliminate entity/actor duplication.
CREATE VIEW actors AS
SELECT
    e.id,
    e.chitty_id,
    e.entity_subtype AS actor_type,   -- HUMAN, SYSTEM, AI, BOT, SERVICE, ORGANIZATION
    e.name AS display_name,
    e.description,
    e.metadata,
    e.status,
    e.created_at,
    e.access_level,
    e.restrictions
FROM entities e
WHERE e.entity_type = 'P'
  AND e.status != 'deleted';

-- Role-based access per context — what an actor can do within a specific context
CREATE TABLE entity_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entities(id),
    context_id UUID REFERENCES contexts(id),  -- NULL = global role
    role_name TEXT NOT NULL,                   -- owner, contributor, reviewer, observer
    permissions TEXT[] DEFAULT '{}',
    access_level TEXT DEFAULT 'standard',
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    granted_by UUID,
    expires_at TIMESTAMPTZ,

    CONSTRAINT valid_access_level CHECK (access_level IN ('restricted', 'standard', 'elevated', 'administrative', 'system')),
    UNIQUE(entity_id, context_id, role_name)
);

-- =============================================================================
-- UNIVERSAL SCHEMA MANAGEMENT
-- =============================================================================

-- Schema versioning and migration tracking
CREATE TABLE schema_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_number TEXT UNIQUE NOT NULL,
    version_type TEXT NOT NULL, -- major, minor, patch, hotfix
    description TEXT,
    migration_script TEXT,
    rollback_script TEXT,
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    applied_by UUID,
    checksum TEXT,

    CONSTRAINT valid_version_type CHECK (version_type IN ('major', 'minor', 'patch', 'hotfix'))
);

-- Insert initial schema version
INSERT INTO schema_versions (version_number, version_type, description, applied_by)
VALUES ('1.0.0', 'major', 'Initial neutral schema foundation', NULL);

INSERT INTO schema_versions (version_number, version_type, description, applied_by)
VALUES ('1.1.0', 'minor', 'Canonical ontology alignment: P/L/T/E/A types, actors→entities view, verify_event_chain fix, context indexes, tenant_id, entity_roles', NULL);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Entity indexes
CREATE INDEX idx_entities_type ON entities(entity_type);
CREATE INDEX idx_entities_status ON entities(status);
CREATE INDEX idx_entities_chitty_id ON entities(chitty_id);
CREATE INDEX idx_entities_created ON entities(created_at);
CREATE INDEX idx_entities_classification ON entities(classification);
CREATE INDEX idx_entities_tenant ON entities(tenant_id) WHERE tenant_id IS NOT NULL;

-- Relationship indexes
CREATE INDEX idx_relationships_source ON entity_relationships(source_entity_id);
CREATE INDEX idx_relationships_target ON entity_relationships(target_entity_id);
CREATE INDEX idx_relationships_type ON entity_relationships(relationship_type);
CREATE INDEX idx_relationships_current ON entity_relationships(is_current);

-- Information indexes
CREATE INDEX idx_information_type ON information_items(content_type);
CREATE INDEX idx_information_tier ON information_items(information_tier);
CREATE INDEX idx_information_source ON information_items(source_entity_id);
CREATE INDEX idx_information_hash ON information_items(content_hash);
CREATE INDEX idx_information_date ON information_items(content_date);

-- Fact indexes
CREATE INDEX idx_facts_subject ON atomic_facts(subject_entity_id);
CREATE INDEX idx_facts_source ON atomic_facts(source_information_id);
CREATE INDEX idx_facts_type ON atomic_facts(fact_type);
CREATE INDEX idx_facts_classification ON atomic_facts(classification);
CREATE INDEX idx_facts_timestamp ON atomic_facts(fact_timestamp);

-- Context join indexes
CREATE INDEX idx_context_entities_context ON context_entities(context_id);
CREATE INDEX idx_context_entities_entity ON context_entities(entity_id);
CREATE INDEX idx_context_information_context ON context_information(context_id);
CREATE INDEX idx_context_information_info ON context_information(information_id);

-- Entity roles indexes
CREATE INDEX idx_entity_roles_entity ON entity_roles(entity_id);
CREATE INDEX idx_entity_roles_context ON entity_roles(context_id);

-- Event store indexes
CREATE INDEX idx_events_aggregate ON event_store(aggregate_id);
CREATE INDEX idx_events_type ON event_store(event_type);
CREATE INDEX idx_events_timestamp ON event_store(timestamp);
CREATE INDEX idx_events_hash ON event_store(event_hash);

-- Activity log indexes
CREATE INDEX idx_activity_resource ON activity_log(resource_type, resource_id);
CREATE INDEX idx_activity_actor ON activity_log(actor_id);
CREATE INDEX idx_activity_timestamp ON activity_log(started_at);
CREATE INDEX idx_activity_type ON activity_log(activity_type);

-- =============================================================================
-- VIEWS FOR COMMON OPERATIONS
-- =============================================================================

-- Current entity state view
CREATE VIEW current_entities AS
SELECT e.*
FROM entities e
WHERE e.valid_to = 'infinity'
  AND e.status != 'deleted';

-- Entity relationship graph view
CREATE VIEW entity_graph AS
SELECT
    er.id,
    er.source_entity_id,
    es.name as source_name,
    es.entity_type as source_type,
    er.target_entity_id,
    et.name as target_name,
    et.entity_type as target_type,
    er.relationship_type,
    er.strength_score,
    er.confidence_score,
    er.is_current
FROM entity_relationships er
JOIN entities es ON er.source_entity_id = es.id
JOIN entities et ON er.target_entity_id = et.id
WHERE er.is_current = true;

-- Information provenance chain view
CREATE VIEW information_provenance AS
SELECT
    ii.id,
    ii.chitty_id,
    ii.title,
    ii.content_type,
    ii.information_tier,
    ii.source_entity_id,
    e.name as source_name,
    ii.chain_of_custody,
    ii.verification_status,
    ii.created_at
FROM information_items ii
LEFT JOIN entities e ON ii.source_entity_id = e.id;

-- Fact verification summary view
CREATE VIEW fact_verification_summary AS
SELECT
    af.id,
    af.chitty_id,
    af.fact_statement,
    af.classification,
    af.certainty_level,
    af.confidence_score,
    af.verification_status,
    ii.title as source_title,
    ii.information_tier as source_tier,
    e.name as subject_name
FROM atomic_facts af
JOIN information_items ii ON af.source_information_id = ii.id
LEFT JOIN entities e ON af.subject_entity_id = e.id;

-- =============================================================================
-- CHAIN OF CUSTODY FUNCTIONS
-- =============================================================================

-- Function to verify event chain integrity
-- Each event's previous_hash must match the event_hash of the prior event in sequence.
CREATE OR REPLACE FUNCTION verify_event_chain(p_aggregate_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    last_hash TEXT := NULL;
    event_record RECORD;
    chain_valid BOOLEAN := TRUE;
    event_count INTEGER := 0;
BEGIN
    FOR event_record IN
        SELECT event_hash, previous_hash
        FROM event_store
        WHERE aggregate_id = p_aggregate_id
        ORDER BY event_version ASC
    LOOP
        event_count := event_count + 1;

        -- First event must have NULL previous_hash (chain origin)
        IF event_count = 1 THEN
            IF event_record.previous_hash IS NOT NULL THEN
                chain_valid := FALSE;
                EXIT;
            END IF;
        ELSE
            -- Subsequent events: previous_hash must match the prior event's hash
            IF event_record.previous_hash IS DISTINCT FROM last_hash THEN
                chain_valid := FALSE;
                EXIT;
            END IF;
        END IF;

        last_hash := event_record.event_hash;
    END LOOP;

    RETURN chain_valid;
END;
$$ LANGUAGE plpgsql;

-- Function to add to chain of custody
CREATE OR REPLACE FUNCTION add_custody_entry(
    p_information_id UUID,
    p_actor_id UUID,
    p_action TEXT,
    p_location TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    custody_entry JSONB;
    new_entry_id UUID;
BEGIN
    new_entry_id := gen_random_uuid();

    custody_entry := jsonb_build_object(
        'id', new_entry_id,
        'timestamp', NOW(),
        'actor_id', p_actor_id,
        'action', p_action,
        'location', p_location,
        'notes', p_notes
    );

    UPDATE information_items
    SET chain_of_custody = chain_of_custody || custody_entry
    WHERE id = p_information_id;

    RETURN new_entry_id;
END;
$$ LANGUAGE plpgsql;