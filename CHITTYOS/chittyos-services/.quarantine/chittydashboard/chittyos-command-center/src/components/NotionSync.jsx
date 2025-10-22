import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Database,
  Webhook,
  CheckCircle,
  AlertCircle,
  XCircle,
  Clock,
  Activity,
  FileText,
  MessageSquare,
  Trash2,
  RefreshCw,
  Settings,
  Eye,
  TrendingUp,
  Shield,
  Repeat,
  Zap,
  Filter,
  AlertOctagon,
  Timer,
  BarChart3
} from 'lucide-react'
import { useNotionWebhooks, useNotionSyncStatus } from '../hooks/useNotionWebhooks'
import { formatDistanceToNow } from 'date-fns'

const NotionSync = () => {
  const [showEvents, setShowEvents] = useState(true)
  const [eventFilter, setEventFilter] = useState('all')
  const [showDLQ, setShowDLQ] = useState(false)
  const [showMetrics, setShowMetrics] = useState(true)

  const {
    webhookEvents,
    isConnected,
    connectionStatus,
    eventCounts,
    getEventsByType,
    getRecentEvents,
    checkConnectionStatus
  } = useNotionWebhooks({
    enableToastNotifications: true,
    onPageCreated: (data) => console.log('Page created:', data),
    onPageUpdated: (data) => console.log('Page updated:', data),
    onPageDeleted: (data) => console.log('Page deleted:', data),
    onDatabaseUpdated: (data) => console.log('Database updated:', data),
    onCommentCreated: (data) => console.log('Comment created:', data)
  })

  const { syncMetrics } = useNotionSyncStatus()

  const getStatusIcon = (status) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-5 h-5 text-green-400" />
      case 'disconnected':
        return <XCircle className="w-5 h-5 text-gray-400" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-400" />
      default:
        return <Clock className="w-5 h-5 text-yellow-400" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'connected':
        return 'border-green-400/30 bg-green-400/10'
      case 'disconnected':
        return 'border-gray-400/30 bg-gray-400/10'
      case 'error':
        return 'border-red-400/30 bg-red-400/10'
      default:
        return 'border-yellow-400/30 bg-yellow-400/10'
    }
  }

  const getEventIcon = (type) => {
    switch (type) {
      case 'page_created':
      case 'page_updated':
        return <FileText className="w-4 h-4" />
      case 'page_deleted':
        return <Trash2 className="w-4 h-4" />
      case 'database_updated':
        return <Database className="w-4 h-4" />
      case 'comment_created':
        return <MessageSquare className="w-4 h-4" />
      default:
        return <Activity className="w-4 h-4" />
    }
  }

  const getEventColor = (type) => {
    switch (type) {
      case 'page_created':
        return 'text-green-400 bg-green-400/10'
      case 'page_updated':
        return 'text-blue-400 bg-blue-400/10'
      case 'page_deleted':
        return 'text-red-400 bg-red-400/10'
      case 'database_updated':
        return 'text-purple-400 bg-purple-400/10'
      case 'comment_created':
        return 'text-yellow-400 bg-yellow-400/10'
      default:
        return 'text-gray-400 bg-gray-400/10'
    }
  }

  const filteredEvents = eventFilter === 'all'
    ? getRecentEvents(20)
    : getEventsByType(eventFilter)

  // Mock hardened sync data
  const hardenedSyncData = {
    dlq: {
      totalItems: 5,
      processingItems: 2,
      failedItems: 3,
      avgRetryTime: 245,
      successRate: 94.2
    },
    rateLimit: {
      currentRps: 8.5,
      maxRps: 10,
      throttledRequests: 12,
      avgBackoffTime: 1200,
      jitterEnabled: true
    },
    schemaValidation: {
      totalValidations: 1247,
      passedValidations: 1235,
      failedValidations: 12,
      avgValidationTime: 15,
      lastSchemaUpdate: Date.now() - 3600000
    },
    idempotency: {
      totalUpserts: 892,
      duplicatesPrevented: 45,
      conflictsResolved: 8,
      avgDedupeTime: 5
    }
  }

  return (
    <div className="space-y-6">
      {/* Status Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glassmorphic rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-chitty-primary/10 rounded-lg">
              <Webhook className="w-6 h-6 text-chitty-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Notion Webhook Integration</h2>
              <p className="text-gray-400 text-sm">
                Real-time synchronization with Notion workspace
              </p>
            </div>
          </div>
          <button
            onClick={checkConnectionStatus}
            className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 rounded-lg px-3 py-2 text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Connection Status */}
        <div className={`rounded-xl p-4 border ${getStatusColor(connectionStatus.status)}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {getStatusIcon(connectionStatus.status)}
              <div>
                <div className="font-medium capitalize">
                  {connectionStatus.status}
                </div>
                <div className="text-xs text-gray-400">
                  {connectionStatus.lastSync
                    ? `Last sync: ${formatDistanceToNow(new Date(connectionStatus.lastSync), { addSuffix: true })}`
                    : 'No recent sync'
                  }
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium">
                {connectionStatus.eventCount} events
              </div>
              <div className="text-xs text-gray-400">
                {connectionStatus.errorCount} errors
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Sync Metrics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <div className="glassmorphic rounded-xl p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-400/10 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <div className="text-lg font-bold">{eventCounts.total}</div>
              <div className="text-xs text-gray-400">Total Events</div>
            </div>
          </div>
        </div>

        <div className="glassmorphic rounded-xl p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-400/10 rounded-lg">
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="text-lg font-bold">
                {eventCounts.pageCreated + eventCounts.pageUpdated}
              </div>
              <div className="text-xs text-gray-400">Page Events</div>
            </div>
          </div>
        </div>

        <div className="glassmorphic rounded-xl p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-400/10 rounded-lg">
              <Database className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <div className="text-lg font-bold">{eventCounts.databaseUpdated}</div>
              <div className="text-xs text-gray-400">DB Updates</div>
            </div>
          </div>
        </div>

        <div className="glassmorphic rounded-xl p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-yellow-400/10 rounded-lg">
              <MessageSquare className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <div className="text-lg font-bold">{eventCounts.commentCreated}</div>
              <div className="text-xs text-gray-400">Comments</div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Hardened Sync Features */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glassmorphic rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold flex items-center space-x-2">
            <Shield className="w-5 h-5 text-chitty-primary" />
            <span>Hardened Sync Features</span>
          </h2>
          <button
            onClick={() => setShowMetrics(!showMetrics)}
            className="text-chitty-primary hover:text-chitty-secondary transition-colors text-sm flex items-center space-x-1"
          >
            <BarChart3 className="w-4 h-4" />
            <span>{showMetrics ? 'Hide' : 'Show'} Metrics</span>
          </button>
        </div>

        {showMetrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Dead Letter Queue */}
            <div className="bg-black/20 rounded-xl p-4">
              <div className="flex items-center space-x-2 mb-3">
                <AlertOctagon className="w-5 h-5 text-red-400" />
                <h3 className="font-medium text-sm">Dead Letter Queue</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Total Items:</span>
                  <span className="font-medium">{hardenedSyncData.dlq.totalItems}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Processing:</span>
                  <span className="font-medium text-blue-400">{hardenedSyncData.dlq.processingItems}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Failed:</span>
                  <span className="font-medium text-red-400">{hardenedSyncData.dlq.failedItems}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Success Rate:</span>
                  <span className="font-medium text-green-400">{hardenedSyncData.dlq.successRate}%</span>
                </div>
              </div>
            </div>

            {/* Rate Limiting */}
            <div className="bg-black/20 rounded-xl p-4">
              <div className="flex items-center space-x-2 mb-3">
                <Timer className="w-5 h-5 text-yellow-400" />
                <h3 className="font-medium text-sm">Rate Limiting</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Current RPS:</span>
                  <span className="font-medium">{hardenedSyncData.rateLimit.currentRps}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Max RPS:</span>
                  <span className="font-medium">{hardenedSyncData.rateLimit.maxRps}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Throttled:</span>
                  <span className="font-medium text-yellow-400">{hardenedSyncData.rateLimit.throttledRequests}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Jitter:</span>
                  <span className="font-medium text-green-400">
                    {hardenedSyncData.rateLimit.jitterEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>

            {/* Schema Validation */}
            <div className="bg-black/20 rounded-xl p-4">
              <div className="flex items-center space-x-2 mb-3">
                <Filter className="w-5 h-5 text-blue-400" />
                <h3 className="font-medium text-sm">Schema Validation</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Total:</span>
                  <span className="font-medium">{hardenedSyncData.schemaValidation.totalValidations}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Passed:</span>
                  <span className="font-medium text-green-400">{hardenedSyncData.schemaValidation.passedValidations}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Failed:</span>
                  <span className="font-medium text-red-400">{hardenedSyncData.schemaValidation.failedValidations}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Avg Time:</span>
                  <span className="font-medium">{hardenedSyncData.schemaValidation.avgValidationTime}ms</span>
                </div>
              </div>
            </div>

            {/* Idempotent Upserts */}
            <div className="bg-black/20 rounded-xl p-4">
              <div className="flex items-center space-x-2 mb-3">
                <Repeat className="w-5 h-5 text-purple-400" />
                <h3 className="font-medium text-sm">Idempotent Upserts</h3>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Total:</span>
                  <span className="font-medium">{hardenedSyncData.idempotency.totalUpserts}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Duplicates:</span>
                  <span className="font-medium text-yellow-400">{hardenedSyncData.idempotency.duplicatesPrevented}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Conflicts:</span>
                  <span className="font-medium text-orange-400">{hardenedSyncData.idempotency.conflictsResolved}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Avg Dedupe:</span>
                  <span className="font-medium">{hardenedSyncData.idempotency.avgDedupeTime}ms</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* DLQ Management */}
        <div className="border-t border-white/10 pt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center space-x-2">
              <AlertOctagon className="w-4 h-4 text-red-400" />
              <span>Dead Letter Queue Management</span>
            </h3>
            <button
              onClick={() => setShowDLQ(!showDLQ)}
              className="text-sm text-chitty-primary hover:text-chitty-secondary transition-colors"
            >
              {showDLQ ? 'Hide' : 'Show'} Failed Items
            </button>
          </div>

          {showDLQ && (
            <div className="space-y-2">
              {[1, 2, 3].map((item) => (
                <div key={item} className="bg-red-400/10 border border-red-400/30 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <XCircle className="w-4 h-4 text-red-400" />
                      <div>
                        <div className="text-sm font-medium">Failed Notion Sync</div>
                        <div className="text-xs text-gray-400">
                          Page update failed: Rate limit exceeded (429)
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button className="text-xs bg-chitty-primary hover:bg-chitty-primary/80 px-2 py-1 rounded transition-colors">
                        Retry
                      </button>
                      <span className="text-xs text-gray-400">
                        Retry {item + 2}/5
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* Event Feed */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glassmorphic rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <Activity className="w-5 h-5 text-chitty-primary" />
            <h3 className="text-lg font-semibold">Recent Webhook Events</h3>
          </div>

          <div className="flex items-center space-x-3">
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className="bg-black/30 border border-white/10 rounded-lg px-3 py-1 text-sm focus:outline-none focus:border-chitty-primary/50"
            >
              <option value="all">All Events</option>
              <option value="page_created">Page Created</option>
              <option value="page_updated">Page Updated</option>
              <option value="page_deleted">Page Deleted</option>
              <option value="database_updated">Database Updated</option>
              <option value="comment_created">Comment Created</option>
            </select>

            <button
              onClick={() => setShowEvents(!showEvents)}
              className="flex items-center space-x-1 text-chitty-primary hover:text-chitty-secondary transition-colors"
            >
              <Eye className="w-4 h-4" />
              <span className="text-sm">{showEvents ? 'Hide' : 'Show'}</span>
            </button>
          </div>
        </div>

        {showEvents && (
          <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-hide">
            {filteredEvents.length > 0 ? (
              filteredEvents.map((event, index) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-black/20 rounded-lg p-4 border border-white/5 hover:border-white/10 transition-all"
                >
                  <div className="flex items-start space-x-3">
                    <div className={`p-2 rounded-lg ${getEventColor(event.type)}`}>
                      {getEventIcon(event.type)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="font-medium text-sm capitalize">
                          {event.type.replace('_', ' ')}
                        </h4>
                        <div className="text-xs text-gray-400">
                          {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                        </div>
                      </div>

                      <div className="text-sm text-gray-400 mb-2">
                        {event.data.title || event.data.id || 'Event processed'}
                      </div>

                      {event.data.url && (
                        <a
                          href={event.data.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-chitty-primary hover:text-chitty-secondary transition-colors"
                        >
                          View in Notion →
                        </a>
                      )}

                      {!event.processed && (
                        <div className="mt-2">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-yellow-400/10 text-yellow-400">
                            <Clock className="w-3 h-3 mr-1" />
                            Processing
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-400">
                <Webhook className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No webhook events yet</p>
                <p className="text-sm">Events will appear here when your Notion workspace changes</p>
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Webhook Configuration Help */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glassmorphic rounded-2xl p-6"
      >
        <div className="flex items-center space-x-3 mb-4">
          <Settings className="w-5 h-5 text-chitty-primary" />
          <h3 className="text-lg font-semibold">Webhook Configuration</h3>
        </div>

        <div className="space-y-4 text-sm">
          <div>
            <h4 className="font-medium mb-2">Setup Instructions:</h4>
            <ol className="list-decimal list-inside space-y-1 text-gray-400">
              <li>Go to your Notion integration settings</li>
              <li>Navigate to the Webhooks tab</li>
              <li>Click "Create a subscription"</li>
              <li>Enter your webhook URL: <code className="bg-black/30 px-2 py-1 rounded">https://your-domain.com/api/notion/webhook</code></li>
              <li>Select the event types you want to monitor</li>
              <li>Save the webhook secret in your environment variables</li>
            </ol>
          </div>

          <div>
            <h4 className="font-medium mb-2">Supported Events:</h4>
            <div className="grid grid-cols-2 gap-2 text-gray-400">
              <div>• Page created/updated/deleted</div>
              <div>• Database schema changes</div>
              <div>• Comment creation</div>
              <div>• Real-time synchronization</div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default NotionSync