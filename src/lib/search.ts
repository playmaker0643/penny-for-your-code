/**
 * Filter and rank a list by a search query against a name field and a description field.
 *
 * Items whose `name` contains the query rank first (in their original relative order),
 * followed by items whose `description` contains the query (but `name` does not).
 * Items matching neither are dropped. Empty query returns the list unchanged.
 *
 * Case-insensitive substring match.
 */
export function filterByQuery<T>(
  items: T[] | undefined | null,
  query: string,
  getName: (item: T) => string | null | undefined,
  getDescription: (item: T) => string | null | undefined,
): T[] {
  if (!items) return [];
  const q = query.trim().toLowerCase();
  if (!q) return items;
  const nameHits: T[] = [];
  const descHits: T[] = [];
  for (const item of items) {
    const name = (getName(item) || "").toLowerCase();
    const desc = (getDescription(item) || "").toLowerCase();
    if (name.includes(q)) nameHits.push(item);
    else if (desc.includes(q)) descHits.push(item);
  }
  return [...nameHits, ...descHits];
}
