import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../state/store'

export default function CoordinatorLogin() {
  const navigate = useNavigate()
  const { coordinatorLogin } = useStore()
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function submit() {
    if (!pin.trim() || loading) return
    setLoading(true)
    setError(false)
    setErrorMessage('')

    // NOTE: there is intentionally no offline/hardcoded-PIN fallback here.
    // Authentication is verified server-side on every request via a signed,
    // HttpOnly session cookie (see src/server/security.ts) — never a
    // client-side flag.
    const ok = await coordinatorLogin(pin.trim())
    if (ok) {
      navigate('/coordinator')
    } else {
      setError(true)
      setErrorMessage('INCORRECT PIN OR SERVER UNREACHABLE')
      setPin('')
      setTimeout(() => setError(false), 1500)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div
        className={`w-full max-w-sm rounded-md p-8 flex flex-col items-center gap-6 ${error ? 'shake' : ''}`}
        style={{ background: 'var(--bg-panel)', border: '1px solid var(--line)' }}
      >
        <div className="text-center">
          <div className="font-display text-xl sm:text-2xl font-bold tracking-[0.2em]" style={{ color: 'var(--text-hi)' }}>
            PROJECT NEUROVAULT
          </div>
          <div className="font-mono text-xs tracking-[0.25em] mt-1" style={{ color: 'var(--cyan)' }}>
            COORDINATOR AUTHENTICATION
          </div>
          <div className="font-mono text-[11px] tracking-wider mt-2" style={{ color: 'var(--text-dim)' }}>
            ENTER SECURE PIN TO PROCEED
          </div>
        </div>

        <input
          type="password"
          inputMode="numeric"
          value={pin}
          autoFocus
          disabled={loading}
          onChange={(e) => setPin(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          className="digit-box w-full text-center text-2xl tracking-[0.4em] rounded-sm py-3 outline-none"
          style={{
            background: 'var(--bg-raised)',
            border: `1px solid ${error ? 'var(--red)' : 'var(--line)'}`,
            color: 'var(--text-hi)',
          }}
        />

        {error && (
          <div className="font-mono text-xs tracking-widest text-center" style={{ color: 'var(--red)' }}>
            {errorMessage || 'INCORRECT PIN'}
          </div>
        )}

        <button
          onClick={submit}
          disabled={loading || !pin.trim()}
          className="font-display uppercase tracking-[0.2em] text-sm font-semibold w-full py-3 rounded-sm transition-opacity disabled:opacity-40"
          style={{ background: 'var(--cyan)', color: 'var(--bg-void)' }}
        >
          {loading ? 'Authenticating...' : 'Unlock Terminal'}
        </button>
      </div>
    </div>
  )
}
