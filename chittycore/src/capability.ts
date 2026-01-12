/**
 * Capability Framework - Accountable, Traceable Execution
 *
 * Core principle: Capabilities are the ONLY path to functionality.
 * Every invocation is tracked, every outcome recorded, every context held accountable.
 *
 * Architecture:
 * - Elements: Pure types (this file)
 * - Chemists: Services that export capabilities, not raw functions
 * - Connector: ChittyConnect manages the capability registry
 * - Alchemists: Compose capabilities with full provenance
 */

import type { ChittyContext, ContextGrade } from './types'

// ============================================================
// Core Capability Types
// ============================================================

/**
 * Capability status in rollout lifecycle
 */
export type CapabilityStatus =
  | 'experimental'  // Only test contexts
  | 'limited'       // Opt-in for real contexts
  | 'general'       // Available to all qualifying contexts
  | 'deprecated'    // Being phased out
  | 'quarantined'   // Temporarily disabled due to issues

/**
 * Gate types for rollout progression
 */
export type RolloutGateType =
  | 'usage_count'    // N successful invocations
  | 'success_rate'   // % of invocations successful
  | 'time_in_status' // Hours in current status
  | 'manual_approval'// Requires explicit approval
  | 'failure_rate'   // For demotion: % failures

/**
 * Rollout rule for capability progression/regression
 */
export interface RolloutRule {
  gate: RolloutGateType
  threshold: number
  direction: 'promote' | 'demote'
  targetStatus: CapabilityStatus
  windowHours?: number  // Time window for rate calculations
}

/**
 * Capability definition - what a Chemist exposes
 */
export interface CapabilityDefinition<TInput = unknown, TOutput = unknown> {
  id: string                        // Unique identifier: 'domain.action'
  name: string                      // Human-readable name
  version: string                   // Semantic version
  domain: string                    // Owning Chemist domain
  description: string               // What this capability does
  status: CapabilityStatus          // Current rollout status
  requiredContextGrade: ContextGrade // Minimum trust level
  rolloutRules: RolloutRule[]       // Promotion/demotion criteria
  dependencies?: string[]           // Required upstream capabilities
  tags?: string[]                   // For discovery/filtering

  // Type markers (for TypeScript inference)
  _inputType?: TInput
  _outputType?: TOutput
}

/**
 * Provenance record - the "receipt" for every capability invocation
 */
export interface Provenance {
  invocationId: string
  capabilityId: string
  capabilityVersion: string
  contextId: string
  chittyId: string
  timestamp: string
  inputHash: string       // SHA-256 of input (privacy-preserving)
  parentProvenances?: string[]  // Upstream capability invocations
}

/**
 * Capability result - you can't get the value without the provenance
 * This is the key to leak-proof traceability
 */
export interface CapabilityResult<T> {
  value: T
  provenance: Provenance
  success: true
}

/**
 * Capability failure result
 */
export interface CapabilityFailure {
  error: string
  errorCode: string
  provenance: Provenance
  success: false
  recoverable: boolean
}

/**
 * Union type for all capability outcomes
 */
export type CapabilityOutcome<T> = CapabilityResult<T> | CapabilityFailure

/**
 * Invocation record - for metrics and accountability
 */
export interface CapabilityInvocation {
  invocationId: string
  capabilityId: string
  capabilityVersion: string
  contextId: string
  chittyId: string
  status: CapabilityStatus
  timestamp: string
  durationMs: number
  success: boolean
  errorCode?: string
  inputHash: string
  outputHash?: string
  parentInvocations?: string[]
}

/**
 * Capability metrics - aggregated for rollout decisions
 */
export interface CapabilityMetrics {
  capabilityId: string
  windowStart: string
  windowEnd: string
  totalInvocations: number
  successCount: number
  failureCount: number
  successRate: number
  avgDurationMs: number
  uniqueContexts: number
  errorBreakdown: Record<string, number>
}

// ============================================================
// Capability Registry Types
// ============================================================

/**
 * Registry entry - combines definition with runtime state
 */
export interface CapabilityRegistryEntry<TInput = unknown, TOutput = unknown> {
  definition: CapabilityDefinition<TInput, TOutput>
  metrics: CapabilityMetrics
  lastStatusChange: string
  statusHistory: Array<{
    from: CapabilityStatus
    to: CapabilityStatus
    reason: string
    timestamp: string
    triggeredBy: 'rollout_rule' | 'manual' | 'incident'
  }>
}

/**
 * Context-capability authorization matrix
 */
export interface ContextCapabilityAuth {
  contextId: string
  chittyId: string
  contextGrade: ContextGrade
  enabledCapabilities: string[]  // Explicitly enabled
  disabledCapabilities: string[] // Explicitly disabled (overrides)
  capabilityOverrides: Record<string, {
    reason: string
    expiresAt?: string
    grantedBy: string
  }>
}

// ============================================================
// Capability Execution
// ============================================================

/**
 * Execution context passed to capability handler
 */
export interface CapabilityExecutionContext {
  context: ChittyContext
  invocationId: string
  parentProvenances?: Provenance[]
}

/**
 * Capability handler function type
 */
export type CapabilityHandler<TInput, TOutput> = (
  execCtx: CapabilityExecutionContext,
  input: TInput
) => Promise<TOutput>

/**
 * Runnable capability - the actual executable unit
 */
export interface RunnableCapability<TInput, TOutput> {
  definition: CapabilityDefinition<TInput, TOutput>

  /**
   * Check if a context can invoke this capability
   */
  canInvoke(context: ChittyContext): CapabilityAccessCheck

  /**
   * Execute the capability with full provenance
   */
  invoke(
    context: ChittyContext,
    input: TInput,
    parentProvenances?: Provenance[]
  ): Promise<CapabilityOutcome<TOutput>>

  /**
   * Get current metrics (in-memory, synchronous)
   */
  getMetrics(): CapabilityMetrics

  /**
   * Get metrics from persistent store (async)
   * Falls back to in-memory if no store configured
   */
  getPersistedMetrics(): Promise<CapabilityMetrics>
}

/**
 * Access check result
 */
export interface CapabilityAccessCheck {
  allowed: boolean
  reason: string
  missingGrade?: ContextGrade
  blockedBy?: 'status' | 'grade' | 'override' | 'dependency'
}

// ============================================================
// Capability State Store Interface
// ============================================================

/**
 * Interface for persistent capability state storage
 * Domain services implement this to persist invocations to their own storage (D1, etc.)
 */
export interface CapabilityStateStore {
  /**
   * Record an invocation (async, fire-and-forget OK)
   */
  recordInvocation(invocation: CapabilityInvocation): Promise<void>

  /**
   * Get metrics for a capability (can return cached or calculate fresh)
   */
  getMetrics(capabilityId: string): Promise<CapabilityMetrics>

  /**
   * Get current status for a capability (for status overrides from rollout engine)
   */
  getStatus?(capabilityId: string): Promise<CapabilityStatus | null>
}

// ============================================================
// Capability Factory
// ============================================================

/**
 * Options for defining a capability
 */
export interface DefineCapabilityOptions<TInput, TOutput> {
  id: string
  name: string
  version: string
  domain: string
  description: string
  status?: CapabilityStatus
  requiredContextGrade?: ContextGrade
  rolloutRules?: RolloutRule[]
  dependencies?: string[]
  tags?: string[]
  handler: CapabilityHandler<TInput, TOutput>
  /**
   * Optional external state store for persistent invocation tracking
   * If not provided, invocations are tracked in-memory (lost on request end)
   */
  stateStore?: CapabilityStateStore
}

/**
 * Internal state for a capability instance (fallback when no store provided)
 */
interface CapabilityState {
  invocations: CapabilityInvocation[]
  metricsWindow: number  // Hours
}

/**
 * Hash input for privacy-preserving provenance
 */
async function hashInput(input: unknown): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(JSON.stringify(input))
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Create provenance record
 */
function createProvenance(
  capabilityId: string,
  capabilityVersion: string,
  context: ChittyContext,
  inputHash: string,
  parentProvenances?: Provenance[]
): Provenance {
  return {
    invocationId: crypto.randomUUID(),
    capabilityId,
    capabilityVersion,
    contextId: context.id,
    chittyId: context.chittyId,
    timestamp: new Date().toISOString(),
    inputHash,
    parentProvenances: parentProvenances?.map(p => p.invocationId)
  }
}

/**
 * Calculate metrics from invocation history
 */
function calculateMetrics(
  capabilityId: string,
  invocations: CapabilityInvocation[],
  windowHours: number
): CapabilityMetrics {
  const now = new Date()
  const windowStart = new Date(now.getTime() - windowHours * 60 * 60 * 1000)

  const windowInvocations = invocations.filter(
    inv => new Date(inv.timestamp) >= windowStart
  )

  const successCount = windowInvocations.filter(inv => inv.success).length
  const failureCount = windowInvocations.length - successCount

  const errorBreakdown: Record<string, number> = {}
  for (const inv of windowInvocations) {
    if (inv.errorCode) {
      errorBreakdown[inv.errorCode] = (errorBreakdown[inv.errorCode] || 0) + 1
    }
  }

  const uniqueContexts = new Set(windowInvocations.map(inv => inv.contextId)).size
  const avgDuration = windowInvocations.length > 0
    ? windowInvocations.reduce((sum, inv) => sum + inv.durationMs, 0) / windowInvocations.length
    : 0

  return {
    capabilityId,
    windowStart: windowStart.toISOString(),
    windowEnd: now.toISOString(),
    totalInvocations: windowInvocations.length,
    successCount,
    failureCount,
    successRate: windowInvocations.length > 0 ? successCount / windowInvocations.length : 0,
    avgDurationMs: avgDuration,
    uniqueContexts,
    errorBreakdown
  }
}

/**
 * Check if context meets capability requirements
 */
function checkAccess(
  definition: CapabilityDefinition,
  context: ChittyContext
): CapabilityAccessCheck {
  // Check capability status
  if (definition.status === 'quarantined') {
    return {
      allowed: false,
      reason: 'Capability is quarantined due to operational issues',
      blockedBy: 'status'
    }
  }

  if (definition.status === 'experimental') {
    // Only test contexts (metadata.isTest = true) can use experimental
    if (!context.metadata?.isTest) {
      return {
        allowed: false,
        reason: 'Experimental capabilities only available to test contexts',
        blockedBy: 'status'
      }
    }
  }

  // Check context grade
  const gradeOrder: ContextGrade[] = ['F', 'D', 'C', 'B', 'A']
  const requiredIndex = gradeOrder.indexOf(definition.requiredContextGrade)
  const contextIndex = gradeOrder.indexOf(context.grade)

  if (contextIndex < requiredIndex) {
    return {
      allowed: false,
      reason: `Context grade ${context.grade} insufficient, requires ${definition.requiredContextGrade}`,
      missingGrade: definition.requiredContextGrade,
      blockedBy: 'grade'
    }
  }

  return {
    allowed: true,
    reason: 'Access granted'
  }
}

/**
 * Define a capability with automatic instrumentation
 * This is the factory function Chemists use to create capabilities
 */
export function defineCapability<TInput, TOutput>(
  options: DefineCapabilityOptions<TInput, TOutput>
): RunnableCapability<TInput, TOutput> {

  const definition: CapabilityDefinition<TInput, TOutput> = {
    id: options.id,
    name: options.name,
    version: options.version,
    domain: options.domain,
    description: options.description,
    status: options.status || 'experimental',
    requiredContextGrade: options.requiredContextGrade || 'C',
    rolloutRules: options.rolloutRules || [
      // Default: promote after 100 successes
      { gate: 'usage_count', threshold: 100, direction: 'promote', targetStatus: 'limited' },
      // Promote to general after 95% success over 1000 invocations
      { gate: 'success_rate', threshold: 0.95, direction: 'promote', targetStatus: 'general', windowHours: 168 },
      // Demote/quarantine if failure rate exceeds 20%
      { gate: 'failure_rate', threshold: 0.20, direction: 'demote', targetStatus: 'quarantined', windowHours: 24 }
    ],
    dependencies: options.dependencies,
    tags: options.tags
  }

  // Internal state (in production, this would be backed by durable storage)
  const state: CapabilityState = {
    invocations: [],
    metricsWindow: 168  // 7 days default
  }

  return {
    definition,

    canInvoke(context: ChittyContext): CapabilityAccessCheck {
      return checkAccess(definition, context)
    },

    async invoke(
      context: ChittyContext,
      input: TInput,
      parentProvenances?: Provenance[]
    ): Promise<CapabilityOutcome<TOutput>> {
      const startTime = Date.now()
      const inputHash = await hashInput(input)
      const provenance = createProvenance(
        definition.id,
        definition.version,
        context,
        inputHash,
        parentProvenances
      )

      // Helper to record invocation (to store or in-memory)
      const recordInvocation = async (invocation: CapabilityInvocation) => {
        if (options.stateStore) {
          // Await the store write - fire-and-forget doesn't work in Workers
          try {
            await options.stateStore.recordInvocation(invocation)
          } catch (err) {
            console.error(`[Capability] Failed to persist invocation: ${err}`)
          }
        }
        // Always track in-memory too (for immediate metrics)
        state.invocations.push(invocation)
      }

      // Check access first
      const accessCheck = checkAccess(definition, context)
      if (!accessCheck.allowed) {
        const invocation: CapabilityInvocation = {
          invocationId: provenance.invocationId,
          capabilityId: definition.id,
          capabilityVersion: definition.version,
          contextId: context.id,
          chittyId: context.chittyId,
          status: definition.status,
          timestamp: provenance.timestamp,
          durationMs: Date.now() - startTime,
          success: false,
          errorCode: 'ACCESS_DENIED',
          inputHash,
          parentInvocations: parentProvenances?.map(p => p.invocationId)
        }
        await recordInvocation(invocation)

        return {
          error: accessCheck.reason,
          errorCode: 'ACCESS_DENIED',
          provenance,
          success: false,
          recoverable: false
        }
      }

      // Execute the handler
      try {
        const execCtx: CapabilityExecutionContext = {
          context,
          invocationId: provenance.invocationId,
          parentProvenances
        }

        const result = await options.handler(execCtx, input)
        const durationMs = Date.now() - startTime

        // Record successful invocation
        const invocation: CapabilityInvocation = {
          invocationId: provenance.invocationId,
          capabilityId: definition.id,
          capabilityVersion: definition.version,
          contextId: context.id,
          chittyId: context.chittyId,
          status: definition.status,
          timestamp: provenance.timestamp,
          durationMs,
          success: true,
          inputHash,
          outputHash: await hashInput(result),
          parentInvocations: parentProvenances?.map(p => p.invocationId)
        }
        await recordInvocation(invocation)

        return {
          value: result,
          provenance,
          success: true
        }

      } catch (err) {
        const durationMs = Date.now() - startTime
        const errorCode = err instanceof Error && 'code' in err
          ? String((err as { code: unknown }).code)
          : 'UNKNOWN_ERROR'

        // Record failed invocation
        const invocation: CapabilityInvocation = {
          invocationId: provenance.invocationId,
          capabilityId: definition.id,
          capabilityVersion: definition.version,
          contextId: context.id,
          chittyId: context.chittyId,
          status: definition.status,
          timestamp: provenance.timestamp,
          durationMs,
          success: false,
          errorCode,
          inputHash,
          parentInvocations: parentProvenances?.map(p => p.invocationId)
        }
        await recordInvocation(invocation)

        return {
          error: err instanceof Error ? err.message : String(err),
          errorCode,
          provenance,
          success: false,
          recoverable: true
        }
      }
    },

    getMetrics(): CapabilityMetrics {
      // In-memory metrics (for immediate access)
      // For persistent metrics, use the store's getMetrics directly
      return calculateMetrics(definition.id, state.invocations, state.metricsWindow)
    },

    /**
     * Get metrics from persistent store (async)
     * Falls back to in-memory if no store configured
     */
    async getPersistedMetrics(): Promise<CapabilityMetrics> {
      if (options.stateStore) {
        return options.stateStore.getMetrics(definition.id)
      }
      return calculateMetrics(definition.id, state.invocations, state.metricsWindow)
    }
  }
}

// ============================================================
// Provenance Helpers
// ============================================================

/**
 * Extract provenance from a capability result for downstream use
 */
export function extractProvenance<T>(result: CapabilityResult<T>): Provenance {
  return result.provenance
}

/**
 * Require provenance from upstream capability
 * Use this when a capability depends on output from another capability
 */
export function requireProvenance<T>(
  result: CapabilityOutcome<T>
): asserts result is CapabilityResult<T> {
  if (!result.success) {
    throw new Error(`Upstream capability failed: ${result.error} (${result.errorCode})`)
  }
}

/**
 * Check if result is successful
 */
export function isSuccess<T>(result: CapabilityOutcome<T>): result is CapabilityResult<T> {
  return result.success === true
}

/**
 * Check if result is a failure
 */
export function isFailure<T>(result: CapabilityOutcome<T>): result is CapabilityFailure {
  return result.success === false
}

// ============================================================
// Rollout Engine
// ============================================================

/**
 * Evaluate rollout rules against current metrics
 */
export function evaluateRolloutRules(
  definition: CapabilityDefinition,
  metrics: CapabilityMetrics
): { shouldTransition: boolean; newStatus?: CapabilityStatus; triggeredRule?: RolloutRule } {

  for (const rule of definition.rolloutRules) {
    let meetsThreshold = false

    switch (rule.gate) {
      case 'usage_count':
        meetsThreshold = metrics.totalInvocations >= rule.threshold
        break

      case 'success_rate':
        meetsThreshold = metrics.totalInvocations > 0 &&
          metrics.successRate >= rule.threshold
        break

      case 'failure_rate':
        const failureRate = metrics.totalInvocations > 0
          ? metrics.failureCount / metrics.totalInvocations
          : 0
        meetsThreshold = failureRate >= rule.threshold
        break

      case 'time_in_status':
        // Would need statusHistory to evaluate
        break

      case 'manual_approval':
        // Requires external approval system
        break
    }

    if (meetsThreshold) {
      // For promotions, only if current status is below target
      if (rule.direction === 'promote') {
        const statusOrder: CapabilityStatus[] = ['quarantined', 'deprecated', 'experimental', 'limited', 'general']
        const currentIndex = statusOrder.indexOf(definition.status)
        const targetIndex = statusOrder.indexOf(rule.targetStatus)

        if (targetIndex > currentIndex) {
          return {
            shouldTransition: true,
            newStatus: rule.targetStatus,
            triggeredRule: rule
          }
        }
      }

      // For demotions, only if current status is above target
      if (rule.direction === 'demote') {
        const statusOrder: CapabilityStatus[] = ['quarantined', 'deprecated', 'experimental', 'limited', 'general']
        const currentIndex = statusOrder.indexOf(definition.status)
        const targetIndex = statusOrder.indexOf(rule.targetStatus)

        if (currentIndex > targetIndex) {
          return {
            shouldTransition: true,
            newStatus: rule.targetStatus,
            triggeredRule: rule
          }
        }
      }
    }
  }

  return { shouldTransition: false }
}
