// ============================================
// LEGAL CONSTITUTION ENFORCER SERVICE
// Gatekeeper for legal analysis - enforces evidentiary standards
// ============================================

import { Env } from '../types';
import { generateId, safeJsonParse } from '../utils';

// ============================================
// TYPES
// ============================================

export interface AdmissibilityCheck {
  documentId: string;
  claimTypeId?: string;
  requestorChittyId?: string;
}

export interface AdmissibilityResult {
  status: 'approved' | 'rejected' | 'insufficient';
  requestId: string;
  documentId: string;
  approvalScope?: string;
  rejectionReason?: string;
  missingSources?: string[];
  violatedArticles?: string[];
  admissibilityFlags?: AdmissibilityFlag[];
}

export interface AdmissibilityFlag {
  ruleCode: string;
  ruleText: string;
  status: 'pass' | 'fail' | 'warn';
  details?: string;
}

export interface ClaimType {
  id: string;
  name: string;
  description: string;
}

export interface SourceRequirement {
  id: string;
  claimTypeId: string;
  sourceCategory: 'primary' | 'secondary';
  sourceDescription: string;
  authenticationRequirement: string;
  admissibilityNote: string;
  isRequired: boolean;
}

export interface ApprovedSource {
  id: string;
  sourceType: string;
  category: 'primary' | 'secondary' | 'excluded';
  description: string;
  authenticationRules: Record<string, any>;
}

export interface EvidenceCustodyEntry {
  documentId: string;
  custodian: string;
  custodyAction: 'received' | 'transferred' | 'stored' | 'accessed';
  custodyDate: string;
  location?: string;
  notes?: string;
  verificationMethod?: string;
}

export interface StatementOfFactEntry {
  caseId?: string;
  factNumber: number;
  factDate?: string;
  factText: string;
  exhibitReference: string;
  documentId?: string;
  sourceQuote?: string;
}

export interface ClaimAnalysis {
  claimTypeId: string;
  claimText: string;
  supportedElements: string[];
  unsupportedElements: string[];
  confidence: number;
  status: 'provisional' | 'supported' | 'insufficient';
}

// Document metadata interface for type safety
interface DocumentMetadata {
  is_screenshot?: boolean;
  is_converted?: boolean;
  is_summary?: boolean;
  original_filename?: string;
  document_type?: string;
  source_id?: string;
  source_type?: string;
  retrieval_timestamp?: string;
  [key: string]: unknown;
}

// ============================================
// SERVICE IMPLEMENTATION
// ============================================

export class LegalConstitutionService {
  constructor(private env: Env) {}

  // ============================================
  // CORE GATEKEEPER - ADMISSIBILITY CHECK
  // ============================================

  /**
   * Primary gatekeeper function - determines if analysis is permitted
   * This implements the Legal Constitution Enforcer (CORE) logic
   */
  async checkAdmissibility(input: AdmissibilityCheck): Promise<AdmissibilityResult> {
    const requestId = generateId();
    const flags: AdmissibilityFlag[] = [];
    const missingSources: string[] = [];
    const violatedArticles: string[] = [];

    // Get document details
    const doc = await this.env.DB.prepare(
      `SELECT * FROM evidence_documents WHERE id = ?`
    ).bind(input.documentId).first();

    if (!doc) {
      return {
        status: 'rejected',
        requestId,
        documentId: input.documentId,
        rejectionReason: 'Document not found',
        violatedArticles: ['Article 2: Scope'],
      };
    }

    // Get all active admissibility rules
    const rules = await this.env.DB.prepare(
      `SELECT * FROM evidence_admissibility_rules WHERE is_active = 1`
    ).all();

    // Check each rule
    for (const rule of rules.results as any[]) {
      const checkResult = await this.checkRule(rule, doc);
      flags.push(checkResult);

      if (checkResult.status === 'fail') {
        if (rule.failure_action === 'reject') {
          violatedArticles.push(`Article 6: Admissibility Filters - ${rule.rule_code}`);
        }
      }
    }

    // Check chain of custody
    const custodyCheck = await this.checkChainOfCustody(input.documentId);
    flags.push(custodyCheck);
    if (custodyCheck.status === 'fail') {
      violatedArticles.push('Article 5: Authentication & Provenance');
    }

    // Check source authority
    const sourceCheck = await this.checkSourceAuthority(doc);
    flags.push(sourceCheck);
    if (sourceCheck.status === 'fail') {
      violatedArticles.push('Article 4: Source Hierarchy');
    }

    // If claim type specified, check source requirements
    if (input.claimTypeId) {
      const sourceReqs = await this.getSourceRequirements(input.claimTypeId);
      const docSources = await this.getDocumentSources(input.documentId);

      for (const req of sourceReqs.filter(r => r.isRequired)) {
        const hasSource = docSources.some(s =>
          s.category === req.sourceCategory &&
          this.matchesSourceDescription(s, req.sourceDescription)
        );
        if (!hasSource) {
          missingSources.push(req.sourceDescription);
        }
      }

      if (missingSources.length > 0) {
        violatedArticles.push('Article 9: Failure Mode - Missing required sources');
      }
    }

    // Determine final status
    const hasRejections = flags.some(f => f.status === 'fail');
    const hasMissingSources = missingSources.length > 0;

    let status: 'approved' | 'rejected' | 'insufficient';
    let approvalScope: string | undefined;
    let rejectionReason: string | undefined;

    if (hasRejections) {
      status = 'rejected';
      rejectionReason = flags
        .filter(f => f.status === 'fail')
        .map(f => f.ruleText)
        .join('; ');
    } else if (hasMissingSources) {
      status = 'insufficient';
      rejectionReason = 'Missing required sources for claim type';
    } else {
      status = 'approved';
      approvalScope = 'Analysis permitted within scope of authenticated sources';
    }

    // Log the request
    await this.env.DB.prepare(
      `INSERT INTO evidence_legal_analysis_requests
       (id, document_id, claim_type_id, requestor_chitty_id, status, approval_scope, rejection_reason, missing_sources, violated_articles, reviewed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(
      requestId,
      input.documentId,
      input.claimTypeId || null,
      input.requestorChittyId || null,
      status,
      approvalScope || null,
      rejectionReason || null,
      missingSources.length > 0 ? JSON.stringify(missingSources) : null,
      violatedArticles.length > 0 ? JSON.stringify(violatedArticles) : null
    ).run();

    return {
      status,
      requestId,
      documentId: input.documentId,
      approvalScope,
      rejectionReason,
      missingSources: missingSources.length > 0 ? missingSources : undefined,
      violatedArticles: violatedArticles.length > 0 ? violatedArticles : undefined,
      admissibilityFlags: flags,
    };
  }

  private async checkRule(rule: any, doc: any): Promise<AdmissibilityFlag> {
    const metadata = safeJsonParse<DocumentMetadata>(doc.metadata, {});

    switch (rule.rule_code) {
      case 'NATIVE_FORMAT':
        const isNative = !metadata.is_screenshot && !metadata.is_converted;
        return {
          ruleCode: rule.rule_code,
          ruleText: rule.rule_text,
          status: isNative ? 'pass' : 'fail',
          details: isNative ? undefined : 'Document is not in native format',
        };

      case 'INTACT_METADATA':
        const hasMetadata = doc.content_hash && metadata.original_filename;
        return {
          ruleCode: rule.rule_code,
          ruleText: rule.rule_text,
          status: hasMetadata ? 'pass' : 'warn',
          details: hasMetadata ? undefined : 'Metadata may be incomplete',
        };

      case 'CHAIN_OF_CUSTODY':
        // Checked separately
        return {
          ruleCode: rule.rule_code,
          ruleText: rule.rule_text,
          status: 'pass', // Placeholder - actual check in checkChainOfCustody
        };

      case 'NO_SCREENSHOTS':
        const isScreenshot = metadata.is_screenshot ||
          (doc.file_name && /screenshot|screen.?shot|capture/i.test(doc.file_name));
        return {
          ruleCode: rule.rule_code,
          ruleText: rule.rule_text,
          status: isScreenshot ? 'fail' : 'pass',
          details: isScreenshot ? 'Screenshots are not admissible' : undefined,
        };

      case 'NO_SUMMARIES':
        const isSummary = metadata.is_summary || metadata.document_type === 'summary';
        return {
          ruleCode: rule.rule_code,
          ruleText: rule.rule_text,
          status: isSummary ? 'fail' : 'pass',
          details: isSummary ? 'Summaries cannot substitute for source documents' : undefined,
        };

      case 'SOURCE_AUTHORITY':
        // Checked separately
        return {
          ruleCode: rule.rule_code,
          ruleText: rule.rule_text,
          status: 'pass', // Placeholder
        };

      case 'PROVENANCE_REQUIRED':
        const hasProvenance = metadata.source_id || metadata.retrieval_timestamp || doc.source_url;
        return {
          ruleCode: rule.rule_code,
          ruleText: rule.rule_text,
          status: hasProvenance ? 'pass' : 'warn',
          details: hasProvenance ? undefined : 'Provenance metadata incomplete',
        };

      default:
        return {
          ruleCode: rule.rule_code,
          ruleText: rule.rule_text,
          status: 'pass',
        };
    }
  }

  private async checkChainOfCustody(documentId: string): Promise<AdmissibilityFlag> {
    const custody = await this.env.DB.prepare(
      `SELECT COUNT(*) as count FROM evidence_chain_of_custody WHERE document_id = ?`
    ).bind(documentId).first<{ count: number }>();

    const hasCustody = custody && custody.count > 0;

    return {
      ruleCode: 'CHAIN_OF_CUSTODY',
      ruleText: 'Chain of custody must be documented',
      status: hasCustody ? 'pass' : 'warn',
      details: hasCustody ? undefined : 'No chain of custody entries recorded',
    };
  }

  private async checkSourceAuthority(doc: any): Promise<AdmissibilityFlag> {
    const metadata = safeJsonParse<DocumentMetadata>(doc.metadata, {});
    const sourceType = metadata.source_type || doc.document_type;

    if (!sourceType) {
      return {
        ruleCode: 'SOURCE_AUTHORITY',
        ruleText: 'Source must be from approved source list',
        status: 'warn',
        details: 'Source type not specified',
      };
    }

    const approved = await this.env.DB.prepare(
      `SELECT * FROM evidence_approved_sources WHERE source_type = ? OR id = ?`
    ).bind(sourceType, sourceType).first();

    if (!approved) {
      return {
        ruleCode: 'SOURCE_AUTHORITY',
        ruleText: 'Source must be from approved source list',
        status: 'warn',
        details: `Source type "${sourceType}" not in approved list`,
      };
    }

    if ((approved as any).category === 'excluded') {
      return {
        ruleCode: 'SOURCE_AUTHORITY',
        ruleText: 'Source must be from approved source list',
        status: 'fail',
        details: `Source type "${sourceType}" is excluded`,
      };
    }

    return {
      ruleCode: 'SOURCE_AUTHORITY',
      ruleText: 'Source must be from approved source list',
      status: 'pass',
    };
  }

  // ============================================
  // CLAIM TYPE MANAGEMENT
  // ============================================

  async getClaimTypes(): Promise<ClaimType[]> {
    const result = await this.env.DB.prepare(
      `SELECT * FROM evidence_claim_types ORDER BY name`
    ).all();

    return (result.results as any[]).map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
    }));
  }

  async getSourceRequirements(claimTypeId: string): Promise<SourceRequirement[]> {
    const result = await this.env.DB.prepare(
      `SELECT * FROM evidence_claim_source_requirements WHERE claim_type_id = ? ORDER BY source_category, is_required DESC`
    ).bind(claimTypeId).all();

    return (result.results as any[]).map(r => ({
      id: r.id,
      claimTypeId: r.claim_type_id,
      sourceCategory: r.source_category,
      sourceDescription: r.source_description,
      authenticationRequirement: r.authentication_requirement,
      admissibilityNote: r.admissibility_note,
      isRequired: r.is_required === 1,
    }));
  }

  async getApprovedSources(): Promise<ApprovedSource[]> {
    const result = await this.env.DB.prepare(
      `SELECT * FROM evidence_approved_sources ORDER BY category, source_type`
    ).all();

    return (result.results as any[]).map(r => ({
      id: r.id,
      sourceType: r.source_type,
      category: r.category,
      description: r.description,
      authenticationRules: safeJsonParse(r.authentication_rules, {}),
    }));
  }

  private async getDocumentSources(documentId: string): Promise<any[]> {
    // Get linked entities and their source information
    const result = await this.env.DB.prepare(
      `SELECT e.*, de.role
       FROM evidence_entities e
       JOIN evidence_document_entities de ON e.id = de.entity_id
       WHERE de.document_id = ?`
    ).bind(documentId).all();

    return result.results as any[];
  }

  private matchesSourceDescription(source: any, description: string): boolean {
    // Simple matching - could be enhanced with AI
    const descLower = description.toLowerCase();
    const sourceType = (source.entity_type || '').toLowerCase();
    const sourceName = (source.name || '').toLowerCase();

    return descLower.includes(sourceType) || descLower.includes(sourceName);
  }

  // ============================================
  // CHAIN OF CUSTODY
  // ============================================

  async addCustodyEntry(entry: EvidenceCustodyEntry): Promise<string> {
    const id = generateId();

    await this.env.DB.prepare(
      `INSERT INTO evidence_chain_of_custody
       (id, document_id, custodian, custody_action, custody_date, location, notes, verification_method)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      entry.documentId,
      entry.custodian,
      entry.custodyAction,
      entry.custodyDate,
      entry.location || null,
      entry.notes || null,
      entry.verificationMethod || null
    ).run();

    return id;
  }

  async getCustodyChain(documentId: string): Promise<EvidenceCustodyEntry[]> {
    const result = await this.env.DB.prepare(
      `SELECT * FROM evidence_chain_of_custody WHERE document_id = ? ORDER BY custody_date`
    ).bind(documentId).all();

    return (result.results as any[]).map(r => ({
      documentId: r.document_id,
      custodian: r.custodian,
      custodyAction: r.custody_action,
      custodyDate: r.custody_date,
      location: r.location,
      notes: r.notes,
      verificationMethod: r.verification_method,
    }));
  }

  // ============================================
  // DOCUMENT CLAIMS
  // ============================================

  async analyzeDocumentClaims(
    documentId: string,
    claimTypeId: string,
    claimText: string
  ): Promise<ClaimAnalysis> {
    // Get source requirements for this claim type
    const requirements = await this.getSourceRequirements(claimTypeId);
    const docSources = await this.getDocumentSources(documentId);

    const supportedElements: string[] = [];
    const unsupportedElements: string[] = [];

    for (const req of requirements) {
      const hasSource = docSources.some(s =>
        this.matchesSourceDescription(s, req.sourceDescription)
      );

      if (hasSource) {
        supportedElements.push(req.sourceDescription);
      } else if (req.isRequired) {
        unsupportedElements.push(req.sourceDescription);
      }
    }

    const confidence = supportedElements.length /
      Math.max(1, supportedElements.length + unsupportedElements.length);

    let status: 'provisional' | 'supported' | 'insufficient';
    if (unsupportedElements.length === 0 && supportedElements.length > 0) {
      status = 'supported';
    } else if (unsupportedElements.length > 0) {
      status = 'insufficient';
    } else {
      status = 'provisional';
    }

    // Store the analysis
    await this.env.DB.prepare(
      `INSERT OR REPLACE INTO evidence_document_claims
       (id, document_id, claim_type_id, claim_text, supporting_elements, unsupported_elements, confidence, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      generateId(),
      documentId,
      claimTypeId,
      claimText,
      JSON.stringify(supportedElements),
      JSON.stringify(unsupportedElements),
      confidence,
      status
    ).run();

    return {
      claimTypeId,
      claimText,
      supportedElements,
      unsupportedElements,
      confidence,
      status,
    };
  }

  // ============================================
  // STATEMENT OF FACTS
  // ============================================

  async addFactEntry(entry: StatementOfFactEntry): Promise<string> {
    const id = generateId();

    // Check for conflicts with existing facts
    let hasConflict = false;
    let conflictWithId: string | null = null;

    if (entry.factDate) {
      const existing = await this.env.DB.prepare(
        `SELECT id, fact_text FROM evidence_statement_of_facts
         WHERE case_id = ? AND fact_date = ? AND id != ?`
      ).bind(entry.caseId || '', entry.factDate, id).all();

      // Simple conflict detection - could be enhanced with AI
      for (const fact of existing.results as any[]) {
        if (this.detectFactConflict(entry.factText, fact.fact_text)) {
          hasConflict = true;
          conflictWithId = fact.id;
          break;
        }
      }
    }

    await this.env.DB.prepare(
      `INSERT INTO evidence_statement_of_facts
       (id, case_id, fact_number, fact_date, fact_text, exhibit_reference, document_id, source_quote, has_conflict, conflict_with_fact_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      entry.caseId || null,
      entry.factNumber,
      entry.factDate || null,
      entry.factText,
      entry.exhibitReference,
      entry.documentId || null,
      entry.sourceQuote || null,
      hasConflict ? 1 : 0,
      conflictWithId
    ).run();

    return id;
  }

  async getStatementOfFacts(caseId: string): Promise<{
    facts: StatementOfFactEntry[];
    conflicts: { factId: string; conflictsWith: string }[];
  }> {
    const result = await this.env.DB.prepare(
      `SELECT * FROM evidence_statement_of_facts WHERE case_id = ? ORDER BY fact_number`
    ).bind(caseId).all();

    const facts = (result.results as any[]).map(r => ({
      caseId: r.case_id,
      factNumber: r.fact_number,
      factDate: r.fact_date,
      factText: r.fact_text,
      exhibitReference: r.exhibit_reference,
      documentId: r.document_id,
      sourceQuote: r.source_quote,
    }));

    const conflicts = (result.results as any[])
      .filter(r => r.has_conflict)
      .map(r => ({
        factId: r.id,
        conflictsWith: r.conflict_with_fact_id,
      }));

    return { facts, conflicts };
  }

  private detectFactConflict(fact1: string, fact2: string): boolean {
    // Simple conflict detection - looks for contradictory statements
    // Could be enhanced with AI for semantic analysis
    const negations = ['not', 'never', 'no', 'denied', 'refused', 'failed'];
    const fact1Lower = fact1.toLowerCase();
    const fact2Lower = fact2.toLowerCase();

    // Check if one fact negates concepts in the other
    for (const neg of negations) {
      if (fact1Lower.includes(neg) !== fact2Lower.includes(neg)) {
        // One has negation, other doesn't - potential conflict
        // Check if they're about the same subject
        const words1 = fact1Lower.split(/\s+/);
        const words2 = fact2Lower.split(/\s+/);
        const overlap = words1.filter(w => words2.includes(w) && w.length > 4);
        if (overlap.length >= 3) {
          return true;
        }
      }
    }

    return false;
  }

  // ============================================
  // CONSTITUTION QUERIES
  // ============================================

  async getConstitution(): Promise<any[]> {
    const result = await this.env.DB.prepare(
      `SELECT * FROM evidence_legal_constitution WHERE is_active = 1 ORDER BY article_number`
    ).all();

    return result.results;
  }

  async getAdmissibilityRules(): Promise<any[]> {
    const result = await this.env.DB.prepare(
      `SELECT * FROM evidence_admissibility_rules WHERE is_active = 1 ORDER BY rule_code`
    ).all();

    return result.results;
  }

  // ============================================
  // FORMATTED OUTPUT (CORE STYLE)
  // ============================================

  formatCoreResponse(result: AdmissibilityResult): string {
    if (result.status === 'approved') {
      return `APPROVED:\n${result.approvalScope}`;
    }

    let response = 'INSUFFICIENT EVIDENCE TO ANALYZE\n';

    if (result.missingSources && result.missingSources.length > 0) {
      response += `• Missing source: ${result.missingSources.join(', ')}\n`;
    }

    if (result.violatedArticles && result.violatedArticles.length > 0) {
      response += `• Constitution article violated: ${result.violatedArticles.join(', ')}`;
    }

    return response;
  }
}
