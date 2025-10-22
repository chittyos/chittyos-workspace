import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Crown,
  X,
  Check,
  Star,
  Zap,
  Shield,
  Scale,
  Building,
  Users,
  CreditCard,
  ArrowRight
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { upgradeToPremium } from '../services/api'
import toast from 'react-hot-toast'

const UpgradePrompt = ({ open, onClose }) => {
  const [selectedPlan, setSelectedPlan] = useState('premium')
  const [isProcessing, setIsProcessing] = useState(false)
  const { user, updateUserTier } = useAuth()

  const plans = [
    {
      id: 'premium',
      name: 'Premium',
      price: 99,
      originalPrice: 199,
      period: 'month',
      popular: true,
      description: 'Perfect for legal professionals and small businesses',
      features: [
        'All 51+ modules included',
        'Advanced legal technology suite',
        'Premium security & identity tools',
        'Property management platform',
        'Priority support (24/7)',
        '100GB secure storage',
        '100,000 API calls/month',
        'Advanced analytics & reports',
        'Custom integrations',
        'Multi-user team access'
      ],
      professionalFeatures: {
        'Legal Practice': [
          'ChittyContract Pro - Advanced contract management',
          'ChittyCourt - Real-time court integrations',
          'ChittyDiscovery - AI-powered legal discovery',
          'ChittyLitigation - Case management suite'
        ],
        'Property Management': [
          'ChittyRealty Pro - MLS integrations',
          'ChittyLease - Automated lease management',
          'ChittyMaintenance - Work order system',
          'ChittyRentals - Tenant screening'
        ],
        'Business Operations': [
          'ChittySecure - Enterprise security',
          'ChittyVault - Document encryption',
          'ChittyKeys - Certificate management',
          'ChittyAnalytics Pro - Business intelligence'
        ]
      }
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 299,
      originalPrice: 599,
      period: 'month',
      popular: false,
      description: 'For law firms and large organizations',
      features: [
        'Everything in Premium',
        'White-label solutions',
        'Custom module development',
        'Dedicated account manager',
        'On-premise deployment options',
        'Unlimited storage',
        'Unlimited API calls',
        'Custom SLA agreements',
        'Advanced compliance tools',
        'Multi-tenant architecture'
      ]
    }
  ]

  const handleUpgrade = async (planId) => {
    setIsProcessing(true)
    try {
      const result = await upgradeToPremium({ plan: planId })
      if (result.success) {
        updateUserTier('premium')
        toast.success('Upgrade successful! Welcome to Premium!')
        onClose()
      } else {
        toast.error('Upgrade failed. Please try again.')
      }
    } catch (error) {
      console.error('Upgrade error:', error)
      toast.error('Something went wrong. Please try again.')
    } finally {
      setIsProcessing(false)
    }
  }

  if (!open) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

        {/* Modal */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative glassmorphic rounded-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 glassmorphic border-b border-white/10 p-6 rounded-t-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-premium rounded-xl flex items-center justify-center animate-pulse-glow">
                  <Crown className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Upgrade to Premium</h2>
                  <p className="text-gray-400">
                    🎉 Limited time: 50% off your first year!
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-8">
            {/* Value proposition */}
            <div className="text-center">
              <h3 className="text-xl font-semibold mb-4">
                Unlock the Full Power of ChittyOS
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="text-center">
                  <Scale className="w-8 h-8 text-red-400 mx-auto mb-2" />
                  <div className="text-sm font-medium">Legal Practice</div>
                  <div className="text-xs text-gray-400">Complete legal suite</div>
                </div>
                <div className="text-center">
                  <Building className="w-8 h-8 text-green-400 mx-auto mb-2" />
                  <div className="text-sm font-medium">Property Mgmt</div>
                  <div className="text-xs text-gray-400">End-to-end solutions</div>
                </div>
                <div className="text-center">
                  <Shield className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                  <div className="text-sm font-medium">Enterprise Security</div>
                  <div className="text-xs text-gray-400">Bank-grade protection</div>
                </div>
                <div className="text-center">
                  <Users className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                  <div className="text-sm font-medium">Team Features</div>
                  <div className="text-xs text-gray-400">Collaborate seamlessly</div>
                </div>
              </div>
            </div>

            {/* Pricing plans */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {plans.map((plan) => (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`relative border rounded-2xl p-6 transition-all cursor-pointer ${
                    selectedPlan === plan.id
                      ? 'border-chitty-primary bg-chitty-primary/5'
                      : 'border-white/10 hover:border-white/20'
                  } ${plan.popular ? 'premium-glow' : ''}`}
                  onClick={() => setSelectedPlan(plan.id)}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <div className="bg-gradient-premium text-white text-xs font-bold px-4 py-1 rounded-full">
                        Most Popular
                      </div>
                    </div>
                  )}

                  <div className="text-center mb-6">
                    <h3 className="text-xl font-bold">{plan.name}</h3>
                    <div className="mt-2">
                      <span className="text-3xl font-bold">${plan.price}</span>
                      <span className="text-gray-400">/{plan.period}</span>
                    </div>
                    <div className="text-sm text-gray-400 line-through">
                      Originally ${plan.originalPrice}
                    </div>
                    <p className="text-sm text-gray-400 mt-2">{plan.description}</p>
                  </div>

                  <div className="space-y-3 mb-6">
                    {plan.features.slice(0, 6).map((feature, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <Check className="w-4 h-4 text-green-400 flex-shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                    {plan.features.length > 6 && (
                      <div className="text-xs text-gray-400">
                        + {plan.features.length - 6} more features
                      </div>
                    )}
                  </div>

                  {/* Professional features */}
                  {plan.professionalFeatures && (
                    <div className="space-y-4 mb-6">
                      <h4 className="font-semibold text-sm text-chitty-primary">
                        Professional Modules Included:
                      </h4>
                      {Object.entries(plan.professionalFeatures).map(([category, features]) => (
                        <div key={category} className="space-y-2">
                          <div className="text-xs font-medium text-gray-300">{category}:</div>
                          <div className="grid grid-cols-1 gap-1 ml-3">
                            {features.slice(0, 2).map((feature, index) => (
                              <div key={index} className="flex items-center space-x-2">
                                <Star className="w-3 h-3 text-yellow-400 flex-shrink-0" />
                                <span className="text-xs text-gray-400">{feature}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={isProcessing}
                    className={`w-full py-3 rounded-lg font-medium transition-all flex items-center justify-center space-x-2 ${
                      selectedPlan === plan.id
                        ? 'bg-gradient-premium text-white hover:scale-105'
                        : 'bg-white/10 hover:bg-white/20'
                    } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isProcessing ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4" />
                        <span>Choose {plan.name}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </motion.div>
              ))}
            </div>

            {/* Money back guarantee */}
            <div className="text-center text-sm text-gray-400">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <Shield className="w-4 h-4 text-green-400" />
                <span>30-day money-back guarantee</span>
              </div>
              <p>
                Cancel anytime. No questions asked. Your satisfaction is guaranteed.
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default UpgradePrompt