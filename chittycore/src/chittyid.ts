/**
 * ChittyID - Universal Identifier for the ChittyOS Ecosystem
 *
 * ## Format
 * `VV-G-LLL-SSSS-T-YM-C-XXXXXXXXXXXXXXXXXX` (32 characters without dashes)
 *
 * ## Component Breakdown
 *
 * | Position | Component   | Length | Description                                    | Valid Values                        |
 * |----------|-------------|--------|------------------------------------------------|-------------------------------------|
 * | 1-2      | Version     | 2      | Format version                                 | 01-99                               |
 * | 3        | Governance  | 1      | Governance zone                                | C=Corp, P=Personal, G=Govt, O=Open  |
 * | 4-6      | Location    | 3      | Geographic/jurisdiction code                   | USA, EUR, GBL (global), etc.        |
 * | 7-10     | Sequence    | 4      | Sequential number within service               | 0000-9999                           |
 * | 11       | Type        | 1      | Entity type                                    | See entity types below              |
 * | 12-13    | YearMonth   | 2      | Creation timestamp (base36)                    | 00-ZZ                               |
 * | 14       | Checksum    | 1      | Validation checksum                            | A-Z                                 |
 * | 15-32    | Extension   | 18     | Service-specific extension / random identifier | Alphanumeric                        |
 *
 * ## Entity Types (Position 11)
 *
 * | Code | Type         | Description                    |
 * |------|--------------|--------------------------------|
 * | P    | Person       | Individual human identity      |
 * | L    | LLC          | Limited Liability Company      |
 * | C    | Corporation  | Corporate entity               |
 * | T    | Trust        | Trust entity                   |
 * | R    | Partnership  | Partnership entity             |
 * | E    | Estate       | Estate entity                  |
 * | S    | Service      | ChittyOS service               |
 * | D    | Document     | Document/file identity         |
 * | A    | Asset        | Digital or physical asset      |
 * | N    | Node         | Network node or device         |
 *
 * ## Example
 * ```
 * Formatted: 01-C-USA-0001-S-K7-X-MCPGATEWAY123456
 * Raw:       01CUSA0001SK7XMCPGATEWAY123456
 *
 * Breakdown:
 * - 01        = Version 1
 * - C         = Corporate governance
 * - USA       = United States jurisdiction
 * - 0001      = First in sequence
 * - S         = Service type
 * - K7        = Year/month (base36)
 * - X         = Checksum
 * - MCPGATEWAY123456 = Service-specific extension
 * ```
 *
 * @module chittyid
 */

/**
 * Parsed components of a ChittyID
 */
export interface ChittyIDComponents {
  /**
   * Format version (2 digits: 01-99)
   * @example "01"
   */
  version: string

  /**
   * Governance zone identifier
   * - C = Corporate
   * - P = Personal
   * - G = Government
   * - O = Open/Public
   * @example "C"
   */
  governance: string

  /**
   * Geographic/jurisdiction code (3 uppercase letters)
   * - USA = United States
   * - EUR = European Union
   * - GBL = Global (no specific jurisdiction)
   * - ILL = Illinois (state-level)
   * @example "USA"
   */
  location: string

  /**
   * Sequential number within the service (4 digits: 0000-9999)
   * @example "0001"
   */
  sequence: string

  /**
   * Entity type code (single uppercase letter)
   * - P = Person
   * - L = LLC
   * - C = Corporation
   * - T = Trust
   * - R = Partnership
   * - E = Estate
   * - S = Service
   * - D = Document
   * - A = Asset
   * - N = Node
   * @example "S"
   */
  type: string

  /**
   * Year/month encoded in base36 (2 characters)
   * Represents creation timestamp
   * @example "K7"
   */
  yearMonth: string

  /**
   * Single-character checksum for validation
   * @example "X"
   */
  checksum: string

  /**
   * Service-specific extension (18 characters)
   * Contains unique identifier or descriptive text
   * @example "MCPGATEWAY123456AB"
   */
  extension: string
}

/**
 * Valid entity type codes for ChittyID
 */
export const CHITTYID_ENTITY_TYPES = {
  P: 'person',
  L: 'llc',
  C: 'corporation',
  T: 'trust',
  R: 'partnership',
  E: 'estate',
  S: 'service',
  D: 'document',
  A: 'asset',
  N: 'node'
} as const

/**
 * Valid governance zone codes for ChittyID
 */
export const CHITTYID_GOVERNANCE_ZONES = {
  C: 'corporate',
  P: 'personal',
  G: 'government',
  O: 'open'
} as const

/**
 * Parses a ChittyID string into its component parts
 *
 * Accepts both formatted (with dashes) and raw (without dashes) ChittyIDs.
 * The raw ID must be exactly 32 characters.
 *
 * @param id - The ChittyID to parse (formatted or raw)
 * @returns Parsed components or null if invalid format
 *
 * @example
 * ```typescript
 * // With dashes
 * const components = parseChittyID('01-C-USA-0001-S-K7-X-MCPGATEWAY123456');
 *
 * // Without dashes
 * const components = parseChittyID('01CUSA0001SK7XMCPGATEWAY123456');
 *
 * // Result:
 * // {
 * //   version: '01',
 * //   governance: 'C',
 * //   location: 'USA',
 * //   sequence: '0001',
 * //   type: 'S',
 * //   yearMonth: 'K7',
 * //   checksum: 'X',
 * //   extension: 'MCPGATEWAY123456'
 * // }
 * ```
 */
export function parseChittyID(id: string): ChittyIDComponents | null {
  const clean = id.replace(/-/g, '')
  if (clean.length !== 32) return null

  return {
    version: clean.slice(0, 2),
    governance: clean.slice(2, 3),
    location: clean.slice(3, 6),
    sequence: clean.slice(6, 10),
    type: clean.slice(10, 11),
    yearMonth: clean.slice(11, 13),
    checksum: clean.slice(13, 14),
    extension: clean.slice(14, 32)
  }
}

/**
 * Formats ChittyID components into a canonical dash-separated string
 *
 * Produces the standard ChittyID format: VV-G-LLL-SSSS-T-YM-C-XXXXXXXXXXXXXXXXXX
 *
 * @param components - The ChittyID components to format
 * @returns Formatted ChittyID string with dashes
 *
 * @example
 * ```typescript
 * const id = formatChittyID({
 *   version: '01',
 *   governance: 'C',
 *   location: 'USA',
 *   sequence: '0001',
 *   type: 'S',
 *   yearMonth: 'K7',
 *   checksum: 'X',
 *   extension: 'MCPGATEWAY123456'
 * });
 * // Returns: '01-C-USA-0001-S-K7-X-MCPGATEWAY123456'
 * ```
 */
export function formatChittyID(components: ChittyIDComponents): string {
  const raw = [
    components.version,
    components.governance,
    components.location,
    components.sequence,
    components.type,
    components.yearMonth,
    components.checksum,
    components.extension
  ].join('')

  // Format as VV-G-LLL-SSSS-T-YM-C-X
  return `${raw.slice(0, 2)}-${raw.slice(2, 3)}-${raw.slice(3, 6)}-${raw.slice(6, 10)}-${raw.slice(10, 11)}-${raw.slice(11, 13)}-${raw.slice(13, 14)}-${raw.slice(14)}`
}

/**
 * Validates a ChittyID string for proper format and structure
 *
 * Checks:
 * - Total length is 32 characters (excluding dashes)
 * - Version is 2 digits
 * - Governance is single uppercase letter
 * - Location is 3 uppercase letters
 * - Sequence is 4 digits
 * - Type is single uppercase letter
 * - YearMonth is 2 alphanumeric characters
 *
 * @param id - The ChittyID to validate
 * @returns true if valid, false otherwise
 *
 * @example
 * ```typescript
 * validateChittyID('01-C-USA-0001-S-K7-X-MCPGATEWAY123456'); // true
 * validateChittyID('invalid'); // false
 * validateChittyID('01CUSA0001SK7XMCPGATEWAY123456'); // true (raw format)
 * ```
 */
export function validateChittyID(id: string): boolean {
  const parsed = parseChittyID(id)
  if (!parsed) return false

  // Basic validation
  if (!/^\d{2}$/.test(parsed.version)) return false
  if (!/^[A-Z]$/.test(parsed.governance)) return false
  if (!/^[A-Z]{3}$/.test(parsed.location)) return false
  if (!/^\d{4}$/.test(parsed.sequence)) return false
  if (!/^[A-Z]$/.test(parsed.type)) return false
  if (!/^[A-Z0-9]{2}$/.test(parsed.yearMonth)) return false

  return true
}

/**
 * Request options for obtaining a ChittyID from the ChittyID service
 */
export interface ChittyIDRequestOptions {
  /** Entity type (P=Person, L=LLC, C=Corporation, T=Trust, R=Partnership, E=Estate, S=Service, D=Document, A=Asset, N=Node) */
  type: 'P' | 'L' | 'C' | 'T' | 'R' | 'E' | 'S' | 'D' | 'A' | 'N'
  /** Governance zone (C=Corporate, P=Personal, G=Government, O=Open) */
  governance?: 'C' | 'P' | 'G' | 'O'
  /** Location/jurisdiction code (e.g., 'USA', 'EUR', 'GBL') */
  location?: string
  /** Optional descriptive extension hint */
  extensionHint?: string
}

/**
 * Requests a new ChittyID from the ChittyID service (id.chitty.cc)
 *
 * **IMPORTANT**: ChittyIDs must be requested from the central ChittyID service.
 * They are NOT generated locally. The ChittyID service is the sole authority
 * for issuing valid identifiers in the ChittyOS ecosystem.
 *
 * @param options - Request options specifying the entity type and optional metadata
 * @param serviceToken - Service authentication token for the request
 * @returns Promise resolving to the issued ChittyID
 *
 * @example
 * ```typescript
 * // Request a new ChittyID for a document
 * const chittyId = await requestChittyID({
 *   type: 'D',           // Document
 *   governance: 'C',     // Corporate
 *   location: 'USA'
 * }, serviceToken);
 * // Returns: '01-C-USA-0042-D-K7-X-EVIDENCEDOC12345'
 *
 * // Request a ChittyID for a service
 * const serviceId = await requestChittyID({
 *   type: 'S',
 *   extensionHint: 'MYSERVICE'
 * }, serviceToken);
 * ```
 *
 * @see https://id.chitty.cc/docs for API documentation
 */
export async function requestChittyID(
  options: ChittyIDRequestOptions,
  serviceToken: string
): Promise<string> {
  const response = await fetch('https://id.chitty.cc/api/issue', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceToken}`
    },
    body: JSON.stringify({
      type: options.type,
      governance: options.governance || 'C',
      location: options.location || 'GBL',
      extension_hint: options.extensionHint
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to request ChittyID: ${error}`)
  }

  const data = await response.json() as { chitty_id: string }
  return data.chitty_id
}

/**
 * Batch request multiple ChittyIDs from the ChittyID service
 *
 * Use this for bulk operations where multiple identifiers are needed.
 * More efficient than individual requests.
 *
 * @param requests - Array of request options
 * @param serviceToken - Service authentication token
 * @returns Promise resolving to array of issued ChittyIDs
 *
 * @example
 * ```typescript
 * const ids = await requestChittyIDBatch([
 *   { type: 'D', location: 'USA' },
 *   { type: 'D', location: 'USA' },
 *   { type: 'D', location: 'USA' }
 * ], serviceToken);
 * // Returns: ['01-C-USA-0043-D-...', '01-C-USA-0044-D-...', '01-C-USA-0045-D-...']
 * ```
 */
export async function requestChittyIDBatch(
  requests: ChittyIDRequestOptions[],
  serviceToken: string
): Promise<string[]> {
  const response = await fetch('https://id.chitty.cc/api/issue/batch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceToken}`
    },
    body: JSON.stringify({
      requests: requests.map(r => ({
        type: r.type,
        governance: r.governance || 'C',
        location: r.location || 'GBL',
        extension_hint: r.extensionHint
      }))
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to request ChittyID batch: ${error}`)
  }

  const data = await response.json() as { chitty_ids: string[] }
  return data.chitty_ids
}
