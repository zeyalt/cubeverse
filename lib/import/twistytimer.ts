import type { ParsedSolve } from "./ingest";

/**
 * Parses a Twisty Timer export file for a single puzzle type.
 *
 * Format (semicolon-delimited, values optionally quoted):
 *   "39.17";"D B' L' B L2 ..."; "2025-04-29T21:52:30.642+10:00"
 *   col 0: time in seconds (e.g. "39.17"), or "DNF", or "+2:39.17"
 *   col 1: scramble
 *   col 2: ISO timestamp
 *
 * The eventId must be supplied by the caller (from user selection).
 */
export function parseTwistyTimerExport(
  raw: string,
  eventId: string
): ParsedSolve[] {
  const solves: ParsedSolve[] = [];

  // Normalise line endings (\r\n, \r, \n all → \n)
  const normalised = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Log first few lines to help diagnose format issues
  const preview = normalised.split("\n").slice(0, 3);
  console.log("[twistytimer] first 3 lines:", preview);

  for (const line of normalised.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect tab-delimited (Twisty Timer older format: puzzle\tcategory\ttime_ms\tpenalty\tscramble\tdate)
    if (trimmed.includes("\t")) {
      const cols = trimmed.split("\t").map((c) => c.trim());
      // col 2 = time in ms, col 3 = penalty (0=ok,2=+2,-1=DNF), col 4 = scramble, col 5 = date
      const timeMs = parseInt(cols[2]);
      if (isNaN(timeMs) || timeMs <= 0) continue;
      const penaltyRaw = parseInt(cols[3] ?? "0");
      const penalty: "none" | "plus2" | "dnf" =
        penaltyRaw === -1 ? "dnf" : penaltyRaw === 2 ? "plus2" : "none";
      const scramble = cols[4] ?? undefined;
      const solvedAt = cols[5] ? new Date(cols[5]).toISOString() : undefined;
      solves.push({ event_id: eventId, time_cs: Math.round(timeMs / 10), penalty, scramble, solved_at: solvedAt });
      continue;
    }

    // Semicolon-delimited format: "39.17";"scramble";"2025-04-29T..."
    const cols = trimmed.split(";").map((c) => c.trim().replace(/^"|"$/g, ""));
    if (cols.length < 1) continue;

    const timeRaw = cols[0];
    const scramble = cols[1] ?? null;
    const solvedAt = cols[2] ? new Date(cols[2]).toISOString() : undefined;

    let time_cs: number;
    let penalty: "none" | "plus2" | "dnf" = "none";

    if (timeRaw.toUpperCase() === "DNF") {
      // Record as 1cs with dnf penalty (time_cs must be > 0 for schema)
      time_cs = 1;
      penalty = "dnf";
    } else if (timeRaw.startsWith("+2:") || timeRaw.startsWith("+2 ")) {
      // +2 penalty: strip prefix, parse time
      const base = timeRaw.replace(/^\+2[: ]/, "");
      time_cs = parseTimeToCs(base);
      penalty = "plus2";
    } else {
      time_cs = parseTimeToCs(timeRaw);
    }

    if (time_cs <= 0) continue;

    solves.push({
      event_id: eventId,
      time_cs,
      penalty,
      scramble: scramble || undefined,
      solved_at: solvedAt,
    });
  }

  return solves;
}

function parseTimeToCs(s: string): number {
  // Handles: "39.17", "1:39.17", "1:02:39.17"
  const parts = s.trim().split(":");
  try {
    if (parts.length === 1) {
      return Math.round(parseFloat(parts[0]) * 100);
    } else if (parts.length === 2) {
      return Math.round((parseInt(parts[0]) * 60 + parseFloat(parts[1])) * 100);
    } else if (parts.length === 3) {
      return Math.round(
        (parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2])) * 100
      );
    }
  } catch {
    return 0;
  }
  return 0;
}
