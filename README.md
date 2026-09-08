# PROJECT NEUROVAULT
> **Tagline:** UNLOCK THE INTELLIGENCE WITHIN

A near-future AI-thriller escape room control platform for a college tech fest. One repository: React + TypeScript + Vite frontend, Vercel serverless `/api` backend, Neon PostgreSQL storage. No Render backend.

---

## 1. Quick Start (Local Development)

```bash
npm install
npm run dev
```

Open the printed URL (default `http://localhost:5173`). `npm run dev` serves the React/Vite frontend **and** the `/api/*` routes together via a Vite dev middleware — one command, no separate backend process.

- **Database**: with no `DATABASE_URL` set, the app uses an in-memory repository for local development. It starts with **zero teams** — there is no sample/demo data seeded automatically anywhere in the app.
- **Coordinator PIN**: set `COORDINATOR_PIN` in a `.env.local` file. If unset in development, it defaults to `1234` (server-side only — never shipped to the browser). In production, `COORDINATOR_PIN` is mandatory and there is no fallback.
- **Session signing**: set `SESSION_SECRET` in `.env.local` / production env vars. If unset, the session signer derives a secret from `COORDINATOR_PIN` instead — but at least one of the two must be present in production, or the server refuses to start signing sessions.

---

## 2. Production Deployment (Vercel + Neon PostgreSQL)

### Architecture
- **Frontend**: React + TypeScript + Tailwind, built by Vite into `dist/`.
- **Backend**: a single Vercel Serverless Function (`api/[...path].ts`, re-exporting the shared handler in `api/_handler.ts`) routes every `/api/*` request into `src/server/apiRouter.ts`.
- **Database**: Neon PostgreSQL via the real `@neondatabase/serverless` HTTP driver (`src/server/db/client.ts`). There is no hand-rolled SQL endpoint.

### Required Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | **Mandatory in production** | Neon Postgres connection string. Missing in production throws on startup rather than silently falling back to in-memory storage. |
| `COORDINATOR_PIN` | **Mandatory in production** | PIN required to obtain a coordinator session. |
| `SESSION_SECRET` | Strongly recommended | HMAC key used to sign the coordinator session cookie. Falls back to a value derived from `COORDINATOR_PIN` if unset. |

### Deploy Steps
1. Push to GitHub/GitLab/Bitbucket and import into Vercel.
2. Set `DATABASE_URL`, `COORDINATOR_PIN`, and `SESSION_SECRET` in Project Settings -> Environment Variables.
3. Deploy. Vercel serves the static frontend and the `/api/*` function from this one repository.

The first request against a fresh Neon database creates its own schema (`nv_teams`, `nv_puzzle_versions`, `nv_audit_events`, `nv_delete_tokens`, `nv_app_state`, and an id-sequence table) and seeds only the 5 answer-free puzzle-slot placeholders from `src/data/puzzles.ts` — never any team data.

---

## 3. Game Structure & Flow

```
                     [REGISTER] (public /register, PENDING)
                              |
              [COORDINATOR APPROVES -> ACTIVATES]
                              |
                        [START GAME]
                 [MODULE 01] [MODULE 02] [MODULE 03] [MODULE 04]
           (parallel — players do not wait on each other)
                              |
                    4 digits, FIXED order (01->02->03->04)
                              |
                 [RECOVERY CODE] — unlocks final module, does NOT escape
                              |
              [FINAL MODULE — Constraint Breach 8x8 grid]
                              |
                server validates the board, derives an
                  8-digit code from columns A->H
                              |
                 [FINAL OVERRIDE CODE ENTRY]
                              |
                [ACCESS GRANTED / ESCAPED — frozen result]
```

Recovery Code and Final Override Code are two **separate** stages, matching the brief: the 4-digit recovery code (Module 01->02->03->04, always in that fixed order regardless of finish order) only unlocks the final module. It never freezes the timer or escapes the team. The 8-digit final override code — derived server-side from a validated Constraint Breach board — is what actually escapes the team.

---

## 4. Puzzle Content Status

Per the brief, only two puzzle *concepts* are defined (Memory Archive, Constraint Breach) and both are still being playtested. Modules 02-04 have no approved mechanic. Accordingly:

- `src/data/puzzles.ts` — production defaults. All 5 slots start `DESIGN_PENDING` with **no answer key** (no `answer`/`outputDigit`/`hint` fields at all). A coordinator fills in real content per team once a module's design is locked, via the Coordinator Dashboard (which PATCHes a real `PuzzleVersion`).
- `src/data/devFixtures.ts` — fully-worked example puzzle content with real answers, used **only** by the automated test suite. Never imported by the production database path or any client-bundled file.
- `src/server/puzzleData/constraintVariants.ts` — Constraint Breach variant fixtures (contains the actual grid solution). This lives under `src/server/` specifically so it can never end up in the client JS bundle; only server code may import it.

---

## 5. Constraint Breach — N-Queens Solver & Server-Side Validation

`src/lib/constraintBreachSolver.ts` is a pure, side-effect-free module with **no answer data in it**:
- `solveConstraintBreach()` — exact backtracking CSP solver used at puzzle-authoring time to verify a variant has exactly one solution (see `npm run test:solver`).
- `validateConstraintBreachSubmission()` — server-side check of a participant's submitted board against the assigned variant (structural validity + exact match to the known unique solution). Used by `POST /api/teams/:id/constraint-breach/submit`.
- `deriveOverrideCodeFromPlacement()` — reads agent IDs column A->H from a validated board to produce the 8-digit final override code, entirely server-side.

`GET /api/teams/:id/constraint-breach` returns only the participant-safe view (fixed agents + forbidden cells currently in play) — never the solution, and the 4th hidden forbidden cell only appears once Hint 1 has actually been used.

---

## 6. Timer, Hints, Freezing (Unchanged Core Logic)

- 25-minute default session, timestamp-derived (`startedAt`/`pausedAt`/`totalPausedMs`/`finishedAt`) — never a client-side interval as the source of truth.
- Hints are strictly sequential (1->2->3), fixed penalties (+00:30 / +01:00 / +01:30 cumulative), affect only the frozen official ranking time.
- `officialRankingSeconds = completionSeconds + hintPenaltySeconds`, frozen once on ESCAPED/TIME_EXPIRED and never recalculated.
- The persistence layer enforces this with optimistic concurrency (a `version` column / compare-and-swap update): a stale concurrent write is rejected as a conflict rather than silently overwriting a just-frozen result. See `npm run test:api`, section 12.

---

## 7. Team Lifecycle & Registration

Registration status (`PENDING -> APPROVED -> ACTIVE -> COMPLETED`, or `REJECTED`) is a field on `Team`, **independent** of the gameplay `TeamStatus` state machine (`NOT_STARTED/RUNNING/PAUSED/ESCAPED/TIME_EXPIRED`).

- `POST /api/register` — public registration form (`/register` page). Creates a `PENDING` team with a server-generated `NV-###` id.
- Coordinator manual entry (`POST /api/teams`, dashboard) creates teams through the same underlying model, `registrationSource: 'COORDINATOR_MANUAL'`.
- `game/start` refuses to run for a `PENDING`/`REJECTED` team.
- The public leaderboard only ever shows teams that reached `ESCAPED`/`TIME_EXPIRED` — which is structurally impossible for a team that was never approved/activated.

---

## 8. Security Model (Phase 2)

- **Coordinator sessions**: `POST /api/auth/coordinator/login` verifies the PIN server-side and issues a signed, HttpOnly, `SameSite=Strict` cookie (`src/server/security.ts`). Every coordinator-only route re-verifies that cookie server-side on every request — there is no client-side "logged in" flag anywhere that any route trusts.
- **No hardcoded fallback PIN** in the client bundle (verified: `dist/assets/*.js` contains no `1234` literal).
- **Answer-key secrecy**: `src/server/sanitize.ts` whitelists exactly which `Team`/`PuzzleVersion`/`ConstraintBreachVariant` fields may reach a non-coordinator client. `GET /api/state` and every participant-reachable route run through these builders. Verified in `npm run test:api` (section 4) and by grepping the built client bundle for fixture answer strings (see section 10 below).
- **Server-generated team IDs**: `NV-001`, `NV-002`, ... allocated atomically by the database (a Postgres sequence row updated with a single `UPDATE ... RETURNING`), never computed from a client-side team list.
- **Puzzle completion authorization**: every puzzle-completion route requires a coordinator session; a `PuzzleVersion.completionMode` field (`COORDINATOR_ONLY` / `SERVER_VALIDATED` / `DEV_SHORTCUT`) additionally blocks manual completion of server-validated slots (e.g. Constraint Breach) and disables `DEV_SHORTCUT` outright in production.
- **Delete Completed Result**: `POST /api/teams/:id/result/delete-token` generates a random one-character alphanumeric token **server-side**, single-use, 5-minute expiry; `POST /api/teams/:id/result/delete` requires the matching token and a coordinator session, and deletes only the frozen result fields — never the team/registration/players.
- **Audit log**: every security/result-relevant action is recorded to `nv_audit_events` (`src/server/audit.ts`), readable only by an authenticated coordinator via `GET /api/audit`.

---

## 9. Available Scripts & Testing

```bash
npm test             # logic + solver + API integration tests
npm run test:logic   # pure game-engine/state-machine tests
npm run test:solver  # N-Queens solver + submission-validation tests
npm run test:api     # integration tests against the real HTTP router (handleApiRoute)
npm run lint
npm run build        # tsc -b && vite build
npm run preview
```

`npm run test:api` exercises the actual API layer end-to-end: auth rejection on every coordinator-only route, response sanitization, registration -> approval -> activation -> play -> recovery code -> Constraint Breach -> escape, server-generated unique IDs, the random-token deletion flow, audit logging, and persistence-layer optimistic concurrency.

---

## 10. API Reference

- `GET /api/health`
- `POST /api/auth/coordinator/login`, `POST /api/auth/coordinator/logout`, `GET /api/auth/coordinator/session`
- `POST /api/register` — public team registration
- `GET /api/state` — role-aware synchronized snapshot (sanitized unless the request carries a valid coordinator session)
- `GET /api/leaderboard` — public, only participating/finished teams
- `GET /api/audit` — coordinator only
- `GET/POST /api/teams`, `GET/PATCH/DELETE /api/teams/:id` — coordinator only
- `POST /api/teams/:id/approve|reject|activate` — coordinator only
- `POST /api/teams/:id/game/start|pause|resume|reset|escape` — coordinator only
- `POST /api/teams/:id/hints/use` — coordinator only
- `POST /api/teams/:id/puzzles/:slot/complete` — coordinator only, gated by `completionMode`
- `POST /api/teams/:id/result/delete-token`, `POST /api/teams/:id/result/delete` — coordinator only
- `POST /api/teams/:id/recovery-code/verify` — participant-usable, unlocks the final module only
- `GET /api/teams/:id/constraint-breach`, `POST /api/teams/:id/constraint-breach/submit` — participant-usable, server-validated
- `POST /api/teams/:id/final-code/verify` — participant-usable, escapes the team
- `PATCH /api/settings`, `POST /api/active-team` — coordinator only
- `POST /api/dev/constraint-breach/validate` — development only, `403` in production
