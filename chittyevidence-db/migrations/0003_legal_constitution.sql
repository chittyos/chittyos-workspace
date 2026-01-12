-- ============================================
-- LEGAL CONSTITUTION SCHEMA
-- Evidentiary rules, claim-to-source mapping, admissibility enforcement
-- ============================================

-- Legal Research Constitution (governance rules)
CREATE TABLE IF NOT EXISTS legal_constitution (
    id TEXT PRIMARY KEY,
    article_number INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    authority_level TEXT NOT NULL DEFAULT 'enforcement', -- 'enforcement' | 'informational' | 'guidance'
    is_active INTEGER DEFAULT 1,
    version TEXT NOT NULL DEFAULT '1.0',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Claim Types and their source requirements
CREATE TABLE IF NOT EXISTS claim_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Claim-to-Source Matrix (what evidence is required for each claim type)
CREATE TABLE IF NOT EXISTS claim_source_requirements (
    id TEXT PRIMARY KEY,
    claim_type_id TEXT NOT NULL REFERENCES claim_types(id),
    source_category TEXT NOT NULL, -- 'primary' | 'secondary'
    source_description TEXT NOT NULL,
    authentication_requirement TEXT,
    admissibility_note TEXT,
    is_required INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Approved source types (authoritative sources)
CREATE TABLE IF NOT EXISTS approved_sources (
    id TEXT PRIMARY KEY,
    source_type TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL, -- 'primary' | 'secondary' | 'excluded'
    description TEXT,
    authentication_rules TEXT, -- JSON
    created_at TEXT DEFAULT (datetime('now'))
);

-- Admissibility rules
CREATE TABLE IF NOT EXISTS admissibility_rules (
    id TEXT PRIMARY KEY,
    rule_code TEXT NOT NULL UNIQUE,
    rule_text TEXT NOT NULL,
    failure_action TEXT NOT NULL DEFAULT 'reject', -- 'reject' | 'flag' | 'warn'
    applies_to TEXT, -- JSON array of document types or NULL for all
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Legal analysis requests (gatekeeper log)
CREATE TABLE IF NOT EXISTS legal_analysis_requests (
    id TEXT PRIMARY KEY,
    document_id TEXT REFERENCES documents(id),
    claim_type_id TEXT REFERENCES claim_types(id),
    requestor_chitty_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected' | 'insufficient'
    approval_scope TEXT, -- What analysis is permitted (if approved)
    rejection_reason TEXT,
    missing_sources TEXT, -- JSON array
    violated_articles TEXT, -- JSON array
    reviewed_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Document claim associations (what claims a document supports)
CREATE TABLE IF NOT EXISTS document_claims (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id),
    claim_type_id TEXT NOT NULL REFERENCES claim_types(id),
    claim_text TEXT,
    supporting_elements TEXT, -- JSON: which elements this doc supports
    unsupported_elements TEXT, -- JSON: gaps identified
    confidence REAL DEFAULT 0.0,
    status TEXT DEFAULT 'provisional', -- 'provisional' | 'supported' | 'insufficient'
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(document_id, claim_type_id)
);

-- Evidence chain of custody
CREATE TABLE IF NOT EXISTS evidence_custody (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id),
    custodian TEXT NOT NULL,
    custody_action TEXT NOT NULL, -- 'received' | 'transferred' | 'stored' | 'accessed'
    custody_date TEXT NOT NULL,
    location TEXT,
    notes TEXT,
    verification_method TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Statement of Facts entries
CREATE TABLE IF NOT EXISTS statement_of_facts (
    id TEXT PRIMARY KEY,
    case_id TEXT, -- Optional grouping
    fact_number INTEGER NOT NULL,
    fact_date TEXT,
    fact_text TEXT NOT NULL,
    exhibit_reference TEXT NOT NULL,
    document_id TEXT REFERENCES documents(id),
    source_quote TEXT,
    has_conflict INTEGER DEFAULT 0,
    conflict_with_fact_id TEXT REFERENCES statement_of_facts(id),
    created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_claim_source_claim ON claim_source_requirements(claim_type_id);
CREATE INDEX IF NOT EXISTS idx_legal_requests_doc ON legal_analysis_requests(document_id);
CREATE INDEX IF NOT EXISTS idx_legal_requests_status ON legal_analysis_requests(status);
CREATE INDEX IF NOT EXISTS idx_doc_claims_doc ON document_claims(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_claims_type ON document_claims(claim_type_id);
CREATE INDEX IF NOT EXISTS idx_custody_doc ON evidence_custody(document_id);
CREATE INDEX IF NOT EXISTS idx_sof_case ON statement_of_facts(case_id);

-- ============================================
-- SEED DATA: Claim Types
-- ============================================

INSERT OR IGNORE INTO claim_types (id, name, description) VALUES
    ('claim_ownership', 'Ownership / Title', 'Claims related to property ownership or title'),
    ('claim_membership', 'Membership / LLC Interest', 'Claims related to business entity membership or ownership interests'),
    ('claim_loan', 'Loan Origination / Terms', 'Claims related to loan creation, terms, or modifications'),
    ('claim_payment', 'Payment / Transfer (Financial)', 'Claims related to financial transactions or transfers'),
    ('claim_eviction', 'Eviction / Occupancy', 'Claims related to eviction proceedings or occupancy rights'),
    ('claim_governance', 'Governance Action (Board/Resolution)', 'Claims related to corporate governance actions'),
    ('claim_dissipation', 'Asset Dissipation / Transfer', 'Claims related to improper asset transfers or dissipation'),
    ('claim_timeline', 'Statement of Fact (timeline)', 'Chronological factual claims requiring documentation');

-- ============================================
-- SEED DATA: Approved Sources
-- ============================================

INSERT OR IGNORE INTO approved_sources (id, source_type, category, description, authentication_rules) VALUES
    ('src_statute', 'Statutes', 'primary', 'Federal and state statutes', '{"requires": ["citation", "effective_date"]}'),
    ('src_regulation', 'Regulations', 'primary', 'Federal and state regulations', '{"requires": ["citation", "effective_date"]}'),
    ('src_case_law', 'Binding Appellate Decisions', 'primary', 'Published appellate court decisions', '{"requires": ["citation", "court", "date"]}'),
    ('src_court_record', 'Certified Court Records', 'primary', 'Court-certified documents', '{"requires": ["case_number", "certification"]}'),
    ('src_testimony', 'Recorded Testimony', 'primary', 'Deposition or trial transcripts', '{"requires": ["case_number", "date", "certifier"]}'),
    ('src_deed', 'Recorded Deeds', 'primary', 'Property deeds from public registry', '{"requires": ["recording_number", "county", "date"]}'),
    ('src_bank_record', 'Bank Records', 'primary', 'Certified bank statements or confirmations', '{"requires": ["account_mask", "bank_reference", "date"]}'),
    ('src_corporate_filing', 'Corporate Filings', 'primary', 'Secretary of State filings', '{"requires": ["filing_number", "state", "date"]}'),
    ('src_notarized', 'Notarized Instruments', 'primary', 'Documents with notary acknowledgment', '{"requires": ["notary_name", "notary_date", "commission"]}'),
    ('src_treatise', 'Treatises', 'secondary', 'Legal treatises (interpretation only)', '{"requires": ["title", "edition", "page"]}'),
    ('src_expert', 'Expert Reports', 'secondary', 'Expert witness reports', '{"requires": ["expert_name", "credentials", "date"]}'),
    ('src_email', 'Contemporaneous Communications', 'secondary', 'Timestamped emails with verified origin', '{"requires": ["timestamp", "sender", "recipient", "headers"]}'),
    ('src_blog', 'Blogs', 'excluded', 'Blog posts and informal publications', NULL),
    ('src_wikipedia', 'Wikipedia', 'excluded', 'Wikipedia and similar open wikis', NULL),
    ('src_news', 'News Articles', 'excluded', 'News reporting without primary sourcing', NULL),
    ('src_ai_generated', 'AI-Generated Content', 'excluded', 'Content generated by AI without human verification', NULL);

-- ============================================
-- SEED DATA: Claim-to-Source Requirements
-- ============================================

-- Ownership / Title
INSERT OR IGNORE INTO claim_source_requirements (id, claim_type_id, source_category, source_description, authentication_requirement, admissibility_note, is_required) VALUES
    ('csr_own_1', 'claim_ownership', 'primary', 'Recorded deed, title insurance, public registry', 'Certified copy or registry link + identifiers', 'Must tie property identifiers (PIN, address)', 1),
    ('csr_own_2', 'claim_ownership', 'secondary', 'Purchase contract, escrow statement', 'Signed copy with dates', 'Corroborating only', 0);

-- Membership / LLC Interest
INSERT OR IGNORE INTO claim_source_requirements (id, claim_type_id, source_category, source_description, authentication_requirement, admissibility_note, is_required) VALUES
    ('csr_mem_1', 'claim_membership', 'primary', 'Filed articles, membership ledger, signed operating agreement', 'Notarized signature or corporate record', 'If disputed, require board minutes or distribution records', 1),
    ('csr_mem_2', 'claim_membership', 'secondary', 'Bank transfers showing capital contribution', 'Bank-issued reference', 'Corroborating only', 0);

-- Loan Origination / Terms
INSERT OR IGNORE INTO claim_source_requirements (id, claim_type_id, source_category, source_description, authentication_requirement, admissibility_note, is_required) VALUES
    ('csr_loan_1', 'claim_loan', 'primary', 'Promissory note, signed loan agreement, bank records', 'Signed instrument and bank ref #', 'Ambiguities require cross-check w/ bank', 1),
    ('csr_loan_2', 'claim_loan', 'secondary', 'Email offer + payment trace', 'Verified headers and timestamps', 'Corroborating only', 0);

-- Payment / Transfer (Financial)
INSERT OR IGNORE INTO claim_source_requirements (id, claim_type_id, source_category, source_description, authentication_requirement, admissibility_note, is_required) VALUES
    ('csr_pay_1', 'claim_payment', 'primary', 'Bank statement, wire confirmation, certified bank record', 'Bank-issued reference, account mask', 'Prefer bank CSV + statement page w/ mask', 1),
    ('csr_pay_2', 'claim_payment', 'secondary', 'Payment receipt, counterparty ledger', 'Signed or timestamped', 'Corroborating only', 0);

-- Eviction / Occupancy
INSERT OR IGNORE INTO claim_source_requirements (id, claim_type_id, source_category, source_description, authentication_requirement, admissibility_note, is_required) VALUES
    ('csr_evict_1', 'claim_eviction', 'primary', 'Lease, signed notice, court filing', 'Executed lease or court doc', 'Short-term occupancy without lease → corroborate', 1),
    ('csr_evict_2', 'claim_eviction', 'secondary', 'Messages confirming occupancy', 'Timestamped with parties identified', 'Corroborating only', 0);

-- Governance Action
INSERT OR IGNORE INTO claim_source_requirements (id, claim_type_id, source_category, source_description, authentication_requirement, admissibility_note, is_required) VALUES
    ('csr_gov_1', 'claim_governance', 'primary', 'Signed minute, resolution, filed corporate record', 'Signed minutes or resolution bearing officer signature', 'Board quorum proof required', 1),
    ('csr_gov_2', 'claim_governance', 'secondary', 'Email approvals, draft resolutions', 'Verified headers', 'Corroborating only', 0);

-- Asset Dissipation / Transfer
INSERT OR IGNORE INTO claim_source_requirements (id, claim_type_id, source_category, source_description, authentication_requirement, admissibility_note, is_required) VALUES
    ('csr_diss_1', 'claim_dissipation', 'primary', 'Transfer docs, bank wires, recorded conveyance', 'Transfer instrument + bank trace', 'Correlate timestamps with control changes', 1),
    ('csr_diss_2', 'claim_dissipation', 'secondary', 'Suspicious account activity, emails', 'Bank records or verified communications', 'Corroborating only', 0);

-- Statement of Fact (timeline)
INSERT OR IGNORE INTO claim_source_requirements (id, claim_type_id, source_category, source_description, authentication_requirement, admissibility_note, is_required) VALUES
    ('csr_sof_1', 'claim_timeline', 'primary', 'Chronological primary docs per event', 'Source_id + retrieval metadata', 'Each fact needs at least one admissible primary or two corroborating secondaries', 1),
    ('csr_sof_2', 'claim_timeline', 'secondary', 'Contemporaneous communications', 'Verified timestamps and parties', 'Two required if no primary', 0);

-- ============================================
-- SEED DATA: Admissibility Rules
-- ============================================

INSERT OR IGNORE INTO admissibility_rules (id, rule_code, rule_text, failure_action, is_active) VALUES
    ('adm_native', 'NATIVE_FORMAT', 'Evidence must be in native format', 'reject', 1),
    ('adm_metadata', 'INTACT_METADATA', 'Metadata must be intact and unmodified', 'reject', 1),
    ('adm_custody', 'CHAIN_OF_CUSTODY', 'Chain of custody must be documented', 'reject', 1),
    ('adm_no_screenshot', 'NO_SCREENSHOTS', 'Screenshots are not admissible as primary evidence', 'reject', 1),
    ('adm_no_summary', 'NO_SUMMARIES', 'Summaries cannot substitute for source documents', 'reject', 1),
    ('adm_source_auth', 'SOURCE_AUTHORITY', 'Source must be from approved source list', 'flag', 1),
    ('adm_provenance', 'PROVENANCE_REQUIRED', 'Provenance metadata (source_id, timestamp, method) required', 'flag', 1);

-- ============================================
-- SEED DATA: Legal Constitution Articles
-- ============================================

INSERT OR IGNORE INTO legal_constitution (id, article_number, title, content, authority_level, version) VALUES
    ('const_1', 1, 'Purpose & Principles', 'This document defines minimum standards for legal research, evidence intake, citation, and gatekeeping. Principles: authority-first, provenance, reproducibility, minimal-assumption, and auditability.', 'enforcement', '1.0'),
    ('const_2', 2, 'Scope', 'Applies to factual timelines, claim mapping, evidence ingestion, drafting, and any automated analysis.', 'enforcement', '1.0'),
    ('const_3', 3, 'Definitions', 'Authoritative Source: statutes, regulations, published case law, certified government records, recorded transcripts, notarized instruments, and authenticated financial institution records. Secondary Source: treatises, practice guides, news, blog posts, non-governmental reports.', 'enforcement', '1.0'),
    ('const_4', 4, 'Source Hierarchy', 'Primary (highest): statutes, regulations, binding precedent, certified records, recorded testimony, court orders. Institutional records: bank statements, corporate filings, recorded deeds, tax transcripts. Contemporaneous communications: timestamped emails/texts with verified origin metadata. Secondary: expert reports, treatises. Excluded: anonymous forums, unverified social posts, unverifiable hearsay.', 'enforcement', '1.0'),
    ('const_5', 5, 'Authentication & Provenance', 'Every item must include: source_id, origin URL or custody path, retrieval timestamp, retrieval method, and checksum if binary. Chain-of-custody entries must be recorded for items used as evidence.', 'enforcement', '1.0'),
    ('const_6', 6, 'Admissibility Filters', 'Pre-analysis filter rejects non-authoritative sources for substantive legal conclusions. If a source fails authentication, it may be used only for contextual background (flagged as non-admissible).', 'enforcement', '1.0'),
    ('const_7', 7, 'Research Methodology', 'Use boolean + semantic search, record queries and result sets. For each claim, require at least one primary source or two corroborating secondary sources with separate provenance.', 'guidance', '1.0'),
    ('const_8', 8, 'Citation Standard', 'Use canonical short-cite plus link and file id. For documents: include page ranges and extracted text excerpt.', 'guidance', '1.0'),
    ('const_9', 9, 'Failure Mode', 'If a claim cannot be supported by an approved source, analysis is forbidden. Output: INSUFFICIENT EVIDENCE TO ANALYZE with missing source and violated article.', 'enforcement', '1.0'),
    ('const_10', 10, 'Enforcement', 'Legal Constitution Enforcer (CORE) may whitelist narrow exceptions; exceptions must be logged, justified, and reviewed.', 'enforcement', '1.0');
