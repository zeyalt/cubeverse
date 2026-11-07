# Lessons

## 2026-11-07 — Smart tab: "looks weird", and a 16347% split

**What happened.** I reported the Smart tab's timer screen as finished on the strength of 218
passing tests and a clean build, without once looking at it. The user found, by using it: labels
colliding in the phase bar, a table stretched across a desktop window, and an insight claiming a
step took 16347% of a solve.

**Rules.**
- **UI isn't verified until it has been seen.** Tests prove the logic; only a screenshot proves the
  layout. Before calling UI work done, render it (Playwright against the dev server) at phone
  width, desktop width, and in both themes, and look at every screen.
- **Use real data in the preview, not just tidy fixtures.** The collision and the corrupt split
  both appeared only with real solves. Pull real rows into the preview when they exist.
- **A comment that describes a check is not the check.** `solveMachine` said "a snapshot that
  *disagrees* means a missed move" above code that flagged on *any* snapshot. When a comment
  states a condition, confirm the code tests that condition.
- **Never mix clocks per item.** `a ?? b` across two clocks with different origins is a silent unit
  error. Choose the clock once per measurement and convert or interpolate within it.
- **Refuse impossible derived data at read time.** Stored values can't be fixed retroactively, so
  anything that averages them must check they're possible (each step within the total) first.
- **Label-fit is a neighbour problem.** Whether a label fits depends on the labels beside it, not
  only on its own segment's width.

## 2026-11-08 — Cube twice the size on a real phone; Smart tab off the nav

**What happened.** On the user's phone the 3D cube rendered at double size, spilling off its card,
and the sixth nav tab was pushed off-screen. My screenshots had shown neither.

**Rules.**
- **Screenshot at a phone's real pixel density (3×), not 1×.** The canvas bug only exists when the
  drawing buffer is larger than the display size, which never happens at 1×.
- **Measure, don't just look:** assert no sideways scroll (`scrollWidth === innerWidth`), that
  every nav item is inside the viewport, and that a canvas's box equals its container's.
- **When porting code, port what it relied on.** The renderer depended on a stylesheet rule in the
  prototype that didn't come across. Sizing the renderer needs belongs in the renderer.
- **Flex items need `min-w-0` to shrink below their content.** Six `flex-1` tabs with long
  labels overflowed rather than shrinking.
- **Nothing goes inside a frame that a gyro-rotated object can sweep.** Controls go beside it.
