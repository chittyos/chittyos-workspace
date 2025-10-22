import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Compliance from './pages/Compliance'
import Evidence from './pages/Evidence'
import AuditTrail from './pages/AuditTrail'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-900">
        {/* Navigation */}
        <nav className="bg-slate-800 border-b border-slate-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex">
                <div className="flex-shrink-0 flex items-center">
                  <h1 className="text-2xl font-bold text-chitty-primary">ChittyGov</h1>
                </div>
                <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                  <Link
                    to="/"
                    className="border-chitty-primary text-slate-100 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    Dashboard
                  </Link>
                  <Link
                    to="/compliance"
                    className="border-transparent text-slate-400 hover:border-slate-300 hover:text-slate-100 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    Compliance
                  </Link>
                  <Link
                    to="/evidence"
                    className="border-transparent text-slate-400 hover:border-slate-300 hover:text-slate-100 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    Evidence
                  </Link>
                  <Link
                    to="/audit"
                    className="border-transparent text-slate-400 hover:border-slate-300 hover:text-slate-100 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  >
                    Audit Trail
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/compliance" element={<Compliance />} />
            <Route path="/evidence" element={<Evidence />} />
            <Route path="/audit" element={<AuditTrail />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App
