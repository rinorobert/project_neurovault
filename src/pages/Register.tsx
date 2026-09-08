import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../state/store'

export default function Register() {
  const { registerTeam } = useStore()
  const [teamName, setTeamName] = useState('')
  const [players, setPlayers] = useState(['', '', '', ''])
  const [captain, setCaptain] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactMobile, setContactMobile] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  function setPlayer(i: number, value: string) {
    setPlayers((p) => p.map((existing, idx) => (idx === i ? value : existing)))
  }

  async function submit() {
    setError(null)
    const cleanPlayers = players.map((p) => p.trim())
    if (!teamName.trim()) return setError('Team name is required.')
    if (cleanPlayers.some((p) => !p)) return setError('All 4 player names are required.')
    if (!captain || !cleanPlayers.includes(captain)) return setError('Select a captain from your 4 players.')
    if (!contactEmail.trim().includes('@')) return setError('A valid contact email is required.')
    const mobileDigits = contactMobile.replace(/[\s\-().]/g, '').replace(/^\+?91/, '').replace(/^0/, '')
    if (!/^[6-9]\d{9}$/.test(mobileDigits)) {
      return setError('A valid team contact mobile number is required (e.g. 8921151978 or +91 8921151978).')
    }

    setSubmitting(true)
    const result = await registerTeam({
      teamName: teamName.trim(),
      players: cleanPlayers,
      captain,
      contactEmail: contactEmail.trim(),
      contactMobile: contactMobile.trim(),
    })
    setSubmitting(false)
    if (!result.ok) {
      setError(result.error ?? 'Registration failed. Please try again.')
      return
    }
    setSuccess(
      `Registration received for "${teamName.trim()}". Your team is now PENDING coordinator approval — ` +
        `you'll be notified at ${contactEmail.trim()} once approved.`
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="font-display text-2xl font-bold tracking-[0.2em]" style={{ color: 'var(--green)' }}>
          REGISTRATION RECEIVED
        </div>
        <div className="font-mono text-sm max-w-md" style={{ color: 'var(--text-mid)' }}>
          {success}
        </div>
        <Link to="/" className="font-mono text-xs tracking-widest hover:underline" style={{ color: 'var(--cyan)' }}>
          ← Return Home
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-6 py-12">
      <div className="text-center">
        <div className="font-display text-2xl sm:text-3xl font-bold tracking-[0.2em]" style={{ color: 'var(--text-hi)' }}>
          PROJECT NEUROVAULT
        </div>
        <div className="font-mono text-xs tracking-[0.3em] mt-2" style={{ color: 'var(--cyan)' }}>
          TEAM REGISTRATION
        </div>
      </div>

      <div
        className="w-full max-w-md rounded-md p-6 flex flex-col gap-4"
        style={{ background: 'var(--bg-panel)', border: '1px solid var(--line)' }}
      >
        <label className="font-mono text-xs flex flex-col gap-1" style={{ color: 'var(--text-mid)' }}>
          Team Name
          <input
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            className="font-mono text-sm rounded-sm px-3 py-2 outline-none"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--line)', color: 'var(--text-hi)' }}
          />
        </label>

        {players.map((p, i) => (
          <label key={i} className="font-mono text-xs flex flex-col gap-1" style={{ color: 'var(--text-mid)' }}>
            Player {i + 1}
            <input
              value={p}
              onChange={(e) => setPlayer(i, e.target.value)}
              className="font-mono text-sm rounded-sm px-3 py-2 outline-none"
              style={{ background: 'var(--bg-raised)', border: '1px solid var(--line)', color: 'var(--text-hi)' }}
            />
          </label>
        ))}

        <label className="font-mono text-xs flex flex-col gap-1" style={{ color: 'var(--text-mid)' }}>
          Captain
          <select
            value={captain}
            onChange={(e) => setCaptain(e.target.value)}
            className="font-mono text-sm rounded-sm px-3 py-2 outline-none"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--line)', color: 'var(--text-hi)' }}
          >
            <option value="">Select captain...</option>
            {players.filter(Boolean).map((p, i) => (
              <option key={i} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <label className="font-mono text-xs flex flex-col gap-1" style={{ color: 'var(--text-mid)' }}>
          Contact Email
          <input
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            className="font-mono text-sm rounded-sm px-3 py-2 outline-none"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--line)', color: 'var(--text-hi)' }}
          />
        </label>

        <label className="font-mono text-xs flex flex-col gap-1" style={{ color: 'var(--text-mid)' }}>
          Team Contact Mobile Number
          <input
            type="tel"
            placeholder="e.g. 8921151978 or +91 8921151978"
            value={contactMobile}
            onChange={(e) => setContactMobile(e.target.value)}
            className="font-mono text-sm rounded-sm px-3 py-2 outline-none"
            style={{ background: 'var(--bg-raised)', border: '1px solid var(--line)', color: 'var(--text-hi)' }}
          />
        </label>

        {error && (
          <div className="font-mono text-xs" style={{ color: 'var(--red)' }}>
            {error}
          </div>
        )}

        <button
          onClick={submit}
          disabled={submitting}
          className="font-display uppercase tracking-[0.2em] text-sm font-semibold py-3 rounded-sm disabled:opacity-40"
          style={{ background: 'var(--cyan)', color: 'var(--bg-void)' }}
        >
          {submitting ? 'Submitting...' : 'Submit Registration'}
        </button>
      </div>

      <Link to="/" className="font-mono text-xs tracking-widest hover:underline" style={{ color: 'var(--text-dim)' }}>
        ← Back Home
      </Link>
    </div>
  )
}
