'use client'

import { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { Activity, Database, Cloud, Zap } from 'lucide-react'

const mockStorageData = [
  { time: '00:00', used: 65, cleaned: 5 },
  { time: '04:00', used: 68, cleaned: 8 },
  { time: '08:00', used: 72, cleaned: 12 },
  { time: '12:00', used: 69, cleaned: 15 },
  { time: '16:00', used: 71, cleaned: 18 },
  { time: '20:00', used: 67, cleaned: 22 },
  { time: '24:00', used: 64, cleaned: 25 }
]

const fileTypeData = [
  { name: 'Temp Files', value: 35, color: '#ef4444' },
  { name: 'Cache', value: 28, color: '#f97316' },
  { name: 'Logs', value: 20, color: '#eab308' },
  { name: 'Duplicates', value: 17, color: '#22c55e' }
]

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalCleaned: '2.4 GB',
    filesProcessed: '15,847',
    ipfsArchived: '1.2 GB',
    ethTransactions: '42'
  })

  const [isLive, setIsLive] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setIsLive(prev => !prev)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="bg-gray-800/30 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
      {/* Status Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-white">System Status</h3>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-400' : 'bg-gray-400'} transition-colors`} />
          <span className="text-sm text-gray-300">
            {isLive ? 'Active' : 'Monitoring'}
          </span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-900/50 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <Zap className="h-5 w-5 text-yellow-400 mr-2" />
            <span className="text-sm text-gray-400">Cleaned</span>
          </div>
          <div className="text-xl font-bold text-white">{stats.totalCleaned}</div>
        </div>

        <div className="bg-gray-900/50 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <Activity className="h-5 w-5 text-blue-400 mr-2" />
            <span className="text-sm text-gray-400">Files</span>
          </div>
          <div className="text-xl font-bold text-white">{stats.filesProcessed}</div>
        </div>

        <div className="bg-gray-900/50 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <Cloud className="h-5 w-5 text-purple-400 mr-2" />
            <span className="text-sm text-gray-400">IPFS</span>
          </div>
          <div className="text-xl font-bold text-white">{stats.ipfsArchived}</div>
        </div>

        <div className="bg-gray-900/50 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <Database className="h-5 w-5 text-green-400 mr-2" />
            <span className="text-sm text-gray-400">Blockchain</span>
          </div>
          <div className="text-xl font-bold text-white">{stats.ethTransactions}</div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Storage Timeline */}
        <div className="bg-gray-900/30 rounded-lg p-4">
          <h4 className="text-lg font-semibold text-white mb-4">Storage Usage (24h)</h4>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={mockStorageData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px'
                }}
              />
              <Line
                type="monotone"
                dataKey="used"
                stroke="#8b5cf6"
                strokeWidth={2}
                name="Used %"
              />
              <Line
                type="monotone"
                dataKey="cleaned"
                stroke="#10b981"
                strokeWidth={2}
                name="Cleaned GB"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* File Types */}
        <div className="bg-gray-900/30 rounded-lg p-4">
          <h4 className="text-lg font-semibold text-white mb-4">Cleanup Categories</h4>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={fileTypeData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                dataKey="value"
              >
                {fileTypeData.map((entry, index) => (
                  <Cell key={index} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 mt-4">
            {fileTypeData.map((item, index) => (
              <div key={index} className="flex items-center">
                <div
                  className="w-3 h-3 rounded-full mr-1"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-xs text-gray-400">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="mt-6 bg-gray-900/30 rounded-lg p-4">
        <h4 className="text-lg font-semibold text-white mb-4">Recent Activity</h4>
        <div className="space-y-2">
          {[
            { time: '2 min ago', action: 'Archived 150MB to IPFS', type: 'ipfs' },
            { time: '5 min ago', action: 'Cleaned temp directory', type: 'cleanup' },
            { time: '12 min ago', action: 'Updated storage policy on-chain', type: 'ethereum' },
            { time: '18 min ago', action: 'Detected 25 duplicate files', type: 'scan' }
          ].map((activity, index) => (
            <div key={index} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-b-0">
              <div className="flex items-center">
                <div className={`w-2 h-2 rounded-full mr-3 ${
                  activity.type === 'ipfs' ? 'bg-purple-400' :
                  activity.type === 'cleanup' ? 'bg-green-400' :
                  activity.type === 'ethereum' ? 'bg-blue-400' : 'bg-yellow-400'
                }`} />
                <span className="text-gray-300">{activity.action}</span>
              </div>
              <span className="text-sm text-gray-500">{activity.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}