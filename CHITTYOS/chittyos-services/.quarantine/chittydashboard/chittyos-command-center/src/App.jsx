import React from 'react'
import { Routes, Route } from 'react-router-dom'
import { motion } from 'framer-motion'
import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import ModuleExplorer from './components/ModuleExplorer'
import PipelineStatus from './components/PipelineStatus'
import SessionSync from './components/SessionSync'
import Analytics from './components/Analytics'
import NotionSync from './components/NotionSync'
import Billing from './components/Billing'
import Settings from './components/Settings'
import { ChittyOSProvider } from './contexts/ChittyOSContext'
import { AuthProvider } from './contexts/AuthContext'

function App() {
  console.log('App component rendering...')

  return (
    <AuthProvider>
      <ChittyOSProvider>
        <Layout>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="min-h-screen"
          >
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/modules" element={<ModuleExplorer />} />
              <Route path="/pipeline" element={<PipelineStatus />} />
              <Route path="/session-sync" element={<SessionSync />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/notion" element={<NotionSync />} />
              <Route path="/billing" element={<Billing />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </motion.div>
        </Layout>
      </ChittyOSProvider>
    </AuthProvider>
  )
}

export default App