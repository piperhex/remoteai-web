import { pageUrl } from '../../provider-market/pageLink';

const STORAGE_KEY = 'remoteai:website-icons:v1';
const MAX_SITES = 128;
const MAX_ICONS = 4;
const MAX_URL_LENGTH = 4096;
const icons = new Map<string, string>();
const listeners = new Set<() => void>();
let initialized = false;

function safeIcons(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === 'string'
    && item.length <= MAX_URL_LENGTH && !!pageUrl(item)))].slice(0, MAX_ICONS);
}

function initialize() {
  if (initialized) return;
  initialized = true;
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(saved)) return;
    for (const entry of saved.slice(-MAX_SITES)) {
      if (!Array.isArray(entry) || typeof entry[0] !== 'string') continue;
      const origin = pageUrl(entry[0])?.origin;
      const sources = safeIcons(entry[1]);
      if (origin && sources.length) icons.set(origin, sources.join('\n'));
    }
  } catch { /* An unavailable or corrupt cache must not prevent browsing. */ }
}

/** Cache only icon URLs by origin; page addresses, credentials and headers are never persisted here. */
export function rememberWebsiteIcons(address: string, value: unknown) {
  const origin = pageUrl(address)?.origin;
  const sources = safeIcons(value);
  if (!origin || !sources.length) return;
  initialize();
  const snapshot = sources.join('\n');
  if (icons.get(origin) === snapshot) return;
  icons.delete(origin);
  icons.set(origin, snapshot);
  if (icons.size > MAX_SITES) icons.delete(icons.keys().next().value!);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...icons].map(([site, urls]) => [site, urls.split('\n')])));
  } catch { /* Keep the in-memory cache when storage is full or unavailable. */ }
  listeners.forEach(listener => listener());
}

export function websiteIconSnapshot(address?: string): string {
  initialize();
  const origin = pageUrl(address ?? '')?.origin;
  return origin ? icons.get(origin) ?? '' : '';
}

export function subscribeWebsiteIcons(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
