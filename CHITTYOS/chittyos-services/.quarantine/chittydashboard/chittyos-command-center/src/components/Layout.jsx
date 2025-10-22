import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, Crown } from 'lucide-react'
import Navigation from './Navigation'
import Header from './Header'
import UpgradePrompt from './UpgradePrompt'
import { useAuth } from '../contexts/AuthContext'

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false)
  const { user } = useAuth()

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-black">
      {/* Mobile sidebar backdrop */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col">
        <Navigation onUpgrade={() => setShowUpgradePrompt(true)} />
      </aside>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="fixed inset-y-0 left-0 z-50 w-72 lg:hidden"
          >
            <Navigation onUpgrade={() => setShowUpgradePrompt(true)} />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="lg:pl-72">
        <Header onMenuClick={toggleSidebar} />

        {/* Upgrade banner for free users */}
        {user?.tier === 'free' && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="upgrade-banner p-3 text-center text-white font-medium cursor-pointer"
            onClick={() => setShowUpgradePrompt(true)}
          >
            <div className="flex items-center justify-center gap-2">
              <Crown className="w-5 h-5" />
              <span>Unlock Premium Features - 50% off this week!</span>
              <Crown className="w-5 h-5" />
            </div>
          </motion.div>
        )}

        <main className="px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
      </div>

      {/* Upgrade prompt modal */}
      <UpgradePrompt
        open={showUpgradePrompt}
        onClose={() => setShowUpgradePrompt(false)}
      />
    </div>
  )
}

export default Layout