import React, { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext()

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate loading user data
    const timer = setTimeout(() => {
      // Mock user data - in real app this would come from your API
      setUser({
        id: '03-1-USA-0001-P-2509-3-97',
        name: 'Alex Chen',
        email: 'alex.chen@example.com',
        tier: 'free', // 'free' or 'premium'
        profession: 'lawyer',
        chittyId: '03-1-USA-0001-P-2509-3-97',
        joinDate: '2025-09-01',
        avatar: null,
        preferences: {
          theme: 'dark',
          notifications: true,
          autoSync: true
        },
        usage: {
          modulesUsed: 12,
          storageUsed: '2.1 GB',
          storageLimit: '5 GB',
          apiCalls: 1247,
          apiLimit: 10000
        }
      })
      setLoading(false)
    }, 1000)

    return () => clearTimeout(timer)
  }, [])

  const login = async (email, password) => {
    setLoading(true)
    try {
      // Mock login - replace with real authentication
      await new Promise(resolve => setTimeout(resolve, 1000))

      setUser({
        id: '03-1-USA-0001-P-2509-3-97',
        name: 'Alex Chen',
        email,
        tier: 'free',
        profession: 'lawyer',
        chittyId: '03-1-USA-0001-P-2509-3-97',
        joinDate: '2025-09-01',
        avatar: null,
        preferences: {
          theme: 'dark',
          notifications: true,
          autoSync: true
        },
        usage: {
          modulesUsed: 12,
          storageUsed: '2.1 GB',
          storageLimit: '5 GB',
          apiCalls: 1247,
          apiLimit: 10000
        }
      })
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    setUser(null)
  }

  const updateUserTier = (newTier) => {
    setUser(prev => ({
      ...prev,
      tier: newTier,
      usage: {
        ...prev.usage,
        storageLimit: newTier === 'premium' ? '100 GB' : '5 GB',
        apiLimit: newTier === 'premium' ? 100000 : 10000
      }
    }))
  }

  const updatePreferences = (newPreferences) => {
    setUser(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        ...newPreferences
      }
    }))
  }

  const value = {
    user,
    loading,
    login,
    logout,
    updateUserTier,
    updatePreferences
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}