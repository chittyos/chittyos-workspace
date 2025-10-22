import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Menu,
  Bell,
  Search,
  User,
  Settings,
  LogOut,
  Crown,
  Zap
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useChittyOS } from '../contexts/ChittyOSContext'

const Header = ({ onMenuClick }) => {
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const { user, logout } = useAuth()
  const { notifications, systemTime } = useChittyOS()

  const unreadCount = notifications?.filter(n => !n.read).length || 0

  return (
    <header className="glassmorphic sticky top-0 z-40 px-4 sm:px-6 lg:px-8 py-4 border-b border-white/10">
      <div className="flex items-center justify-between">
        {/* Left side */}
        <div className="flex items-center space-x-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>

          {/* Search bar */}
          <div className="hidden sm:block relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search modules, features..."
              className="bg-black/30 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-chitty-primary/50 focus:bg-black/50 transition-all w-64"
            />
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-4">
          {/* System time */}
          <div className="hidden md:block text-sm text-gray-400">
            {systemTime}
          </div>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications dropdown */}
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute right-0 mt-2 w-80 glassmorphic rounded-lg shadow-xl border border-white/10 overflow-hidden"
              >
                <div className="p-4 border-b border-white/10">
                  <h3 className="font-semibold">Notifications</h3>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notifications?.length > 0 ? (
                    notifications.slice(0, 5).map((notification, index) => (
                      <div
                        key={index}
                        className={`p-4 border-b border-white/5 hover:bg-white/5 ${
                          !notification.read ? 'bg-chitty-primary/10' : ''
                        }`}
                      >
                        <div className="text-sm font-medium">{notification.title}</div>
                        <div className="text-xs text-gray-400 mt-1">
                          {notification.message}
                        </div>
                        <div className="text-xs text-gray-500 mt-2">
                          {notification.time}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-gray-400">
                      No notifications
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center space-x-2 p-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-chitty-primary to-chitty-secondary rounded-full flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-sm font-medium flex items-center gap-1">
                  {user?.name || 'Professional User'}
                  {user?.tier === 'premium' && (
                    <Crown className="w-3 h-3 text-yellow-400" />
                  )}
                </div>
                <div className="text-xs text-gray-400">
                  {user?.tier === 'premium' ? 'Premium Account' : 'Free Tier'}
                </div>
              </div>
            </button>

            {/* User dropdown */}
            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute right-0 mt-2 w-48 glassmorphic rounded-lg shadow-xl border border-white/10 overflow-hidden"
              >
                <div className="p-4 border-b border-white/10">
                  <div className="text-sm font-medium">{user?.name || 'User'}</div>
                  <div className="text-xs text-gray-400">{user?.email}</div>
                  <div className={`text-xs mt-1 flex items-center gap-1 ${
                    user?.tier === 'premium' ? 'text-yellow-400' : 'text-gray-400'
                  }`}>
                    {user?.tier === 'premium' ? (
                      <Crown className="w-3 h-3" />
                    ) : (
                      <Zap className="w-3 h-3" />
                    )}
                    {user?.tier === 'premium' ? 'Premium Account' : 'Free Tier'}
                  </div>
                </div>
                <div className="py-2">
                  <button className="w-full text-left px-4 py-2 text-sm hover:bg-white/5 flex items-center space-x-2">
                    <Settings className="w-4 h-4" />
                    <span>Settings</span>
                  </button>
                  <button
                    onClick={logout}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-white/5 flex items-center space-x-2 text-red-400"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign out</span>
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile search */}
      <div className="sm:hidden mt-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            className="w-full bg-black/30 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-chitty-primary/50 focus:bg-black/50 transition-all"
          />
        </div>
      </div>
    </header>
  )
}

export default Header