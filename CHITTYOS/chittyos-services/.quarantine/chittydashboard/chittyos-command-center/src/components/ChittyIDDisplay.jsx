import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Fingerprint, Copy, Check, Info } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'

const ChittyIDDisplay = () => {
  const { user } = useAuth()
  const [copied, setCopied] = useState(false)
  const [animatingSegment, setAnimatingSegment] = useState(null)

  const chittyId = user?.chittyId || '03-1-USA-0001-P-2509-3-97'
  const segments = chittyId.split('-')

  const segmentLabels = [
    { label: 'Version', description: 'Schema version (03 = Current)' },
    { label: 'Region', description: 'Geographic region (1 = North America)' },
    { label: 'Jurisdiction', description: 'Legal jurisdiction (USA)' },
    { label: 'Sequential', description: 'Sequential identifier' },
    { label: 'Type', description: 'Entity type (P = Person)' },
    { label: 'YearMonth', description: 'Registration date (2509 = Sep 2025)' },
    { label: 'Trust', description: 'Trust level (3 = Verified)' },
    { label: 'Checksum', description: 'Validation checksum' }
  ]

  const copyToClipboard = () => {
    navigator.clipboard.writeText(chittyId)
    setCopied(true)
    toast.success('ChittyID copied to clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  // Animate random segments periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * segments.length)
      setAnimatingSegment(randomIndex)
      setTimeout(() => setAnimatingSegment(null), 1000)
    }, 3000)

    return () => clearInterval(interval)
  }, [segments.length])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="glassmorphic rounded-2xl p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center space-x-2">
          <Fingerprint className="w-5 h-5 text-chitty-primary" />
          <span>Your ChittyID</span>
        </h2>
        <button
          onClick={copyToClipboard}
          className="flex items-center space-x-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-400" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
          <span>{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>

      {/* ChittyID Display */}
      <div className="bg-black/50 rounded-xl p-6 mb-4 overflow-x-auto">
        <div className="flex items-center space-x-2 text-xl font-mono min-w-max">
          {segments.map((segment, index) => (
            <React.Fragment key={index}>
              <motion.span
                className={`px-3 py-2 rounded-lg border transition-all duration-300 ${
                  animatingSegment === index
                    ? 'bg-chitty-primary/30 border-chitty-primary text-white'
                    : 'bg-chitty-primary/10 border-chitty-primary/30 text-gray-300'
                }`}
                animate={animatingSegment === index ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.3 }}
                title={segmentLabels[index]?.description}
              >
                {segment}
              </motion.span>
              {index < segments.length - 1 && (
                <span className="text-gray-500 text-lg">-</span>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Segment Legend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {segmentLabels.map((item, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + index * 0.05 }}
            className={`text-center p-2 rounded-lg transition-all ${
              animatingSegment === index
                ? 'bg-chitty-primary/20 border border-chitty-primary/30'
                : 'bg-slate-800/30'
            }`}
          >
            <div className="text-xs font-medium text-chitty-primary">
              {item.label}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {segments[index]}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Trust Level Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-4 flex items-center justify-between bg-gradient-to-r from-green-400/10 to-emerald-400/10 border border-green-400/30 rounded-lg p-3"
      >
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-sm font-medium text-green-400">
            Level 3 Verified Identity
          </span>
        </div>
        <div className="flex items-center space-x-1 text-xs text-gray-400">
          <Info className="w-3 h-3" />
          <span>High Trust</span>
        </div>
      </motion.div>
    </motion.div>
  )
}

export default ChittyIDDisplay