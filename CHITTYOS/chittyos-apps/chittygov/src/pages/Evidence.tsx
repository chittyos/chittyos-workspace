import { useEffect, useState } from 'react'
import { api } from '../lib/api'

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

export default function Evidence() {
  const [evidence, setEvidence] = useState<EvidenceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEntity, setSelectedEntity] = useState<string>('')

  useEffect(() => {
    if (selectedEntity) {
      loadEvidence(selectedEntity)
    }
  }, [selectedEntity])

  const loadEvidence = async (entityId: string) => {
    setLoading(true)
    try {
      const response = await api.getEvidence(entityId)
      if (response.data) {
        setEvidence(response.data)
      }
    } catch (error) {
      console.error('Failed to load evidence:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (evidenceId: string) => {
    try {
      const response = await api.verifyEvidence(evidenceId)
      if (response.data) {
        // Update local state
        setEvidence(prev =>
          prev.map(item =>
            item.id === evidenceId ? { ...item, verified: true } : item
          )
        )
      }
    } catch (error) {
      console.error('Failed to verify evidence:', error)
    }
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-100">Evidence Management</h2>
        <p className="mt-2 text-slate-400">
          Upload and track supporting documentation and evidence
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

      {/* Upload Section */}
      {selectedEntity && (
        <div className="mb-6 bg-slate-800 rounded-lg border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">Upload Evidence</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Evidence Type
              </label>
              <input
                type="text"
                placeholder="e.g., Annual Report, Tax Filing, etc."
                className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-chitty-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                File Upload
              </label>
              <input
                type="file"
                className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-chitty-primary"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Description
              </label>
              <textarea
                rows={3}
                placeholder="Describe this evidence..."
                className="w-full bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-chitty-primary"
              />
            </div>
            <div className="sm:col-span-2">
              <button className="bg-chitty-primary hover:bg-chitty-primary/80 text-slate-900 font-semibold px-6 py-2 rounded-lg transition-colors">
                Upload Evidence
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Evidence List */}
      {selectedEntity ? (
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <div className="px-6 py-4 bg-slate-900 border-b border-slate-700">
            <h3 className="text-lg font-semibold text-slate-100">Uploaded Evidence</h3>
          </div>
          <div className="divide-y divide-slate-700">
            {loading ? (
              <div className="px-6 py-8 text-center text-slate-400">
                Loading evidence...
              </div>
            ) : evidence.length === 0 ? (
              <div className="px-6 py-8 text-center text-slate-400">
                No evidence found for this entity
              </div>
            ) : (
              evidence.map((item) => (
                <div key={item.id} className="px-6 py-4 hover:bg-slate-700/50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h4 className="text-sm font-medium text-slate-100">
                          {item.evidence_type}
                        </h4>
                        {item.verified ? (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                            Verified
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                            Pending
                          </span>
                        )}
                        {item.chitty_id && (
                          <span className="text-xs text-slate-500 font-mono">
                            {item.chitty_id}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-slate-400">{item.description}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Uploaded {new Date(item.uploaded_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <a
                        href={item.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1 text-sm font-medium text-chitty-primary hover:text-chitty-primary/80 transition-colors"
                      >
                        View
                      </a>
                      {!item.verified && (
                        <button
                          onClick={() => handleVerify(item.id)}
                          className="px-3 py-1 text-sm font-medium text-green-400 hover:text-green-300 transition-colors"
                        >
                          Verify
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-12 text-center">
          <p className="text-slate-400">Select an entity to view evidence</p>
        </div>
      )}
    </div>
  )
}
