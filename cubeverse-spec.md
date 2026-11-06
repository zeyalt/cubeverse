# Cubeverse — Product, Technical & Design Specification

**Version:** 0.1 (draft) · **Date:** 2026-11-07
**Goal:** Replicate the core experience of a smart-cube speedcubing timer (reference: the Acubemy Android app) as an original app, **Cubeverse**, driven by a Bluetooth smart cube.

> **Legal / originality note.** This spec describes *features and behaviours* observed in a reference app. Cubeverse must use its own name, logo, copy, iconography, colour treatment, and illustrations. Don't ship the reference app's assets or text. Algorithm databases (OLL/PLL/F2L/etc.) must come from sources whose licences permit use (check the licence of each dataset before bundling).

---

## 0. How to read this document

| Tag | Meaning |
|---|---|
| **[OBSERVED]** | Directly visible in the screenshot / screen recording |
| **[INFERRED]** | Reasonable interpretation of what was shown; verify before building |
| **[PROPOSED]** | Not seen in the material; my recommendation to fill the gap |

### 0.1 Source material reviewed
- **Screenshot:** post-solve timer screen (solve #84, 1:15.09, 1.61 TPS, 121 turns, 22% fluency, CROSS/F2L/OLL/PLL phase bar, stats table).
- **Screen recording (70 s, 1080×2340, Android):** tour of all 5 bottom tabs → Connect flow → "Select Your Cube" scan → device found (`GANi4_5B84`) → "Sync your cube" dialog → scramble-following on the physical cube with live 3D cube → "You can start!" → live solve timer (1.37 → 3.36 → 5.37 → 7.37 s) with scramble/stats hidden.

### 0.2 What was *not* visible
History list detail, Insights charts, the algorithm trainer (paywalled), Daily Scramble / Tournament / Match internals, Settings sub-pages, DNF/+2 handling, inspection timer, manual-timer details. Those sections are **[PROPOSED]** or based only on landing-page text.

---

## 1. Product overview

### 1.1 Vision
A mobile-first speedcubing companion where the **smart cube is the timer**: it auto-starts on your first move, auto-stops on solved, records every turn with timestamps, and turns that raw move log into phase splits, TPS, fluency, replays, and training.

### 1.2 Core value (derived from the reference)
1. Connect a smart cube in < 15 s.
2. Follow the scramble *on the cube*, with live per-move feedback.
3. Hands-free timing (start on first move, stop on solved state).
4. Automatic CFOP phase analysis (Cross / F2L / OLL / PLL) with pauses visible.
5. Standard speedcubing stats (single, ao5, ao12, ao50, ao100) with PB highlighting.
6. Algorithm learning/training and competition (later phases).

### 1.3 Phasing

| Phase | Scope | Notes |
|---|---|---|
| **MVP (P1)** | BLE connect, sync, scramble generator + following, live 3D cube, auto timer, solve save, stats table, result screen with TPS/turns, phase bar, manual timer fallback | Everything on the Timer tab |
| **P2** | History, Insights (TPS/splits trends), replay, export (CSV/JSON/csTimer), settings, accounts + cloud sync, multiple sessions | Stats + Settings tabs |
| **P3** | Algorithm library + trainer (OLL/PLL/F2L, then CMLL/ZBLL), learned-state tracking | "Learn" tab |
| **P4** | Daily scramble, tournaments, local + online matches, leaderboards, anti-cheat verification | "Compete" tab |
| **P5** | Premium/subscription, multi-brand cube support, 2x2/other events (manual), widgets | Monetisation |

---

## 2. Platform & architecture recommendation

### 2.1 Client options

| Option | Pros | Cons |
|---|---|---|
| **A. PWA (Next.js) + Web Bluetooth** — *recommended for MVP* | One codebase, fast iteration, deploys on Vercel, mature open-source smart-cube JS drivers | Web Bluetooth works on **Chrome/Edge (Android, desktop)** only — **not iOS Safari** (iOS needs a wrapper such as Bluefy, or a native shell); background BLE is limited |
| **B. React Native + `react-native-ble-plx`** | iOS + Android, background-capable | Must port/wrap protocol drivers; 3D needs `expo-gl`/three |
| **C. Capacitor wrapper around the PWA + BLE plugin** | Reuses PWA UI, gets iOS BLE | Plugin quirks; driver logic still JS |

**Recommendation:** Build the PWA first (matches the reference's Android flow; fastest path to validate), keep the BLE layer behind an interface (§5.2) so a Capacitor/native BLE transport can be swapped in for iOS later.

### 2.2 Suggested stack
- **UI:** Next.js (App Router) + TypeScript + Tailwind; installable PWA (manifest, offline shell).
- **State:** Zustand (or Redux Toolkit) for live solve state; TanStack Query for server data.
- **3D cube:** `cubing.js` (`twisty`) for MVP, or a custom three.js / react-three-fiber cube if you need gyro-driven orientation and custom stickering.
- **Cube logic:** `cubing.js` (`KPuzzle`, scramble generation) *or* a small in-house facelet engine (§6).
- **Smart-cube drivers:** use an existing open-source driver (e.g. `gan-web-bluetooth` by afedotov; `cubing.js` `bluetooth` module; csTimer's bluetooth code is a good protocol reference). **Do not reimplement encryption from scratch** unless necessary. Check each licence.
- **Backend:** Supabase (Postgres + Auth + Realtime + Storage) — fits P2–P4.
- **Workers:** Web Worker for scramble generation and phase analysis (keep the main thread free for 60 fps timer).
- **Analytics/telemetry:** privacy-respecting, opt-in.

### 2.3 High-level modules

```
┌────────────────────────── UI (React) ──────────────────────────┐
│ Timer │ Learn │ Stats │ Compete │ Settings                      │
└───────┬──────────────────────────────────────────────┬─────────┘
        │ events/state                                  │ queries
┌───────▼───────────┐  ┌──────────────┐  ┌──────────────▼────────┐
│ SolveController   │  │ ScrambleSvc  │  │ Stats / Persistence   │
│ (state machine)   │  │ (worker)     │  │ (IndexedDB ⇄ Supabase)│
└───────┬───────────┘  └──────────────┘  └───────────────────────┘
        │ SmartCube events (move, facelets, gyro, battery)
┌───────▼───────────┐   ┌────────────────────────┐
│ CubeEngine        │◀──│ SmartCubeTransport     │
│ (state, phases)   │   │ (driver per brand)     │
└───────────────────┘   └───────────┬────────────┘
                                    │ Web Bluetooth / native BLE
                               [ Smart cube ]
```

---

## 3. Information architecture

### 3.1 Bottom navigation (5 tabs) **[OBSERVED]**

| # | Icon (reference) | Tab | Content seen |
|---|---|---|---|
| 1 | Play ▶ (active = orange, in a rounded square) | **Timer** | Session, scramble, 3D cube, time, stats |
| 2 | Graduation cap, red badge "9+" | **Learn / Train** | Paywall: "Training is a premium feature" |
| 3 | Line chart | **Stats** | History, Insights cards; Algorithms list with learned counts |
| 4 | Crossed swords, orange flame badge | **Compete** | Daily Scramble, Tournaments, Local Match, Online Match |
| 5 | Gear | **Settings** | Account, Devices, Preferences, Export Data, Subscription, Support, Discord, Sign Out |

Spec for Cubeverse:
- Active tab = accent-coloured icon inside a subtle rounded-square chip (`surface-2`).
- Badges: numeric (red) for unread/new content; dot/flame (orange) for streaks/live events. Badge rules **[PROPOSED]**: Learn = number of algorithms due for review; Compete = streak or live tournament.
- Bottom nav is **hidden during an active solve** **[OBSERVED]** (see §4.4).
- Android system nav (3-button) must not overlap: respect safe-area insets.

### 3.2 Route map

```
/timer                      (default)
/learn                      (premium gate → /learn/algorithms/:set → /learn/train/:caseId)
/stats                      (History, Insights, Algorithms summary)
/stats/history              /stats/history/:solveId (replay)
/stats/insights
/compete                    /compete/daily  /compete/tournaments  /compete/match/local|online
/settings                   /settings/account|devices|preferences|export|subscription
```

---

## 4. Screen specifications

### 4.1 Timer screen — layout **[OBSERVED]**

Top → bottom:

1. **Header pill** (full-width, ~60 dp tall, fully rounded, `surface-1`):
   - Left: **Session name** ("Default Session") + chevron → opens session picker.
   - Right (connected): outlined pill with **green dot + battery %** (e.g. `● 32%`) + chevron → device menu (disconnect, rename, hardware info, recalibrate).
   - Right (disconnected): `Bluetooth icon + "Connect"`.
   - Right (connecting): dimmed `Connecting…`.
2. **Scramble navigator:** `‹`  `#84`  `[3x3x3 ▾]`  `›`
   - `#N` = solve number in session (muted).
   - Event pill: orange text, orange outline, chevron → event picker (MVP: 3x3x3; others manual-only).
   - Arrows: previous/next scramble (previous = re-view scramble of an earlier solve; next = skip/generate new).
3. **Scramble text:** monospace, wrapped to ~3 lines, centred (see §4.3 for progress highlighting). The reference screenshot shows a 20-move random-state scramble.
4. **Hero zone:** 3D cube (when connected, §4.4) + **time display**.
5. **Metrics line** (post-solve only): `1.61 TPS │ 121 turns │ 22% fluency`.
6. **Phase bar** (post-solve only, §4.6).
7. **Stats table** (§4.7) with a collapse/expand chevron (`^`) at the bottom edge.
8. **Bottom nav.**

### 4.2 Idle / connection states **[OBSERVED]**

| State | Hero zone content | Header right |
|---|---|---|
| Disconnected | Large "Connect" button (BT icon, pill, `surface-2`, blue-tinted) over a faint translucent cube watermark; helper text beneath: `or [tap & hold] to start timer`; last time shown below (e.g. 23.58) | `Connect` |
| Connecting | Watermark + "Connecting… / Connecting to Bluetooth…" in small text | `Connecting…` (dimmed) |
| Connected, syncing | Modal "Sync your cube" (§4.5) | green dot + % |
| Connected, scramble pending | 3D live cube, scramble being followed | green dot + % |

Manual fallback **[OBSERVED text]**: "tap & hold to start timer" — the app supports a classic touch-hold-release timer when no cube is connected. Spec: hold ≥ 300 ms (turns green = ready), release to start, tap anywhere to stop. Also keyboard `Space` on desktop.

### 4.3 Scramble following **[OBSERVED]**

While the user performs the scramble on the physical cube:
- Moves **already done**: dimmed grey.
- **Current/next move**: enlarged (~1.4×) and bright white.
- Move just completed correctly: flashes **green** briefly.
- The 3D cube mirrors the physical cube in real time, including orientation (see §5.5).
- When the final scramble move is completed and cube state == expected scrambled state, the scramble text is **replaced by "You can start!"** (monospace, centred, muted) and the cube stays displayed. Solve number remains shown (`#83`, muted).

**Error handling [PROPOSED]** (not shown in the recording):
- Wrong move → highlight in red; show the **corrective inverse move(s)** needed (e.g. user did `R` instead of `R'` → show `R2`, or "undo R").
- Partial turn / double-turn detection: a `U2` must accept `U U` within a window (≤ 500 ms between quarter turns) **and** a single driver-reported half turn if the cube provides it.
- Allow "skip scramble check" (long-press on scramble → "Start anyway").

**Algorithm (see §6.3):** compare the incoming move against `scramble[i]`; handle `X`, `X'`, `X2` as: `X2` requires two quarter turns in the same direction; wrong-direction partials are tracked as a pending correction.

### 4.4 Live solve view **[OBSERVED]**

- Trigger: **first move after "You can start!"** starts the timer (no button).
- While solving the UI is minimal:
  - Scramble, `‹ #N ›`, stats table, and bottom nav **are hidden**.
  - Header pill is hidden in the later frames of the recording; keep only the **3D cube** and the **running time**.
  - Cube ≈ 70–80 dp wide, centred, above the time; the time uses a large monospace font.
  - Cube continues to mirror the physical cube (orientation + turn animation).
- Time format while running: `SS.cc` (e.g. `7.37`), switching to `M:SS.cc` after 60 s (e.g. `1:15.09`). Update at display refresh rate (use `requestAnimationFrame`, **not** `setInterval`).
- Option **[PROPOSED]**: "Hide time while solving" (shows `Solve…`) and "Update every 0.1 s".
- Stop trigger: **cube reaches solved state** (any orientation) → timer stops on the **timestamp of the last move** reported by the cube, not on the phone's receive time.

### 4.5 "Select Your Cube" & "Sync your cube" dialogs **[OBSERVED]**

**Select Your Cube** (bottom-sheet-style centred modal, dark, rounded 24 dp):
- Title row: BT icon + "Select Your Cube" + ✕ close.
- Sub-row: spinner + "Scanning for cubes…"
- Empty state: "No devices found yet. Make sure your cube is turned on and nearby."
- Result row: BT icon, **device name** (`GANi4_5B84`), **signal-strength bars** (green) at right. Tapping a row connects.
- Footer: full-width **Cancel** button (`surface-2`).
- Scan runs for as long as the dialog is open (≥ 20 s observed with no result, then found). Background behind modal is dimmed/blurred, the header shows "Connecting…" once a device is selected.

**Sync your cube** (modal shown after connection):
- Big **3D cube** (~160 dp) showing the app's *tracked state*, live-updating and rotating as the physical cube is moved.
- Title: "Sync your cube"
- Body: "This is the tracked state of your cube. Check that it matches the physical cube in your hands."
- Primary text-button (orange, outlined): **"That's correct [U4]"**
- Divider text: "Doesn't match? Solve your physical cube, then mark it as solved."
- Secondary button: **"Mark as solved [D4]"**
- ✕ close.

**[INFERRED]** The bracketed codes `[U4]` and `[D4]` are **cube gestures**: turning the **U face four times** confirms; turning the **D face four times** marks the cube as solved — so the user can confirm without touching the phone. Implement as gesture shortcuts and render the hint chips.

Behaviour spec:
- If the cube reports full facelet state on connect (GAN gen2+ do), pre-fill tracked state from it; user still confirms.
- "Mark as solved" → resets internal state to solved **and** (if supported by driver) sends the cube a reset-state command.
- Persist "last confirmed sync" per device; skip the dialog on quick reconnect if state was solved on disconnect **[PROPOSED]**.

### 4.6 Post-solve analysis block **[OBSERVED — screenshot]**

For solve #83 shown in solve slot #84 (the app immediately loads the *next* scramble beneath the result):

```
1:15.09                                   ← final time (hero; faint 3D cube watermark behind)
1.61 TPS │ 121 turns │ 22% fluency        ← metrics line

18.03            43.40          4.71  8.94
[████████░░░▒▒▒▒████▒▒███████████▒███▒███]   ← phase bar
CROSS             F2L            OLL  PLL
```

**Observations**
- Phase times sum to 75.08 s ≈ final 75.09 s (rounding) → the bar covers 100 % of the solve.
- TPS check: 121 turns ÷ 75.09 s = **1.61** ✓ (so TPS = turns / total time).
- Bar is a single rounded-pill, ~7 dp tall, segmented proportional to time, with phase **colours** (sampled): Cross `#7C60AB` (purple) · F2L `#52509B` (indigo) · OLL `#4E80BD` (blue) · PLL `#5EA68E` (green).
- **Darker thin segments** (`#282844`-ish) between/within phases → **[INFERRED] pauses / recognition gaps** (long gaps between consecutive moves). F2L is shown as several blue chunks separated by dark gaps ≈ the four slot insertions with thinking pauses between.
- Labels sit under the bar, left-aligned to each phase's start; time values above.
- **Known flaw to avoid:** in the reference, the OLL (`4.71`) and PLL (`8.94`) values overlap when segments are narrow. Cubeverse must collision-detect labels (stagger vertically, abbreviate, or move to a legend row when a segment < ~48 dp).

**Metric definitions for Cubeverse**

| Metric | Definition | Status |
|---|---|---|
| Time | `t_lastMove − t_firstMove` using cube timestamps (ms precision, show 2 dp truncated) | PROPOSED |
| Turns | Count of face turns (HTM-style; `X2` = 1 turn) from the move log **[INFERRED]** | verify |
| TPS | `turns / time_seconds` (2 dp) | OBSERVED (verified arithmetically) |
| Fluency | **Unknown formula.** Proposal: `1 − (Σ pause durations / total time)`, where a pause = inter-move gap > 0.5 s (configurable). Alternative: share of move-intervals below a TPS threshold | PROPOSED — tune so a typical slow solve ≈ 20–30 % |
| Phase time | Time from phase start (previous phase end) to phase end, including pauses | PROPOSED |
| Recognition time | Gap between last move of previous phase and first move of next phase (OLL/PLL especially) | PROPOSED |

### 4.7 Stats table (Timer tab) **[OBSERVED]**

Two-column layout, monospace, tabular numerals, small (~12 dp):

**Left: recent solves** (newest first, 5 rows): `TPS` | `TIME`
```
1.61   1:15.09
2.80   23.58
4.33   15.00
5.81   21.18
3.89   24.65
```
Header row labels (`TPS`, `TIME`) uppercase, muted.

**Right: aggregates** — rows `single / ao5 / ao12 / ao50 / ao100`, columns `NOW` and `BEST`:
```
            NOW      BEST
single   1:15.09    13.67
ao5        23.14    17.51
ao12       22.92    22.36
ao50       39.44    38.69
ao100          -        -
```
Rules:
- `NOW` = current rolling average ending at the latest solve; `-` if fewer solves than N.
- `BEST` = session (or all-time; make configurable) best.
- **PB highlight:** when `NOW == BEST` (just set a record) render in **accent orange**; the row's label too (seen on the earlier frames: `ao12`, `ao50` rows orange). The solve list also highlights the **best single** row in orange.
- Average method **[PROPOSED]**: WCA-style trimmed mean — drop best and worst solve of the window for ao5/ao12; drop top & bottom 5 % for ao50/ao100; DNF counts as worst; > 1 DNF in ao5 → DNF.
- Chevron `^` at bottom → expands a sheet (full solve list, mean, best, worst, std-dev) **[PROPOSED]**.
- Time formatting: `SS.cc` < 60 s; `M:SS.cc` ≥ 60 s; `H:MM:SS.cc` ≥ 1 h. Truncate (don't round) to centiseconds, per WCA.

### 4.8 Stats tab **[OBSERVED landing page]**

- Two cards side by side: **History** ("View your solve history, charts, and averages." → *Open*) and **Insights** ("TPS analysis, splits, and performance insights." → *Open*).
- Section **Algorithms** — list rows with thumbnail, set name, learned/total, chevron:
  - OLL — 24/57 learned · PLL — 17/21 · F2L (no count) · CMLL — 0/42 · ZBLL — 0/472
  - Totals match the real case counts (OLL 57, PLL 21, F2L 41, CMLL 42, ZBLL 472).
  - Thumbnails: top-down case diagrams (OLL/PLL/CMLL/ZBLL) with yellow stickers, 3D cube for F2L.

**History [PROPOSED]:** session filter, date range, line chart (time + ao5/ao12), histogram, sortable list; tap row → solve detail (time, scramble, phases bar, TPS, replay, penalty edit, delete, share).
**Insights [PROPOSED]:** TPS trend, phase-split trend (stacked), recognition-time per OLL/PLL case, pause heatmap, "weakest cases", move-count distribution, time-of-day performance.

### 4.9 Learn / Train tab **[OBSERVED paywall]**

Paywall card: crown icon in a circle, title "Premium Feature", "Training is a premium feature", description ("practice and learn algorithms… suggests new algorithms based on your skill and helps you easily memorize them"), primary gradient button **"Upgrade to Premium"** with sub-label "7-Day Free Trial".

Cubeverse trainer spec **[PROPOSED]**:
1. Pick set (OLL/PLL/F2L/CMLL/ZBLL) → case grid with learned status.
2. Case detail: diagram, algorithm(s), animation (`twisty`), mark learned.
3. **Smart-cube drill:** app generates a scramble that yields the case; user solves the case on the cube; success = target sub-state reached (e.g. OLL done, or full solved for PLL); record **recognition time** (time to first move) and **execution time**.
4. Spaced-repetition scheduler (SM-2 or FSRS-lite) using per-case time + success.
5. Suggest next case: lowest learned-confidence × highest frequency.

### 4.10 Compete tab **[OBSERVED landing page]**

- **Daily Scramble** (orange flame dot): "Compete with cubers worldwide! You have one attempt at today's scramble. Your time will be added to the global leaderboard." CTA *Attempt Today's Scramble*; link *View Leaderboard*.
- **Tournaments:** "Join tournaments, compete in timed phases, and climb the leaderboard to win prizes and earn badges." Link *View Tournaments*.
- **Local Match:** "Challenge a friend side by side on the same scramble." *Start*.
- **Online Match:** "Race against other cubers online in real-time matches." *Start*.

**[PROPOSED] Cubeverse differentiator — verifiable results:** because the cube emits a timestamped move log, the server can **re-simulate the log against the official scramble** and reject any solve that doesn't reach solved state or has impossible inter-move timings. This makes smart-cube leaderboards trustworthy; mark leaderboard entries as "verified".

### 4.11 Settings tab **[OBSERVED landing page]**

Rows (icon-in-rounded-square, title, subtitle, chevron):
- **Account** — Profile, badges & email preferences
- **Devices** — Connected cubes & device settings
- **Preferences** — Visual, sound & scramble settings
- **Export Data** — Download your solve data
- **Subscription** — Manage your plan & billing
- *Community and support* section: **Support** (FAQ, contact & community help), **Join our Discord** (external link icon)
- **Sign Out** (red text button at bottom)

Additional **[PROPOSED]** preferences: inspection on/off + length (15 s, voice alerts), hide time while solving, time precision (cc / ms), theme, cube colour scheme / stickerless, 3D cube size & animation speed, haptics, sounds, scramble length / type, penalty rules, auto-save on solved, "ignore first N turns after scramble complete".

---

## 5. Smart-cube connectivity (technical)

### 5.1 Supported hardware strategy
- **Reference device in the video:** `GANi4_5B84` (advertised BLE name). GAN cubes use name prefixes (`GAN…`, `GANi…`), and use **encrypted** GATT protocols (generations "Gen2/Gen3/Gen4").
- **Start with GAN** (best documented in open source) and design a driver interface to later add **GoCube, Giiker/Xiaomi, MoYu 32, QiYi**, etc.

### 5.2 Transport & driver interface **[PROPOSED]**

```ts
interface SmartCubeDriver {
  readonly brand: 'gan' | 'gocube' | 'giiker' | 'moyu' | 'qiyi';
  connect(device: BluetoothDevice | NativeDevice): Promise<void>;
  disconnect(): Promise<void>;
  on(event: 'move', cb: (e: MoveEvent) => void): void;
  on(event: 'facelets', cb: (e: { facelets: string; serial?: number }) => void): void;
  on(event: 'gyro', cb: (e: { q: [number, number, number, number]; t: number }) => void): void;
  on(event: 'battery', cb: (e: { percent: number; charging?: boolean }) => void): void;
  on(event: 'disconnect', cb: () => void): void;
  requestFacelets(): Promise<string>;     // full 54-char state
  requestBattery(): Promise<number>;
  requestHardwareInfo(): Promise<HardwareInfo>;
  resetState?(): Promise<void>;           // "mark as solved" on-cube
}

interface MoveEvent {
  face: 'U'|'R'|'F'|'D'|'L'|'B';
  direction: 'CW' | 'CCW';               // quarter turn; half turns = 2 events
  cubeTimestampMs: number;                // cube clock, monotonic
  localTimestampMs: number;               // performance.now() on receipt
  serial?: number;                        // for gap detection
}
```

### 5.3 Web Bluetooth specifics (PWA)
- Must be triggered by a **user gesture** (`navigator.bluetooth.requestDevice`).
- Filters: `namePrefix` list (`GAN`, `MG`, `AiCube`, etc. — maintain in a config) + `optionalServices` for each supported brand's service UUID. **Verify UUIDs against the reference library you adopt**; the GAN generations use distinct primary services (Gen2 `6e400001-b5a3-f393-e0a9-e50e24dc4179`, Gen3 `8653000a-43e6-47b7-9cb0-5fc21d4ae340`, Gen4 `00000010-0000-fff7-fff6-fff5fff4fff0` — confirm before hard-coding).
- **Encryption key derivation** for GAN needs the cube's **MAC address**. Web Bluetooth doesn't expose it directly: read it from **advertisement manufacturer data** via `device.watchAdvertisements()` (Chrome flag/permissions may apply) or fall back to a **manual MAC entry** prompt. Plan for this UX path ("Can't read cube address — enter it from the cube's label / BLE scanner app").
- Use `gattserverdisconnected` for drop detection; implement **auto-reconnect** with exponential backoff (1 s, 2 s, 4 s … cap 15 s).
- Scan UI behaviour in the reference (device chooser list with RSSI bars) is **not** natively available in Web Bluetooth (Chrome shows its own chooser). To replicate the in-app list, use a **native/Capacitor BLE plugin** (or accept the Chrome chooser in the PWA MVP and style the surrounding flow only).
- Android permissions (native): `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT` (Android 12+), location for ≤ 11.

### 5.4 Timing accuracy (critical)
- Use **cube-side timestamps** for solve time and move gaps; BLE notification latency/jitter on the phone is 10–50 ms and variable.
- Cube clocks can drift/reset: normalise per solve (`t0 = first move's cube timestamp`).
- Handle **packet loss**: use move **serial numbers**; on a gap, request the missed moves from the cube (Gen2+ supports a "last N moves" request), else re-request facelets and rebuild state (move log gets a flagged gap).
- Store both timestamps per move for debugging.

### 5.5 Orientation & gyro
- Most smart cubes report face turns **relative to the cube's internal frame** (centres fixed), independent of how the user holds it. So moves are valid for logic irrespective of rotation.
- The reference shows the 3D cube **freely rotating** to match the hand → implies **IMU/gyro quaternion** streaming (GAN i3/i4 class). Spec: if gyro available, apply the quaternion (with smoothing/slerp, ~60 Hz) to the 3D model; otherwise show a fixed-orientation cube.
- Provide "Recalibrate orientation" (set current quaternion as identity) in the device menu **[PROPOSED]**.

### 5.6 Battery
- Show **battery %** in the header pill (e.g. 32–35 % seen). Poll every 60 s + on connect. Colour dot: green > 30 %, amber 15–30 %, red < 15 %; toast at 20 % and 10 %.

### 5.7 Connection state machine
```
DISCONNECTED → SCANNING → DEVICE_SELECTED → CONNECTING → HANDSHAKE(keys) → SYNC_PROMPT → READY
READY ↔ RECONNECTING (on unexpected drop)   READY → DISCONNECTED (user)
```
Errors surfaced: Bluetooth off, permission denied, unsupported browser, device not found (empty state text shown in §4.5), key/MAC failure, GATT timeout.

---

## 6. Cube engine

### 6.1 State representation
- **Facelet string** (54 chars, URFDLB order) or cubie model (corner/edge permutation + orientation). Cubie model is faster for moves/phase checks; facelets simpler for rendering.
- Apply each `MoveEvent` (`X` or `X'`) to the state; maintain `moveLog[]` with timestamps.
- Reconcile with the cube's own facelets whenever received; if mismatch ≠ pending, trust the cube and flag a "resync" event.

### 6.2 Solved detection
- State == identity **regardless of whole-cube orientation** (centres fixed relative to each other on a standard cube, so identity check on cubie state suffices).
- Debounce: require solved state to persist for the next packet or ≥ 30 ms to avoid false stops mid-turn; but **stop time = timestamp of the move that produced solved**.
- Guard against stopping during scramble: only evaluate solved-stop in `SOLVING` state, and require ≥ N moves (e.g. 3) to avoid trivial solves.

### 6.3 Scramble following algorithm
```
expected = parse(scramble)      // [{face, amount: 1|2|3}]
i = 0; pendingQuarter = null
on move m:
  if matches expected[i] fully → i++ (flash green)
  elif expected[i].amount==2 and m.face==expected[i].face and pendingQuarter==null
       → pendingQuarter = m (wait for second quarter, same direction)
  elif pendingQuarter and m completes it → i++
  else → enter CORRECTION: push inverse(m) onto correctionStack, show hint
after i == len → verify state == scrambledState(scramble) → READY ("You can start!")
```
Also maintain tolerance for users doing the scramble with a different but equivalent sequence: **final state comparison** is authoritative; per-move highlighting is a UX aid.

### 6.4 Scramble generation
- WCA-style **random-state** scrambles (the reference shows 20-move ones). Use `cubing.js` `randomScrambleForEvent('333')` (runs a solver in a worker) or `min2phase`/`cstimer` scrambler.
- Pre-generate the next scramble while the current solve runs; keep a small buffer (3). Persist scramble with each solve.
- Prev/next arrows navigate a per-session scramble history.

### 6.5 CFOP phase detection **[PROPOSED]**
Evaluate after every move on the cubie state:

| Phase | Completion condition |
|---|---|
| **Cross** | 4 edges of a single colour solved relative to their centre-adjacent edges on one face (detect which of 6 colours — usually white — completes first; allow any cross colour) |
| **F2L** | Cross + 4 corner/edge pairs inserted (count pairs 1→4 for sub-splits) |
| **OLL** | Last layer all one colour on top (F2L intact) |
| **PLL** | Fully solved |

- Record `phaseEnd[ph] = timestamp of the move that satisfied the condition`. A move can complete multiple phases at once (e.g. skip) → zero-length segment.
- Sub-splits: record time of each F2L pair and each pause > threshold for the "dark segments".
- Handle non-CFOP methods (Roux/ZZ/beginner): fallback to a generic "move-density" view (equal-time segments), and make the method selectable later.
- Run analysis **in a worker** at solve end (not per move) except for the lightweight live checks used by the trainer.

---

## 7. Data model

### 7.1 Entities (Postgres / Supabase)

```sql
create table profiles (
  id uuid primary key references auth.users,
  display_name text, avatar_url text,
  settings jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table cubes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  brand text, model text, ble_name text, mac_hash text,   -- hash, not raw MAC
  nickname text, last_connected_at timestamptz,
  last_battery_percent int
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  name text not null default 'Default Session',
  event text not null default '333',
  created_at timestamptz default now(), archived boolean default false
);

create table solves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  session_id uuid references sessions(id) on delete cascade,
  seq int not null,                         -- #83, #84 …
  event text not null default '333',
  scramble text not null,
  time_ms int not null,                     -- raw time
  penalty text check (penalty in ('none','+2','dnf')) default 'none',
  input text check (input in ('smartcube','manual')) not null,
  cube_id uuid references cubes(id),
  turns int, tps numeric(5,2), fluency numeric(4,3),
  phases jsonb,        -- {cross_ms, f2l_ms:[..], oll_ms, pll_ms, pauses:[{start_ms,dur_ms}]}
  moves bytea,         -- compact move log (see 7.2)
  verified boolean default false,
  created_at timestamptz default now(),
  unique (session_id, seq)
);

create table algorithms (id text primary key, set text, name text, setup text, diagram jsonb);
create table algorithm_variants (id uuid primary key default gen_random_uuid(),
  algorithm_id text references algorithms(id), notation text, source text);
create table user_algorithm_progress (
  user_id uuid, algorithm_id text, status text,   -- new|learning|learned
  ease numeric, due_at timestamptz, best_recog_ms int, best_exec_ms int,
  primary key (user_id, algorithm_id)
);
-- P4
create table daily_scrambles (date date primary key, event text, scramble text);
create table leaderboard_entries (id uuid primary key default gen_random_uuid(),
  board text, user_id uuid, time_ms int, solve_id uuid, verified boolean, created_at timestamptz default now());
create table matches (id uuid primary key default gen_random_uuid(), type text, scramble text,
  state text, created_at timestamptz default now());
create table match_players (match_id uuid, user_id uuid, time_ms int, solve_id uuid, primary key (match_id, user_id));
```
Row-Level Security on every user-owned table (`user_id = auth.uid()`); leaderboards readable by all.

### 7.2 Move-log compact format **[PROPOSED]**
Per move: 1 byte (`face` 3 bits + `dir` 1 bit + reserved) + 2-byte delta-time (ms since previous move, capped; escape code for > 65 s). A 121-turn solve ≈ 360 bytes. Enables replay, analysis recomputation, and server verification.

### 7.3 Local-first
- **IndexedDB** (Dexie) is the source of truth on device; background sync to Supabase with `updated_at` + tombstones. The timer must work **fully offline**.
- Export: CSV (csTimer-compatible columns), JSON (full), and the reference-style "Download your solve data".

---

## 8. Design system

### 8.1 Colour tokens (sampled from the screenshot; names are Cubeverse's own)

| Token | Hex | Use |
|---|---|---|
| `bg` | `#15161A` | App background |
| `surface-1` | `#1E1F23` | Header pill, cards |
| `surface-2` | `#232428` | Active-tab chip, buttons |
| `text-primary` | `#F2F2F3` | Time, scramble current move |
| `text-muted` | `#6B6D75` | Done scramble moves, table headers, `#N` |
| `accent` | `#E8914E` | Event pill, PB highlight, primary outlined CTA |
| `positive` | `#59BB64` | Connected dot, correct-move flash |
| `danger` | `#D9534F` | Sign out, badges, wrong move |
| `phase-cross` | `#7C60AB` | Phase bar |
| `phase-f2l` | `#52509B` | Phase bar |
| `phase-oll` | `#4E80BD` | Phase bar |
| `phase-pll` | `#5EA68E` | Phase bar |
| `phase-pause` | `#282844` | Pause segments |

Dark theme is the default and only theme observed; a light theme is **[PROPOSED]** (P2). Check contrast: `text-muted` on `bg` should be ≥ 4.5:1 for table text (adjust if the sampled values fall short).

### 8.2 Typography (approximate, measured from a 1080 px-wide capture ≈ 360 dp)
| Role | Family | Size (dp) | Notes |
|---|---|---|---|
| Time (hero) | Monospace, tabular nums (JetBrains Mono / Roboto Mono class) | ~44 | Regular/medium weight |
| Scramble | Monospace | ~20 (current move ~28) | Letter-spaced, wraps ≤ 3 lines |
| Metrics line | Monospace | ~14 | Muted, separators `│` |
| Table | Monospace | ~12 | Right-aligned numbers |
| UI/headings | Geometric sans (Inter class) | 16–20, semibold | Session name ≈ 20 |
| Phase labels | Sans, uppercase, tracking +8 % | 11–12 | Muted |

Always enable `font-variant-numeric: tabular-nums` so digits don't jitter while the timer runs.

### 8.3 Layout & shape
- Screen padding 16–24 dp; header pill height ≈ 60 dp, radius = full.
- Cards/modals radius 20–24 dp; buttons radius full (pills) or 12 dp.
- Phase bar height ≈ 7 dp, radius full, 1–2 dp gaps allowed between phases.
- Bottom nav height ≈ 64 dp + safe-area; icon 24 dp; active chip 52×52 dp, radius 16.
- Touch targets ≥ 48 dp.

### 8.4 Motion
- 3D cube turns animate at **≤ 80 ms per quarter turn** (queue and fast-forward if moves arrive faster than the animation — never lag the data).
- Scramble move highlight: colour/scale transition 120 ms.
- Modals: fade + 8 dp rise, 200 ms. Phase-bar: grow-in left→right 400 ms after solve end.
- Respect `prefers-reduced-motion`.

### 8.5 Iconography
Line icons, 1.75 dp stroke, rounded caps. Needed: play, graduation cap, chart, swords, gear, bluetooth, chevrons, close, crown, user, device, download, credit-card, help, Discord/external-link, flame, signal bars, battery.

### 8.6 Accessibility
- Don't rely on colour alone for correct/incorrect scramble moves (add icon/size/weight change).
- Screen-reader announcements for state changes ("Cube connected", "Scramble complete — you can start") but **no live announcements during solving**.
- Dynamic type for UI text (not for the timer, which is capped).
- Haptic option: tick on each correct scramble move, long pulse on "You can start!", success pulse on solved.

---

## 9. Timer state machine (single source of truth)

```
                ┌───────────────┐   connect ok     ┌──────────┐
                │ NO_CUBE/IDLE  │ ───────────────▶ │  SYNC    │
                │ (manual timer │ ◀─────────────── │ (dialog) │
                │  available)   │   disconnect     └────┬─────┘
                └──────┬────────┘                       │ confirm [U4] / mark solved [D4]
        hold+release   │                                ▼
                       │                        ┌───────────────┐
                       │                        │ SCRAMBLE_WAIT │◀──────────┐
                       │                        │ (cube solved) │           │
                       │                        └──────┬────────┘           │
                       │               first scramble move                   │
                       │                               ▼                     │
                       │                        ┌───────────────┐  wrong move│
                       │                        │ SCRAMBLING    │───▶CORRECT─┘
                       │                        └──────┬────────┘
                       │              state == scrambled│
                       │                               ▼
                       │                        ┌───────────────┐  (optional inspection)
                       │                        │ READY "You can│
                       │                        │   start!"     │
                       │                        └──────┬────────┘
                       │                     first move │
                       ▼                               ▼
                ┌───────────────┐   solved      ┌───────────────┐
                │ MANUAL_RUNNING│──────────────▶│   SOLVING     │
                └──────┬────────┘   tap stop    │ (chrome hidden)│
                       │                        └──────┬────────┘
                       └─────────────┬─────────────────┘ solved detected
                                     ▼
                              ┌───────────────┐
                              │   RESULT      │  save solve, compute stats,
                              │ (analysis)    │  load next scramble (#N+1)
                              └──────┬────────┘
                                     └─▶ SCRAMBLE_WAIT (smart) / IDLE (manual)
```

Rules:
- Pre-start moves in `READY` that **undo** the scramble (user changes mind) → return to `SCRAMBLING`.
- Disconnect during `SOLVING` → pause event capture, show "Reconnecting…", allow **recover** (resync facelets on reconnect and continue) or **discard**. Never silently drop the solve.
- `RESULT` actions **[PROPOSED]**: tap result → penalty (+2 / DNF), delete, comment, share, replay.
- A solve ends as DNF automatically if the cube is solved with mismatching scramble check failures (optional strict mode).

---

## 10. Non-functional requirements

| Area | Target |
|---|---|
| Move → UI latency | ≤ 50 ms from BLE notification to 3D cube update and scramble highlight |
| Timer display | Render at screen refresh; time value derived from cube timestamps + local clock interpolation |
| Time precision | 1 ms stored, 10 ms displayed (WCA-style truncation) |
| Connect time | Scan → connected ≤ 10 s typical; clear error after 30 s |
| Reconnect | Auto-retry within 2 s of drop; state resync ≤ 1 s |
| Offline | Full timer + stats offline; sync when online |
| Battery | No wake-lock after leaving the Timer tab; BLE disconnect after N min idle (configurable) |
| Performance | 60 fps during solve on a mid-range Android (3D cube ≤ 2 ms/frame) |
| Privacy | MAC stored hashed; analytics opt-in; account deletion + data export |
| Security | RLS everywhere; server-side verification of competitive solves |
| Compatibility | Android Chrome 100+ (PWA); iOS via Capacitor/native later |

---

## 11. Acceptance criteria (MVP)

1. **Connect:** From a cold start with a GAN smart cube, a user can tap Connect → see the cube in the list (name + signal) → connect → see the sync dialog → confirm using both the button and the `U×4` gesture; battery % appears in the header.
2. **Scramble following:** Performing a 20-move scramble highlights each move correctly, tolerates `X2` done as two quarter turns, shows a correction when wrong, and shows "You can start!" only when the cube state matches.
3. **Auto timing:** Timer starts on the first solve move and stops on solved; displayed time equals `lastMoveTs − firstMoveTs` within ±1 ms of the cube's timestamps.
4. **3D view:** The cube mirrors turns with no visible lag; orientation follows the cube when gyro is available.
5. **Result:** After a solve, the screen shows time, TPS (turns ÷ time, 2 dp), turns, fluency %, and a phase bar whose segment times sum to the total ±0.01 s with no overlapping labels.
6. **Stats:** single/ao5/ao12/ao50/ao100 `NOW`/`BEST` match a reference implementation on a test set; PBs highlight in accent colour.
7. **Persistence:** Solves (with scramble, moves, phases) survive reload and work offline.
8. **Manual fallback:** With no cube, tap-&-hold starts/stops the timer.
9. **Resilience:** Dropping the BLE link mid-solve doesn't lose the solve; reconnect resumes tracking via facelet resync.

---

## 12. Test plan

- **Unit:** move application, solved detection, scramble parser/follower (incl. `X2` edge cases), average calculators (WCA trimming, DNF), phase detector against recorded solves, time formatting.
- **Golden data:** record raw BLE packets/move logs from real solves (with a CFOP solver and a non-CFOP solver) and replay them through the engine in CI.
- **Hardware matrix:** at least 2 cubes per supported brand, Android 12–15, Chrome stable.
- **Fault injection:** drop/duplicate/reorder packets; clock jumps; low battery; BLE off mid-solve.
- **UX:** usability test of the connect → sync → scramble → solve loop with 5 cubers (target: unassisted success in < 2 min).

---

## 13. Risks & open questions

| # | Risk / question | Mitigation |
|---|---|---|
| 1 | Web Bluetooth unavailable on iOS Safari | Capacitor/native BLE shell in P5; communicate clearly in onboarding |
| 2 | GAN MAC address not exposed to Web Bluetooth | Advertisement-data path + manual-entry fallback |
| 3 | Brand protocol changes / firmware updates | Isolate drivers; pin to tested firmware list; feature flags |
| 4 | Exact definitions of **fluency** and **turns** in the reference are unknown | Define Cubeverse's own, document them in-app ("How is fluency calculated?") |
| 5 | Chrome's native device chooser differs from the in-app list seen in the reference | Accept for MVP; native BLE plugin for a custom list |
| 6 | Reference gestures `[U4]/[D4]` interpretation unverified | Test with the cube; ship button path regardless |
| 7 | Algorithm dataset licensing | Pick openly licensed sources or author your own |
| 8 | Cheating in competitions | Server-side move-log verification, rate limits, verified badge |
| 9 | Trademark/trade-dress similarity to the reference | Original branding, layout variations, own illustrations |

**Questions for you (product owner):**
1. Which cube(s) do you own (the video shows a GAN `i4`-named cube)? That decides the first driver to build and test on.
2. PWA first (Android Chrome only) or go straight to a native/Capacitor shell for iOS?
3. Is monetisation (Premium gate) in scope, or is Cubeverse personal/free?
4. Should Cubeverse support non-CFOP analysis (Roux/ZZ) from the start?

---

## 14. Suggested build order (first 6 sprints)

1. **Sprint 1 — Foundations:** repo, design tokens, nav shell, theme, IndexedDB schema, manual timer, time formatting, stats calculators (+ tests).
2. **Sprint 2 — Cube engine:** facelet/cubie model, solved detection, scramble generation worker, scramble-follower, mock "virtual cube" driver for dev without hardware.
3. **Sprint 3 — BLE:** driver interface, GAN driver integration, connect/scan UX, battery, reconnect, sync dialog + gestures.
4. **Sprint 4 — Live solve:** 3D cube (turn animation + gyro), state machine, auto start/stop, chrome-hide during solve, save solve with move log.
5. **Sprint 5 — Analysis:** phase detector, pause detection, TPS/turns/fluency, phase bar with label collision handling, result screen.
6. **Sprint 6 — Polish & P2 kickoff:** stats table highlights/expand sheet, history list, export, Supabase auth + sync, hardening/tests on hardware matrix.

---

*End of spec.*
