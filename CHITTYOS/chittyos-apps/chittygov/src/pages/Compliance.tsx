import { useEffect, useState } from 'react'
import { api } from '../lib/api'

interface ComplianceRule {
  id: string
  entity_id: string
  rule_type: string
  description: string
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual'
  next_due: string
  status: 'compliant' | 'pending' | 'overdue' | 'exempt'
}

export default function Compliance() {
  const [rules, setRules] = useState<ComplianceRule[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedEntity, setSelectedEntity] = useState<string>('')

  useEffect(() => {
    if (selectedEntity) {
      loadComplianceRules(selectedEntity)
    }
  }, [selectedEntity])

  const loadComplianceRules = async (entityId: string) => {
    setLoading(true)
    try {
      const response = await api.getComplianceRules(entityId)
      if (response.data) {
        setRules(response.data)
      }
    } catch (error) {
      console.error('Failed to load compliance rules:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: ComplianceRule['status']) => {
    switch (status) {
      case 'compliant':
        return 'bg-green-500/10 text-green-400 border-green-500/20'
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
      case 'overdue':
        return 'bg-red-500/10 text-red-400 border-red-500/20'
      case 'exempt':
        return 'bg-slate-500/10 text-slate-400 border-slate-500/20'
    }
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-100">Compliance Tracking</h2>
        <p className="mt-2 text-slate-400">
          Monitor regulatory requirements and compliance deadlines
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

      {/* Compliance Rules Table */}
      {selectedEntity ? (
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          <table className="min-w-full divide-y divide-slate-700">
            <thead className="bg-slate-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Rule Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Frequency
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Next Due
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-slate-800 divide-y divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    Loading compliance rules...
                  </td>
                </tr>
              ) : rules.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                    No compliance rules found for this entity
                  </td>
                </tr>
              ) : (
                rules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-slate-700/50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-100">
                      {rule.rule_type}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300">
                      {rule.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      {rule.frequency}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                      {new Date(rule.next_due).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${getStatusColor(
                          rule.status
                        )}`}
                      >
                        {rule.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-12 text-center">
          <p className="text-slate-400">Select an entity to view compliance rules</p>
        </div>
      )}
    </div>
  )
}
