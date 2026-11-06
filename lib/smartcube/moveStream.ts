/**
 * Compact encoding for a solve's timestamped move stream.
 *
 * A solve is 50-80 moves, a bad one a few hundred, and every one is stored forever. Verbose JSON
 * (`[{"move":"R","t":1234},…]`) costs ~25 bytes a move and makes Postgres parse a structure nobody
 * queries into. This encoding is 2-4 bytes a move and stays an opaque `text` column.
 *
 * Format: space-separated tokens, each `<moveCode><delta>` where
 *   - `moveCode` is one of 18 letters A-R: face index (U R F D L B) × 3 + {CW, half, CCW}
 *   - `delta` is base-36 centiseconds since the previous move (absolute for the first)
 *
 * Decoding never throws: a malformed stream returns `null` so the UI can say "no replay available"
 * instead of taking down the page for a solve that is otherwise fine.
 */

import { KOCIEMBA_FACES, splitMoves } from "./facelets";

export const MOVE_STREAM_VERSION = 1;

/** Guards against a runaway stream filling the row and the offline outbox. */
export const MAX_MOVES = 2000;

export type TimedMove = {
  /** Standard notation: U, R', F2, … */
  move: string;
  /** Milliseconds since the start of the solve. */
  t: number;
};

const SUFFIXES = ["", "2", "'"] as const;
const CODE_START = "A".charCodeAt(0);

const MOVE_TO_CODE = new Map<string, string>();
const CODE_TO_MOVE = new Map<string, string>();
KOCIEMBA_FACES.forEach((face, faceIndex) => {
  SUFFIXES.forEach((suffix, variant) => {
    const code = String.fromCharCode(CODE_START + faceIndex * 3 + variant);
    MOVE_TO_CODE.set(face + suffix, code);
    CODE_TO_MOVE.set(code, face + suffix);
  });
});

const TOKEN_RE = /^([A-R])([0-9a-z]+)$/;

/**
 * Encode moves to a storable string. Times are quantised to centiseconds, matching the precision
 * of `time_cs` everywhere else in the app; sub-10 ms resolution is noise on a Bluetooth link.
 */
export function encodeMoveStream(moves: readonly TimedMove[]): string {
  const tokens: string[] = [];
  let previousCs = 0;
  for (const { move, t } of moves.slice(0, MAX_MOVES)) {
    const code = MOVE_TO_CODE.get(move);
    if (!code) throw new Error(`Cannot encode move "${move}"`);
    const cs = Math.max(previousCs, Math.round(t / 10));
    tokens.push(code + (cs - previousCs).toString(36));
    previousCs = cs;
  }
  return tokens.join(" ");
}

/** Decode a stored stream. Returns `null` for anything malformed — never throws. */
export function decodeMoveStream(encoded: string | null | undefined): TimedMove[] | null {
  if (typeof encoded !== "string") return null;
  const trimmed = encoded.trim();
  if (trimmed === "") return [];

  const out: TimedMove[] = [];
  let cs = 0;
  for (const token of trimmed.split(/\s+/)) {
    const match = TOKEN_RE.exec(token);
    if (!match) return null;
    const move = CODE_TO_MOVE.get(match[1]);
    if (!move) return null;
    const delta = parseInt(match[2], 36);
    if (!Number.isFinite(delta) || delta < 0) return null;
    cs += delta;
    out.push({ move, t: cs * 10 });
    if (out.length > MAX_MOVES) return null;
  }
  return out;
}

/** Helper for tests and for replaying a scramble: "R U R'" → timed moves at a fixed cadence. */
export const timedFromNotation = (notation: string, msPerMove = 200): TimedMove[] =>
  splitMoves(notation).map((move, i) => ({ move, t: (i + 1) * msPerMove }));
