import type { ParsedSolve } from "./ingest";

/**
 * Twisty Timer import — DEFERRED (Phase 8b).
 *
 * When a real export fixture is available, implement the parser here.
 * Twisty Timer exports are tab-delimited rows:
 *   puzzle | category | time (ms) | penalty | scramble | date | comment
 *
 * The ingestPracticeSolves() path in lib/import/ingest.ts is already built
 * and ready to accept the output of this parser.
 */
export function parseTwistyTimerExport(
  _raw: string
): ParsedSolve[] {
  // TODO: implement parser once a real export file is provided at
  //       /fixtures/twistytimer-sample.txt
  //       Convert times from ms → cs (divide by 10).
  throw new Error("Twisty Timer import not yet implemented");
}
