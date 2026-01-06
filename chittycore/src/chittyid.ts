/**
 * ChittyID utilities
 */

// ChittyID Format: VV-G-LLL-SSSS-T-YM-C-X (32 chars)

export interface ChittyIDComponents {
  version: string      // VV
  governance: string   // G
  location: string     // LLL
  sequence: string     // SSSS
  type: string         // T
  yearMonth: string    // YM
  checksum: string     // C
  extension: string    // X
}

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
