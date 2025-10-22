import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Crown,
  Lock,
  CheckCircle,
  Clock,
  Pause,
  ExternalLink,
  Star,
  ChevronRight
} from 'lucide-react'
import { useChittyOS } from '../contexts/ChittyOSContext'
import { useAuth } from '../contexts/AuthContext'

const ModuleGrid = ({ featured = false, category = null }) => {
  const { stats } = useChittyOS()
  const { user } = useAuth()
  const [selectedCategory, setSelectedCategory] = useState(category || 'All')

  // Get modules from context or use featured subset
  const allModules = stats?.modules || []

  const featuredModules = [
    'chittycore', 'chittylegal', 'chittyid', 'chittyproperty',
    'chittycontract', 'chittysecure', 'chittyauth', 'chittychain'
  ]

  const modules = featured
    ? allModules.filter(module => featuredModules.includes(module.id))
    : allModules

  const categories = ['All', ...new Set(allModules.map(module => module.category))]

  const filteredModules = selectedCategory === 'All'
    ? modules
    : modules.filter(module => module.category === selectedCategory)

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-400" />
      case 'beta':
        return <Clock className="w-4 h-4 text-yellow-400" />
      case 'paused':
        return <Pause className="w-4 h-4 text-gray-400" />
      default:
        return <CheckCircle className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return 'border-green-400/30 bg-green-400/5'
      case 'beta':
        return 'border-yellow-400/30 bg-yellow-400/5'
      case 'paused':
        return 'border-gray-400/30 bg-gray-400/5'
      default:
        return 'border-gray-400/30 bg-gray-400/5'
    }
  }

  const isPremiumLocked = (module) => {
    return module.premium && user?.tier !== 'premium'
  }

  return (
    <div className="glassmorphic rounded-2xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <h2 className="text-lg font-semibold mb-4 sm:mb-0">
          {featured ? 'Featured Modules' : 'Module Explorer'}
        </h2>

        {!featured && (
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs transition-all ${
                  selectedCategory === cat
                    ? 'bg-chitty-primary text-white'
                    : 'bg-white/10 text-gray-400 hover:text-white hover:bg-white/20'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredModules.slice(0, featured ? 8 : undefined).map((module, index) => (
          <motion.div
            key={module.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`relative module-card border ${getStatusColor(module.status)} ${
              isPremiumLocked(module) ? 'opacity-75' : ''
            }`}
          >
            {/* Premium overlay */}
            {isPremiumLocked(module) && (
              <div className="absolute inset-0 glassmorphic-light rounded-xl flex items-center justify-center z-10">
                <div className="text-center">
                  <Lock className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                  <div className="text-xs text-yellow-400 font-medium">Premium</div>
                </div>
              </div>
            )}

            {/* Premium badge */}
            {module.premium && (
              <div className="absolute top-2 right-2 z-20">
                <Crown className="w-4 h-4 text-yellow-400" />
              </div>
            )}

            {/* Featured star */}
            {featured && featuredModules.includes(module.id) && (
              <div className="absolute top-2 left-2 z-20">
                <Star className="w-4 h-4 text-chitty-primary fill-current" />
              </div>
            )}

            <div className="p-4">
              {/* Module header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  {getStatusIcon(module.status)}
                  <h3 className="font-semibold text-sm">{module.name}</h3>
                </div>
                <ExternalLink className="w-3 h-3 text-gray-400 hover:text-white transition-colors cursor-pointer" />
              </div>

              {/* Module description */}
              <p className="text-xs text-gray-400 mb-3 line-clamp-2">
                {module.description}
              </p>

              {/* Module category */}
              <div className="flex items-center justify-between">
                <span className="text-xs bg-chitty-primary/20 text-chitty-primary px-2 py-1 rounded-full">
                  {module.category}
                </span>
                <div className="flex items-center space-x-1 text-xs text-gray-400">
                  <span className="capitalize">{module.status}</span>
                  {module.status === 'active' && (
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  )}
                </div>
              </div>

              {/* Premium features hint */}
              {module.premium && user?.tier !== 'premium' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 text-xs text-yellow-400 bg-yellow-400/10 border border-yellow-400/30 rounded-lg p-2"
                >
                  Advanced features available with Premium
                </motion.div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* View more button for featured */}
      {featured && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-6 text-center"
        >
          <button className="inline-flex items-center space-x-2 text-chitty-primary hover:text-chitty-secondary transition-colors">
            <span>Explore All {stats?.totalModules || 51} Modules</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </motion.div>
      )}

      {/* Premium upsell for free users */}
      {user?.tier === 'free' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-6 upgrade-banner rounded-xl p-4 text-center cursor-pointer hover:scale-105 transition-transform"
        >
          <div className="flex items-center justify-center space-x-2 text-white">
            <Crown className="w-5 h-5" />
            <span className="font-medium">
              Unlock {allModules.filter(m => m.premium).length} Premium Modules
            </span>
          </div>
          <p className="text-sm text-white/80 mt-1">
            Get access to advanced legal, security, and automation tools
          </p>
        </motion.div>
      )}
    </div>
  )
}

export default ModuleGrid