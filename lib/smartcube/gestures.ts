/**
 * Cube gestures: confirming something by turning the cube rather than by reaching for the phone.
 *
 * The reference app labels its two sync buttons `[U4]` and `[D4]` — four turns of the U face to
 * confirm the tracked state, four of D to declare the cube solved. That is a genuinely good idea:
 * both hands are already on the cube, and the sync dialog is exactly the moment you don't want to
 * put it down.
 *
 * Four quarter turns of one face also returns that face to where it started, so a gesture leaves
 * the cube's state untouched — which is what makes it safe to use as a button.
 *
 * Pure and time-aware: the turns must be consecutive, on the same face, in the same direction, and
 * within the window. Without the window, four U turns spread over a minute of idle fiddling would
 * fire it.
 */

/** Four turns must land within this long to count as one deliberate gesture. */
export const GESTURE_WINDOW_MS = 2_500;

const QUARTERS_REQUIRED = 4;

export type GestureFace = "U" | "D";

type Turn = { face: string; direction: 1 | -1; t: number };

/**
 * Rolling detector. Feed it every move; it returns the gesture's face on the move that completes
 * one, and null otherwise.
 *
 * Stateful by design — it has to be, since the gesture is a property of a sequence — but the state
 * is a short array held here rather than anywhere else in the app.
 */
export function createGestureDetector(faces: readonly GestureFace[] = ["U", "D"]) {
  let run: Turn[] = [];

  return {
    /** @returns the gesture's face if this move completed one. */
    push(move: string, t: number): GestureFace | null {
      const face = move[0];
      // A half turn is reported by the cube as two quarter turns, so it never arrives here; if one
      // ever did, treat it as breaking the run rather than as two turns of ambiguous direction.
      const direction: 1 | -1 | null = move.endsWith("2") ? null : move.endsWith("'") ? -1 : 1;

      if (direction === null || !(faces as readonly string[]).includes(face)) {
        run = [];
        return null;
      }

      const last = run[run.length - 1];
      const continues =
        last !== undefined &&
        last.face === face &&
        last.direction === direction &&
        t - last.t <= GESTURE_WINDOW_MS;

      run = continues ? [...run, { face, direction, t }] : [{ face, direction, t }];

      // The window applies to the whole gesture, not just to each gap: four turns at two seconds
      // apart are idle fiddling, however evenly spaced. Stale turns are dropped from the front —
      // all of them, so a fast four that follows a slow one still fires on its fourth turn rather
      // than limping towards the threshold one call at a time.
      while (run.length > 0 && t - run[0].t > GESTURE_WINDOW_MS) run = run.slice(1);

      if (run.length < QUARTERS_REQUIRED) return null;
      run = [];
      return face as GestureFace;
    },
    reset() {
      run = [];
    },
  };
}
