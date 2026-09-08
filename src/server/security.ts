import crypto from 'crypto'

// ============================================================================
// PROJECT NEUROVAULT — Server-Side Coordinator Session
// ----------------------------------------------------------------------------
// Stateless, signed session token delivered as an HttpOnly cookie. Because
// Vercel serverless functions do not share memory between invocations, the
// session cannot live in a process-local Map — it must be self-verifying.
//
// Token shape:  base64url(payloadJSON) + "." + hex(HMAC-SHA256(payload))
// Payload:      { role: "coordinator", iat: <epoch ms>, exp: <epoch ms> }
//
// The signing secret comes from SESSION_SECRET (preferred) or falls back to
// COORDINATOR_PIN so a single env var still gets you a real, unforgeable
// session in a pinch. In production, at least one of these MUST be set —
// there is no silent fallback to a hardcoded secret.
// ============================================================================

export const COORDINATOR_SESSION_COOKIE = 'nv_coordinator_session'
const SESSION_TTL_MS = 8 * 60 * 60 * 1000 // 8 hours — long enough for one event day

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL === '1'
}

function getSessionSecret(): string {
  const explicit = process.env.SESSION_SECRET
  if (explicit && explicit.trim() !== '') return explicit.trim()

  const pin = process.env.COORDINATOR_PIN
  if (pin && pin.trim() !== '') return `pin-derived:${pin.trim()}`

  if (isProduction()) {
    throw new Error(
      '[CRITICAL] SESSION_SECRET (or at minimum COORDINATOR_PIN) must be set in production to sign coordinator sessions.'
    )
  }

  // Local development only — never reachable in production (guarded above).
  return 'dev-only-insecure-session-secret'
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('hex')
}

export function createCoordinatorSessionToken(now: number = Date.now()): string {
  const payload = JSON.stringify({ role: 'coordinator', iat: now, exp: now + SESSION_TTL_MS })
  const encoded = Buffer.from(payload, 'utf-8').toString('base64url')
  const signature = sign(encoded)
  return `${encoded}.${signature}`
}

export function verifyCoordinatorSessionToken(token: string | undefined | null, now: number = Date.now()): boolean {
  if (!token) return false
  const parts = token.split('.')
  if (parts.length !== 2) return false
  const [encoded, signature] = parts
  const expected = sign(encoded)

  // Constant-time comparison to avoid timing side-channels on the signature.
  const a = Buffer.from(signature, 'hex')
  const b = Buffer.from(expected, 'hex')
  if (a.length !== b.length || a.length === 0) return false
  if (!crypto.timingSafeEqual(a, b)) return false

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8'))
    if (payload.role !== 'coordinator') return false
    if (typeof payload.exp !== 'number' || payload.exp < now) return false
    return true
  } catch {
    return false
  }
}

export function parseCookies(header: string | string[] | undefined): Record<string, string> {
  const result: Record<string, string> = {}
  const raw = Array.isArray(header) ? header.join('; ') : header
  if (!raw) return result
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const key = part.slice(0, idx).trim()
    const value = part.slice(idx + 1).trim()
    if (!key) continue
    try {
      result[key] = decodeURIComponent(value)
    } catch {
      result[key] = value
    }
  }
  return result
}

export function buildSessionCookie(token: string): string {
  const secure = isProduction() ? '; Secure' : ''
  return `${COORDINATOR_SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${Math.floor(
    SESSION_TTL_MS / 1000
  )}${secure}`
}

export function buildClearSessionCookie(): string {
  const secure = isProduction() ? '; Secure' : ''
  return `${COORDINATOR_SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0${secure}`
}

/** Cryptographically-random alphanumeric token, e.g. for one-time deletion confirmation. */
export function generateRandomAlphanumeric(length: number): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // avoid ambiguous chars (0/O, 1/I)
  const bytes = crypto.randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length]
  }
  return out
}

export function generateId(prefix: string, length: number = 12): string {
  return `${prefix}_${crypto.randomBytes(length).toString('hex')}`
}
