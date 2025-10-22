// ChittyGov API Client
// Governance, compliance, and regulatory tracking for legal entities

interface Entity {
  id: string
  name: string
  type: 'corporation' | 'llc' | 'partnership' | 'trust' | 'individual'
  jurisdiction: string
  status: 'active' | 'inactive' | 'suspended' | 'dissolved'
  registered_date: string
  chitty_id?: string
  metadata: Record<string, any>
}

interface ComplianceRule {
  id: string
  entity_id: string
  rule_type: string
  description: string
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual'
  next_due: string
  status: 'compliant' | 'pending' | 'overdue' | 'exempt'
}

interface EvidenceItem {
  id: string
  entity_id: string
  evidence_type: string
  file_url: string
  description: string
  uploaded_at: string
  verified: boolean
  chitty_id?: string
}

interface AuditEntry {
  id: string
  entity_id: string
  action: string
  actor: string
  timestamp: string
  metadata: Record<string, any>
}

interface ApiResponse<T> {
  data?: T
  error?: string
  status: number
}

class ChittyGovAPI {
  private baseUrl: string
  private token: string | null

  constructor(baseUrl = 'https://gov.chitty.cc/api') {
    this.baseUrl = baseUrl
    this.token = localStorage.getItem('chitty_auth_token')
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
        ...options.headers,
      }

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      })

      const data = await response.json()

      if (!response.ok) {
        return {
          error: data.error || 'Request failed',
          status: response.status,
        }
      }

      return {
        data,
        status: response.status,
      }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 500,
      }
    }
  }

  // Entity Management
  async registerEntity(entityData: Omit<Entity, 'id'>) {
    return this.request<Entity>('/entities/register', {
      method: 'POST',
      body: JSON.stringify(entityData),
    })
  }

  async getEntity(entityId: string) {
    return this.request<Entity>(`/entities/${entityId}`)
  }

  async listEntities(filters?: { status?: string; type?: string }) {
    const params = new URLSearchParams(filters as Record<string, string>)
    return this.request<Entity[]>(`/entities?${params}`)
  }

  async updateEntity(entityId: string, updates: Partial<Entity>) {
    return this.request<Entity>(`/entities/${entityId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    })
  }

  async revokeEntity(entityId: string, reason: string) {
    return this.request<{ success: boolean }>(`/entities/${entityId}/revoke`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
  }

  // Compliance Management
  async getComplianceRules(entityId: string) {
    return this.request<ComplianceRule[]>(`/compliance/${entityId}`)
  }

  async addComplianceRule(ruleData: Omit<ComplianceRule, 'id'>) {
    return this.request<ComplianceRule>('/compliance/rules', {
      method: 'POST',
      body: JSON.stringify(ruleData),
    })
  }

  async updateComplianceStatus(
    ruleId: string,
    status: ComplianceRule['status']
  ) {
    return this.request<ComplianceRule>(`/compliance/rules/${ruleId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
  }

  // Evidence Management
  async uploadEvidence(evidenceData: Omit<EvidenceItem, 'id' | 'uploaded_at'>) {
    return this.request<EvidenceItem>('/evidence/upload', {
      method: 'POST',
      body: JSON.stringify(evidenceData),
    })
  }

  async getEvidence(entityId: string) {
    return this.request<EvidenceItem[]>(`/evidence/${entityId}`)
  }

  async verifyEvidence(evidenceId: string) {
    return this.request<EvidenceItem>(`/evidence/${evidenceId}/verify`, {
      method: 'POST',
    })
  }

  // Audit Trail
  async logAudit(auditData: {
    entity_id: string
    action: string
    actor: string
    metadata: Record<string, any>
  }) {
    return this.request<AuditEntry>('/audit/log', {
      method: 'POST',
      body: JSON.stringify(auditData),
    })
  }

  async getAuditTrail(entityId: string) {
    return this.request<AuditEntry[]>(`/audit/${entityId}`)
  }

  // Health check
  async health() {
    return this.request<{ status: string; service: string; version: string }>('/health')
  }
}

export const api = new ChittyGovAPI()
