import React, { createContext, useContext, useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchChittyOSData } from '../services/api'

const ChittyOSContext = createContext()

export const useChittyOS = () => {
  const context = useContext(ChittyOSContext)
  if (!context) {
    throw new Error('useChittyOS must be used within a ChittyOSProvider')
  }
  return context
}

export const ChittyOSProvider = ({ children }) => {
  const [systemTime, setSystemTime] = useState(new Date().toLocaleString())
  const [realTimeData, setRealTimeData] = useState({})

  // Update system time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setSystemTime(new Date().toLocaleString())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Mock real-time WebSocket connection
  useEffect(() => {
    const interval = setInterval(() => {
      setRealTimeData(prev => ({
        ...prev,
        lastUpdate: Date.now(),
        activeConnections: Math.floor(Math.random() * 50) + 150,
        cpuUsage: Math.floor(Math.random() * 30) + 20,
        memoryUsage: Math.floor(Math.random() * 20) + 40,
        networkActivity: Math.floor(Math.random() * 1000) + 500
      }))
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  // Fetch ChittyOS ecosystem data
  const { data: ecosystemData, isLoading, error, refetch } = useQuery({
    queryKey: ['chittyos-ecosystem'],
    queryFn: fetchChittyOSData,
    refetchInterval: 30000, // Refetch every 30 seconds
  })

  // Mock ecosystem data if API is not available
  const mockEcosystemData = {
    totalModules: 51,
    activeModules: 47,
    betaModules: 3,
    pausedModules: 1,
    totalConnections: realTimeData.activeConnections || 187,
    categories: {
      'Core Infrastructure': { count: 6, status: 'active' },
      'Identity & Security': { count: 6, status: 'active' },
      'Legal Technology': { count: 10, status: 'active' },
      'Property Management': { count: 6, status: 'active' },
      'Automation Tools': { count: 5, status: 'active' },
      'Financial & Business': { count: 5, status: 'active' },
      'Business Operations': { count: 4, status: 'active' },
      'Communication & Support': { count: 4, status: 'active' },
      'Recent Development': { count: 5, status: 'beta' }
    },
    recentActivity: [
      {
        id: 1,
        type: 'module_update',
        title: 'ChittyGov updated',
        description: 'Government module received new features',
        timestamp: Date.now() - 3600000,
        severity: 'info'
      },
      {
        id: 2,
        type: 'new_connection',
        title: 'New client connected',
        description: 'Law firm "Smith & Associates" joined the network',
        timestamp: Date.now() - 7200000,
        severity: 'success'
      },
      {
        id: 3,
        type: 'system_alert',
        title: 'High usage detected',
        description: 'ChittyLegal module experiencing high traffic',
        timestamp: Date.now() - 10800000,
        severity: 'warning'
      }
    ],
    modules: [
      // Core Infrastructure
      { id: 'chittycore', name: 'ChittyCore', category: 'Core Infrastructure', status: 'active', description: 'Core system foundation', premium: false },
      { id: 'chittyauth', name: 'ChittyAuth', category: 'Core Infrastructure', status: 'active', description: 'Authentication framework', premium: false },
      { id: 'chittyverify', name: 'ChittyVerify', category: 'Core Infrastructure', status: 'active', description: 'Identity verification', premium: false },
      { id: 'chittychain', name: 'ChittyChain', category: 'Core Infrastructure', status: 'active', description: 'Blockchain layer', premium: true },
      { id: 'chittyos', name: 'ChittyOS', category: 'Core Infrastructure', status: 'active', description: 'Operating system', premium: false },
      { id: 'chittychat', name: 'ChittyChat', category: 'Core Infrastructure', status: 'active', description: 'AI coordination hub', premium: false },

      // Identity & Security
      { id: 'chittyid', name: 'ChittyID', category: 'Identity & Security', status: 'active', description: 'Universal identity system', premium: false },
      { id: 'chittysecure', name: 'ChittySecure', category: 'Identity & Security', status: 'active', description: 'Security framework', premium: true },
      { id: 'chittykeys', name: 'ChittyKeys', category: 'Identity & Security', status: 'active', description: 'Key management', premium: true },
      { id: 'chittyvault', name: 'ChittyVault', category: 'Identity & Security', status: 'active', description: 'Secure storage', premium: true },
      { id: 'chittyguard', name: 'ChittyGuard', category: 'Identity & Security', status: 'active', description: 'Access control', premium: true },
      { id: 'chittycert', name: 'ChittyCert', category: 'Identity & Security', status: 'active', description: 'Certificate management', premium: true },

      // Legal Technology
      { id: 'chittylegal', name: 'ChittyLegal', category: 'Legal Technology', status: 'active', description: 'Legal framework', premium: false },
      { id: 'chittycontract', name: 'ChittyContract', category: 'Legal Technology', status: 'active', description: 'Contract management', premium: true },
      { id: 'chittylaw', name: 'ChittyLaw', category: 'Legal Technology', status: 'active', description: 'Legal reference', premium: false },
      { id: 'chittycourt', name: 'ChittyCourt', category: 'Legal Technology', status: 'active', description: 'Court integration', premium: true },
      { id: 'chittycompliance', name: 'ChittyCompliance', category: 'Legal Technology', status: 'active', description: 'Compliance tracking', premium: true },
      { id: 'chittydiscovery', name: 'ChittyDiscovery', category: 'Legal Technology', status: 'active', description: 'Legal discovery tools', premium: true },
      { id: 'chittywitness', name: 'ChittyWitness', category: 'Legal Technology', status: 'active', description: 'Witness management', premium: true },
      { id: 'chittyevidence', name: 'ChittyEvidence', category: 'Legal Technology', status: 'active', description: 'Evidence tracking', premium: true },
      { id: 'chittylitigation', name: 'ChittyLitigation', category: 'Legal Technology', status: 'active', description: 'Litigation support', premium: true },
      { id: 'chittycases-private', name: 'ChittyCases Pro', category: 'Legal Technology', status: 'active', description: 'Enhanced legal case management', premium: true },

      // Property Management
      { id: 'chittyproperty', name: 'ChittyProperty', category: 'Property Management', status: 'active', description: 'Property database', premium: false },
      { id: 'chittyrealty', name: 'ChittyRealty', category: 'Property Management', status: 'active', description: 'Real estate tools', premium: true },
      { id: 'chittylease', name: 'ChittyLease', category: 'Property Management', status: 'active', description: 'Lease management', premium: true },
      { id: 'chittymaintenance', name: 'ChittyMaintenance', category: 'Property Management', status: 'active', description: 'Maintenance tracking', premium: true },
      { id: 'chittyrentals', name: 'ChittyRentals', category: 'Property Management', status: 'active', description: 'Rental management', premium: true },
      { id: 'chittytenant', name: 'ChittyTenant', category: 'Property Management', status: 'active', description: 'Tenant portal', premium: false }
    ],
    notifications: [
      {
        id: 1,
        title: 'System Update Available',
        message: 'ChittyOS v3.2.1 is ready for installation',
        time: '2 minutes ago',
        read: false,
        type: 'update'
      },
      {
        id: 2,
        title: 'Premium Feature Available',
        message: 'ChittyContract Pro features are now available',
        time: '1 hour ago',
        read: false,
        type: 'premium'
      },
      {
        id: 3,
        title: 'Module Sync Complete',
        message: 'All modules successfully synchronized',
        time: '3 hours ago',
        read: true,
        type: 'success'
      }
    ]
  }

  const stats = ecosystemData || mockEcosystemData
  const notifications = stats.notifications || []

  const value = {
    stats,
    notifications,
    systemTime,
    realTimeData,
    isLoading,
    error,
    refetch
  }

  return (
    <ChittyOSContext.Provider value={value}>
      {children}
    </ChittyOSContext.Provider>
  )
}