import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../state/store'
import { CountdownTimer } from '../components/CountdownTimer'
import { PuzzleProgress } from '../components/PuzzleProgress'
import { CodeEntry } from '../components/CodeEntry'
import { SuccessScreen } from '../components/SuccessScreen'
import { AccessDenied, TimeExpiredScreen } from '../components/FailureScreen'
import { areInitialPuzzlesCompleted } from '../engine/gameEngine'

function StandbyScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6">
      <div className="font-display text-2xl sm:text-4xl font-bold tracking-[0.3em] flicker" style={{ color: 'var(--cyan)' }}>
        PROJECT NEUROVAULT
      </div>
      <div className="font-mono text-xs sm:text-sm tracking-[0.35em]" style={{ color: 'var(--text-hi)' }}>
        UNLOCK THE INTELLIGENCE WITHIN
      </div>
      <div className="font-mono text-xs tracking-[0.25em] mt-2" style={{ color: 'var(--text-dim)' }}>
        AWAITING COORDINATOR ASSIGNMENT
      </div>
      <div className="font-mono text-xs mt-6 max-w-sm" style={{ color: 'var(--text-dim)' }}>
        A coordinator will initialize and authorize your room session shortly.
      </div>
    </div>
  )
}

export default function ParticipantView() {
  const { activeTeam, submitCode, verifyRecoveryCode } = useStore()
  const [lastResult, setLastResult] = useState<{ correct: boolean; attemptsRemaining: number | null } | null>(null)
  const [shake, setShake] = useState(false)
  const [recoveryShake, setRecoveryShake] = useState(false)
  const [recoveryWrong, setRecoveryWrong] = useState(false)

  if (!activeTeam) return <StandbyScreen />

  const team = activeTeam
  const notStarted = team.status === 'NOT_STARTED'
  const paused = team.status === 'PAUSED'
  const escaped = team.status === 'ESCAPED'
  const expired = team.status === 'TIME_EXPIRED'
  const attemptsExhausted =
    team.maxAttempts !== undefined && team.attempts >= team.maxAttempts && !escaped

  const initialDone = areInitialPuzzlesCompleted(team)
  const recoveryUnlocked = team.recoveryCodeUnlocked === true
  const canEnterRecoveryCode = initialDone && !recoveryUnlocked
  const canEnterFinalCode = recoveryUnlocked && team.finalPuzzleCompleted

  async function handleSubmit(code: string) {
    const result = await submitCode(team.id, code)
    setLastResult(result)
    if (!result.correct) {
      setShake(true)
      setTimeout(() => setShake(false), 500)
    }
  }

  async function handleRecoverySubmit(code: string) {
    const result = await verifyRecoveryCode(team.id, code)
    setRecoveryWrong(!result.correct)
    if (!result.correct) {
      setRecoveryShake(true)
      setTimeout(() => setRecoveryShake(false), 500)
    }
  }

  return (
    <div className="min-h-screen scanlines flex flex-col">
      <header
        className="relative overflow-hidden flex items-center justify-between px-6 sm:px-10 py-5"
        style={{ borderBottom: '1px solid var(--line)' }}
      >
        <div className="sweep-layer" />
        <div className="relative z-10">
          <div className="font-display text-lg sm:text-xl font-bold tracking-[0.25em]" style={{ color: 'var(--text-hi)' }}>
            PROJECT NEUROVAULT
          </div>
          <div className="font-mono text-[10px] tracking-[0.25em] mt-0.5" style={{ color: 'var(--cyan)' }}>
            UNLOCK THE INTELLIGENCE WITHIN // SECURITY OVERRIDE TERMINAL
          </div>
        </div>
        <div className="relative z-10 text-right">
          <div className="font-mono text-[11px] tracking-[0.2em]" style={{ color: 'var(--text-dim)' }}>
            SYSTEM STATUS
          </div>
          <div
            className="font-mono text-sm font-semibold tracking-widest"
            style={{
              color: escaped ? 'var(--green)' : expired ? 'var(--red)' : paused ? 'var(--amber)' : 'var(--cyan)',
            }}
          >
            {escaped ? 'RESTORED' : expired ? 'LOCKED OUT' : paused ? 'SUSPENDED' : notStarted ? 'STANDBY' : 'CONTAINMENT ACTIVE'}
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-8">
        <div className="text-center">
          <div className="font-mono text-xs tracking-[0.3em]" style={{ color: 'var(--text-dim)' }}>
            ACTIVE TEAM
          </div>
          <div className="font-display text-2xl sm:text-3xl font-bold" style={{ color: 'var(--text-hi)' }}>
            {team.name}
          </div>
          {team.members && team.members.length > 0 && (
            <div className="font-mono text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
              Operators: {team.members.join(' • ')}
            </div>
          )}
        </div>

        {escaped ? (
          <SuccessScreen team={team} />
        ) : expired ? (
          <TimeExpiredScreen team={team} />
        ) : (
          <>
            <div>
              <div className="font-mono text-xs tracking-[0.3em] text-center mb-3" style={{ color: 'var(--text-dim)' }}>
                TIME REMAINING
              </div>
              <CountdownTimer team={team} />
            </div>

            <div
              className="w-full max-w-lg rounded-md p-6"
              style={{ background: 'var(--bg-panel)', border: '1px solid var(--line)' }}
            >
              <div className="font-mono text-xs tracking-[0.3em] mb-4" style={{ color: 'var(--text-dim)' }}>
                SYSTEM RECOVERY STATUS
              </div>
              <PuzzleProgress team={team} />
            </div>

            {paused && (
              <div
                className="font-mono text-sm tracking-widest px-4 py-2 rounded-sm"
                style={{ color: 'var(--amber)', border: '1px solid var(--amber)' }}
              >
                SESSION SUSPENDED BY COORDINATOR
              </div>
            )}

            {notStarted && (
              <div className="font-mono text-sm tracking-widest text-center" style={{ color: 'var(--text-dim)' }}>
                Waiting for coordinator authorization to initiate countdown...
              </div>
            )}

            {!notStarted && (
              <div className="w-full max-w-md flex flex-col items-center gap-4">
                {canEnterRecoveryCode ? (
                  <>
                    <div className="font-mono text-xs tracking-[0.3em] text-center" style={{ color: 'var(--cyan)' }}>
                      ENTER NEUROVAULT // RECOVERY CODE
                    </div>
                    <div className="font-mono text-[11px] text-center max-w-sm" style={{ color: 'var(--text-dim)' }}>
                      Combine each module's digit in order — Module 01, 02, 03, 04 — to unlock the final module.
                    </div>
                    <CodeEntry
                      length={4}
                      onSubmit={handleRecoverySubmit}
                      disabled={paused}
                      shake={recoveryShake}
                      submitLabel="Unlock Final Module"
                    />
                    {recoveryWrong && (
                      <div className="font-mono text-xs tracking-widest" style={{ color: 'var(--red)' }}>
                        RECOVERY CODE REJECTED — VERIFY EACH MODULE'S DIGIT.
                      </div>
                    )}
                  </>
                ) : canEnterFinalCode ? (
                  <>
                    <div className="font-mono text-xs tracking-[0.3em] text-center" style={{ color: 'var(--cyan)' }}>
                      ENTER FINAL SECURITY OVERRIDE CODE
                    </div>
                    <CodeEntry length={8} onSubmit={handleSubmit} disabled={paused || attemptsExhausted} shake={shake} />
                    {team.maxAttempts !== undefined && (
                      <div className="font-mono text-xs" style={{ color: 'var(--text-dim)' }}>
                        Attempts remaining: {Math.max(0, team.maxAttempts - team.attempts)}
                      </div>
                    )}
                    {attemptsExhausted && (
                      <div
                        className="font-mono text-xs tracking-widest px-4 py-2 rounded-sm"
                        style={{ color: 'var(--red)', border: '1px solid var(--red)' }}
                      >
                        OVERRIDE LOCKED — NO ATTEMPTS REMAINING. CONTACT YOUR COORDINATOR.
                      </div>
                    )}
                    {!attemptsExhausted && lastResult && !lastResult.correct && (
                      <AccessDenied attemptsRemaining={lastResult.attemptsRemaining} />
                    )}
                  </>
                ) : (
                  <div
                    className="w-full text-center font-mono text-xs p-4 rounded-sm"
                    style={{ background: 'var(--bg-raised)', border: '1px solid var(--line)', color: 'var(--text-mid)' }}
                  >
                    {!initialDone
                      ? '🔒 OVERRIDE LOCKED: Solve all 4 parallel station modules to proceed.'
                      : !team.finalModuleEnabled
                        ? '⏳ AWAITING COORDINATOR: Final module has not been enabled yet.'
                        : '⚡ FINAL MODULE UNLOCKED: Constraint Breach in progress.'}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="text-center py-4 font-mono text-[10px] tracking-[0.3em]" style={{ color: 'var(--text-dim)' }}>
        <Link to="/leaderboard" className="hover:underline">
          VIEW PUBLIC LEADERBOARD
        </Link>
      </footer>
    </div>
  )
}
