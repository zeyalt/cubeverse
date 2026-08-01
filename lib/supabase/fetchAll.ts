/**
 * PostgREST caps every response at a fixed number of rows (1000 by default) and
 * gives no indication that it did so — a query for 1475 solves quietly returns
 * the first 1000. Because our solve queries are ordered by `solved_at`
 * ascending, that silently discards the *newest* solves, which is the worst
 * possible half to lose: averages and counts freeze in the past.
 *
 * This pages through the full result set instead. Callers pass a function that
 * builds the query for a given window, since a PostgREST query builder can only
 * be awaited once.
 */
const PAGE_SIZE = 1000;

/** Hard stop so a runaway table can't spin forever. */
const MAX_PAGES = 100;

export async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const all: T[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const from = page * PAGE_SIZE;
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = data ?? [];
    all.push(...rows);
    // A short page means we've reached the end.
    if (rows.length < PAGE_SIZE) return all;
  }

  console.error(
    `[fetchAllRows] stopped at ${MAX_PAGES} pages (${all.length} rows) — result may be incomplete`
  );
  return all;
}
