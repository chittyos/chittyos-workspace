/**
 * Intent Classification for Natural Language Gateway
 * Classifies user queries into actionable intents
 */

import { listServices, getService } from '@chittyos/core'
import type { ServiceRecord } from '@chittyos/core'

export type IntentCategory =
  | 'ServiceInquiry'      // "What is chittyauth?"
  | 'Installation'        // "How do I install chittyverify?"
  | 'Status'              // "Is chittyconnect running?"
  | 'Discovery'           // "What services handle authentication?"
  | 'Comparison'          // "Difference between chittyauth and chittyid?"
  | 'HowTo'               // "How do I verify a certificate?"
  | 'Troubleshooting'     // "Why isn't my auth working?"
  | 'ListAll'             // "Show me all services"
  | 'Unknown'

export interface ClassifiedIntent {
  category: IntentCategory
  confidence: number
  services: string[]
  keywords: string[]
  originalQuery: string
}

// Service name patterns - matches both "chittyauth" and "auth"
const SERVICE_PATTERN = /\b(chitty[a-z]+|auth|id|schema|registry|canon|beacon|verify|trust|certify|entry|router|connect|ledger|dna|finance|credit|resolution|brand|chat|flow|force|forge|mcp|docs|get|git)\b/gi

// Normalize service names: "chittyauth" → "auth", "auth" stays "auth"
function normalizeServiceName(name: string): string {
  const lower = name.toLowerCase()
  // If it starts with "chitty", strip it
  if (lower.startsWith('chitty')) {
    return lower.slice(6) // Remove "chitty" prefix
  }
  return lower
}

// Intent classification patterns
const INTENT_PATTERNS: { pattern: RegExp; category: IntentCategory; weight: number }[] = [
  // Installation
  { pattern: /\b(install|setup|get started|npm|brew|download)\b/i, category: 'Installation', weight: 0.9 },
  { pattern: /\bhow (do|can) I (get|install|setup)\b/i, category: 'Installation', weight: 0.95 },

  // Status
  { pattern: /\b(status|running|live|active|health|up|down)\b/i, category: 'Status', weight: 0.85 },
  { pattern: /\bis .+ (running|live|working)\b/i, category: 'Status', weight: 0.9 },

  // ServiceInquiry
  { pattern: /\bwhat (is|does|can)\b/i, category: 'ServiceInquiry', weight: 0.8 },
  { pattern: /\btell me about\b/i, category: 'ServiceInquiry', weight: 0.85 },
  { pattern: /\bexplain\b/i, category: 'ServiceInquiry', weight: 0.8 },

  // Discovery
  { pattern: /\b(which|what) (service|services?) (handle|for|do|can)\b/i, category: 'Discovery', weight: 0.9 },
  { pattern: /\bneed .+ (service|help with)\b/i, category: 'Discovery', weight: 0.85 },
  { pattern: /\brecommend\b/i, category: 'Discovery', weight: 0.8 },

  // Comparison
  { pattern: /\b(difference|compare|vs|versus|between)\b/i, category: 'Comparison', weight: 0.9 },
  { pattern: /\bwhich (one|should)\b/i, category: 'Comparison', weight: 0.75 },

  // HowTo
  { pattern: /\bhow (do|can|to)\b/i, category: 'HowTo', weight: 0.7 },
  { pattern: /\b(steps|guide|tutorial)\b/i, category: 'HowTo', weight: 0.8 },

  // Troubleshooting
  { pattern: /\b(error|issue|problem|not working|broken|fail|debug)\b/i, category: 'Troubleshooting', weight: 0.85 },
  { pattern: /\bwhy (isn't|isn't|doesn't|won't)\b/i, category: 'Troubleshooting', weight: 0.9 },

  // ListAll
  { pattern: /\b(list|show|all) (all |the )?(services?|available)\b/i, category: 'ListAll', weight: 0.95 },
  { pattern: /\bwhat services\b/i, category: 'ListAll', weight: 0.85 },
]

// Keyword to service mapping for discovery (use short names matching static registry)
const KEYWORD_SERVICE_MAP: Record<string, string[]> = {
  'auth': ['auth', 'id'],
  'authentication': ['auth', 'id'],
  'login': ['auth'],
  'identity': ['id', 'auth'],
  'verify': ['verify', 'certify'],
  'verification': ['verify'],
  'certificate': ['certify'],
  'cert': ['certify'],
  'connect': ['connect'],
  'connection': ['connect'],
  'api': ['connect'],
  'mcp': ['mcp'],
  'docs': ['docs'],
  'documentation': ['docs'],
  'registry': ['registry'],
  'register': ['registry'],
  'evidence': ['ledger'],
  'ledger': ['ledger'],
  'blockchain': ['ledger'],
  'chain': ['ledger'],
  'cases': ['resolution'],
  'legal': ['resolution'],
  'monitor': ['beacon'],
  'monitoring': ['beacon'],
  'beacon': ['beacon'],
  'discovery': ['get'],
  'storage': ['connect'],
  'data': ['schema', 'ledger'],
  'schema': ['schema'],
  'trust': ['trust', 'certify'],
  'package': ['git'],
  'install': ['git', 'get'],
  'finance': ['finance'],
  'credit': ['credit'],
  'brand': ['brand'],
  'chat': ['chat'],
  'flow': ['flow'],
  'force': ['force'],
  'forge': ['forge'],
  'dna': ['dna'],
  'canon': ['canon'],
}

export function classifyIntent(query: string): ClassifiedIntent {
  const normalizedQuery = query.toLowerCase().trim()

  // Extract mentioned services and normalize names
  const serviceMatches = query.match(SERVICE_PATTERN) || []
  const services = [...new Set(serviceMatches.map(s => normalizeServiceName(s)))]

  // Extract keywords that map to services
  const keywords: string[] = []
  const discoveredServices: string[] = []

  for (const [keyword, mappedServices] of Object.entries(KEYWORD_SERVICE_MAP)) {
    if (normalizedQuery.includes(keyword)) {
      keywords.push(keyword)
      discoveredServices.push(...mappedServices)
    }
  }

  // Combine explicit and discovered services
  const allServices = [...new Set([...services, ...discoveredServices])]

  // Score each intent category
  const scores: Map<IntentCategory, number> = new Map()

  for (const { pattern, category, weight } of INTENT_PATTERNS) {
    if (pattern.test(normalizedQuery)) {
      const current = scores.get(category) || 0
      scores.set(category, Math.max(current, weight))
    }
  }

  // Find best category
  let bestCategory: IntentCategory = 'Unknown'
  let bestScore = 0

  for (const [category, score] of scores) {
    if (score > bestScore) {
      bestScore = score
      bestCategory = category
    }
  }

  // If we found services but no clear intent, default to ServiceInquiry
  if (bestCategory === 'Unknown' && allServices.length > 0) {
    bestCategory = 'ServiceInquiry'
    bestScore = 0.6
  }

  return {
    category: bestCategory,
    confidence: bestScore,
    services: allServices,
    keywords: [...new Set(keywords)],
    originalQuery: query
  }
}

export interface IntentResponse {
  intent: ClassifiedIntent
  answer: string
  services?: ServiceRecord[]
  actions?: { label: string; url: string }[]
}

export async function handleIntent(intent: ClassifiedIntent): Promise<IntentResponse> {
  const response: IntentResponse = {
    intent,
    answer: '',
    actions: []
  }

  switch (intent.category) {
    case 'ServiceInquiry': {
      if (intent.services.length === 0) {
        response.answer = "I can help you learn about ChittyOS services. Which service would you like to know about?"
        response.actions = [
          { label: 'Browse all services', url: '/discover' },
          { label: 'Get recommendations', url: '/' }
        ]
      } else {
        const service = await getService(intent.services[0])
        if (service) {
          response.services = [service]
          response.answer = `**${service.service_name}** is a ${service.category} service. Status: ${service.status}.`
          response.actions = [
            { label: 'View docs', url: `https://docs.chitty.cc/${service.service_name}/` },
            { label: 'Install', url: `/onboard/${service.service_name}` }
          ]
        } else {
          response.answer = `I couldn't find information about "${intent.services[0]}". Try browsing all available services.`
          response.actions = [{ label: 'Browse services', url: '/discover' }]
        }
      }
      break
    }

    case 'Installation': {
      if (intent.services.length === 0) {
        response.answer = "To install a ChittyOS service, you can use our quick install script or package managers. Which service do you want to install?"
        response.actions = [
          { label: 'Browse services', url: '/discover' },
          { label: 'Package registry', url: 'https://git.chitty.cc/' }
        ]
      } else {
        const serviceName = intent.services[0]
        response.answer = `To install **${serviceName}**, use:\n\n\`\`\`bash\ncurl -fsSL https://git.chitty.cc/${serviceName}/install | bash\n\`\`\`\n\nOr visit the onboarding page for more options.`
        response.actions = [
          { label: 'Guided install', url: `/onboard/${serviceName}` },
          { label: 'Package info', url: `https://git.chitty.cc/${serviceName}.json` }
        ]
      }
      break
    }

    case 'Status': {
      if (intent.services.length === 0) {
        const services = await listServices({ status: 'Live' })
        response.services = services
        response.answer = `${services.length} services are currently live.`
        response.actions = [{ label: 'View all', url: '/discover' }]
      } else {
        const service = await getService(intent.services[0])
        if (service) {
          response.services = [service]
          response.answer = `**${service.service_name}** status: ${service.status}`
          if (service.exposes?.health) {
            response.actions = [
              { label: 'Health check', url: `https://api.chitty.cc/${service.service_name}/health` }
            ]
          }
        } else {
          response.answer = `Service "${intent.services[0]}" not found.`
        }
      }
      break
    }

    case 'Discovery': {
      const allServices = await listServices()
      const relevant = intent.services.length > 0
        ? allServices.filter(s => intent.services.includes(s.service_name))
        : allServices.filter(s =>
            intent.keywords.some(k =>
              s.service_name.includes(k) || s.category.toLowerCase().includes(k)
            )
          )

      if (relevant.length > 0) {
        response.services = relevant.slice(0, 5)
        response.answer = `Found ${relevant.length} service(s) matching your needs:`
        response.actions = relevant.slice(0, 3).map(s => ({
          label: s.service_name,
          url: `/onboard/${s.service_name}`
        }))
      } else {
        response.answer = "I couldn't find specific services for that. Try describing what you need."
        response.actions = [{ label: 'Browse all', url: '/discover' }]
      }
      break
    }

    case 'Comparison': {
      if (intent.services.length < 2) {
        response.answer = "To compare services, mention at least two service names. For example: 'What's the difference between chittyauth and chittyid?'"
      } else {
        const services = await Promise.all(intent.services.slice(0, 2).map(s => getService(s)))
        const valid = services.filter((s): s is ServiceRecord => s !== null)

        if (valid.length === 2) {
          response.services = valid
          response.answer = `**${valid[0].service_name}** (${valid[0].category}, ${valid[0].status}) vs **${valid[1].service_name}** (${valid[1].category}, ${valid[1].status})`
          response.actions = valid.map(s => ({
            label: `${s.service_name} docs`,
            url: `https://docs.chitty.cc/${s.service_name}/`
          }))
        } else {
          response.answer = "Couldn't find both services. Check the service names and try again."
        }
      }
      break
    }

    case 'HowTo': {
      if (intent.services.length > 0) {
        const service = await getService(intent.services[0])
        if (service) {
          response.services = [service]
          response.answer = `Check the documentation for ${service.service_name} for detailed guides.`
          response.actions = [
            { label: 'Documentation', url: `https://docs.chitty.cc/${service.service_name}/` },
            { label: 'API reference', url: `https://api.chitty.cc/${service.service_name}/` }
          ]
        }
      } else {
        response.answer = "What would you like to learn how to do? Mention a specific service or task."
        response.actions = [
          { label: 'All documentation', url: 'https://docs.chitty.cc/' }
        ]
      }
      break
    }

    case 'Troubleshooting': {
      response.answer = "For troubleshooting help, please check the service documentation or health endpoints."
      if (intent.services.length > 0) {
        response.actions = [
          { label: 'Health check', url: `https://api.chitty.cc/${intent.services[0]}/health` },
          { label: 'Documentation', url: `https://docs.chitty.cc/${intent.services[0]}/` }
        ]
      } else {
        response.actions = [{ label: 'Documentation', url: 'https://docs.chitty.cc/' }]
      }
      break
    }

    case 'ListAll': {
      const services = await listServices()
      response.services = services
      response.answer = `ChittyOS has ${services.length} registered services.`
      response.actions = [{ label: 'View all', url: '/discover' }]
      break
    }

    default: {
      response.answer = "I'm not sure what you're looking for. Try asking about a specific service, or describe what you need help with."
      response.actions = [
        { label: 'Browse services', url: '/discover' },
        { label: 'Get recommendations', url: '/' }
      ]
    }
  }

  return response
}
