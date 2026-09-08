// ============================================================================
// PROJECT NEUROVAULT — Server-Side Contact Validation
// ----------------------------------------------------------------------------
// Mobile number format support is intentionally scoped to common Indian
// formats per the event brief: a bare 10-digit number, a "+91 " prefixed
// number, or a "+91" prefixed number with no space. This is validated and
// normalized SERVER-SIDE — the client may also validate for UX, but the
// server never trusts it.
// ============================================================================

/**
 * Normalizes a mobile number to a canonical `+91XXXXXXXXXX` form.
 * Returns null if the input cannot be recognized as a valid Indian mobile
 * number (10 digits, starting 6-9, after stripping the country code).
 *
 * Accepts: "8921151978", "+91 8921151978", "+918921151978",
 * "091 8921151978", with any amount of internal whitespace/hyphens.
 */
export function normalizeIndianMobile(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  let digitsAndPlus = raw.trim().replace(/[\s\-().]/g, '')
  if (digitsAndPlus === '') return null

  // Strip a leading country/trunk prefix down to the bare 10-digit number.
  if (digitsAndPlus.startsWith('+91')) {
    digitsAndPlus = digitsAndPlus.slice(3)
  } else if (digitsAndPlus.startsWith('0091')) {
    digitsAndPlus = digitsAndPlus.slice(4)
  } else if (digitsAndPlus.startsWith('91') && digitsAndPlus.length === 12) {
    digitsAndPlus = digitsAndPlus.slice(2)
  } else if (digitsAndPlus.startsWith('0') && digitsAndPlus.length === 11) {
    digitsAndPlus = digitsAndPlus.slice(1)
  }

  // Must now be exactly 10 digits, first digit 6-9 (valid Indian mobile prefixes).
  if (!/^[6-9]\d{9}$/.test(digitsAndPlus)) return null

  return `+91${digitsAndPlus}`
}
