/**
 * SwiftStream Public IP Resolution Service
 * Resolves the client's real public WAN IP address using secure, CORS-enabled IP lookups.
 * Caches results in memory and browser storage to prevent redundant network calls.
 */

const STORAGE_KEY = 'swiftstream_client_public_ip';

let inMemoryPublicIp: string | null = null;
let activeFetchPromise: Promise<string | null> | null = null;

/**
 * Checks if an IP string is a private, local loopback, or mock address.
 */
export const isLocalOrMockIp = (ip?: string | null): boolean => {
  if (!ip) return true;
  const clean = ip.trim();
  if (
    clean === '127.0.0.1' ||
    clean === 'localhost' ||
    clean === '::1' ||
    clean === '192.168.18.1' ||
    clean === '192.168.88.10' ||
    clean === '192.168.88.1' ||
    clean === 'Internal Network' ||
    clean === 'Internal'
  ) {
    return true;
  }

  // Local subnet range checks
  if (
    clean.startsWith('192.168.') ||
    clean.startsWith('10.') ||
    clean.startsWith('172.16.') ||
    clean.startsWith('172.17.') ||
    clean.startsWith('172.18.') ||
    clean.startsWith('172.19.') ||
    clean.startsWith('172.2') ||
    clean.startsWith('172.30.') ||
    clean.startsWith('172.31.')
  ) {
    return true;
  }

  return false;
};

/**
 * Returns the currently known public IP synchronously (from memory or web storage),
 * or null if not yet resolved.
 */
export const getPublicIp = (): string | null => {
  if (inMemoryPublicIp && !isLocalOrMockIp(inMemoryPublicIp)) {
    return inMemoryPublicIp;
  }

  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
      if (stored && !isLocalOrMockIp(stored)) {
        inMemoryPublicIp = stored;
        return stored;
      }
    } catch {}
  }

  return null;
};

/**
 * Helper to fetch with timeout and CORS abort controller
 */
const fetchWithTimeout = async (url: string, timeoutMs = 3500): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, mode: 'cors' });
    clearTimeout(timer);
    return res;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
};

const cacheResolvedIp = (ip: string) => {
  inMemoryPublicIp = ip;
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(STORAGE_KEY, ip);
      localStorage.setItem(STORAGE_KEY, ip);
    } catch {}
  }
};

/**
 * Asynchronously detects the operator's public IP address.
 * Primary: api64.ipify.org (JSON, IPv4/IPv6)
 * Fallback 1: api.ipify.org (JSON, IPv4)
 * Fallback 2: icanhazip.com (Text)
 * Fallback 3: ipapi.co/json/
 */
export const fetchPublicIp = async (): Promise<string | null> => {
  const existing = getPublicIp();
  if (existing) {
    return existing;
  }

  if (activeFetchPromise) {
    return activeFetchPromise;
  }

  activeFetchPromise = (async () => {
    // Attempt 1: api64.ipify.org (JSON, handles dual-stack IPv4/IPv6)
    try {
      const res = await fetchWithTimeout('https://api64.ipify.org?format=json');
      if (res.ok) {
        const data = await res.json();
        if (data?.ip && !isLocalOrMockIp(data.ip)) {
          const ip = String(data.ip).trim();
          cacheResolvedIp(ip);
          return ip;
        }
      }
    } catch {}

    // Attempt 2: api.ipify.org (JSON, IPv4)
    try {
      const res = await fetchWithTimeout('https://api.ipify.org?format=json');
      if (res.ok) {
        const data = await res.json();
        if (data?.ip && !isLocalOrMockIp(data.ip)) {
          const ip = String(data.ip).trim();
          cacheResolvedIp(ip);
          return ip;
        }
      }
    } catch {}

    // Attempt 3: icanhazip.com (Plain text)
    try {
      const res = await fetchWithTimeout('https://icanhazip.com');
      if (res.ok) {
        const text = await res.text();
        const ip = text.trim();
        if (ip && !isLocalOrMockIp(ip)) {
          cacheResolvedIp(ip);
          return ip;
        }
      }
    } catch {}

    // Attempt 4: ipapi.co (JSON)
    try {
      const res = await fetchWithTimeout('https://ipapi.co/json/');
      if (res.ok) {
        const data = await res.json();
        if (data?.ip && !isLocalOrMockIp(data.ip)) {
          const ip = String(data.ip).trim();
          cacheResolvedIp(ip);
          return ip;
        }
      }
    } catch {}

    return null;
  })();

  try {
    const result = await activeFetchPromise;
    return result;
  } finally {
    activeFetchPromise = null;
  }
};

