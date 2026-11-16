import { browserUrl, type BrowserRecord, type Visit } from './data/model';

export const MAX_ADDRESS_SUGGESTIONS = 8;

function searchable(value: string) {
  try { return decodeURI(value).toLocaleLowerCase(); }
  catch { return value.toLocaleLowerCase(); }
}

function matchRank(visit: Visit, query: string): number {
  const url = searchable(visit.url), title = searchable(visit.title);
  const address = url.replace(/^https?:\/\/(?:www\.)?/, '');
  if (!query || url.startsWith(query) || address.startsWith(query)) return 0;
  return query.split(/\s+/).every(word => `${title} ${url}`.includes(word)) ? 1 : -1;
}

/** Only saved visits participate; never fetch suggestions or inspect saved credentials. */
export function addressSuggestions(entries: readonly BrowserRecord[], input: string): Visit[] {
  const latest = new Map<string, Visit>();
  for (const entry of entries) {
    if (entry.kind !== 'visit') continue;
    const url = browserUrl(entry.url)?.href;
    if (!url) continue;
    const previous = latest.get(url);
    if (!previous || entry.at > previous.at) latest.set(url, entry);
  }
  const query = searchable(input.trim());
  return [...latest.values()].map(visit => ({ visit, rank: matchRank(visit, query) }))
    .filter(entry => entry.rank >= 0)
    .sort((a, b) => a.rank - b.rank || b.visit.at - a.visit.at || a.visit.url.localeCompare(b.visit.url))
    .slice(0, MAX_ADDRESS_SUGGESTIONS).map(entry => entry.visit);
}
