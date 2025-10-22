import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  Crown,
  CreditCard,
  Download,
  Calendar,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Package,
  Zap,
  Users,
  HardDrive,
  Activity
} from 'lucide-react'
import { fetchBillingInfo } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import UpgradePrompt from './UpgradePrompt'

const Billing = () => {
  const { user } = useAuth()
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false)

  const { data: billingData, isLoading } = useQuery({
    queryKey: ['billing'],
    queryFn: fetchBillingInfo,
  })

  const usageStats = [
    {
      name: 'Storage Used',
      current: user?.usage?.storageUsed || '2.1 GB',
      limit: user?.usage?.storageLimit || '5 GB',
      percentage: 42,
      icon: HardDrive,
      color: 'text-blue-400',
      bgColor: 'bg-blue-400'
    },
    {
      name: 'API Calls',
      current: user?.usage?.apiCalls || 1247,
      limit: user?.usage?.apiLimit || 10000,
      percentage: 12,
      icon: Activity,
      color: 'text-green-400',
      bgColor: 'bg-green-400'
    },
    {
      name: 'Active Modules',
      current: user?.usage?.modulesUsed || 12,
      limit: user?.tier === 'premium' ? 'Unlimited' : 15,
      percentage: user?.tier === 'premium' ? 100 : 80,
      icon: Package,
      color: 'text-purple-400',
      bgColor: 'bg-purple-400'
    },
    {
      name: 'Team Members',
      current: 1,
      limit: user?.tier === 'premium' ? 10 : 1,
      percentage: user?.tier === 'premium' ? 10 : 100,
      icon: Users,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-400'
    }
  ]

  const recentInvoices = [
    {
      id: 'INV-2025-001',
      date: '2025-09-01',
      amount: user?.tier === 'premium' ? 99 : 0,
      status: 'paid',
      description: user?.tier === 'premium' ? 'Premium Plan - Monthly' : 'Free Plan'
    },
    {
      id: 'INV-2025-002',
      date: '2025-08-01',
      amount: user?.tier === 'premium' ? 99 : 0,
      status: 'paid',
      description: user?.tier === 'premium' ? 'Premium Plan - Monthly' : 'Free Plan'
    }
  ]

  const premiumFeatures = [
    'All 51+ modules unlocked',
    'Advanced legal technology suite',
    'Enhanced security & identity tools',
    'Property management platform',
    'Priority support (24/7)',
    '100GB secure storage',
    '100,000 API calls/month',
    'Advanced analytics & reports',
    'Custom integrations',
    'Multi-user team access'
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-chitty-primary border-t-transparent rounded-full animate-spin" />
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
              <CreditCard className="w-7 h-7 text-chitty-primary" />
              <span>Billing & Usage</span>
            </h1>
            <p className="text-gray-400 mt-1">
              Manage your subscription and monitor usage
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            {user?.tier === 'premium' ? (
              <div className="flex items-center space-x-2 bg-gradient-premium rounded-lg px-4 py-2">
                <Crown className="w-5 h-5 text-white" />
                <span className="text-white font-medium">Premium Active</span>
              </div>
            ) : (
              <button
                onClick={() => setShowUpgradePrompt(true)}
                className="bg-gradient-to-r from-chitty-primary to-chitty-secondary hover:scale-105 transition-transform rounded-lg px-6 py-2 text-white font-medium"
              >
                Upgrade to Premium
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Current Plan */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glassmorphic rounded-2xl p-6"
      >
        <h2 className="text-lg font-semibold mb-4">Current Plan</h2>

        <div className={`border rounded-xl p-6 ${
          user?.tier === 'premium'
            ? 'border-yellow-400/30 bg-gradient-to-r from-yellow-400/10 to-orange-400/10'
            : 'border-gray-400/30 bg-gray-400/5'
        }`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              {user?.tier === 'premium' ? (
                <Crown className="w-8 h-8 text-yellow-400" />
              ) : (
                <Zap className="w-8 h-8 text-gray-400" />
              )}
              <div>
                <h3 className="text-xl font-bold capitalize">{user?.tier || 'Free'} Plan</h3>
                <p className="text-gray-400">
                  {user?.tier === 'premium'
                    ? 'All features unlocked'
                    : 'Limited features available'
                  }
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold">
                ${user?.tier === 'premium' ? '99' : '0'}
              </div>
              <div className="text-gray-400 text-sm">/month</div>
            </div>
          </div>

          {user?.tier === 'free' && (
            <div className="bg-chitty-primary/10 border border-chitty-primary/30 rounded-lg p-4 mb-4">
              <h4 className="font-semibold text-chitty-primary mb-2">
                Upgrade to Premium and Save 50%!
              </h4>
              <ul className="text-sm text-gray-300 space-y-1 mb-3">
                {premiumFeatures.slice(0, 3).map((feature, index) => (
                  <li key={index} className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
                <li className="text-gray-400">+ {premiumFeatures.length - 3} more features</li>
              </ul>
              <button
                onClick={() => setShowUpgradePrompt(true)}
                className="w-full bg-gradient-premium text-white py-2 rounded-lg font-medium hover:scale-105 transition-transform"
              >
                Upgrade Now - 50% Off First Year
              </button>
            </div>
          )}

          {user?.tier === 'premium' && billingData?.billing?.nextBillDate && (
            <div className="flex items-center space-x-2 text-sm text-gray-400">
              <Calendar className="w-4 h-4" />
              <span>Next billing date: {billingData.billing.nextBillDate}</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Usage Statistics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glassmorphic rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Usage This Month</h2>
          <div className="text-sm text-gray-400">
            Resets on the 1st of each month
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {usageStats.map((stat, index) => (
            <motion.div
              key={stat.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + index * 0.1 }}
              className="space-y-4"
            >
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg bg-${stat.color.split('-')[1]}-400/10`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div>
                  <h3 className="font-medium text-sm">{stat.name}</h3>
                  <p className="text-xs text-gray-400">
                    {stat.current} of {stat.limit}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Usage</span>
                  <span className={stat.percentage > 80 ? 'text-yellow-400' : 'text-gray-400'}>
                    {stat.percentage}%
                  </span>
                </div>
                <div className="bg-black/30 rounded-full h-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${stat.percentage}%` }}
                    transition={{ delay: 0.5 + index * 0.1, duration: 0.8 }}
                    className={`h-2 rounded-full ${stat.bgColor} ${
                      stat.percentage > 80 ? 'bg-gradient-to-r from-yellow-400 to-red-400' : ''
                    }`}
                  />
                </div>
              </div>

              {stat.percentage > 80 && user?.tier === 'free' && (
                <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-lg p-2">
                  <div className="flex items-center space-x-1 text-xs text-yellow-400">
                    <AlertCircle className="w-3 h-3" />
                    <span>Approaching limit</span>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Recent Invoices */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glassmorphic rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Recent Invoices</h2>
          <button className="text-chitty-primary hover:text-chitty-secondary transition-colors text-sm flex items-center space-x-1">
            <Download className="w-4 h-4" />
            <span>Download All</span>
          </button>
        </div>

        <div className="space-y-3">
          {recentInvoices.map((invoice) => (
            <div
              key={invoice.id}
              className="flex items-center justify-between p-4 bg-black/20 rounded-lg hover:bg-black/30 transition-colors"
            >
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-chitty-primary/10 rounded-lg">
                  <CreditCard className="w-4 h-4 text-chitty-primary" />
                </div>
                <div>
                  <h3 className="font-medium">{invoice.id}</h3>
                  <p className="text-sm text-gray-400">{invoice.description}</p>
                  <p className="text-xs text-gray-500">{invoice.date}</p>
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="font-medium">${invoice.amount}</div>
                  <div className={`text-xs flex items-center space-x-1 ${
                    invoice.status === 'paid' ? 'text-green-400' : 'text-yellow-400'
                  }`}>
                    <CheckCircle className="w-3 h-3" />
                    <span className="capitalize">{invoice.status}</span>
                  </div>
                </div>
                <button className="text-gray-400 hover:text-white transition-colors">
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Upgrade Prompt Modal */}
      <UpgradePrompt
        open={showUpgradePrompt}
        onClose={() => setShowUpgradePrompt(false)}
      />
    </div>
  )
}

export default Billing