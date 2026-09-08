// ============================================================================
// PROJECT NEUROVAULT — Coordinator Server-Side Authentication
// ----------------------------------------------------------------------------
// Production Requirement: COORDINATOR_PIN environment variable is MANDATORY.
// In production, missing COORDINATOR_PIN throws a critical configuration error.
// ============================================================================

export function getExpectedCoordinatorPin(): string {
  const isProduction =
    process.env.NODE_ENV === 'production' || process.env.VERCEL === '1'
  const pin = process.env.COORDINATOR_PIN

  if (pin && pin.trim() !== '') {
    return pin.trim()
  }

  if (isProduction) {
    throw new Error(
      '[CRITICAL] COORDINATOR_PIN environment variable is required in production.'
    )
  }

  // Development default for local testing
  return '1234'
}

export function verifyCoordinatorPin(submittedPin: string): boolean {
  try {
    const expected = getExpectedCoordinatorPin()
    return submittedPin.trim() === expected
  } catch (err) {
    console.error('Coordinator auth failure:', err)
    return false
  }
}

// ----------------------------------------------------------------------------
// NOTE: PIN verification alone is NOT a session. A successful PIN check must
// be turned into a signed, HttpOnly-cookie-backed session token (see
// src/server/security.ts: createCoordinatorSessionToken / buildSessionCookie)
// before any coordinator-only route can trust the caller. apiRouter.ts wires
// this together on POST /api/auth/coordinator/login and re-verifies the
// session cookie server-side on every coordinator-only request — it never
// relies on a client-side flag (e.g. sessionStorage) as proof of identity.
// ----------------------------------------------------------------------------

