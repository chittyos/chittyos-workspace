import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Router,
  Shield,
  UserCheck,
  Key,
  Fingerprint,
  CheckCircle,
  AlertTriangle,
  Clock,
  Activity,
  Lock,
  Unlock,
  Zap,
  Eye,
  Server
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Area, AreaChart } from 'recharts'

const PipelineStatus = () => {
  const [selectedStage, setSelectedStage] = useState(null)
  const [realTimeMetrics, setRealTimeMetrics] = useState({})

  // Mock real-time pipeline metrics
  useEffect(() => {
    const interval = setInterval(() => {
      setRealTimeMetrics({
        router: {
          throughput: Math.floor(Math.random() * 50) + 150,
          latency: Math.floor(Math.random() * 20) + 5,
          success_rate: 99.2 + Math.random() * 0.8
        },
        intake: {
          throughput: Math.floor(Math.random() * 45) + 140,
          latency: Math.floor(Math.random() * 30) + 10,
          success_rate: 98.8 + Math.random() * 1.2
        },
        trust: {
          throughput: Math.floor(Math.random() * 40) + 130,
          latency: Math.floor(Math.random() * 50) + 15,
          success_rate: 97.5 + Math.random() * 2.5
        },
        authorization: {
          throughput: Math.floor(Math.random() * 35) + 125,
          latency: Math.floor(Math.random() * 25) + 8,
          success_rate: 99.5 + Math.random() * 0.5
        },
        generation: {
          throughput: Math.floor(Math.random() * 30) + 120,
          latency: Math.floor(Math.random() * 40) + 20,
          success_rate: 99.8 + Math.random() * 0.2
        }
      })
    }, 2000)

    return () => clearInterval(interval)
  }, [])

  const pipelineStages = [
    {
      id: 'router',
      name: 'Router',
      description: 'Request routing and initial validation',
      icon: Router,
      color: 'text-blue-400',
      bgColor: 'bg-blue-400/10',
      borderColor: 'border-blue-400/30',
      status: 'healthy',
      features: [
        'Request classification',
        'Load balancing',
        'Rate limiting',
        'Initial validation'
      ]
    },
    {
      id: 'intake',
      name: 'Intake',
      description: 'Project validation and context gathering',
      icon: Server,
      color: 'text-green-400',
      bgColor: 'bg-green-400/10',
      borderColor: 'border-green-400/30',
      status: 'healthy',
      features: [
        'Project validation',
        'Context extraction',
        'Schema validation',
        'Data sanitization'
      ]
    },
    {
      id: 'trust',
      name: 'Trust',
      description: 'Trust level evaluation and scoring',
      icon: Shield,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-400/10',
      borderColor: 'border-yellow-400/30',
      status: 'healthy',
      features: [
        'Identity verification',
        'Trust scoring',
        'Risk assessment',
        'Fraud detection'
      ]
    },
    {
      id: 'authorization',
      name: 'Authorization',
      description: 'Permission checking and access control',
      icon: UserCheck,
      color: 'text-purple-400',
      bgColor: 'bg-purple-400/10',
      borderColor: 'border-purple-400/30',
      status: 'healthy',
      features: [
        'Permission validation',
        'Role-based access',
        'Policy enforcement',
        'Audit logging'
      ]
    },
    {
      id: 'generation',
      name: 'Generation',
      description: 'Secure ChittyID creation and registration',
      icon: Fingerprint,
      color: 'text-chitty-primary',
      bgColor: 'bg-chitty-primary/10',
      borderColor: 'border-chitty-primary/30',
      status: 'healthy',
      features: [
        'ID generation',
        'Cryptographic signing',
        'Registry update',
        'Notification dispatch'
      ]
    }
  ]

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-4 h-4 text-green-400" />
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-400" />
      default:
        return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  const generateMetricsData = (stageId) => {
    return Array.from({ length: 20 }, (_, i) => ({
      time: i,
      throughput: realTimeMetrics[stageId]?.throughput + Math.random() * 20 - 10 || 100,
      latency: realTimeMetrics[stageId]?.latency + Math.random() * 10 - 5 || 15
    }))
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
              <Activity className="w-7 h-7 text-chitty-primary" />
              <span>ChittyID Pipeline Status</span>
            </h1>
            <p className="text-gray-400 mt-1">
              Secure, authenticated ChittyID generation pipeline
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-green-400">All Systems Operational</span>
            </div>
            <div className="text-sm text-gray-400">
              Pipeline Enforced • No Direct Access
            </div>
          </div>
        </div>
      </motion.div>

      {/* Pipeline Flow Visualization */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glassmorphic rounded-2xl p-6"
      >
        <h2 className="text-lg font-semibold mb-6 flex items-center space-x-2">
          <Lock className="w-5 h-5 text-chitty-primary" />
          <span>Mandatory Authentication Pipeline</span>
        </h2>

        {/* Desktop Flow */}
        <div className="hidden lg:block">
          <div className="flex items-center justify-between space-x-4 mb-8">
            {pipelineStages.map((stage, index) => (
              <React.Fragment key={stage.id}>
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + index * 0.1 }}
                  className={`flex-1 border rounded-xl p-4 cursor-pointer transition-all ${
                    selectedStage === stage.id
                      ? `${stage.borderColor} ${stage.bgColor}`
                      : 'border-white/10 hover:border-white/20'
                  }`}
                  onClick={() => setSelectedStage(selectedStage === stage.id ? null : stage.id)}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <div className={`p-2 rounded-lg ${stage.bgColor}`}>
                        <stage.icon className={`w-5 h-5 ${stage.color}`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm">{stage.name}</h3>
                        <p className="text-xs text-gray-400">{stage.description}</p>
                      </div>
                    </div>
                    {getStatusIcon(stage.status)}
                  </div>

                  {/* Real-time metrics */}
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="text-center">
                      <div className="font-medium text-green-400">
                        {realTimeMetrics[stage.id]?.throughput || 0}
                      </div>
                      <div className="text-gray-400">req/min</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-blue-400">
                        {realTimeMetrics[stage.id]?.latency || 0}ms
                      </div>
                      <div className="text-gray-400">latency</div>
                    </div>
                    <div className="text-center">
                      <div className="font-medium text-purple-400">
                        {(realTimeMetrics[stage.id]?.success_rate || 99).toFixed(1)}%
                      </div>
                      <div className="text-gray-400">success</div>
                    </div>
                  </div>
                </motion.div>

                {index < pipelineStages.length - 1 && (
                  <ArrowRight className="w-6 h-6 text-chitty-primary flex-shrink-0" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Mobile Flow */}
        <div className="lg:hidden space-y-4">
          {pipelineStages.map((stage, index) => (
            <motion.div
              key={stage.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.05 }}
              className={`border rounded-xl p-4 ${
                selectedStage === stage.id
                  ? `${stage.borderColor} ${stage.bgColor}`
                  : 'border-white/10'
              }`}
              onClick={() => setSelectedStage(selectedStage === stage.id ? null : stage.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${stage.bgColor}`}>
                    <stage.icon className={`w-5 h-5 ${stage.color}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold">{stage.name}</h3>
                    <p className="text-sm text-gray-400">{stage.description}</p>
                  </div>
                </div>
                {getStatusIcon(stage.status)}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Security Notice */}
        <div className="mt-6 bg-gradient-to-r from-red-400/10 to-orange-400/10 border border-red-400/30 rounded-xl p-4">
          <div className="flex items-center space-x-2 mb-2">
            <Lock className="w-5 h-5 text-red-400" />
            <h3 className="font-semibold text-red-400">Security Enforced</h3>
          </div>
          <p className="text-sm text-gray-300">
            All ChittyID generation must pass through this complete pipeline. Direct access is prevented to ensure
            proper authentication, project validation, and trust evaluation.
          </p>
        </div>
      </motion.div>

      {/* Detailed Stage View */}
      {selectedStage && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glassmorphic rounded-2xl p-6"
        >
          {(() => {
            const stage = pipelineStages.find(s => s.id === selectedStage)
            return (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-3 rounded-xl ${stage.bgColor}`}>
                      <stage.icon className={`w-6 h-6 ${stage.color}`} />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold">{stage.name} Stage</h3>
                      <p className="text-gray-400">{stage.description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedStage(null)}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <Eye className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Features */}
                  <div>
                    <h4 className="font-semibold mb-3">Stage Features</h4>
                    <div className="space-y-2">
                      {stage.features.map((feature, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
                          <span className="text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Metrics Chart */}
                  <div>
                    <h4 className="font-semibold mb-3">Real-time Metrics</h4>
                    <div className="h-32">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={generateMetricsData(selectedStage)}>
                          <Area
                            type="monotone"
                            dataKey="throughput"
                            stroke={stage.color.replace('text-', '#')}
                            fill={stage.color.replace('text-', '#')}
                            fillOpacity={0.2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>

                {/* Current Metrics */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-black/20 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-green-400">
                      {realTimeMetrics[selectedStage]?.throughput || 0}
                    </div>
                    <div className="text-sm text-gray-400">Requests/min</div>
                  </div>
                  <div className="bg-black/20 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-blue-400">
                      {realTimeMetrics[selectedStage]?.latency || 0}ms
                    </div>
                    <div className="text-sm text-gray-400">Avg Latency</div>
                  </div>
                  <div className="bg-black/20 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-purple-400">
                      {(realTimeMetrics[selectedStage]?.success_rate || 99).toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-400">Success Rate</div>
                  </div>
                </div>
              </div>
            )
          })()}
        </motion.div>
      )}

      {/* Pipeline Metrics Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <div className="glassmorphic rounded-xl p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-400/10 rounded-lg">
              <Zap className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <div className="text-lg font-bold">147/min</div>
              <div className="text-xs text-gray-400">Pipeline Throughput</div>
            </div>
          </div>
        </div>

        <div className="glassmorphic rounded-xl p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-400/10 rounded-lg">
              <Clock className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="text-lg font-bold">23ms</div>
              <div className="text-xs text-gray-400">End-to-end Latency</div>
            </div>
          </div>
        </div>

        <div className="glassmorphic rounded-xl p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-400/10 rounded-lg">
              <Shield className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <div className="text-lg font-bold">99.2%</div>
              <div className="text-xs text-gray-400">Security Pass Rate</div>
            </div>
          </div>
        </div>

        <div className="glassmorphic rounded-xl p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-chitty-primary/10 rounded-lg">
              <Fingerprint className="w-5 h-5 text-chitty-primary" />
            </div>
            <div>
              <div className="text-lg font-bold">2,847</div>
              <div className="text-xs text-gray-400">IDs Generated Today</div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default PipelineStatus