import React from 'react'
import { motion } from 'framer-motion'
import {
  Activity,
  Users,
  Server,
  Zap,
  Crown,
  TrendingUp,
  Shield,
  Building,
  Scale,
  Home,
  ChevronRight
} from 'lucide-react'
import { useChittyOS } from '../contexts/ChittyOSContext'
import { useAuth } from '../contexts/AuthContext'
import SystemMetrics from './SystemMetrics'
import ModuleGrid from './ModuleGrid'
import ActivityFeed from './ActivityFeed'
import ChittyIDDisplay from './ChittyIDDisplay'

const Dashboard = () => {
  const { stats, realTimeData } = useChittyOS()
  const { user } = useAuth()

  const quickStats = [
    {
      title: 'Active Modules',
      value: stats?.activeModules || 0,
      icon: Server,
      color: 'text-green-400',
      bgColor: 'bg-green-400/10',
      change: '+2 this week'
    },
    {
      title: 'Connected Users',
      value: realTimeData?.activeConnections || 187,
      icon: Users,
      color: 'text-blue-400',
      bgColor: 'bg-blue-400/10',
      change: 'Live count'
    },
    {
      title: 'System Health',
      value: '98.5%',
      icon: Activity,
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-400/10',
      change: 'Excellent'
    },
    {
      title: 'API Calls',
      value: user?.usage?.apiCalls || 1247,
      icon: Zap,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-400/10',
      change: `of ${user?.usage?.apiLimit || 10000}`
    }
  ]

  const professionalCategories = [
    {
      name: 'Legal Practice',
      icon: Scale,
      modules: stats?.categories?.['Legal Technology']?.count || 10,
      description: 'Complete legal technology stack',
      color: 'text-red-400',
      bgColor: 'bg-red-400/10'
    },
    {
      name: 'Property Management',
      icon: Home,
      modules: stats?.categories?.['Property Management']?.count || 6,
      description: 'End-to-end property solutions',
      color: 'text-green-400',
      bgColor: 'bg-green-400/10'
    },
    {
      name: 'Business Operations',
      icon: Building,
      modules: stats?.categories?.['Business Operations']?.count || 4,
      description: 'Streamline your operations',
      color: 'text-blue-400',
      bgColor: 'bg-blue-400/10'
    },
    {
      name: 'Security & Identity',
      icon: Shield,
      modules: stats?.categories?.['Identity & Security']?.count || 6,
      description: 'Advanced security framework',
      color: 'text-purple-400',
      bgColor: 'bg-purple-400/10'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glassmorphic rounded-2xl p-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">
              Welcome back, {user?.name || 'Professional'}
            </h1>
            <p className="text-gray-400 mt-1">
              Your ChittyOS ecosystem is running smoothly
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex items-center space-x-3">
            {user?.tier === 'premium' ? (
              <div className="flex items-center space-x-2 bg-gradient-to-r from-yellow-400/20 to-orange-400/20 border border-yellow-400/30 rounded-lg px-4 py-2">
                <Crown className="w-5 h-5 text-yellow-400" />
                <span className="text-yellow-400 font-medium">Premium Active</span>
              </div>
            ) : (
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="bg-gradient-to-r from-chitty-primary to-chitty-secondary rounded-lg px-4 py-2 cursor-pointer"
              >
                <div className="flex items-center space-x-2 text-white">
                  <TrendingUp className="w-5 h-5" />
                  <span className="font-medium">Upgrade to Premium</span>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>

      {/* ChittyID Display */}
      <ChittyIDDisplay />

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickStats.map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="glassmorphic rounded-xl p-6 hover:scale-105 transition-transform cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">{stat.title}</p>
                <p className="text-2xl font-bold mt-1">{stat.value}</p>
                <p className="text-xs text-gray-500 mt-1">{stat.change}</p>
              </div>
              <div className={`${stat.bgColor} rounded-lg p-3`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Professional Categories */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="glassmorphic rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Professional Solutions</h2>
          <button className="text-chitty-primary hover:text-chitty-secondary transition-colors flex items-center space-x-1">
            <span className="text-sm">View All</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {professionalCategories.map((category, index) => (
            <motion.div
              key={category.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6 + index * 0.1 }}
              className="module-card hover:border-white/20"
            >
              <div className={`${category.bgColor} rounded-lg p-3 mb-4 w-fit`}>
                <category.icon className={`w-6 h-6 ${category.color}`} />
              </div>
              <h3 className="font-semibold mb-2">{category.name}</h3>
              <p className="text-gray-400 text-sm mb-3">{category.description}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  {category.modules} modules
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400" />
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* System Metrics and Activity - Side by side on larger screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SystemMetrics />
        <ActivityFeed />
      </div>

      {/* Featured Modules */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
      >
        <ModuleGrid featured={true} />
      </motion.div>
    </div>
  )
}

export default Dashboard