# TwistyTimer Logic - Extracted

## Overview
The timer flow in TwistyTimer follows this sequence:
1. **Initial State**: Display "0.00"
2. **User Clicks**: Start 15-second inspection countdown
3. **Press & Hold**: User holds when ready to solve
4. **Release**: Timer starts counting up

---

## State Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      INITIAL STATE                              │
│                   Display: "0.00"                               │
└─────────────────────────────────────────────────────────────────┘
                             │
                   User touches chronometer
                             │
              ┌──────────────┴──────────────┐
              │                             │
       ┌──────▼──────────┐      ┌──────────▼────────┐
       │  INSPECTION     │      │  NO INSPECTION    │
       │  ENABLED        │      │  ENABLED          │
       └─────┬───────────┘      └────────┬──────────┘
             │                          │
    ┌────────▼────────┐        ┌────────▼────────┐
    │ ACTION_DOWN     │        │ ACTION_DOWN     │
    │ Start 15s       │        │ Hold for start  │
    │ countdown       │        │ (500ms delay)   │
    └────────┬────────┘        └────────┬────────┘
             │                          │
    ┌────────▼────────┐        ┌────────▼────────┐
    │ ACTION_UP       │        │ ACTION_UP       │
    │ Release touch   │        │ Release touch   │
    │ Start timer     │        │ (depends on     │
    │                │        │  hold duration) │
    └─────────────────┘        └────────┬────────┘
                                        │
                              ┌─────────▼────────┐
                              │ Held long enough?│
                              └────┬────────┬────┘
                                   │        │
                              YES  │        │  NO
                                   │        │
                         ┌─────────▼─┐  ┌──▼────────┐
                         │Start timer│  │Cancel hold│
                         │           │  │Restore    │
                         │           │  │previous   │
                         └───────────┘  │value      │
                                        └───────────┘
```

---

## Component Details

### 1. TimerFragment (Main Controller)

**File**: `TimerFragment.java`

**Key State Variables**:
```java
private boolean isReady = false;           // Hold was long enough (500ms)
private boolean countingDown = false;      // In inspection countdown
private boolean isRunning = false;         // Timer is running
private boolean isLocked = true;           // Waiting for scramble generation
private CountDownTimer countdown;          // 15-second inspection timer
private CountDownTimer plusTwoCountdown;   // 2-second penalty countdown
```

**Key Methods**:
- `startInspectionCountdown(int inspectionTime)` - Starts 15s countdown
- `startChronometer()` - Starts the actual timer
- `stopChronometer()` - Stops the timer
- `stopInspectionCountdown()` - Cancels inspection countdown

**Touch Listener** (lines 758-868):
The main `startTimerLayout.setOnTouchListener` handles:
- `ACTION_DOWN`: User touches the timer
- `ACTION_UP`: User releases the timer

---

### 2. Hold-for-Start Logic

**Key Constants**:
```java
private static final long HOLD_FOR_START_DELAY = 500L;  // 500ms minimum hold
```

**Flow**:
1. `ACTION_DOWN` → Post `holdRunnable` with 500ms delay
2. If user releases before 500ms: `holdHandler.removeCallbacks(holdRunnable)` → Cancel hold
3. If user holds for 500ms: `holdRunnable` executes → `isReady = true`
4. Visual cue: `chronometer.setHighlighted(true)` (changes text color)

**Code Location** (lines 740-753):
```java
if (holdEnabled) {
    holdHandler = new Handler();
    holdRunnable = () -> {
        isReady = true;
        chronometer.setHighlighted(true);  // Visual feedback
        if (!inspectionEnabled) {
            hideToolbar();
        }
    };
}
```

---

### 3. Inspection Countdown

**Configuration** (lines 676-738):
```java
if (inspectionEnabled) {
    // Default: 15 seconds (WCA standard)
    countdown = new CountDownTimer(inspectionTime * 1000, 500) {
        @Override
        public void onTick(long l) {
            chronometer.setText(String.valueOf((l / 1000) + 1));
        }
        
        @Override
        public void onFinish() {
            chronometer.setText("+2");  // +2 penalty applied
            currentPenalty = PuzzleUtils.PENALTY_PLUSTWO;
            plusTwoCountdown.start();
        }
    };
}
```

**Timeline**:
- **t=0**: User clicks → Inspection countdown starts
- **t=8s**: First warning (vibration/sound)
- **t=12s**: Second warning (vibration/sound)
- **t=15s**: Display "+2" penalty
- **t=17s**: Becomes DNF if timer not started

---

### 4. ChronometerMilli (Timer View)

**File**: `ChronometerMilli.java`

**Core Timing**:
```java
private long mStartedAt;   // System elapsed time when started
private long mStoppedAt;   // System elapsed time when stopped

public long getElapsedTime() {
    // Returns: current time - start time + penalties
    return (mIsStarted ? SystemClock.elapsedRealtime() : mStoppedAt) - mStartedAt;
}
```

**Display Update Frequency**:
```java
private static final long TICK_TIME_LR = 100L;  // Low-res (whole seconds)
private static final long TICK_TIME_HR = 30L;   // High-res (hundredths)
```

**Key Methods**:
- `start()` - Start timing from current elapsed time
- `stop()` - Stop timing, preserve elapsed time
- `reset()` - Reset to 0.00
- `holdForStart()` - Display "0.00" without resetting internal state
- `cancelHoldForStart()` - Restore previous display value
- `setPenalty(int)` - Apply "+2" or "DNF" penalty

---

## Touch Event Sequence

### Without Inspection
```
User ACTION_DOWN
  ↓
(if holdEnabled)
  Post holdRunnable (500ms delay)
  chronometer.holdForStart() → display "0.00"
  ↓
  [User holds for 500ms]
  ↓
  holdRunnable executes
  isReady = true
  chronometer.setHighlighted(true)
  ↓
User ACTION_UP
  ↓
  holdHandler.removeCallbacks(holdRunnable)  [Cancel if not ready]
  OR
  startChronometer()  [If ready]
  hideToolbar()
  chronometer.start()
  isRunning = true
```

### With Inspection
```
User ACTION_DOWN
  ↓
  chronometer ALREADY counting down (showing "15", "14", "13"...)
  ↓
  (if holdEnabled)
    Post holdRunnable (500ms delay)
  (else if startCueEnabled)
    chronometer.setHighlighted(true)
  ↓
  [User holds for 500ms]
  ↓
User ACTION_UP
  ↓
  If held long enough (or not holdEnabled):
    stopInspectionCountdown()
    startChronometer()
    isRunning = true
  Else:
    holdHandler.removeCallbacks(holdRunnable)
    Cancel the hold
```

---

## Solve Recording

**When timer stops** (lines 851-865):
```java
if (motionEvent.getAction() == MotionEvent.ACTION_DOWN
        && chronometer.getElapsedTime() >= 80) {  // >= 80ms to avoid accidental touch
    animationDone = false;
    stopChronometer();
    
    if (currentPenalty == PuzzleUtils.PENALTY_PLUSTWO) {
        chronometer.setPenalty(PuzzleUtils.PENALTY_PLUSTWO);
    }
    
    addNewSolve();  // Save to database
}
```

**addNewSolve()** (lines 998-1010):
```java
private void addNewSolve() {
    currentSolve = new Solve(
        (int) chronometer.getElapsedTime(),  // Time in ms with penalties
        currentPuzzle, currentPuzzleCategory,
        System.currentTimeMillis(),
        currentScramble,
        currentPenalty,
        "", false
    );
    
    currentSolve.setId(TwistyTimer.getDBHandler().addSolve(currentSolve));
    currentPenalty = NO_PENALTY;
}
```

---

## Penalties

### +2 Penalty
- Applied if inspection time exceeded (but timer started within 2 seconds)
- Display: `"+2"` appended to time
- Effect: Adds 2000ms to recorded time

### DNF (Did Not Finish)
- Applied if inspection period expires + 2 second penalty countdown expires
- Display: `"DNF"` replaces time
- Effect: Time recorded as 0 (ignored in averages)
- Triggering condition (lines 724-734):
  ```java
  plusTwoCountdown = new CountDownTimer(2000, 500) {
      @Override
      public void onFinish() {
          countingDown = false;
          isReady = false;
          holdingDNF = true;
          currentPenalty = PuzzleUtils.PENALTY_DNF;
          chronometer.setPenalty(PuzzleUtils.PENALTY_DNF);
          stopChronometer();
          addNewSolve();
      }
  };
  ```

---

## Preferences Used

```java
// Inspection
pk_inspection_enabled          // Enable/disable 15s countdown
pk_inspection_time             // Countdown duration (default 15s)
pk_inspection_alert_enabled    // Enable warnings at 8s and 12s

// Hold-to-Start
pk_hold_to_start_enabled       // Require 500ms hold

// Display
pk_show_hi_res_timer          // Show hundredths (0.00) vs whole seconds
pk_timer_text_size            // Scale of timer text
pk_hide_time_while_running    // Show placeholder instead of actual time

// UI
pk_start_cue_enabled          // Highlight timer on ACTION_DOWN (if no hold)
pk_show_quick_actions         // Show delete/+2/DNF buttons
```

---

## Summary: Key Implementation Details

1. **Timing Source**: `SystemClock.elapsedRealtime()` (system uptime, not wall clock)
2. **Update Frequency**: 30ms (high-res) or 100ms (low-res)
3. **Minimum Solve Duration**: 80ms (prevents accidental stops)
4. **Hold Duration**: 500ms (configurable via HOLD_FOR_START_DELAY)
5. **Inspection**: 15 seconds (WCA standard, configurable)
6. **Warnings**: 8s and 12s marks during inspection
7. **Penalties**: +2 (2000ms added) or DNF (time = 0)
8. **State Management**: Extensive use of boolean flags (isRunning, countingDown, isReady, etc.)
