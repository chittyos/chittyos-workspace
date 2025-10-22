import React from 'react'
import ReactDOM from 'react-dom/client'

function Dashboard() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-slate-900 to-black text-white p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            ChittyOS Command Center
          </h1>
          <p className="text-gray-400 mt-2">Professional ecosystem management dashboard</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <h3 className="text-xl font-semibold mb-4">System Status</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>ChittyOS Core</span>
                <span className="text-green-400">Online</span>
              </div>
              <div className="flex justify-between">
                <span>Pipeline Status</span>
                <span className="text-green-400">Active</span>
              </div>
              <div className="flex justify-between">
                <span>Session Sync</span>
                <span className="text-green-400">Connected</span>
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <h3 className="text-xl font-semibold mb-4">Module Explorer</h3>
            <div className="space-y-2">
              <div className="text-3xl font-bold text-purple-400">51+</div>
              <div className="text-sm text-gray-400">Active Modules</div>
              <div className="flex gap-2 mt-4">
                <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">Legal</span>
                <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">Property</span>
                <span className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs">Business</span>
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <h3 className="text-xl font-semibold mb-4">ChittyID Pipeline</h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span>Router</span>
                <div className="w-3 h-3 bg-green-400 rounded-full"></div>
              </div>
              <div className="flex justify-between items-center">
                <span>Intake</span>
                <div className="w-3 h-3 bg-green-400 rounded-full"></div>
              </div>
              <div className="flex justify-between items-center">
                <span>Trust Level</span>
                <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
              </div>
              <div className="flex justify-between items-center">
                <span>Authorization</span>
                <div className="w-3 h-3 bg-green-400 rounded-full"></div>
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <h3 className="text-xl font-semibold mb-4">Session Sync</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span>Claude ↔ ChittyOS</span>
                <span className="text-green-400">Synced</span>
              </div>
              <div className="flex justify-between">
                <span>GPT ↔ ChittyOS</span>
                <span className="text-green-400">Synced</span>
              </div>
              <div className="flex justify-between">
                <span>Gemini ↔ ChittyOS</span>
                <span className="text-yellow-400">Pending</span>
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <h3 className="text-xl font-semibold mb-4">Notion Sync</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>AtomicFacts</span>
                <span className="text-green-400">Connected</span>
              </div>
              <div className="flex justify-between">
                <span>Last Sync</span>
                <span className="text-gray-400">2min ago</span>
              </div>
              <div className="flex justify-between">
                <span>Queue Status</span>
                <span className="text-green-400">Empty</span>
              </div>
            </div>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <h3 className="text-xl font-semibold mb-4">Upgrade</h3>
            <div className="space-y-3">
              <div className="text-sm text-gray-400">Current: Free Tier</div>
              <div className="text-2xl font-bold text-purple-400">$99/mo</div>
              <button className="w-full bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white px-4 py-2 rounded-lg transition-all">
                Upgrade to Premium
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
          <h3 className="text-xl font-semibold mb-4">Recent Activity</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span>ChittyID generated for Legal Case #2024-001</span>
              <span className="text-gray-400 text-sm">2 minutes ago</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Property module synchronized with Notion</span>
              <span className="text-gray-400 text-sm">5 minutes ago</span>
            </div>
            <div className="flex justify-between items-center">
              <span>Claude session restored from checkpoint</span>
              <span className="text-gray-400 text-sm">8 minutes ago</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(<Dashboard />)