import { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import { NOTION_EVENT_TYPES } from '../services/notionWebhooks'

/**
 * Custom hook for handling Notion webhook events in real-time
 * @param {Object} options - Configuration options
 * @returns {Object} - Webhook state and handlers
 */
export const useNotionWebhooks = (options = {}) => {
  const {
    enableToastNotifications = true,
    onPageCreated,
    onPageUpdated,
    onPageDeleted,
    onDatabaseUpdated,
    onCommentCreated,
    onError
  } = options

  const [webhookEvents, setWebhookEvents] = useState([])
  const [isConnected, setIsConnected] = useState(false)
  const [lastEventTime, setLastEventTime] = useState(null)
  const [syncStatus, setSyncStatus] = useState({
    status: 'disconnected',
    lastSync: null,
    errorCount: 0,
    successCount: 0
  })

  /**
   * Handle incoming webhook events
   */
  const handleWebhookEvent = useCallback((event) => {
    const { type, data, timestamp = Date.now() } = event.detail

    console.log('Received Notion webhook event:', { type, data, timestamp })

    // Update events list
    setWebhookEvents(prev => [
      {
        id: `${type}-${timestamp}`,
        type,
        data,
        timestamp,
        processed: false
      },
      ...prev.slice(0, 99) // Keep last 100 events
    ])

    setLastEventTime(timestamp)
    setSyncStatus(prev => ({
      ...prev,
      lastSync: new Date(timestamp).toISOString(),
      successCount: prev.successCount + 1
    }))

    // Call specific event handlers
    switch (type) {
      case 'page_created':
        onPageCreated?.(data)
        if (enableToastNotifications) {
          toast.success(`📄 New page created: ${data.title}`, {
            duration: 4000,
            icon: '🔗'
          })
        }
        break

      case 'page_updated':
        onPageUpdated?.(data)
        if (enableToastNotifications && data.significant) {
          toast.info(`📝 Page updated: ${data.title}`, {
            duration: 3000,
            icon: '🔄'
          })
        }
        break

      case 'page_deleted':
        onPageDeleted?.(data)
        if (enableToastNotifications) {
          toast.error(`🗑️ Page deleted: ${data.id}`, {
            duration: 4000,
            icon: '❌'
          })
        }
        break

      case 'database_updated':
        onDatabaseUpdated?.(data)
        if (enableToastNotifications) {
          toast.info(`🗄️ Database updated: ${data.title}`, {
            duration: 3000,
            icon: '📊'
          })
        }
        break

      case 'comment_created':
        onCommentCreated?.(data)
        if (enableToastNotifications) {
          toast.info(`💬 New comment added`, {
            duration: 3000,
            icon: '💭'
          })
        }
        break

      default:
        console.warn(`Unhandled webhook event type: ${type}`)
    }
  }, [
    onPageCreated,
    onPageUpdated,
    onPageDeleted,
    onDatabaseUpdated,
    onCommentCreated,
    enableToastNotifications
  ])

  /**
   * Handle webhook errors
   */
  const handleWebhookError = useCallback((error) => {
    console.error('Notion webhook error:', error)

    setSyncStatus(prev => ({
      ...prev,
      status: 'error',
      errorCount: prev.errorCount + 1
    }))

    onError?.(error)

    if (enableToastNotifications) {
      toast.error('Notion sync error occurred', {
        duration: 5000,
        icon: '⚠️'
      })
    }
  }, [onError, enableToastNotifications])

  /**
   * Mark event as processed
   */
  const markEventProcessed = useCallback((eventId) => {
    setWebhookEvents(prev =>
      prev.map(event =>
        event.id === eventId
          ? { ...event, processed: true }
          : event
      )
    )
  }, [])

  /**
   * Clear old events
   */
  const clearOldEvents = useCallback(() => {
    const oneHourAgo = Date.now() - (60 * 60 * 1000)
    setWebhookEvents(prev =>
      prev.filter(event => event.timestamp > oneHourAgo)
    )
  }, [])

  /**
   * Get events by type
   */
  const getEventsByType = useCallback((eventType) => {
    return webhookEvents.filter(event => event.type === eventType)
  }, [webhookEvents])

  /**
   * Get recent events
   */
  const getRecentEvents = useCallback((limit = 10) => {
    return webhookEvents.slice(0, limit)
  }, [webhookEvents])

  /**
   * Check connection status
   */
  const checkConnectionStatus = useCallback(async () => {
    try {
      // In a real implementation, this would ping the webhook endpoint
      // For now, we'll simulate connection status
      const response = await fetch('/api/notion-sync/status')
      const data = await response.json()

      setIsConnected(data.connected || false)
      setSyncStatus(prev => ({
        ...prev,
        status: data.connected ? 'connected' : 'disconnected'
      }))
    } catch (error) {
      setIsConnected(false)
      setSyncStatus(prev => ({
        ...prev,
        status: 'error'
      }))
      handleWebhookError(error)
    }
  }, [handleWebhookError])

  /**
   * Initialize webhook listener
   */
  useEffect(() => {
    // Set up event listeners for webhook events
    const handleCustomEvent = (event) => handleWebhookEvent(event)
    const handleErrorEvent = (event) => handleWebhookError(event.detail)

    window.addEventListener('notion-webhook-update', handleCustomEvent)
    window.addEventListener('notion-webhook-error', handleErrorEvent)

    // Check initial connection status
    checkConnectionStatus()

    // Set up periodic connection check
    const connectionCheck = setInterval(checkConnectionStatus, 30000) // Every 30 seconds

    // Clean up old events periodically
    const cleanup = setInterval(clearOldEvents, 300000) // Every 5 minutes

    return () => {
      window.removeEventListener('notion-webhook-update', handleCustomEvent)
      window.removeEventListener('notion-webhook-error', handleErrorEvent)
      clearInterval(connectionCheck)
      clearInterval(cleanup)
    }
  }, [handleWebhookEvent, handleWebhookError, checkConnectionStatus, clearOldEvents])

  /**
   * Connection status indicator
   */
  const connectionStatus = {
    connected: isConnected,
    status: syncStatus.status,
    lastSync: syncStatus.lastSync,
    eventCount: webhookEvents.length,
    errorCount: syncStatus.errorCount,
    successCount: syncStatus.successCount
  }

  return {
    // State
    webhookEvents,
    isConnected,
    lastEventTime,
    syncStatus,
    connectionStatus,

    // Actions
    markEventProcessed,
    clearOldEvents,
    checkConnectionStatus,

    // Getters
    getEventsByType,
    getRecentEvents,

    // Event counts by type
    eventCounts: {
      total: webhookEvents.length,
      pageCreated: getEventsByType('page_created').length,
      pageUpdated: getEventsByType('page_updated').length,
      pageDeleted: getEventsByType('page_deleted').length,
      databaseUpdated: getEventsByType('database_updated').length,
      commentCreated: getEventsByType('comment_created').length
    }
  }
}

/**
 * Hook for Notion sync status
 */
export const useNotionSyncStatus = () => {
  const [syncMetrics, setSyncMetrics] = useState({
    totalSynced: 0,
    failedSyncs: 0,
    lastSyncTime: null,
    avgSyncTime: 0,
    isHealthy: true
  })

  const updateSyncMetrics = useCallback((metrics) => {
    setSyncMetrics(prev => ({
      ...prev,
      ...metrics,
      lastSyncTime: new Date().toISOString()
    }))
  }, [])

  return {
    syncMetrics,
    updateSyncMetrics
  }
}

export default useNotionWebhooks