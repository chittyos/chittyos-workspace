import React from 'react'
import { motion } from 'framer-motion'
import {
  Activity,
  Clock,
  CheckCircle,
  AlertTriangle,
  Info,
  Users,
  Server,
  RefreshCw
} from 'lucide-react'
import { useChittyOS } from '../contexts/ChittyOSContext'
import { formatDistanceToNow } from 'date-fns'

const ActivityFeed = () => {
  const { stats } = useChittyOS()

  const activities = stats?.recentActivity || [
    {
      id: 1,
      type: 'module_update',
      title: 'ChittyGov updated',
      description: 'Government module received new governance features and compliance updates',
      timestamp: Date.now() - 3600000,
      severity: 'info',
      user: 'System Admin',
      module: 'ChittyGov'
    },
    {
      id: 2,
      type: 'new_connection',
      title: 'New client connected',
      description: 'Law firm "Smith & Associates" successfully joined the network',
      timestamp: Date.now() - 7200000,
      severity: 'success',
      user: 'Smith & Associates',
      module: 'ChittyAuth'
    },
    {
      id: 3,
      type: 'system_alert',
      title: 'High usage detected',
      description: 'ChittyLegal module experiencing high traffic due to court filing deadline',
      timestamp: Date.now() - 10800000,
      severity: 'warning',
      user: 'System Monitor',
      module: 'ChittyLegal'
    },
    {
      id: 4,
      type: 'module_activation',
      title: 'ChittyContract activated',
      description: 'Contract management module successfully deployed for premium users',
      timestamp: Date.now() - 14400000,
      severity: 'success',
      user: 'Deployment Service',
      module: 'ChittyContract'
    },
    {
      id: 5,
      type: 'security_scan',
      title: 'Security scan completed',
      description: 'Automated security audit completed with no issues found',
      timestamp: Date.now() - 18000000,
      severity: 'info',
      user: 'Security Scanner',
      module: 'ChittySecure'
    }
  ]

  const getActivityIcon = (type, severity) => {
    switch (type) {
      case 'module_update':
        return RefreshCw
      case 'new_connection':
        return Users
      case 'system_alert':
        return AlertTriangle
      case 'module_activation':
        return Server
      case 'security_scan':
        return CheckCircle
      default:
        return Info
    }
  }

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'success':
        return 'text-green-400 bg-green-400/10 border-green-400/30'
      case 'warning':
        return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30'
      case 'error':
        return 'text-red-400 bg-red-400/10 border-red-400/30'
      default:
        return 'text-blue-400 bg-blue-400/10 border-blue-400/30'
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.6 }}
      className="glassmorphic rounded-2xl p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold flex items-center space-x-2">
          <Activity className="w-5 h-5 text-chitty-primary" />
          <span>Recent Activity</span>
        </h2>
        <button className="text-xs text-gray-400 hover:text-white transition-colors flex items-center space-x-1">
          <RefreshCw className="w-3 h-3" />
          <span>Refresh</span>
        </button>
      </div>

      <div className="space-y-4 max-h-96 overflow-y-auto scrollbar-hide">
        {activities.map((activity, index) => {
          const ActivityIcon = getActivityIcon(activity.type, activity.severity)
          const timeAgo = formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })

          return (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 + index * 0.05 }}
              className="bg-black/20 rounded-xl p-4 border border-white/5 hover:border-white/10 transition-all cursor-pointer group"
            >
              <div className="flex items-start space-x-3">
                <div className={`rounded-lg p-2 border ${getSeverityColor(activity.severity)}`}>
                  <ActivityIcon className="w-4 h-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-medium text-sm group-hover:text-chitty-primary transition-colors">
                      {activity.title}
                    </h3>
                    <div className="flex items-center space-x-1 text-xs text-gray-400">
                      <Clock className="w-3 h-3" />
                      <span>{timeAgo}</span>
                    </div>
                  </div>

                  <p className="text-xs text-gray-400 leading-relaxed mb-2">
                    {activity.description}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-xs">
                      <span className="text-gray-500">by</span>
                      <span className="text-chitty-primary">{activity.user}</span>
                    </div>
                    {activity.module && (
                      <span className="bg-chitty-primary/20 text-chitty-primary text-xs px-2 py-1 rounded-full">
                        {activity.module}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Activity Summary */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="mt-6 bg-gradient-to-r from-chitty-primary/10 to-chitty-secondary/10 border border-chitty-primary/30 rounded-xl p-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-chitty-primary">System Activity</h3>
            <p className="text-xs text-gray-400">Last 24 hours</p>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-chitty-primary">
              {activities.length} events
            </div>
            <div className="text-xs text-gray-400">All processed</div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default ActivityFeed