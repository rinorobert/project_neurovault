import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type {
  Team,
  PuzzleVersion,
  GameSettings,
  PuzzleSlotKey,
  InitialPuzzleSlotKey,
  HintLevel,
} from '../types'

// ============================================================================
// PROJECT NEUROVAULT — Client State Store
// ----------------------------------------------------------------------------
// The server is the ONLY source of truth. This store:
//   - polls GET /api/state every ~1.5s and replaces local state with
//     whatever the server returns (never the other way around)
//   - for every mutation, AWAITS the server's response and only then
//     applies the returned team/settings — no speculative/optimistic
//     writes to security- or scoring-relevant state
//   - never seeds itself from localStorage, and never falls back to a
//     locally-computed "looks right" answer if a request fails
//   - surfaces sync failures via `syncStatus`/`lastError` instead of
//     silently continuing to show a possibly-stale local copy
// ============================================================================

export type SyncStatus = 'connecting' | 'ok' | 'error'

interface StoreState {
  teams: Team[]
  puzzleVersions: PuzzleVersion[]
  settings: GameSettings
  activeTeamId: string | null
  coordinator: boolean
  syncStatus: SyncStatus
  lastError?: string
  tick: number // increments ~1/sec purely to drive UI re-renders (display only)
}

interface StoreContextValue extends StoreState {
  activeTeam: Team | null
  isOnline: boolean

  // Registration / team management
  registerTeam: (input: {
    teamName: string
    players: string[]
    captain: string
    contactEmail: string
    contactMobile: string
  }) => Promise<{ ok: boolean; error?: string }>
  addTeam: (input: {
    name: string
    members: string[]
    captain?: string
    contactEmail?: string
    contactMobile: string
  }) => Promise<{ ok: boolean; error?: string }>
  updateTeam: (id: string, patch: Partial<Team>) => Promise<{ ok: boolean; error?: string }>
  deleteTeam: (id: string) => Promise<void>
  approveTeamAction: (id: string) => Promise<void>
  rejectTeamAction: (id: string) => Promise<void>
  activateTeamAction: (id: string) => Promise<void>
  setActiveTeamId: (id: string | null) => Promise<void>

  // Gameplay controls (coordinator)
  startGame: (id: string) => Promise<void>
  pauseGame: (id: string) => Promise<void>
  resumeGame: (id: string) => Promise<void>
  markEscaped: (id: string) => Promise<void>
  resetActiveRun: (id: string) => Promise<void>
  giveHint: (id: string, level: HintLevel) => Promise<void>
  markPuzzleCompleted: (
    teamId: string,
    slot: InitialPuzzleSlotKey | 'FINAL_SLOT',
    completed: boolean,
    outputFragment?: string
  ) => Promise<void>
  setPuzzleVersion: (teamId: string, slot: PuzzleSlotKey, puzzleVersionId: string) => Promise<void>
  changeFinalCodeOverride: (teamId: string, code: string | undefined) => Promise<void>

  // Delete Completed Result (server-generated random token)
  requestDeleteResultToken: (
    id: string
  ) => Promise<{ token: string; teamName: string; officialRankingSeconds?: number } | null>
  confirmDeleteResult: (id: string, token: string) => Promise<{ ok: boolean; error?: string }>

  // Participant-facing code entry
  verifyRecoveryCode: (teamId: string, code: string) => Promise<{ correct: boolean }>
  submitCode: (teamId: string, code: string) => Promise<{ correct: boolean; attemptsRemaining: number | null }>

  // Settings
  updateSettings: (patch: Partial<GameSettings>) => Promise<void>

  // Coordinator auth
  coordinatorLogin: (pin: string) => Promise<boolean>
  coordinatorLogout: () => Promise<void>
}

const StoreContext = createContext<StoreContextValue | null>(null)

const POLL_INTERVAL_MS = 1500

async function apiFetch(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; body: any }> {
  try {
    const res = await fetch(path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...init,
    })
    let body: any = null
    try {
      body = await res.json()
    } catch {
      body = null
    }
    return { ok: res.ok, status: res.status, body }
  } catch (err: any) {
    return { ok: false, status: 0, body: { error: err?.message ?? 'Network error' } }
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StoreState>({
    teams: [],
    puzzleVersions: [],
    settings: { defaultMaxTimeSeconds: 25 * 60, publicLeaderboardUnlocked: false },
    activeTeamId: null,
    coordinator: false,
    syncStatus: 'connecting',
    tick: 0,
  })

  const syncing = useRef(false)

  const sync = useCallback(async () => {
    if (syncing.current) return
    syncing.current = true
    const result = await apiFetch('/api/state')
    syncing.current = false
    if (!result.ok) {
      setState((s) => ({ ...s, syncStatus: 'error', lastError: result.body?.error ?? 'Failed to reach server' }))
      return
    }
    const { teams, puzzleVersions, settings, activeTeamId, coordinator } = result.body
    setState((s) => ({
      ...s,
      teams,
      puzzleVersions,
      settings,
      activeTeamId,
      coordinator: Boolean(coordinator),
      syncStatus: 'ok',
      lastError: undefined,
    }))
  }, [])

  useEffect(() => {
    sync()
    const poll = setInterval(sync, POLL_INTERVAL_MS)
    const uiTick = setInterval(() => setState((s) => ({ ...s, tick: s.tick + 1 })), 1000)
    return () => {
      clearInterval(poll)
      clearInterval(uiTick)
    }
  }, [sync])

  const applyTeam = useCallback((team: Team | undefined) => {
    if (!team) return
    setState((s) => ({ ...s, teams: s.teams.map((t) => (t.id === team.id ? team : t)) }))
  }, [])

  const mutateTeam = useCallback(
    async (id: string, path: string, init?: RequestInit) => {
      const result = await apiFetch(`/api/teams/${id}${path}`, init)
      if (!result.ok) {
        setState((s) => ({ ...s, syncStatus: 'error', lastError: result.body?.error ?? 'Request failed' }))
        return { ok: false as const, body: result.body }
      }
      applyTeam(result.body?.team)
      return { ok: true as const, body: result.body }
    },
    [applyTeam]
  )

  const value: StoreContextValue = {
    ...state,
    activeTeam: state.teams.find((t) => t.id === state.activeTeamId) ?? null,
    isOnline: state.syncStatus === 'ok',

    registerTeam: async (input) => {
      const result = await apiFetch('/api/register', { method: 'POST', body: JSON.stringify(input) })
      if (!result.ok) return { ok: false, error: result.body?.error ?? 'Registration failed' }
      await sync()
      return { ok: true }
    },

    addTeam: async (input) => {
      const result = await apiFetch('/api/teams', { method: 'POST', body: JSON.stringify(input) })
      if (!result.ok) return { ok: false, error: result.body?.error ?? 'Failed to create team' }
      await sync()
      return { ok: true }
    },

    updateTeam: async (id, patch) => {
      // Optimistic-concurrency: send the version we last saw so the server
      // can reject a stale edit (e.g. two coordinator devices editing the
      // same team) instead of silently overwriting it.
      const currentVersion = state.teams.find((t) => t.id === id)?.version
      const result = await mutateTeam(id, '', {
        method: 'PATCH',
        body: JSON.stringify({ ...patch, expectedVersion: currentVersion }),
      })
      if (!result.ok) return { ok: false, error: result.body?.message ?? result.body?.error ?? 'Update failed' }
      return { ok: true }
    },

    deleteTeam: async (id) => {
      const result = await apiFetch(`/api/teams/${id}`, { method: 'DELETE' })
      if (result.ok) setState((s) => ({ ...s, teams: s.teams.filter((t) => t.id !== id) }))
    },

    approveTeamAction: async (id) => mutateTeam(id, '/approve', { method: 'POST' }).then(() => {}),
    rejectTeamAction: async (id) => mutateTeam(id, '/reject', { method: 'POST' }).then(() => {}),
    activateTeamAction: async (id) => mutateTeam(id, '/activate', { method: 'POST' }).then(() => {}),

    setActiveTeamId: async (id) => {
      const result = await apiFetch('/api/active-team', { method: 'POST', body: JSON.stringify({ id }) })
      if (result.ok) setState((s) => ({ ...s, activeTeamId: id }))
    },

    startGame: async (id) => mutateTeam(id, '/game/start', { method: 'POST' }).then(() => {}),
    pauseGame: async (id) => mutateTeam(id, '/game/pause', { method: 'POST' }).then(() => {}),
    resumeGame: async (id) => mutateTeam(id, '/game/resume', { method: 'POST' }).then(() => {}),
    markEscaped: async (id) => mutateTeam(id, '/game/escape', { method: 'POST' }).then(() => {}),
    resetActiveRun: async (id) => mutateTeam(id, '/game/reset', { method: 'POST' }).then(() => {}),

    giveHint: async (id, level) =>
      mutateTeam(id, '/hints/use', { method: 'POST', body: JSON.stringify({ level }) }).then(() => {}),

    markPuzzleCompleted: async (teamId, slot, completed, outputFragment) =>
      mutateTeam(teamId, `/puzzles/${slot}/complete`, {
        method: 'POST',
        body: JSON.stringify({ completed, outputFragment }),
      }).then(() => {}),

    setPuzzleVersion: async (teamId, slot, puzzleVersionId) => {
      const team = state.teams.find((t) => t.id === teamId)
      if (!team) return
      const puzzleAssignments = team.puzzleAssignments.map((a) =>
        a.slot === slot ? { ...a, puzzleVersionId } : a
      )
      await mutateTeam(teamId, '', { method: 'PATCH', body: JSON.stringify({ puzzleAssignments }) })
    },

    changeFinalCodeOverride: async (teamId, code) => {
      await mutateTeam(teamId, '', { method: 'PATCH', body: JSON.stringify({ finalCodeOverride: code ?? null }) })
    },

    requestDeleteResultToken: async (id) => {
      const result = await apiFetch(`/api/teams/${id}/result/delete-token`, { method: 'POST' })
      if (!result.ok) return null
      return {
        token: result.body.token,
        teamName: result.body.teamName,
        officialRankingSeconds: result.body.officialRankingSeconds,
      }
    },

    confirmDeleteResult: async (id, token) => {
      const result = await apiFetch(`/api/teams/${id}/result/delete`, {
        method: 'POST',
        body: JSON.stringify({ token }),
      })
      if (!result.ok) return { ok: false, error: result.body?.error ?? 'Deletion failed' }
      applyTeam(result.body?.team)
      return { ok: true }
    },

    verifyRecoveryCode: async (teamId, code) => {
      const result = await apiFetch(`/api/teams/${teamId}/recovery-code/verify`, {
        method: 'POST',
        body: JSON.stringify({ code }),
      })
      if (result.ok) applyTeam(result.body?.team)
      return { correct: Boolean(result.body?.correct) }
    },

    submitCode: async (teamId, code) => {
      const result = await apiFetch(`/api/teams/${teamId}/final-code/verify`, {
        method: 'POST',
        body: JSON.stringify({ code }),
      })
      if (result.ok) applyTeam(result.body?.team)
      return {
        correct: Boolean(result.body?.correct),
        attemptsRemaining: result.body?.attemptsRemaining ?? null,
      }
    },

    updateSettings: async (patch) => {
      const result = await apiFetch('/api/settings', { method: 'PATCH', body: JSON.stringify(patch) })
      if (result.ok) setState((s) => ({ ...s, settings: result.body.settings }))
    },

    coordinatorLogin: async (pin) => {
      const result = await apiFetch('/api/auth/coordinator/login', { method: 'POST', body: JSON.stringify({ pin }) })
      if (result.ok) {
        setState((s) => ({ ...s, coordinator: true }))
        await sync()
        return true
      }
      return false
    },

    coordinatorLogout: async () => {
      await apiFetch('/api/auth/coordinator/logout', { method: 'POST' })
      setState((s) => ({ ...s, coordinator: false }))
    },
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within a StoreProvider')
  return ctx
}
