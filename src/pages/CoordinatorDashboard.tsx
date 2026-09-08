import { useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useStore } from '../state/store'
import { TeamSelector } from '../components/TeamSelector'
import { PuzzleConfigPanel } from '../components/PuzzleConfigPanel'
import { ControlsPanel } from '../components/ControlsPanel'
import { HintPanel } from '../components/HintPanel'
import { TeamManagerPanel } from '../components/TeamManagerPanel'
import { TeamRoster } from '../components/TeamRoster'
import { SettingsPanel } from '../components/SettingsPanel'
import { Leaderboard } from '../components/Leaderboard'

export default function CoordinatorDashboard() {
  const navigate = useNavigate()
  const { teams, puzzleVersions, activeTeam, setActiveTeamId, isOnline, coordinator, syncStatus, coordinatorLogout } =
    useStore()

  // The route guard trusts ONLY the server-verified session flag returned by
  // GET /api/state (backed by the signed HttpOnly cookie) — never a
  // client-side sessionStorage flag. Until the first sync completes we
  // don't redirect, to avoid bouncing a legitimately-authenticated
  // coordinator on a slow connection.
  useEffect(() => {
    if (syncStatus === 'ok' && !coordinator) navigate('/coordinator/login')
  }, [syncStatus, coordinator, navigate])

  async function logout() {
    await coordinatorLogout()
    navigate('/coordinator/login')
  }

  if (!coordinator) {
    return (
      <div className="min-h-screen flex items-center justify-center font-mono text-sm" style={{ color: 'var(--text-dim)' }}>
        Verifying coordinator session...
      </div>
    )
  }

  return (
    <div className="min-h-screen px-5 sm:px-8 py-6 flex flex-col gap-6">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="font-display text-xl font-bold tracking-[0.15em]" style={{ color: 'var(--text-hi)' }}>
            PROJECT NEUROVAULT
          </div>
          <div className="font-mono text-[11px] tracking-widest flex items-center gap-2" style={{ color: 'var(--cyan)' }}>
            <span>COORDINATOR DASHBOARD // SYSTEM CONTROL</span>
            <span
              className="w-2 h-2 rounded-full inline-block"
              style={{ background: isOnline ? 'var(--green)' : 'var(--amber)' }}
              title={isOnline ? 'Server Sync Active' : 'Offline Mode'}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/play"
            target="_blank"
            className="font-mono text-[11px] uppercase tracking-wider px-3 py-2 rounded-sm"
            style={{ border: '1px solid var(--line)', color: 'var(--cyan)' }}
          >
            Open Participant Screen ↗
          </Link>
          <button
            onClick={logout}
            className="font-mono text-[11px] uppercase tracking-wider px-3 py-2 rounded-sm"
            style={{ border: '1px solid var(--red)', color: 'var(--red)' }}
          >
            Lock Panel
          </button>
        </div>
      </header>

      <div
        className="rounded-md p-4"
        style={{ background: 'var(--bg-panel)', border: '1px solid var(--line)' }}
      >
        <TeamSelector teams={teams} activeTeamId={activeTeam?.id ?? null} onSelect={setActiveTeamId} />
      </div>

      <TeamRoster teams={teams} puzzleVersions={puzzleVersions} activeTeamId={activeTeam?.id ?? null} onSelect={setActiveTeamId} />

      {activeTeam ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="flex flex-col gap-6">
            <ControlsPanel team={activeTeam} />
            <HintPanel team={activeTeam} />
            <TeamManagerPanel team={activeTeam} />
          </div>
          <div className="flex flex-col gap-6">
            <PuzzleConfigPanel team={activeTeam} puzzleVersions={puzzleVersions} />
          </div>
        </div>
      ) : (
        <div
          className="rounded-md p-10 text-center font-mono text-sm"
          style={{ background: 'var(--bg-panel)', border: '1px solid var(--line)', color: 'var(--text-dim)' }}
        >
          Select a team above to configure and control their session.
        </div>
      )}

      {!activeTeam && <TeamManagerPanel team={null} />}

      <SettingsPanel />

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="font-mono text-xs tracking-[0.25em]" style={{ color: 'var(--text-dim)' }}>
            LEADERBOARD
          </div>
          <Link
            to="/leaderboard"
            target="_blank"
            className="font-mono text-[11px] uppercase tracking-wider"
            style={{ color: 'var(--cyan)' }}
          >
            Open Public View ↗
          </Link>
        </div>
        <Leaderboard teams={teams} />
      </div>
    </div>
  )
}
