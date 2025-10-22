import React from 'react'
import { motion } from 'framer-motion'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Area, AreaChart } from 'recharts'
import { Cpu, HardDrive, Wifi, Zap } from 'lucide-react'
import { useChittyOS } from '../contexts/ChittyOSContext'

const SystemMetrics = () => {
  const { realTimeData } = useChittyOS()

  // Mock time series data for charts
  const generateTimeSeriesData = (baseValue, variance = 10) => {
    return Array.from({ length: 20 }, (_, i) => ({
      time: i,
      value: baseValue + Math.random() * variance - variance / 2
    }))
  }

  const cpuData = generateTimeSeriesData(realTimeData?.cpuUsage || 25, 15)
  const memoryData = generateTimeSeriesData(realTimeData?.memoryUsage || 45, 10)
  const networkData = generateTimeSeriesData(realTimeData?.networkActivity || 750, 200)

  const metrics = [
    {
      title: 'CPU Usage',
      value: `${realTimeData?.cpuUsage || 25}%`,
      icon: Cpu,
      color: 'text-blue-400',
      bgColor: 'bg-blue-400/10',
      data: cpuData,
      chartColor: '#3B82F6'
    },
    {
      title: 'Memory',
      value: `${realTimeData?.memoryUsage || 45}%`,
      icon: HardDrive,
      color: 'text-green-400',
      bgColor: 'bg-green-400/10',
      data: memoryData,
      chartColor: '#10B981'
    },
    {
      title: 'Network',
      value: `${realTimeData?.networkActivity || 750} MB/s`,
      icon: Wifi,
      color: 'text-purple-400',
      bgColor: 'bg-purple-400/10',
      data: networkData,
      chartColor: '#8B5CF6'
    }
  ]

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.6 }}
      className="glassmorphic rounded-2xl p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold flex items-center space-x-2">
          <Zap className="w-5 h-5 text-yellow-400" />
          <span>System Performance</span>
        </h2>
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span className="text-xs text-green-400">Optimal</span>
        </div>
      </div>

      <div className="space-y-6">
        {metrics.map((metric, index) => (
          <motion.div
            key={metric.title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 + index * 0.1 }}
            className="bg-black/30 rounded-xl p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className={`${metric.bgColor} rounded-lg p-2`}>
                  <metric.icon className={`w-4 h-4 ${metric.color}`} />
                </div>
                <div>
                  <h3 className="font-medium">{metric.title}</h3>
                  <p className="text-xs text-gray-400">Real-time</p>
                </div>
              </div>
              <div className="text-right">
                <div className={`font-bold ${metric.color}`}>{metric.value}</div>
                <div className="text-xs text-gray-400">Current</div>
              </div>
            </div>

            <div className="h-16">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metric.data}>
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={metric.chartColor}
                    strokeWidth={2}
                    fill={`${metric.chartColor}20`}
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Overall Health */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="mt-6 bg-gradient-to-r from-green-400/10 to-emerald-400/10 border border-green-400/30 rounded-xl p-4"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-green-400">System Health</h3>
            <p className="text-xs text-gray-400">All systems operational</p>
          </div>
          <div className="text-2xl font-bold text-green-400">98.5%</div>
        </div>

        <div className="mt-3 bg-black/30 rounded-full h-2">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: '98.5%' }}
            transition={{ delay: 1.2, duration: 0.8 }}
            className="bg-gradient-to-r from-green-400 to-emerald-400 h-2 rounded-full"
          />
        </div>
      </motion.div>
    </motion.div>
  )
}

export default SystemMetrics