import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  RefreshCw,
  Users,
  Globe,
  Activity,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Zap,
  Network,
  Database,
  ArrowUpDown,
  GitBranch,
  Timer,
  Shield
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'

const SessionSync = () => {
  const [syncMetrics, setSyncMetrics] = useState({})
  const [conflictResolution, setConflictResolution] = useState([])
  const [crossServiceState, setCrossServiceState] = useState({})

  // Mock real-time session sync data
  useEffect(() => {
    const interval = setInterval(() => {
      setSyncMetrics({
        totalSessions: Math.floor(Math.random() * 50) + 200,
        activeSyncs: Math.floor(Math.random() * 20) + 45,
        conflictResolutions: Math.floor(Math.random() * 5) + 12,
        vectorClockUpdates: Math.floor(Math.random() * 100) + 300,
        retryOperations: Math.floor(Math.random() * 10) + 5,
        crossServiceLatency: Math.floor(Math.random() * 50) + 25
      })

      setCrossServiceState({
        chittyCore: {
          status: 'connected',
          lastSync: Date.now() - Math.floor(Math.random() * 30000),
          sessionCount: Math.floor(Math.random() * 20) + 45,
          conflicts: Math.floor(Math.random() * 3)
        },
        chittyLegal: {
          status: 'connected',
          lastSync: Date.now() - Math.floor(Math.random() * 60000),
          sessionCount: Math.floor(Math.random() * 15) + 30,
          conflicts: Math.floor(Math.random() * 2)
        },
        chittyProperty: {
          status: 'syncing',
          lastSync: Date.now() - Math.floor(Math.random() * 10000),
          sessionCount: Math.floor(Math.random() * 12) + 25,
          conflicts: Math.floor(Math.random() * 1)
        },
        chittyAuth: {
          status: 'connected',
          lastSync: Date.now() - Math.floor(Math.random() * 20000),
          sessionCount: Math.floor(Math.random() * 25) + 50,
          conflicts: 0
        },
        notionSync: {
          status: Math.random() > 0.8 ? 'warning' : 'connected',
          lastSync: Date.now() - Math.floor(Math.random() * 120000),
          sessionCount: Math.floor(Math.random() * 8) + 15,
          conflicts: Math.floor(Math.random() * 4)
        }
      })

      // Generate mock conflict resolution data
      setConflictResolution(prev => [
        {
          id: Date.now(),
          timestamp: Date.now(),
          services: ['ChittyLegal', 'ChittyProperty'],
          type: 'data_conflict',
          resolution: 'vector_clock',
          status: 'resolved',
          duration: Math.floor(Math.random() * 500) + 100
        },
        ...prev.slice(0, 9)
      ])
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  const services = Object.entries(crossServiceState)

  const getStatusIcon = (status) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-4 h-4 text-green-400" />
      case 'syncing':
        return <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />
      case 'error':
        return <XCircle className="w-4 h-4 text-red-400" />
      default:
        return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'connected':
        return 'border-green-400/30 bg-green-400/10'
      case 'syncing':
        return 'border-blue-400/30 bg-blue-400/10'
      case 'warning':
        return 'border-yellow-400/30 bg-yellow-400/10'
      case 'error':
        return 'border-red-400/30 bg-red-400/10'
      default:
        return 'border-gray-400/30 bg-gray-400/10'
    }
  }

  const generateSyncData = () => {
    return Array.from({ length: 20 }, (_, i) => ({
      time: i,
      sessions: Math.floor(Math.random() * 50) + 150,
      conflicts: Math.floor(Math.random() * 5) + 2,
      latency: Math.floor(Math.random() * 30) + 20
    }))
  }

  const conflictDistribution = [
    { name: 'Vector Clock Resolution', value: 45, color: '#10B981' },
    { name: 'Last Write Wins', value: 25, color: '#3B82F6' },
    { name: 'Manual Resolution', value: 20, color: '#F59E0B' },
    { name: 'Retry Success', value: 10, color: '#8B5CF6' }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glassmorphic rounded-2xl p-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center space-x-2">
              <Network className="w-7 h-7 text-chitty-primary" />
              <span>Distributed Session Sync</span>
            </h1>
            <p className="text-gray-400 mt-1">
              Cross-service synchronization with vector clock conflict resolution
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-400">
              Vector Clocks • Exponential Backoff • Circuit Breakers
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-green-400">Sync Active</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Sync Overview Metrics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <div className="glassmorphic rounded-xl p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-400/10 rounded-lg">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="text-lg font-bold">{syncMetrics.totalSessions || 0}</div>
              <div className="text-xs text-gray-400">Active Sessions</div>
            </div>
          </div>
        </div>

        <div className="glassmorphic rounded-xl p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-400/10 rounded-lg">
              <ArrowUpDown className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <div className="text-lg font-bold">{syncMetrics.activeSyncs || 0}</div>
              <div className="text-xs text-gray-400">Active Syncs</div>
            </div>
          </div>
        </div>

        <div className="glassmorphic rounded-xl p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-yellow-400/10 rounded-lg">
              <GitBranch className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <div className="text-lg font-bold">{syncMetrics.conflictResolutions || 0}</div>
              <div className="text-xs text-gray-400">Conflicts Resolved</div>
            </div>
          </div>
        </div>

        <div className="glassmorphic rounded-xl p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-400/10 rounded-lg">
              <Timer className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <div className="text-lg font-bold">{syncMetrics.crossServiceLatency || 0}ms</div>
              <div className="text-xs text-gray-400">Avg Latency</div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Cross-Service State */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glassmorphic rounded-2xl p-6"
      >
        <h2 className="text-lg font-semibold mb-6 flex items-center space-x-2">
          <Globe className="w-5 h-5 text-chitty-primary" />
          <span>Cross-Service State Management</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map(([serviceName, serviceData], index) => (
            <motion.div
              key={serviceName}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + index * 0.05 }}
              className={`border rounded-xl p-4 ${getStatusColor(serviceData.status)}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Database className="w-4 h-4 text-chitty-primary" />
                  <h3 className="font-semibold text-sm">{serviceName}</h3>
                </div>
                {getStatusIcon(serviceData.status)}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Sessions:</span>
                  <span className="font-medium">{serviceData.sessionCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Conflicts:</span>
                  <span className={`font-medium ${
                    serviceData.conflicts > 0 ? 'text-yellow-400' : 'text-green-400'
                  }`}>
                    {serviceData.conflicts}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Last Sync:</span>
                  <span className="font-medium text-xs">
                    {Math.floor((Date.now() - serviceData.lastSync) / 1000)}s ago
                  </span>
                </div>
              </div>

              {serviceData.status === 'syncing' && (
                <div className="mt-3">
                  <div className="bg-black/30 rounded-full h-1">
                    <motion.div
                      className="bg-blue-400 h-1 rounded-full"
                      animate={{ width: ['0%', '100%'] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Sync Performance & Conflict Resolution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sync Performance Chart */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="glassmorphic rounded-2xl p-6"
        >
          <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
            <Activity className="w-5 h-5 text-chitty-primary" />
            <span>Sync Performance</span>
          </h3>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={generateSyncData()}>
                <XAxis dataKey="time" stroke="#9CA3AF" fontSize={12} />
                <YAxis stroke="#9CA3AF" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="sessions"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ fill: '#10B981', strokeWidth: 2, r: 3 }}
                  name="Active Sessions"
                />
                <Line
                  type="monotone"
                  dataKey="latency"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ fill: '#3B82F6', strokeWidth: 2, r: 3 }}
                  name="Latency (ms)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Conflict Resolution Methods */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="glassmorphic rounded-2xl p-6"
        >
          <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
            <GitBranch className="w-5 h-5 text-chitty-primary" />
            <span>Conflict Resolution</span>
          </h3>

          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={conflictDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {conflictDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4">
            {conflictDistribution.map((method) => (
              <div key={method.name} className="flex items-center space-x-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: method.color }}
                />
                <span className="text-xs text-gray-400">{method.name}</span>
                <span className="text-xs font-medium">{method.value}%</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Recent Conflict Resolutions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="glassmorphic rounded-2xl p-6"
      >
        <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
          <Shield className="w-5 h-5 text-chitty-primary" />
          <span>Recent Conflict Resolutions</span>
        </h3>

        <div className="space-y-3 max-h-64 overflow-y-auto scrollbar-hide">
          {conflictResolution.length > 0 ? (
            conflictResolution.map((conflict, index) => (
              <motion.div
                key={conflict.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-black/20 rounded-lg p-3 border border-white/5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <GitBranch className="w-4 h-4 text-yellow-400" />
                    <div>
                      <div className="text-sm font-medium">
                        {conflict.services.join(' ↔ ')} Conflict
                      </div>
                      <div className="text-xs text-gray-400">
                        Resolved via {conflict.resolution.replace('_', ' ')} in {conflict.duration}ms
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-gray-400">
                      {Math.floor((Date.now() - conflict.timestamp) / 1000)}s ago
                    </span>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-400">
              <GitBranch className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No recent conflicts</p>
              <p className="text-sm">Vector clock synchronization preventing conflicts</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Reliability Features */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="glassmorphic rounded-2xl p-6"
      >
        <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
          <Zap className="w-5 h-5 text-chitty-primary" />
          <span>Reliability Features</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-black/20 rounded-lg p-4 text-center">
            <RefreshCw className="w-8 h-8 text-blue-400 mx-auto mb-2" />
            <div className="font-medium mb-1">Exponential Backoff</div>
            <div className="text-xs text-gray-400">Automatic retry with jitter</div>
          </div>

          <div className="bg-black/20 rounded-lg p-4 text-center">
            <Shield className="w-8 h-8 text-green-400 mx-auto mb-2" />
            <div className="font-medium mb-1">Circuit Breakers</div>
            <div className="text-xs text-gray-400">Service failure protection</div>
          </div>

          <div className="bg-black/20 rounded-lg p-4 text-center">
            <Clock className="w-8 h-8 text-purple-400 mx-auto mb-2" />
            <div className="font-medium mb-1">Vector Clocks</div>
            <div className="text-xs text-gray-400">Causal ordering preservation</div>
          </div>

          <div className="bg-black/20 rounded-lg p-4 text-center">
            <Activity className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
            <div className="font-medium mb-1">Health Checks</div>
            <div className="text-xs text-gray-400">Continuous monitoring</div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default SessionSync