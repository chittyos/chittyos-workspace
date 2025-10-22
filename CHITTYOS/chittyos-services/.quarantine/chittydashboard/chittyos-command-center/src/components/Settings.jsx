import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Settings as SettingsIcon,
  User,
  Bell,
  Shield,
  Palette,
  Database,
  Key,
  Save,
  Crown,
  Mail,
  Phone,
  MapPin
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

const Settings = () => {
  const { user, updatePreferences } = useAuth()
  const [activeTab, setActiveTab] = useState('profile')
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: '',
    location: '',
    profession: user?.profession || '',
    notifications: user?.preferences?.notifications ?? true,
    autoSync: user?.preferences?.autoSync ?? true,
    theme: user?.preferences?.theme || 'dark',
    dataRetention: '1year',
    apiAccess: true
  })

  const tabs = [
    { id: 'profile', name: 'Profile', icon: User },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'security', name: 'Security', icon: Shield },
    { id: 'preferences', name: 'Preferences', icon: Palette },
    { id: 'data', name: 'Data & Privacy', icon: Database },
    { id: 'api', name: 'API Keys', icon: Key }
  ]

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSave = async () => {
    try {
      await updatePreferences({
        notifications: formData.notifications,
        autoSync: formData.autoSync,
        theme: formData.theme
      })
      toast.success('Settings saved successfully!')
    } catch (error) {
      toast.error('Failed to save settings')
    }
  }

  const renderProfileTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Personal Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Full Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-chitty-primary/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Email Address</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-chitty-primary/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Phone Number</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              placeholder="(555) 123-4567"
              className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-chitty-primary/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Location</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => handleInputChange('location', e.target.value)}
              placeholder="City, State"
              className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-chitty-primary/50"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-4">Professional Details</h3>
        <div>
          <label className="block text-sm font-medium mb-2">Profession</label>
          <select
            value={formData.profession}
            onChange={(e) => handleInputChange('profession', e.target.value)}
            className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-chitty-primary/50"
          >
            <option value="">Select Profession</option>
            <option value="lawyer">Lawyer</option>
            <option value="property_manager">Property Manager</option>
            <option value="business_owner">Business Owner</option>
            <option value="consultant">Consultant</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      {/* ChittyID Display */}
      <div>
        <h3 className="text-lg font-semibold mb-4">ChittyID</h3>
        <div className="bg-black/30 border border-white/10 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-lg text-chitty-primary">
                {user?.chittyId || '03-1-USA-0001-P-2509-3-97'}
              </div>
              <div className="text-sm text-gray-400 mt-1">
                Unique identifier in the ChittyOS ecosystem
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-green-400">Level 3</div>
              <div className="text-xs text-gray-400">Verified</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderNotificationsTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Notification Preferences</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-black/20 rounded-lg">
            <div className="flex items-center space-x-3">
              <Bell className="w-5 h-5 text-chitty-primary" />
              <div>
                <div className="font-medium">Push Notifications</div>
                <div className="text-sm text-gray-400">Receive notifications in your browser</div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.notifications}
                onChange={(e) => handleInputChange('notifications', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-chitty-primary"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 bg-black/20 rounded-lg">
            <div className="flex items-center space-x-3">
              <Mail className="w-5 h-5 text-chitty-primary" />
              <div>
                <div className="font-medium">Email Notifications</div>
                <div className="text-sm text-gray-400">Receive updates via email</div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" defaultChecked className="sr-only peer" />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-chitty-primary"></div>
            </label>
          </div>

          <div className="flex items-center justify-between p-4 bg-black/20 rounded-lg">
            <div className="flex items-center space-x-3">
              <Database className="w-5 h-5 text-chitty-primary" />
              <div>
                <div className="font-medium">Auto-Sync</div>
                <div className="text-sm text-gray-400">Automatically sync data across devices</div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.autoSync}
                onChange={(e) => handleInputChange('autoSync', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-chitty-primary"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  )

  const renderSecurityTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Security Settings</h3>
        <div className="space-y-4">
          <div className="bg-black/20 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="font-medium">Two-Factor Authentication</div>
              <div className="text-xs bg-green-400/20 text-green-400 px-2 py-1 rounded-full">
                Enabled
              </div>
            </div>
            <div className="text-sm text-gray-400 mb-3">
              Add an extra layer of security to your account
            </div>
            <button className="text-chitty-primary hover:text-chitty-secondary transition-colors text-sm">
              Manage 2FA Settings
            </button>
          </div>

          <div className="bg-black/20 rounded-lg p-4">
            <div className="font-medium mb-3">Password</div>
            <div className="text-sm text-gray-400 mb-3">
              Last changed 30 days ago
            </div>
            <button className="text-chitty-primary hover:text-chitty-secondary transition-colors text-sm">
              Change Password
            </button>
          </div>

          <div className="bg-black/20 rounded-lg p-4">
            <div className="font-medium mb-3">Active Sessions</div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Current session (Web)</span>
                <span className="text-green-400">Active now</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Mobile app</span>
                <span className="text-gray-400">2 hours ago</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  const renderPreferencesTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Interface Preferences</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Theme</label>
            <select
              value={formData.theme}
              onChange={(e) => handleInputChange('theme', e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-chitty-primary/50"
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="system">System</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Data Retention</label>
            <select
              value={formData.dataRetention}
              onChange={(e) => handleInputChange('dataRetention', e.target.value)}
              className="w-full bg-black/30 border border-white/10 rounded-lg px-4 py-3 focus:outline-none focus:border-chitty-primary/50"
            >
              <option value="3months">3 Months</option>
              <option value="6months">6 Months</option>
              <option value="1year">1 Year</option>
              <option value="forever">Forever</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )

  const renderApiTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">API Access</h3>
        {user?.tier === 'premium' ? (
          <div className="space-y-4">
            <div className="bg-black/20 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-medium">API Key</div>
                <button className="text-chitty-primary hover:text-chitty-secondary transition-colors text-sm">
                  Regenerate
                </button>
              </div>
              <div className="font-mono text-sm bg-black/30 rounded p-2 border border-white/10">
                chitty_pk_live_51Hs8w2e...
              </div>
            </div>

            <div className="bg-black/20 rounded-lg p-4">
              <div className="font-medium mb-3">Rate Limits</div>
              <div className="text-sm text-gray-400">
                Premium: 100,000 requests per month
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-yellow-400/10 border border-yellow-400/30 rounded-lg p-4 text-center">
            <Crown className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
            <div className="font-medium text-yellow-400 mb-1">Premium Feature</div>
            <div className="text-sm text-gray-400">
              API access is available with Premium subscription
            </div>
          </div>
        )}
      </div>
    </div>
  )

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile': return renderProfileTab()
      case 'notifications': return renderNotificationsTab()
      case 'security': return renderSecurityTab()
      case 'preferences': return renderPreferencesTab()
      case 'api': return renderApiTab()
      default: return renderProfileTab()
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glassmorphic rounded-2xl p-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center space-x-2">
              <SettingsIcon className="w-7 h-7 text-chitty-primary" />
              <span>Settings</span>
            </h1>
            <p className="text-gray-400 mt-1">
              Manage your account preferences and security settings
            </p>
          </div>
          <button
            onClick={handleSave}
            className="flex items-center space-x-2 bg-chitty-primary hover:bg-chitty-primary/80 transition-colors rounded-lg px-4 py-2"
          >
            <Save className="w-4 h-4" />
            <span>Save Changes</span>
          </button>
        </div>
      </motion.div>

      {/* Settings Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="glassmorphic rounded-2xl p-4"
        >
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  activeTab === tab.id
                    ? 'bg-chitty-primary text-white'
                    : 'hover:bg-white/10 text-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="text-sm">{tab.name}</span>
              </button>
            ))}
          </nav>
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-3 glassmorphic rounded-2xl p-6"
        >
          {renderTabContent()}
        </motion.div>
      </div>
    </div>
  )
}

export default Settings