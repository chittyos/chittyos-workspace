import { useEffect, useState } from 'react'
import { api } from '../lib/api'

interface DashboardStats {
  totalEntities: number
  activeEntities: number
  pendingCompliance: number
  overdueItems: number
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalEntities: 0,
    activeEntities: 0,
    pendingCompliance: 0,
    overdueItems: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      const response = await api.listEntities()
      if (response.data) {
        const total = response.data.length
        const active = response.data.filter(e => e.status === 'active').length

        setStats({
          totalEntities: total,
          activeEntities: active,
          pendingCompliance: 0, // TODO: Calculate from compliance API
          overdueItems: 0, // TODO: Calculate from compliance API
        })
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-100">Governance Dashboard</h2>
        <p className="mt-2 text-slate-400">
          Entity management, compliance tracking, and regulatory oversight
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Entities"
          value={stats.totalEntities}
          loading={loading}
          color="blue"
        />
        <StatCard
          title="Active Entities"
          value={stats.activeEntities}
          loading={loading}
          color="green"
        />
        <StatCard
          title="Pending Compliance"
          value={stats.pendingCompliance}
          loading={loading}
          color="yellow"
        />
        <StatCard
          title="Overdue Items"
          value={stats.overdueItems}
          loading={loading}
          color="red"
        />
      </div>

      {/* Recent Activity */}
      <div className="mt-8">
        <h3 className="text-xl font-semibold text-slate-100 mb-4">Recent Activity</h3>
        <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
          <p className="text-slate-400 text-center py-8">
            No recent activity to display
          </p>
        </div>
      </div>
    </div>
  )
}

interface StatCardProps {
  title: string
  value: number
  loading: boolean
  color: 'blue' | 'green' | 'yellow' | 'red'
}

function StatCard({ title, value, loading, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    green: 'bg-green-500/10 text-green-400 border-green-500/20',
    yellow: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    red: 'bg-red-500/10 text-red-400 border-red-500/20',
  }

  return (
    <div className={`${colorClasses[color]} border rounded-lg p-6`}>
      <dt className="text-sm font-medium truncate opacity-80">{title}</dt>
      <dd className="mt-2 text-3xl font-semibold">
        {loading ? '...' : value}
      </dd>
    </div>
  )
}
