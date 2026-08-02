/**
 * WCA official REST API v0 client.
 * Base: https://www.worldcubeassociation.org/api/v0/
 *
 * Times in the API are already centiseconds (integer).
 * -1 = DNF.  0 = DNS / not attempted (skip when storing solves).
 */

const WCA_BASE = "https://www.worldcubeassociation.org/api/v0";

// ─── Response shapes (confirmed against live 2025ZEYA01 data) ────────────────

export interface WcaApiResult {
  competition_id: string;
  event_id: string;
  round_type_id: string;  // "1","2","3","f","d","h","e","o"
  format_id: string;      // "a"=Ao5, "m"=Mo3, "b"=Bo3, "1"=Bo1
  best: number;           // cs; -1=DNF; 0=no best (all DNS)
  average: number;        // cs; -1=DNF avg; 0=no average (partial round / cutoff)
  attempts: number[];     // cs each; -1=DNF; 0=DNS/not attempted
  pos: number;            // ranking in round
}

export interface WcaApiCompetition {
  id: string;
  name: string;
  city: string | null;
  country_iso2: string | null;
  start_date: string | null;
  end_date: string | null;
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

/**
 * The public WCA API occasionally rate-limits or hiccups under bursty use —
 * e.g. Competitor Benchmarking firing a batch of fetchPersonResults /
 * fetchCompetition calls on every event toggle. A 404 is a real "not found"
 * and isn't retried; anything else transient (429, 5xx, network error) gets
 * a couple of quick retries before giving up, instead of silently returning
 * nothing for that call.
 */
async function fetchWcaJson<T>(url: string, notFoundMessage: string, retries = 2): Promise<T> {
  let lastErr: Error = new Error("WCA API request failed.");
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 404) throw new Error(notFoundMessage);
      if (res.ok) return (await res.json()) as T;
      lastErr = new Error(`WCA API error ${res.status}.`);
    } catch (e) {
      if (e instanceof Error && e.message === notFoundMessage) throw e; // not transient
      lastErr = e instanceof Error ? e : lastErr;
    }
    if (attempt < retries) await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
  }
  throw lastErr;
}

export async function fetchPersonResults(wcaId: string): Promise<WcaApiResult[]> {
  return fetchWcaJson<WcaApiResult[]>(
    `${WCA_BASE}/persons/${wcaId}/results`,
    `WCA ID "${wcaId}" not found.`
  );
}

/**
 * Fetches a WCA person's display name — not their results. Used to label a
 * WCA ID the app hasn't seen before (e.g. an opponent entered for a benchmark
 * comparison), as opposed to fetchPersonResults below which returns their
 * competition results.
 *
 * Promoted from an ad hoc client-side fetch in app/onboarding/wca-id/page.tsx
 * (which reads the same `data.name` field) into a shared, server-safe helper
 * alongside the other WCA API calls here.
 */
export async function fetchPerson(wcaId: string): Promise<{ name: string }> {
  const d = await fetchWcaJson<{ name?: string }>(
    `${WCA_BASE}/persons/${wcaId}`,
    `WCA ID "${wcaId}" not found.`
  );
  return { name: d.name ?? wcaId };
}

export async function fetchCompetition(
  competitionId: string
): Promise<WcaApiCompetition> {
  const d = await fetchWcaJson<Record<string, unknown>>(
    `${WCA_BASE}/competitions/${competitionId}`,
    `Competition "${competitionId}" not found.`
  );
  return {
    id: d.id as string,
    name: d.name as string,
    city: (d.city as string | null) ?? null,
    country_iso2: (d.country_iso2 as string | null) ?? null,
    start_date: (d.start_date as string | null) ?? null,
    end_date: (d.end_date as string | null) ?? null,
  };
}

// ─── Mapping helpers ──────────────────────────────────────────────────────────

/**
 * Map WCA round_type_id → our DB round_type.
 * WCA types: "1"=R1, "2"=R2, "3"=R3, "f"=Final, "d"=Combined Final,
 *            "h"=Combined First, "e"=Combined Second, "o"=One-stage
 */
export function mapRoundType(
  id: string
): "first" | "second" | "semi" | "final" {
  const m: Record<string, "first" | "second" | "semi" | "final"> = {
    "1": "first",
    "2": "second",
    "3": "semi",
    f: "final",
    d: "final",
    h: "first",
    e: "second",
    o: "first",
  };
  return m[id] ?? "final";
}

/** Map WCA format_id → our DB format string. */
export function mapFormat(id: string): "ao5" | "mo3" | "bo3" | "bo1" {
  const m: Record<string, "ao5" | "mo3" | "bo3" | "bo1"> = {
    a: "ao5",
    m: "mo3",
    b: "bo3",
    "1": "bo1",
  };
  return m[id] ?? "ao5";
}

/** Map a single WCA attempt integer → our time_cs + penalty. */
export function mapAttempt(attempt: number): {
  time_cs: number;
  penalty: "none" | "dnf" | "dns";
} {
  if (attempt === 0) return { time_cs: 0, penalty: "dns" };
  if (attempt === -1) return { time_cs: 0, penalty: "dnf" };
  return { time_cs: attempt, penalty: "none" };
}

/** Map WCA `average` field → our average_cs (null = not applicable). */
export function mapAverage(average: number): number | null {
  if (average === 0) return null;  // no average (partial round / cutoff)
  if (average === -1) return -1;   // DNF average
  return average;
}

/** Map WCA `best` field → our best_cs. */
export function mapBest(best: number): number {
  return best <= 0 ? -1 : best;
}

/**
 * Return only the attempts that were actually attempted
 * (i.e., skip trailing 0s from cutoff rounds).
 * Per spec: "store the solves you have".
 */
export function meaningfulAttempts(
  attempts: number[]
): number[] {
  // Trim trailing zeros but preserve internal zeros if any.
  let end = attempts.length;
  while (end > 0 && attempts[end - 1] === 0) end--;
  return attempts.slice(0, end);
}
