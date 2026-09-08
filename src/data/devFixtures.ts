import type { PuzzleVersion, Team } from '../types'

// ============================================================================
// PROJECT NEUROVAULT — DEV / TEST FIXTURES ONLY
// ----------------------------------------------------------------------------
// !! NOT PRODUCTION DATA. Contains real example answers and named demo teams
// !! carried over from the old "Project Blackout" prototype, kept ONLY so the
// !! automated test suite (scripts/logic-test.ts) has deterministic puzzle
// !! content to exercise the engine against.
//
// This module must NEVER be imported by:
//   - src/server/db/client.ts's production (Neon) code path
//   - src/lib/storage.ts or anything else that ends up in the client bundle
//   - the default export of the in-memory repository used in production
//
// It MAY be imported by:
//   - scripts/logic-test.ts, scripts/*-test.ts
//   - the in-memory repository's *explicit* dev-seed helper, which is only
//     invoked when NV_SEED_DEV_FIXTURES=1 is set AND the app is not running
//     in production (see src/server/db/client.ts)
// ============================================================================

export const DEV_FIXTURE_PUZZLE_VERSIONS: PuzzleVersion[] = [
  // SLOT 1 -----------------------------------------------------------------
  {
    id: 'NV_MOD_01_V01', slot: 'SLOT_1', version: 'V01', title: 'Archive Sector Alpha',
    category: 'MEMORY / OBSERVATION', difficulty: 'easy', status: 'CONFIGURED',
    completionMode: 'COORDINATOR_ONLY',
    clue: 'Observe the security monitoring stream and extract the missing anomaly index.',
    data: ['Sensor sequence delta: [0x04, 0x08, 0x10, 0x20, 0x??]'],
    answer: 'Index 4', outputDigit: 4, outputFragment: 'KEY_FRAG_A4',
    hint: 'Compare consecutive timestamp increments in the monitoring log.',
  },
  {
    id: 'NV_MOD_01_V02', slot: 'SLOT_1', version: 'V02', title: 'Archive Sector Beta',
    category: 'MEMORY / OBSERVATION', difficulty: 'easy', status: 'CONFIGURED',
    completionMode: 'COORDINATOR_ONLY',
    clue: 'Observe the security monitoring stream and extract the missing anomaly index.',
    data: ['Sensor sequence delta: [0x03, 0x06, 0x0C, 0x18, 0x??]'],
    answer: 'Index 6', outputDigit: 6, outputFragment: 'KEY_FRAG_A6',
    hint: 'Compare consecutive timestamp increments in the monitoring log.',
  },
  // SLOT 2 -------------------------------------------------------------------
  {
    id: 'NV_MOD_02_V01', slot: 'SLOT_2', version: 'V01', title: 'Telemetry Investigation Alpha',
    category: 'DATA INVESTIGATION', difficulty: 'medium', status: 'CONFIGURED',
    completionMode: 'COORDINATOR_ONLY',
    clue: 'Audit system access telemetry logs to identify the anomalous access badge.',
    data: ['Log Record 118 — IN 21:03', 'Log Record 204 — IN 21:04', 'Log Record 118 — IN 21:07', 'Log Record 204 — OUT 21:09'],
    answer: '118 -> last digit 8', outputDigit: 8, outputFragment: 'KEY_FRAG_B8',
    hint: 'Match every IN entry with a corresponding OUT entry.',
  },
  {
    id: 'NV_MOD_02_V02', slot: 'SLOT_2', version: 'V02', title: 'Telemetry Investigation Beta',
    category: 'DATA INVESTIGATION', difficulty: 'medium', status: 'CONFIGURED',
    completionMode: 'COORDINATOR_ONLY',
    clue: 'Audit system access telemetry logs to identify the anomalous access badge.',
    data: ['Log Record 231 — IN 21:01', 'Log Record 145 — IN 21:05', 'Log Record 231 — OUT 21:06', 'Log Record 145 — IN 21:10'],
    answer: '145 -> last digit 5', outputDigit: 5, outputFragment: 'KEY_FRAG_B5',
    hint: 'Match every IN entry with a corresponding OUT entry.',
  },
  // SLOT 3 -------------------------------------------------------------------
  {
    id: 'NV_MOD_03_V01', slot: 'SLOT_3', version: 'V01', title: 'Neural Logic Path Alpha',
    category: 'DECISION LOGIC', difficulty: 'hard', status: 'CONFIGURED',
    completionMode: 'COORDINATOR_ONLY',
    clue: 'Traverse the neural routing logic tree to resolve the termination node.',
    data: ['Physical routing schematic card #1'],
    answer: 'Node 3', outputDigit: 3, outputFragment: 'KEY_FRAG_C3',
    hint: 'Evaluate conditional branching statements sequentially from the root.',
  },
  {
    id: 'NV_MOD_03_V02', slot: 'SLOT_3', version: 'V02', title: 'Neural Logic Path Beta',
    category: 'DECISION LOGIC', difficulty: 'hard', status: 'CONFIGURED',
    completionMode: 'COORDINATOR_ONLY',
    clue: 'Traverse the neural routing logic tree to resolve the termination node.',
    data: ['Physical routing schematic card #2'],
    answer: 'Node 1', outputDigit: 1, outputFragment: 'KEY_FRAG_C1',
    hint: 'Evaluate conditional branching statements sequentially from the root.',
  },
  // SLOT 4 -------------------------------------------------------------------
  {
    id: 'NV_MOD_04_V01', slot: 'SLOT_4', version: 'V01', title: 'Physical Security Matrix Alpha',
    category: 'ENVIRONMENTAL OBSERVATION', difficulty: 'easy', status: 'CONFIGURED',
    completionMode: 'COORDINATOR_ONLY',
    clue: 'Locate and count the active sensory nodes positioned in the containment sector.',
    data: ['Room configuration set #1'],
    answer: 'Count: 5', outputDigit: 5, outputFragment: 'KEY_FRAG_D5',
    hint: 'Inspect all containment enclosures and hardware racks.',
  },
  {
    id: 'NV_MOD_04_V02', slot: 'SLOT_4', version: 'V02', title: 'Physical Security Matrix Beta',
    category: 'ENVIRONMENTAL OBSERVATION', difficulty: 'easy', status: 'CONFIGURED',
    completionMode: 'COORDINATOR_ONLY',
    clue: 'Locate and count the active sensory nodes positioned in the containment sector.',
    data: ['Room configuration set #2'],
    answer: 'Count: 3', outputDigit: 3, outputFragment: 'KEY_FRAG_D3',
    hint: 'Inspect all containment enclosures and hardware racks.',
  },
  // FINAL SLOT -----------------------------------------------------------------
  {
    id: 'NV_FINAL_MOD_V01', slot: 'FINAL_SLOT', version: 'V01', title: 'Core Grid Synchronization Alpha',
    category: 'COLLABORATIVE CONSTRAINT RESTORATION', difficulty: 'hard', status: 'CONFIGURED',
    completionMode: 'SERVER_VALIDATED',
    clue: 'Restore the corrupted core matrix. All four operators must collaborate to stabilize system state.',
    data: ['8x8 neural security grid alignment protocol'],
    answer: 'Grid Stabilized', outputFragment: 'FINAL_STABILIZED',
    hint: 'Ensure zero interference between autonomous subsystem nodes.',
  },
]

function fixtureAssignments(p1: string, p2: string, p3: string, p4: string) {
  return [
    { slot: 'SLOT_1' as const, puzzleVersionId: p1 },
    { slot: 'SLOT_2' as const, puzzleVersionId: p2 },
    { slot: 'SLOT_3' as const, puzzleVersionId: p3 },
    { slot: 'SLOT_4' as const, puzzleVersionId: p4 },
    { slot: 'FINAL_SLOT' as const, puzzleVersionId: 'NV_FINAL_MOD_V01' },
  ]
}

export function devFixtureTeam(overrides: Partial<Team> & Pick<Team, 'id' | 'name' | 'puzzleAssignments'>): Team {
  const now = Date.now()
  return {
    members: ['Player 1', 'Player 2', 'Player 3', 'Player 4'],
    captain: 'Player 1',
    contactEmail: 'team@example.test',
    contactMobile: '+919876543210',
    registrationStatus: 'ACTIVE',
    registeredAt: now,
    registrationSource: 'COORDINATOR_MANUAL',
    finalCodeTransform: {},
    finalModuleEnabled: false,
    maxTimeSeconds: 25 * 60,
    status: 'NOT_STARTED',
    totalPausedMs: 0,
    puzzleCompleted: { SLOT_1: false, SLOT_2: false, SLOT_3: false, SLOT_4: false },
    finalPuzzleCompleted: false,
    puzzleOutputs: {},
    hintsUsed: 0,
    hintLevelLog: [],
    attempts: 0,
    attemptLog: [],
    version: 1,
    updatedAt: now,
    ...overrides,
  }
}

/** Demo/test-only teams — never seeded into a production database. */
export const DEV_FIXTURE_TEAMS: Team[] = [
  devFixtureTeam({
    id: 'T01',
    name: 'Neural Ninjas',
    members: ['Aisha', 'Ravi', 'Meera', 'Devan'],
    captain: 'Aisha',
    puzzleAssignments: fixtureAssignments('NV_MOD_01_V01', 'NV_MOD_02_V01', 'NV_MOD_03_V01', 'NV_MOD_04_V01'),
  }),
  devFixtureTeam({
    id: 'T02',
    name: 'Data Warriors',
    members: ['Sana', 'Kabir', 'Nisha', 'Arjun'],
    captain: 'Sana',
    puzzleAssignments: fixtureAssignments('NV_MOD_01_V02', 'NV_MOD_02_V02', 'NV_MOD_03_V02', 'NV_MOD_04_V02'),
  }),
]
