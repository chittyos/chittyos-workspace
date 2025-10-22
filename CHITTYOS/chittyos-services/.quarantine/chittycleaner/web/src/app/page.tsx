'use client'

import { useState, useEffect } from 'react'
import {
  HardDrive,
  Cloud,
  Zap,
  Shield,
  Download,
  Github,
  CheckCircle,
  Activity,
  Database
} from 'lucide-react'
import Dashboard from './components/Dashboard'

export default function Home() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Navigation */}
      <nav className="border-b border-gray-800 bg-black/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <HardDrive className="h-8 w-8 text-purple-400" />
              <span className="ml-2 text-xl font-bold text-white">ChittyCleaner</span>
            </div>
            <div className="flex items-center space-x-4">
              <a
                href="https://github.com/chitcommit/chittycleaner"
                className="text-gray-300 hover:text-white transition-colors"
              >
                <Github className="h-5 w-5" />
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-6xl font-bold text-white mb-6">
            Intelligent Storage
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
              {" "}Management
            </span>
          </h1>
          <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
            Web3-powered daemon that automatically optimizes your storage with IPFS archiving
            and blockchain-based audit trails via Cloudflare infrastructure.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-lg font-semibold flex items-center justify-center transition-colors">
              <Download className="h-5 w-5 mr-2" />
              Install ChittyCleaner
            </button>
            <button className="border border-purple-400 text-purple-400 hover:bg-purple-400 hover:text-white px-8 py-3 rounded-lg font-semibold transition-colors">
              View Documentation
            </button>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            Powered by Cloudflare Web3
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
              <Cloud className="h-12 w-12 text-blue-400 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">IPFS Gateway</h3>
              <p className="text-gray-300">
                Archive rarely-used files to distributed storage via Cloudflare's IPFS gateway.
                Access your data globally without specialized software.
              </p>
            </div>

            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
              <Shield className="h-12 w-12 text-green-400 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Ethereum Integration</h3>
              <p className="text-gray-300">
                Store cleanup policies and audit trails on-chain using Cloudflare's Ethereum gateway.
                Immutable record of all storage operations.
              </p>
            </div>

            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-xl p-6">
              <Zap className="h-12 w-12 text-yellow-400 mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Intelligent Scanning</h3>
              <p className="text-gray-300">
                AI-powered filesystem analysis identifies temp files, duplicates, and candidates
                for archival based on usage patterns.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Installation */}
      <div className="py-16 px-4 sm:px-6 lg:px-8 bg-black/20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-8">
            Quick Start
          </h2>

          <div className="bg-gray-900 rounded-xl p-6 border border-gray-700">
            <div className="text-sm text-gray-400 mb-2">Terminal</div>
            <code className="text-green-400 font-mono">
              {`# Install ChittyCleaner
npm install -g chittycleaner

# Start daemon with Web3 features
chitty start --ipfs --ethereum

# Perform one-time scan
chitty scan --paths /Users /Applications

# Archive large files to IPFS
chitty ipfs archive large-file.zip`}
            </code>
          </div>

          <div className="mt-8 grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-white">Features</h3>
              <div className="space-y-2">
                {[
                  'Automatic temp file cleanup',
                  'Duplicate file detection',
                  'IPFS distributed archiving',
                  'Blockchain audit trails',
                  'Smart storage policies',
                  'Real-time monitoring'
                ].map((feature, i) => (
                  <div key={i} className="flex items-center text-gray-300">
                    <CheckCircle className="h-4 w-4 text-green-400 mr-2" />
                    {feature}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-white">Commands</h3>
              <div className="space-y-2 text-sm font-mono">
                <div className="text-gray-300"><span className="text-purple-400">chitty</span> start</div>
                <div className="text-gray-300"><span className="text-purple-400">chitty</span> scan</div>
                <div className="text-gray-300"><span className="text-purple-400">chitty</span> ipfs archive</div>
                <div className="text-gray-300"><span className="text-purple-400">chitty</span> ethereum history</div>
                <div className="text-gray-300"><span className="text-purple-400">chitty</span> status</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dashboard Preview */}
      <div className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-white text-center mb-8">
            Live Dashboard
          </h2>
          <Dashboard />
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto text-center text-gray-400">
          <p>&copy; 2024 ChittyCleaner. Powered by Cloudflare Web3.</p>
        </div>
      </footer>
    </div>
  )
}