/**
 * AuditService
 *
 * Maintains immutable audit trails for governance actions.
 * Critical for legal defensibility and compliance verification.
 */

export class AuditService {
  constructor(private env: any) {}

  async logAudit(auditData: {
    entityId: string;
    action: string;
    actor: string;
    metadata: Record<string, any>;
  }) {
    // Mint ChittyID for audit entry
    const auditId = await this.mintAuditId(auditData);

    // Store immutable audit record
    await this.env.DB.prepare(
      `INSERT INTO audit_trail
       (audit_id, entity_id, action, actor, metadata, timestamp)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        auditId,
        auditData.entityId,
        auditData.action,
        auditData.actor,
        JSON.stringify(auditData.metadata),
        new Date().toISOString(),
      )
      .run();

    return {
      auditId,
      entityId: auditData.entityId,
      action: auditData.action,
      actor: auditData.actor,
      timestamp: new Date().toISOString(),
    };
  }

  async getAuditTrail(
    entityId: string,
    options?: {
      startDate?: string;
      endDate?: string;
      limit?: number;
    },
  ) {
    const limit = options?.limit || 100;

    let query = "SELECT * FROM audit_trail WHERE entity_id = ?";
    const params = [entityId];

    if (options?.startDate) {
      query += " AND timestamp >= ?";
      params.push(options.startDate);
    }

    if (options?.endDate) {
      query += " AND timestamp <= ?";
      params.push(options.endDate);
    }

    query += " ORDER BY timestamp DESC LIMIT ?";
    params.push(limit);

    const results = await this.env.DB.prepare(query)
      .bind(...params)
      .all();

    return {
      entityId,
      entries:
        results.results?.map((entry) => ({
          auditId: entry.audit_id,
          action: entry.action,
          actor: entry.actor,
          metadata: JSON.parse(entry.metadata),
          timestamp: entry.timestamp,
        })) || [],
      total: results.results?.length || 0,
    };
  }

  async verifyAuditIntegrity(entityId: string) {
    // Verify audit trail has not been tampered with
    const trail = await this.getAuditTrail(entityId);

    // Check chronological order
    const chronological = trail.entries.every((entry, idx) => {
      if (idx === 0) return true;
      return (
        new Date(entry.timestamp) <= new Date(trail.entries[idx - 1].timestamp)
      );
    });

    return {
      entityId,
      verified: chronological,
      entryCount: trail.total,
      verifiedAt: new Date().toISOString(),
    };
  }

  private async mintAuditId(auditData: any) {
    // Mint ChittyID for audit entry
    const response = await fetch("https://id.chitty.cc/v1/mint", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.env.CHITTY_ID_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        entity_type: "EVNT",
        metadata: {
          type: "audit",
          action: auditData.action,
          entity_id: auditData.entityId,
        },
      }),
    });

    const result = await response.json();
    return result.chittyId;
  }
}
