import { useEffect, useState } from 'react'
import { api } from '../lib/api'

interface AuditEntry {
  id: string
  entity_id: string
  action: string
  actor: string
  timestamp: string
  metadata: Record<string, any>
}

export default function AuditTrail() {
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEntity, setSelectedEntity] = useState<string>('')

  useEffect(() => {
    if (selectedEntity) {
      loadAuditTrail(selectedEntity)
    }
  }, [selectedEntity])

  const loadAuditTrail = async (entityId: string) => {
    setLoading(true)
    try {
      const response = await api.getAuditTrail(entityId)
      if (response.data) {
        setAuditLog(response.data)
      }
    } catch (error) {
      console.error('Failed to load audit trail:', error)
    } finally {
      setLoading(false)
    }
  }

  const getActionColor = (action: string) => {
    if (action.includes('create') || action.includes('register')) {
      return 'text-green-400'
    }
    if (action.includes('update') || action.includes('modify')) {
      return 'text-blue-400'
    }
    if (action.includes('delete') || action.includes('revoke')) {
      return 'text-red-400'
    }
    return 'text-slate-400'
  }

  const getActionIcon = (action: string) => {
    if (action.includes('create') || action.includes('register')) {
      return '+'
    }
    if (action.includes('update') || action.includes('modify')) {
      return '✎'
    }
    if (action.includes('delete') || action.includes('revoke')) {
      return '×'
    }
    return '•'
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-100">Audit Trail</h2>
        <p className="mt-2 text-slate-400">
          Complete history of all actions and changes
        </p>
      </div>

      {/* Entity Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-300 mb-2">
          Select Entity
        </label>
        <select
          value={selectedEntity}
          onChange={(e) => setSelectedEntity(e.target.value)}
          className="w-full max-w-md bg-slate-800 border border-slate-700 text-slate-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-chitty-primary"
        >
          <option value="">Choose an entity...</option>
          {/* TODO: Load entities from API */}
        </select>
      </div>

      {/* Audit Timeline */}
      {selectedEntity ? (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          {loading ? (
            <div className="py-8 text-center text-slate-400">
              Loading audit trail...
            </div>
          ) : auditLog.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              No audit entries found for this entity
            </div>
          ) : (
            <div className="flow-root">
              <ul role="list" className="-mb-8">
                {auditLog.map((entry, idx) => (
                  <li key={entry.id}>
                    <div className="relative pb-8">
                      {idx !== auditLog.length - 1 && (
                        <span
                          className="absolute left-5 top-5 -ml-px h-full w-0.5 bg-slate-700"
                          aria-hidden="true"
                        />
                      )}
                      <div className="relative flex items-start space-x-3">
                        <div>
                          <div className="relative px-1">
                            <div
                              className={`h-8 w-8 rounded-full border-2 border-slate-700 flex items-center justify-center ring-8 ring-slate-800 ${getActionColor(
                                entry.action
                              )} bg-slate-900`}
                            >
                              <span className="font-bold text-lg">
                                {getActionIcon(entry.action)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div>
                            <div className="text-sm">
                              <span className="font-medium text-slate-100">
                                {entry.actor}
                              </span>
                            </div>
                            <p className="mt-0.5 text-sm text-slate-400">
                              {new Date(entry.timestamp).toLocaleString()}
                            </p>
                          </div>
                          <div className="mt-2 text-sm text-slate-300">
                            <p className={getActionColor(entry.action)}>
                              {entry.action}
                            </p>
                            {Object.keys(entry.metadata).length > 0 && (
                              <div className="mt-2 bg-slate-900 rounded p-3 border border-slate-700">
                                <pre className="text-xs text-slate-400 overflow-x-auto">
                                  {JSON.stringify(entry.metadata, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-12 text-center">
          <p className="text-slate-400">Select an entity to view audit trail</p>
        </div>
      )}
    </div>
  )
}
