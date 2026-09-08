// ============================================================================
// PROJECT NEUROVAULT — Non-Authoritative Browser Convenience Cache
// ----------------------------------------------------------------------------
// The server (see src/state/store.tsx polling /api/state) is the ONLY
// source of truth for game state. This file exists purely for a small
// browser-local convenience — remembering which team a coordinator's own
// browser tab was last looking at — and must never be used to seed initial
// application state or to hold anything sensitive (answers, codes, teams).
// If it throws (private browsing, storage disabled, etc.) callers must
// treat that as a no-op, never as a fallback data source.
// ============================================================================

const LAST_VIEWED_TEAM_KEY = 'nv_ui_last_viewed_team_id'

export function cacheLastViewedTeamId(teamId: string | null): void {
  try {
    if (teamId) window.localStorage.setItem(LAST_VIEWED_TEAM_KEY, teamId)
    else window.localStorage.removeItem(LAST_VIEWED_TEAM_KEY)
  } catch {
    // Non-authoritative — ignore storage failures entirely.
  }
}

export function getCachedLastViewedTeamId(): string | null {
  try {
    return window.localStorage.getItem(LAST_VIEWED_TEAM_KEY)
  } catch {
    return null
  }
}
