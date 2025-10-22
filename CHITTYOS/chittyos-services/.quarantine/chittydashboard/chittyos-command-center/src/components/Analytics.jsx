import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart3,
  TrendingUp,
  Users,
  Activity,
  Clock,
  Crown,
  Lock,
  Calendar,
  Download,
  Filter
} from 'lucide-react'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
import { useAuth } from '../contexts/AuthContext'
import { useChittyOS } from '../contexts/ChittyOSContext'

const Analytics = () => {
  const { user } = useAuth()
  const { stats } = useChittyOS()
  const [timeRange, setTimeRange] = useState('30d')
  const [selectedMetric, setSelectedMetric] = useState('all')

  const isPremium = user?.tier === 'premium'

  // Mock analytics data
  const generateTimeSeriesData = (days = 30) => {
    return Array.from({ length: days }, (_, i) => ({
      date: new Date(Date.now() - (days - 1 - i) * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      }),
      modules: Math.floor(Math.random() * 20) + 30,
      users: Math.floor(Math.random() * 50) + 100,
      apiCalls: Math.floor(Math.random() * 5000) + 10000,
      storage: Math.floor(Math.random() * 1000) + 2000
    }))
  }

  const usageData = generateTimeSeriesData(timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90)

  const moduleUsageData = [
    { name: 'ChittyLegal', usage: 85, category: 'Legal Tech', color: '#EF4444' },
    { name: 'ChittyProperty', usage: 72, category: 'Property', color: '#10B981' },
    { name: 'ChittyAuth', usage: 95, category: 'Security', color: '#8B5CF6' },
    { name: 'ChittyContract', usage: 68, category: 'Legal Tech', color: '#F59E0B' },
    { name: 'ChittySecure', usage: 78, category: 'Security', color: '#3B82F6' },
    { name: 'ChittyRealty', usage: 45, category: 'Property', color: '#06B6D4' }
  ]

  const categoryDistribution = [
    { name: 'Legal Technology', value: 35, color: '#EF4444' },
    { name: 'Security & Identity', value: 25, color: '#8B5CF6' },
    { name: 'Property Management', value: 20, color: '#10B981' },
    { name: 'Business Operations', value: 12, color: '#F59E0B' },
    { name: 'Others', value: 8, color: '#6B7280' }
  ]

  const performanceMetrics = [
    {
      title: 'Total API Calls',
      value: '156.2K',
      change: '+12.5%',
      trend: 'up',
      icon: Activity,
      color: 'text-green-400'
    },
    {
      title: 'Active Users',
      value: '2,847',
      change: '+8.3%',
      trend: 'up',
      icon: Users,
      color: 'text-blue-400'
    },
    {
      title: 'Response Time',
      value: '245ms',
      change: '-5.2%',
      trend: 'up',
      icon: Clock,
      color: 'text-purple-400'
    },
    {
      title: 'Success Rate',
      value: '99.7%',
      change: '+0.1%',
      trend: 'up',
      icon: TrendingUp,
      color: 'text-emerald-400'
    }
  ]

  const timeRanges = [
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: '90d', label: '90 Days' }
  ]

  const PremiumOverlay = ({ children, feature }) => {
    if (isPremium) return children

    return (
      <div className="relative">
        {children}
        <div className="absolute inset-0 glassmorphic-light rounded-xl flex items-center justify-center backdrop-blur-sm">
          <div className="text-center">
            <Lock className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
            <div className="text-sm font-medium text-yellow-400 mb-1">{feature}</div>
            <div className="text-xs text-gray-400">Premium Feature</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glassmorphic rounded-2xl p-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center space-x-2">
              <BarChart3 className="w-7 h-7 text-chitty-primary" />
              <span>Analytics Dashboard</span>
              {!isPremium && <Crown className="w-5 h-5 text-yellow-400" />}
            </h1>
            <p className="text-gray-400 mt-1">
              {isPremium
                ? 'Deep insights into your ChittyOS ecosystem'
                : 'Upgrade to Premium for advanced analytics'
              }
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex items-center space-x-3">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-chitty-primary/50"
            >
              {timeRanges.map(range => (
                <option key={range.value} value={range.value}>{range.label}</option>
              ))}
            </select>
            <button className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 rounded-lg px-3 py-2 text-sm transition-colors">
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {performanceMetrics.map((metric, index) => (
          <motion.div
            key={metric.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="glassmorphic rounded-xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2 rounded-lg bg-${metric.color.split('-')[1]}-400/10`}>
                <metric.icon className={`w-5 h-5 ${metric.color}`} />
              </div>
              <div className={`text-xs flex items-center space-x-1 ${
                metric.trend === 'up' ? 'text-green-400' : 'text-red-400'
              }`}>
                <TrendingUp className={`w-3 h-3 ${
                  metric.trend === 'down' ? 'rotate-180' : ''
                }`} />
                <span>{metric.change}</span>
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold">{metric.value}</div>
              <div className="text-sm text-gray-400">{metric.title}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Usage Trends */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="glassmorphic rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Usage Trends</h2>
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              className="bg-black/30 border border-white/10 rounded-lg px-3 py-1 text-xs focus:outline-none focus:border-chitty-primary/50"
            >
              <option value="all">All Metrics</option>
              <option value="modules">Modules</option>
              <option value="users">Users</option>
              <option value="apiCalls">API Calls</option>
            </select>
          </div>
        </div>

        <PremiumOverlay feature="Advanced Usage Analytics">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={usageData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} />
                <YAxis stroke="#9CA3AF" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="modules"
                  stackId="1"
                  stroke="#8B5CF6"
                  fill="#8B5CF6"
                  fillOpacity={0.3}
                  name="Active Modules"
                />
                <Area
                  type="monotone"
                  dataKey="users"
                  stackId="1"
                  stroke="#10B981"
                  fill="#10B981"
                  fillOpacity={0.3}
                  name="Active Users"
                />
                <Area
                  type="monotone"
                  dataKey="apiCalls"
                  stackId="1"
                  stroke="#F59E0B"
                  fill="#F59E0B"
                  fillOpacity={0.3}
                  name="API Calls (x100)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </PremiumOverlay>
      </motion.div>

      {/* Module Usage and Category Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Module Usage */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
          className="glassmorphic rounded-2xl p-6"
        >
          <h2 className="text-lg font-semibold mb-6">Top Module Usage</h2>

          <PremiumOverlay feature="Module Analytics">
            <div className="space-y-4">
              {moduleUsageData.map((module, index) => (
                <div key={module.name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: module.color }}
                      />
                      <span className="font-medium text-sm">{module.name}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-400">{module.category}</span>
                      <span className="text-sm font-medium">{module.usage}%</span>
                    </div>
                  </div>
                  <div className="bg-black/30 rounded-full h-2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${module.usage}%` }}
                      transition={{ delay: 0.8 + index * 0.1, duration: 0.8 }}
                      className="h-2 rounded-full"
                      style={{ backgroundColor: module.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </PremiumOverlay>
        </motion.div>

        {/* Category Distribution */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
          className="glassmorphic rounded-2xl p-6"
        >
          <h2 className="text-lg font-semibold mb-6">Usage by Category</h2>

          <PremiumOverlay feature="Category Analytics">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryDistribution.map((entry, index) => (
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
              {categoryDistribution.map((category) => (
                <div key={category.name} className="flex items-center space-x-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: category.color }}
                  />
                  <span className="text-xs text-gray-400">{category.name}</span>
                  <span className="text-xs font-medium">{category.value}%</span>
                </div>
              ))}
            </div>
          </PremiumOverlay>
        </motion.div>
      </div>

      {/* Premium Upgrade CTA */}
      {!isPremium && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="glassmorphic rounded-2xl p-6 text-center"
        >
          <Crown className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Unlock Advanced Analytics</h3>
          <p className="text-gray-400 mb-6">
            Get detailed insights, custom reports, and real-time monitoring with Premium
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 text-sm">
            <div className="flex items-center justify-center space-x-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span>Real-time Analytics</span>
            </div>
            <div className="flex items-center justify-center space-x-2">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              <span>Custom Reports</span>
            </div>
            <div className="flex items-center justify-center space-x-2">
              <Download className="w-4 h-4 text-purple-400" />
              <span>Data Export</span>
            </div>
          </div>
          <button className="bg-gradient-premium text-white px-8 py-3 rounded-lg font-medium hover:scale-105 transition-transform">
            Upgrade to Premium - 50% Off
          </button>
        </motion.div>
      )}
    </div>
  )
}

export default Analytics