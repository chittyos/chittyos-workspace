import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Home,
  Grid3X3,
  BarChart3,
  CreditCard,
  Settings,
  Crown,
  Zap,
  Shield,
  Building,
  Webhook,
  Activity,
  Network
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useChittyOS } from '../contexts/ChittyOSContext'

const Navigation = ({ onUpgrade }) => {
  const location = useLocation()
  const { user } = useAuth()
  const { stats } = useChittyOS()

  const navigation = [
    { name: 'Dashboard', href: '/', icon: Home },
    { name: 'Module Explorer', href: '/modules', icon: Grid3X3, badge: stats?.totalModules },
    { name: 'Pipeline Status', href: '/pipeline', icon: Activity, premium: true },
    { name: 'Session Sync', href: '/session-sync', icon: Network, premium: true },
    { name: 'Analytics', href: '/analytics', icon: BarChart3, premium: true },
    { name: 'Notion Sync', href: '/notion', icon: Webhook, premium: true },
    { name: 'Billing', href: '/billing', icon: CreditCard },
    { name: 'Settings', href: '/settings', icon: Settings },
  ]

  const isActive = (href) => location.pathname === href

  return (
    <div className="glassmorphic h-full flex flex-col border-r border-white/10">
      {/* Logo */}
      <div className="p-6">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex items-center space-x-3"
        >
          <div className="w-10 h-10 bg-gradient-to-br from-chitty-primary to-chitty-secondary rounded-xl flex items-center justify-center animate-pulse-glow">
            <span className="text-lg font-bold">C</span>
          </div>
          <div>
            <h1 className="text-xl font-bold">ChittyOS</h1>
            <p className="text-xs text-gray-400">Command Center</p>
          </div>
        </motion.div>
      </div>

      {/* User tier indicator */}
      <div className="px-6 mb-4">
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className={`p-3 rounded-lg ${
            user?.tier === 'premium'
              ? 'bg-gradient-to-r from-yellow-400/20 to-orange-400/20 border border-yellow-400/30'
              : 'bg-slate-800/50 border border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {user?.tier === 'premium' ? (
                <Crown className="w-4 h-4 text-yellow-400" />
              ) : (
                <Zap className="w-4 h-4 text-gray-400" />
              )}
              <span className="text-sm font-medium">
                {user?.tier === 'premium' ? 'Premium' : 'Free Tier'}
              </span>
            </div>
            {user?.tier === 'free' && (
              <button
                onClick={onUpgrade}
                className="text-xs text-chitty-primary hover:text-chitty-secondary transition-colors"
              >
                Upgrade
              </button>
            )}
          </div>
        </motion.div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1">
        {navigation.map((item, index) => {
          const isCurrentPage = isActive(item.href)
          const isPremiumFeature = item.premium && user?.tier !== 'premium'

          return (
            <motion.div
              key={item.name}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1 * index }}
            >
              <Link
                to={isPremiumFeature ? '#' : item.href}
                onClick={isPremiumFeature ? onUpgrade : undefined}
                className={`group flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  isCurrentPage
                    ? 'bg-chitty-primary text-white shadow-lg'
                    : isPremiumFeature
                    ? 'text-gray-400 hover:text-yellow-400 hover:bg-yellow-400/10'
                    : 'text-gray-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <item.icon
                    className={`w-5 h-5 ${
                      isPremiumFeature ? 'text-yellow-400' : ''
                    }`}
                  />
                  <span>{item.name}</span>
                  {isPremiumFeature && (
                    <Crown className="w-3 h-3 text-yellow-400" />
                  )}
                </div>
                {item.badge && (
                  <span className="bg-chitty-primary/20 text-chitty-primary text-xs px-2 py-1 rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            </motion.div>
          )
        })}
      </nav>

      {/* Quick stats */}
      <div className="p-4 border-t border-white/10">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="space-y-3"
        >
          <div className="text-xs text-gray-400 uppercase tracking-wide">
            System Status
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-lg font-bold text-green-400">
                {stats?.activeModules || 0}
              </div>
              <div className="text-xs text-gray-400">Active</div>
            </div>
            <div>
              <div className="text-lg font-bold text-yellow-400">
                {stats?.betaModules || 0}
              </div>
              <div className="text-xs text-gray-400">Beta</div>
            </div>
            <div>
              <div className="text-lg font-bold text-chitty-primary">
                {stats?.totalConnections || 0}
              </div>
              <div className="text-xs text-gray-400">Connected</div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Professional categories */}
      <div className="p-4 border-t border-white/10">
        <div className="text-xs text-gray-400 uppercase tracking-wide mb-3">
          Professional Focus
        </div>
        <div className="space-y-2">
          <div className="flex items-center space-x-2 text-sm">
            <Shield className="w-4 h-4 text-blue-400" />
            <span className="text-gray-300">Legal Practice</span>
          </div>
          <div className="flex items-center space-x-2 text-sm">
            <Building className="w-4 h-4 text-green-400" />
            <span className="text-gray-300">Property Mgmt</span>
          </div>
          <div className="flex items-center space-x-2 text-sm">
            <Zap className="w-4 h-4 text-purple-400" />
            <span className="text-gray-300">Automation</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Navigation