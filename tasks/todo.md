# Smart tab → spec parity (P1 / MVP)

Reference: `cubeverse-spec.md`. Decisions: finish P1 properly · self-contained Smart tab ·
separate `smart_solves` table · no manual timer here (Practice already has one).

Already done in commits 45bb728…1ed5879: connect/battery/mark-as-solved, scramble checking
with correction hints, auto start/stop on cube timestamps, live 3D, CFOP splits, session insights.

## S1 — Pure metrics (no UI, no cube)
- [ ] `fluency` in `analysis.ts`: `1 − Σ(gaps > 500 ms) / total`, spec §4.6. Tune so a slow solve ≈ 20–30%
- [ ] `turns` as HTM (`R2` = 1 turn) — spec §4.6 says so; the cube reports quarter turns, so this is a re-count, not a length
- [ ] `lib/smartcube/sessionStats.ts`: single/ao5/ao12/ao50/ao100 × NOW/BEST, reusing `aoN` + `currentAoN`
- [ ] Tests for all three, incl. DNF handling (spec §4.7 average rules)

## S2 — Persistence (spec §7, acceptance #7)
- [ ] `supabase/migrations/0016_smart_solves.sql` — own table, `owner_all` RLS per 0014
- [ ] `recordSmartSolve` / `listSmartSolves` / `updateSmartSolve` / `deleteSmartSolve` in `lib/client/actions.ts`
- [ ] Offline outbox: `entityType: "smartSolve"` in `lib/offline/queue.ts` + a flusher in `sync.ts`
- [ ] **Regression test for the three-place field list** — a field added to the payload but missed in
      `sync.ts`'s explicit arg object is silently dropped (plan §7)
- [ ] `useSmartSolve` loads history from the server and saves on solve
- [ ] Verify: 3 solves appear in the tab and **not** in PBs/badges/Analytics

## S3 — Timer screen parity (spec §4.1–4.4, 4.6, 4.7)
- [ ] Header pill: session name + connection/battery chip (§4.1.1)
- [ ] Scramble navigator `‹ #84 [3x3x3] ›` (§4.1.2)
- [ ] Full scramble text with done-dimmed / next-enlarged / green-flash (§4.3) — replaces the
      current "next move only" panel, which is less informative than the spec
- [ ] Hide scramble, navigator, stats and bottom nav while solving (§4.4)
- [ ] Phase bar: single proportional pill incl. pause segments, **collision-safe labels** (§4.6 —
      the reference app's own labels overlap; the spec calls that a flaw to avoid)
- [ ] Metrics line `TPS │ turns │ fluency` (§4.6)
- [ ] Stats table, two columns, PB highlight in accent (§4.7)
- [ ] `+2` / DNF / delete on the finished solve (§4.6, §9)
- [ ] `U×4` confirm / `D×4` mark-as-solved cube gestures (§4.5)
- [ ] Solve detail + replay (§4.8 History) — only if S1–S3 land cleanly

## Out of scope now
OLL/PLL case names (needs the 78-case self-proving tables), History/Insights charts (P2),
export (P2), trainer (P3), Compete (P4), premium (P5), gyro (hardware reports `gyroSupported: false`).

## Review
_(filled in as each stage lands)_
