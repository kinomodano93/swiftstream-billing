import { NapBox, OltPopNode } from '../types';

/**
 * Calculates straight-line geodetic distance between two GPS coordinates using the Haversine formula.
 * Returns distance in meters.
 */
export const calculateHaversineDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  if (
    typeof lat1 !== 'number' ||
    typeof lon1 !== 'number' ||
    typeof lat2 !== 'number' ||
    typeof lon2 !== 'number' ||
    isNaN(lat1) ||
    isNaN(lon1) ||
    isNaN(lat2) ||
    isNaN(lon2)
  ) {
    return 0;
  }

  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

export interface SpanMetrics {
  directMeters: number;
  directKm: number;
  routeCableMeters: number;
  routeCableKm: number;
  opticalLossDb: number;
  propagationDelayMicroseconds: number;
  formattedDirect: string;
  formattedRoute: string;
}

/**
 * Calculates Outside Plant (OSP) span metrics between two geographic points.
 * - routeWindingFactor: Accounts for road curvature, utility pole sag, and service loops (default: 1.2x)
 * - opticalLossDb: Single-mode G.652.D fiber attenuation at 1310nm (~0.35 dB/km)
 * - propagationDelay: Light travel in single-mode silica fiber (~5.0 microseconds per km)
 */
export const calculateSpanMetrics = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  routeWindingFactor = 1.2
): SpanMetrics => {
  const directMeters = calculateHaversineDistance(lat1, lon1, lat2, lon2);
  const directKm = Number((directMeters / 1000).toFixed(2));
  const routeCableMeters = Math.round(directMeters * routeWindingFactor);
  const routeCableKm = Number((routeCableMeters / 1000).toFixed(2));
  const opticalLossDb = Number(((routeCableMeters / 1000) * 0.35).toFixed(2));
  const propagationDelayMicroseconds = Number(((routeCableMeters / 1000) * 5.0).toFixed(1));

  const formatDist = (meters: number) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km (${meters.toLocaleString()} m)`;
    }
    return `${meters.toLocaleString()} m`;
  };

  return {
    directMeters,
    directKm,
    routeCableMeters,
    routeCableKm,
    opticalLossDb,
    propagationDelayMicroseconds,
    formattedDirect: formatDist(directMeters),
    formattedRoute: formatDist(routeCableMeters),
  };
};

/**
 * Calculates distance metrics between an OLT POP and a downstream NAP box.
 */
export const getOltToNapDistance = (olt: OltPopNode, nap: NapBox): SpanMetrics => {
  return calculateSpanMetrics(olt.latitude, olt.longitude, nap.latitude, nap.longitude);
};

/**
 * Calculates distance metrics between two NAP boxes (inter-NAP distribution span).
 */
export const getNapToNapDistance = (napA: NapBox, napB: NapBox): SpanMetrics => {
  return calculateSpanMetrics(napA.latitude, napA.longitude, napB.latitude, napB.longitude);
};

export interface NearestNapResult {
  nap: NapBox;
  metrics: SpanMetrics;
}

/**
 * Finds the nearest neighboring NAP boxes to a target NAP box.
 */
export const findNearestNaps = (
  targetNap: NapBox,
  allNaps: NapBox[],
  limit = 4
): NearestNapResult[] => {
  return allNaps
    .filter((n) => n.id !== targetNap.id && typeof n.latitude === 'number' && typeof n.longitude === 'number')
    .map((n) => ({
      nap: n,
      metrics: getNapToNapDistance(targetNap, n),
    }))
    .sort((a, b) => a.metrics.directMeters - b.metrics.directMeters)
    .slice(0, limit);
};

