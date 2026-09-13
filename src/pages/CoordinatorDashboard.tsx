import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useStore } from '../state/store.js'
import { TeamSelector } from '../components/TeamSelector.js'
import { PuzzleConfigPanel } from '../components/PuzzleConfigPanel.js'
import { ControlsPanel } from '../components/ControlsPanel.js'
import { HintPanel } from '../components/HintPanel.js'
import { PuzzleProgress } from '../components/PuzzleProgress.js'
import { TeamManagerPanel } from '../components/TeamManagerPanel.js'
import { TeamRoster } from '../components/TeamRoster.js'
import { SettingsPanel } from '../components/SettingsPanel.js'
import { Leaderboard } from '../components/Leaderboard.js'
import { AuditLogPanel } from '../components/AuditLogPanel.js'

type NavTab = 'HOME' | 'REGISTRATION' | 'RESULTS' | 'SETTINGS' | 'AUDIT'

export default function CoordinatorDashboard() {
  const navigate = useNavigate()
  const {
    teams,
    puzzleVersions,
    activeTeam,
    setActiveTeamId,
    isOnline,
    coordinator,
    syncStatus,
    coordinatorLogout,
    settings,
    updateSettings,
  } = useStore()

  const [activeTab, setActiveTab] = useState<NavTab>('HOME')

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

  const pendingCount = teams.filter((t) => t.registrationStatus === 'PENDING').length

  return (
    <div className="min-h-screen px-4 sm:px-8 py-6 flex flex-col gap-6">
      {/* HEADER */}
      <header className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b" style={{ borderColor: 'var(--line)' }}>
        <div>
          <div className="font-display text-xl sm:text-2xl font-bold tracking-[0.15em]" style={{ color: 'var(--text-hi)' }}>
            PROJECT NEUROVAULT
          </div>
          <div className="font-mono text-[11px] tracking-widest flex items-center gap-2 mt-0.5" style={{ color: 'var(--cyan)' }}>
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

      {/* TOP NAVIGATION BAR */}
      <nav
        className="flex items-center gap-2 overflow-x-auto pb-1 select-none"
        style={{ borderBottom: '1px solid var(--line)' }}
      >
        <button
          onClick={() => setActiveTab('HOME')}
          className="font-display text-xs sm:text-sm uppercase tracking-wider px-4 py-2.5 rounded-t-sm transition-all flex items-center gap-2"
          style={{
            background: activeTab === 'HOME' ? 'var(--bg-panel)' : 'transparent',
            color: activeTab === 'HOME' ? 'var(--cyan)' : 'var(--text-mid)',
            borderBottom: activeTab === 'HOME' ? '2px solid var(--cyan)' : '2px solid transparent',
            borderTop: activeTab === 'HOME' ? '1px solid var(--line)' : 'none',
            borderLeft: activeTab === 'HOME' ? '1px solid var(--line)' : 'none',
            borderRight: activeTab === 'HOME' ? '1px solid var(--line)' : 'none',
          }}
        >
          <span>HOME</span>
        </button>

        <button
          onClick={() => setActiveTab('REGISTRATION')}
          className="font-display text-xs sm:text-sm uppercase tracking-wider px-4 py-2.5 rounded-t-sm transition-all flex items-center gap-2"
          style={{
            background: activeTab === 'REGISTRATION' ? 'var(--bg-panel)' : 'transparent',
            color: activeTab === 'REGISTRATION' ? 'var(--cyan)' : 'var(--text-mid)',
            borderBottom: activeTab === 'REGISTRATION' ? '2px solid var(--cyan)' : '2px solid transparent',
            borderTop: activeTab === 'REGISTRATION' ? '1px solid var(--line)' : 'none',
            borderLeft: activeTab === 'REGISTRATION' ? '1px solid var(--line)' : 'none',
            borderRight: activeTab === 'REGISTRATION' ? '1px solid var(--line)' : 'none',
          }}
        >
          <span>REGISTRATION</span>
          {pendingCount > 0 && (
            <span
              className="font-mono text-[10px] px-1.5 py-0.2 rounded-full font-bold"
              style={{ background: 'var(--amber)', color: 'var(--bg-void)' }}
            >
              {pendingCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('RESULTS')}
          className="font-display text-xs sm:text-sm uppercase tracking-wider px-4 py-2.5 rounded-t-sm transition-all flex items-center gap-2"
          style={{
            background: activeTab === 'RESULTS' ? 'var(--bg-panel)' : 'transparent',
            color: activeTab === 'RESULTS' ? 'var(--cyan)' : 'var(--text-mid)',
            borderBottom: activeTab === 'RESULTS' ? '2px solid var(--cyan)' : '2px solid transparent',
            borderTop: activeTab === 'RESULTS' ? '1px solid var(--line)' : 'none',
            borderLeft: activeTab === 'RESULTS' ? '1px solid var(--line)' : 'none',
            borderRight: activeTab === 'RESULTS' ? '1px solid var(--line)' : 'none',
          }}
        >
          <span>RESULTS / LEADERBOARD</span>
        </button>

        <button
          onClick={() => setActiveTab('SETTINGS')}
          className="font-display text-xs sm:text-sm uppercase tracking-wider px-4 py-2.5 rounded-t-sm transition-all flex items-center gap-2"
          style={{
            background: activeTab === 'SETTINGS' ? 'var(--bg-panel)' : 'transparent',
            color: activeTab === 'SETTINGS' ? 'var(--cyan)' : 'var(--text-mid)',
            borderBottom: activeTab === 'SETTINGS' ? '2px solid var(--cyan)' : '2px solid transparent',
            borderTop: activeTab === 'SETTINGS' ? '1px solid var(--line)' : 'none',
            borderLeft: activeTab === 'SETTINGS' ? '1px solid var(--line)' : 'none',
            borderRight: activeTab === 'SETTINGS' ? '1px solid var(--line)' : 'none',
          }}
        >
          <span>EVENT SETTINGS</span>
        </button>

        <button
          onClick={() => setActiveTab('AUDIT')}
          className="font-display text-xs sm:text-sm uppercase tracking-wider px-4 py-2.5 rounded-t-sm transition-all flex items-center gap-2"
          style={{
            background: activeTab === 'AUDIT' ? 'var(--bg-panel)' : 'transparent',
            color: activeTab === 'AUDIT' ? 'var(--cyan)' : 'var(--text-mid)',
            borderBottom: activeTab === 'AUDIT' ? '2px solid var(--cyan)' : '2px solid transparent',
            borderTop: activeTab === 'AUDIT' ? '1px solid var(--line)' : 'none',
            borderLeft: activeTab === 'AUDIT' ? '1px solid var(--line)' : 'none',
            borderRight: activeTab === 'AUDIT' ? '1px solid var(--line)' : 'none',
          }}
        >
          <span>AUDIT LOG</span>
        </button>
      </nav>

      {/* TAB CONTENTS */}

      {/* 1. HOME: CURRENT EVENT + PUZZLE CONFIGURATION */}
      {activeTab === 'HOME' && (
        <div className="flex flex-col gap-6">
          <div
            className="rounded-md p-4"
            style={{ background: 'var(--bg-panel)', border: '1px solid var(--line)' }}
          >
            <TeamSelector teams={teams} activeTeamId={activeTeam?.id ?? null} onSelect={setActiveTeamId} />
          </div>

          {activeTeam ? (
            <>
              {/* CURRENT EVENT SECTION */}
              <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-mono text-xs tracking-[0.3em]" style={{ color: 'var(--cyan)' }}>
                    CURRENT EVENT // LIVE CONTROLS
                  </h2>
                  <div className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
                    Team: <strong style={{ color: 'var(--text-hi)' }}>{activeTeam.name}</strong> ({activeTeam.id})
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ControlsPanel team={activeTeam} />
                  <div className="flex flex-col gap-6">
                    <HintPanel team={activeTeam} />
                    <div
                      className="rounded-md p-5 flex flex-col gap-3"
                      style={{ background: 'var(--bg-panel)', border: '1px solid var(--line)' }}
                    >
                      <div className="font-mono text-xs tracking-[0.25em]" style={{ color: 'var(--text-dim)' }}>
                        LIVE PUZZLE PROGRESS
                      </div>
                      <PuzzleProgress team={activeTeam} />
                    </div>
                  </div>
                </div>
              </section>

              {/* PUZZLE CONFIGURATION SECTION */}
              <section className="flex flex-col gap-3">
                <h2 className="font-mono text-xs tracking-[0.3em]" style={{ color: 'var(--cyan)' }}>
                  PUZZLE CONFIGURATION // LIVE ASSIGNMENTS
                </h2>
                <PuzzleConfigPanel team={activeTeam} puzzleVersions={puzzleVersions} />
              </section>
            </>
          ) : (
            <div
              className="rounded-md p-12 text-center font-mono text-sm"
              style={{ background: 'var(--bg-panel)', border: '1px solid var(--line)', color: 'var(--text-dim)' }}
            >
              Select a team above to view live event controls and configure puzzle variants.
            </div>
          )}
        </div>
      )}

      {/* 2. REGISTRATION SECTION */}
      {activeTab === 'REGISTRATION' && (
        <section className="flex flex-col gap-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-mono text-xs tracking-[0.3em]" style={{ color: 'var(--cyan)' }}>
              TEAM REGISTRATION & ROSTER MANAGEMENT
            </h2>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
                Registration Status:
              </span>
              <button
                type="button"
                onClick={() => updateSettings({ registrationOpen: !settings.registrationOpen })}
                className="font-mono text-xs uppercase tracking-wider px-3 py-1.5 rounded-sm font-semibold"
                style={{
                  background: settings.registrationOpen ? 'var(--green)' : 'var(--red)',
                  color: 'var(--bg-void)',
                }}
              >
                {settings.registrationOpen ? 'REGISTRATION OPEN' : 'REGISTRATION CLOSED'}
              </button>
            </div>
          </div>

          <TeamRoster
            teams={teams}
            puzzleVersions={puzzleVersions}
            activeTeamId={activeTeam?.id ?? null}
            onSelect={setActiveTeamId}
          />
          <TeamManagerPanel team={activeTeam} />
        </section>
      )}

      {/* 3. RESULTS / LEADERBOARD SECTION */}
      {activeTab === 'RESULTS' && (
        <section className="flex flex-col gap-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="font-mono text-xs tracking-[0.3em]" style={{ color: 'var(--cyan)' }}>
                EVENT RESULTS & LEADERBOARD
              </h2>
              <div className="font-mono text-[11px] mt-1" style={{ color: 'var(--text-dim)' }}>
                Public Leaderboard Status:{' '}
                <strong style={{ color: settings.publicLeaderboardUnlocked ? 'var(--green)' : 'var(--amber)' }}>
                  {settings.publicLeaderboardUnlocked ? 'UNLOCKED (PUBLIC)' : 'LOCKED (COORDINATOR PREVIEW ONLY)'}
                </strong>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => updateSettings({ publicLeaderboardUnlocked: !settings.publicLeaderboardUnlocked })}
                className="font-mono text-xs uppercase tracking-wider px-3 py-1.5 rounded-sm font-semibold"
                style={{
                  background: settings.publicLeaderboardUnlocked ? 'var(--amber)' : 'var(--cyan)',
                  color: 'var(--bg-void)',
                }}
              >
                {settings.publicLeaderboardUnlocked ? 'Lock Public Leaderboard' : 'Unlock Public Leaderboard'}
              </button>
              <Link
                to="/leaderboard"
                target="_blank"
                className="font-mono text-[11px] uppercase tracking-wider px-3 py-1.5 rounded-sm"
                style={{ border: '1px solid var(--line)', color: 'var(--cyan)' }}
              >
                Open Public View ↗
              </Link>
            </div>
          </div>

          <Leaderboard teams={teams} />
        </section>
      )}

      {/* 4. EVENT SETTINGS SECTION */}
      {activeTab === 'SETTINGS' && (
        <section className="flex flex-col gap-6">
          <h2 className="font-mono text-xs tracking-[0.3em]" style={{ color: 'var(--cyan)' }}>
            EVENT SETTINGS // SYSTEM-WIDE CONFIGURATION
          </h2>
          <SettingsPanel />
        </section>
      )}

      {/* 5. AUDIT LOG SECTION */}
      {activeTab === 'AUDIT' && (
        <section className="flex flex-col gap-6">
          <h2 className="font-mono text-xs tracking-[0.3em]" style={{ color: 'var(--cyan)' }}>
            AUDIT LOG // EVENT TRAIL
          </h2>
          <AuditLogPanel />
        </section>
      )}
    </div>
  )
}
