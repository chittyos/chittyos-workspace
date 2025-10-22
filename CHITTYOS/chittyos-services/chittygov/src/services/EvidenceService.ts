/**
 * EvidenceService
 *
 * Collects and manages evidentiary records for legal cases.
 * All evidence minted with ChittyID for blockchain anchoring.
 */

export class EvidenceService {
  constructor(private env: any) {}

  async collectEvidence(evidenceData: {
    type: string;
    description: string;
    metadata: Record<string, any>;
    relatedEntities: string[];
  }) {
    // Mint ChittyID for evidence
    const evidenceId = await this.mintEvidenceId(evidenceData);

    // Store evidence record
    await this.env.DB.prepare(
      `INSERT INTO evidence_records
       (evidence_id, type, description, metadata, related_entities, collected_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        evidenceId,
        evidenceData.type,
        evidenceData.description,
        JSON.stringify(evidenceData.metadata),
        JSON.stringify(evidenceData.relatedEntities),
        new Date().toISOString(),
      )
      .run();

    return {
      evidenceId,
      type: evidenceData.type,
      description: evidenceData.description,
      collectedAt: new Date().toISOString(),
      status: "collected",
    };
  }

  async getEvidence(evidenceId: string) {
    const result = await this.env.DB.prepare(
      "SELECT * FROM evidence_records WHERE evidence_id = ?",
    )
      .bind(evidenceId)
      .first();

    if (!result) {
      throw new Error(`Evidence ${evidenceId} not found`);
    }

    return {
      evidenceId: result.evidence_id,
      type: result.type,
      description: result.description,
      metadata: JSON.parse(result.metadata),
      relatedEntities: JSON.parse(result.related_entities),
      collectedAt: result.collected_at,
    };
  }

  async linkEvidenceToCase(evidenceId: string, caseId: string) {
    // Link evidence to legal case
    await this.env.DB.prepare(
      "UPDATE evidence_records SET case_id = ? WHERE evidence_id = ?",
    )
      .bind(caseId, evidenceId)
      .run();

    return { evidenceId, caseId, linked: true };
  }

  private async mintEvidenceId(evidenceData: any) {
    // Mint ChittyID for evidence (CHITTY-EVNT-* for evidence events)
    const response = await fetch("https://id.chitty.cc/v1/mint", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.env.CHITTY_ID_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        entity_type: "EVNT",
        metadata: {
          type: "evidence",
          evidence_type: evidenceData.type,
          description: evidenceData.description,
        },
      }),
    });

    const result = await response.json();
    return result.chittyId;
  }
}
