import React from 'react'
import { motion } from 'framer-motion'
import { Grid3X3, Search, Filter } from 'lucide-react'
import ModuleGrid from './ModuleGrid'
import { useChittyOS } from '../contexts/ChittyOSContext'

const ModuleExplorer = () => {
  const { stats } = useChittyOS()

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
              <Grid3X3 className="w-7 h-7 text-chitty-primary" />
              <span>Module Explorer</span>
            </h1>
            <p className="text-gray-400 mt-1">
              Discover and manage all {stats?.totalModules || 51} ChittyOS modules
            </p>
          </div>
        </div>
      </motion.div>

      {/* Module Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <ModuleGrid featured={false} />
      </motion.div>
    </div>
  )
}

export default ModuleExplorer