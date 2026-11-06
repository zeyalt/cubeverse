# Smart tab → spec parity (P1 / MVP)

Reference: `cubeverse-spec.md`. Decisions: finish P1 properly · self-contained Smart tab ·
separate `smart_solves` table · no manual timer here (Practice already has one).

Already done in commits 45bb728…1ed5879: connect/battery/mark-as-solved, scramble checking
with correction hints, auto start/stop on cube timestamps, live 3D, CFOP splits, session insights.

## S1 — Pure metrics (no UI, no cube)
- [x] `fluency` in `analysis.ts`: `1 − Σ(gaps > 500 ms) / total`, spec §4.6. Tune so a slow solve ≈ 20–30%
- [x] `turns` as HTM (`R2` = 1 turn) — spec §4.6 says so; the cube reports quarter turns, so this is a re-count, not a length
- [x] `lib/smartcube/sessionStats.ts`: single/ao5/ao12/ao50/ao100 × NOW/BEST, reusing `aoN` + `currentAoN`
- [x] Tests for all three, incl. DNF handling (spec §4.7 average rules)

## S2 — Persistence (spec §7, acceptance #7)
- [x] `supabase/migrations/0016_smart_solves.sql` — own table, `owner_all` RLS per 0014
- [x] `recordSmartSolve` / `listSmartSolves` / `updateSmartSolve` / `deleteSmartSolve` in `lib/client/actions.ts`
- [x] Offline outbox: `entityType: "smartSolve"` in `lib/offline/queue.ts` + a flusher in `sync.ts`
- [x] **Regression test for the three-place field list** — a field added to the payload but missed in
      `sync.ts`'s explicit arg object is silently dropped (plan §7)
- [x] `useSmartSolve` loads history from the server and saves on solve
- [x] Verify: 3 solves appear in the tab and **not** in PBs/badges/Analytics

## S3 — Timer screen parity (spec §4.1–4.4, 4.6, 4.7)
- [x] Header pill: session name + connection/battery chip (§4.1.1)
- [x] Scramble navigator `‹ #84 [3x3x3] ›` (§4.1.2)
- [x] Full scramble text with done-dimmed / next-enlarged / green-flash (§4.3) — replaces the
      current "next move only" panel, which is less informative than the spec
- [x] Hide scramble, navigator, stats and bottom nav while solving (§4.4)
- [x] Phase bar: single proportional pill incl. pause segments, **collision-safe labels** (§4.6 —
      the reference app's own labels overlap; the spec calls that a flaw to avoid)
- [x] Metrics line `TPS │ turns │ fluency` (§4.6)
- [x] Stats table, two columns, PB highlight in accent (§4.7)
- [x] `+2` / DNF / delete on the finished solve (§4.6, §9)
- [x] `U×4` confirm / `D×4` mark-as-solved cube gestures (§4.5)
- [x] Solve detail (tap a solve in the stats table to see its reconstruction)
- [ ] **Move-by-move replay animation** — not built; the move stream is stored, so it is the
      3D view plus a scrubber, but it needs the hardware pass first

## Out of scope now
OLL/PLL case names (needs the 78-case self-proving tables), History/Insights charts (P2),
export (P2), trainer (P3), Compete (P4), premium (P5), gyro (hardware reports `gyroSupported: false`).

## Review

**S1 — metrics.** `fluency()` and `htmTurns()` in `analysis.ts`; `sessionStats.ts` for the
NOW/BEST table. Two findings worth recording:
- `tps` was `(moves − 1) / time`, counting intervals rather than turns, and counted quarter turns.
  Both were wrong against the spec's own worked example (121 turns ÷ 75.09 s = 1.61) and against
  every other timer. Now HTM turns ÷ solve time.
- A fixture I wrote for "the ao5 slips after a slow solve" passed wrongly: one outlier is simply
  trimmed away by a trimmed mean and leaves the average untouched. It takes two. The code was
  right; the test was the thing asserting nonsense.

**S2 — persistence.** Own table (`0016`), own actions module, own outbox entity type. The payload
crosses the queue as one opaque object rather than being rebuilt field by field, which is what made
the practice queue's three-place field list a silent-data-loss hazard; `smartSolveQueue.test.ts`
compares the round trip key for key so that can't regress. `reconstruction` is stored even for
unrecognised methods — an earlier draft nulled it and threw away the solve's TPS and fluency with it.

**S3 — timer screen.** Header pill with battery thresholds, scramble navigator, full scramble text
with position, phase bar, stats table, penalties, `U×4`/`D×4` gestures, and the bottom nav
unmounted during a solve.
- The phase bar's label collision is solved in `phaseBar.ts`, not in CSS: segments narrower than 9%
  of the bar drop to a legend row. The spec names the overlapping OLL/PLL labels as a flaw in the
  reference app, and "don't overlap" is a geometry decision with a right answer, so it is tested.
- My first gesture-window test was also wrong: at the timestamps I picked, no four turns ever fit
  inside the window, so `null` was correct. Split into two tests that each say what they mean.

**Verified:** 218 tests, `tsc --noEmit`, `eslint`, build, and the performance budget (first paint
1,205,563 bytes against a 1,240,000 limit; three.js still entirely in lazy chunks).
**Not verified:** nothing in S3 has been in front of the physical cube, and migration 0016 has not
been applied to a database. Both need a hardware pass.
