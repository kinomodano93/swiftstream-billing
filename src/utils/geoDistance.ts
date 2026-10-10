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
 * Calculates Outside Plant (OSP) span metrics along an interactive multi-point pole route.
 * Accurately calculates the exact path distance traversing through intermediate utility poles.
 */
export const calculatePathMetrics = (
  path: Array<{ lat: number; lng: number }>,
  slackPerPoleMeters = 3
): SpanMetrics => {
  if (!path || path.length < 2) {
    return {
      directMeters: 0,
      directKm: 0,
      routeCableMeters: 0,
      routeCableKm: 0,
      opticalLossDb: 0,
      propagationDelayMicroseconds: 0,
      formattedDirect: '0 m',
      formattedRoute: '0 m',
    };
  }

  const directMeters = calculateHaversineDistance(
    path[0].lat,
    path[0].lng,
    path[path.length - 1].lat,
    path[path.length - 1].lng
  );

  let routedMeters = 0;
  for (let i = 0; i < path.length - 1; i++) {
    routedMeters += calculateHaversineDistance(
      path[i].lat,
      path[i].lng,
      path[i + 1].lat,
      path[i + 1].lng
    );
  }

  // Add small drip-loop/sag slack allowance per intermediate utility pole
  if (path.length > 2) {
    routedMeters += (path.length - 2) * slackPerPoleMeters;
  }

  const directKm = Number((directMeters / 1000).toFixed(2));
  const routeCableKm = Number((routedMeters / 1000).toFixed(2));
  const opticalLossDb = Number(((routedMeters / 1000) * 0.35).toFixed(2));
  const propagationDelayMicroseconds = Number(((routedMeters / 1000) * 5.0).toFixed(1));

  const formatDist = (meters: number) => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(2)} km (${meters.toLocaleString()} m)`;
    }
    return `${meters.toLocaleString()} m`;
  };

  return {
    directMeters,
    directKm,
    routeCableMeters: routedMeters,
    routeCableKm,
    opticalLossDb,
    propagationDelayMicroseconds,
    formattedDirect: formatDist(directMeters),
    formattedRoute: formatDist(routedMeters),
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

export interface InterpolatedPointResult {
  lat: number;
  lng: number;
  segmentIndex: number;
  progressInSegment: number;
  totalPathMeters: number;
}

/**
 * Accurately calculates the exact geographic point at a specified distance (meters)
 * along a multi-vertex polyline by walking cumulative Haversine distances.
 * Eliminates proportional index skew on uneven cable segments.
 */
export const interpolatePointAlongPath = (
  path: Array<{ lat: number; lng: number }>,
  targetDistanceMeters: number
): InterpolatedPointResult => {
  if (!path || path.length === 0) {
    return { lat: 0, lng: 0, segmentIndex: 0, progressInSegment: 0, totalPathMeters: 0 };
  }
  if (path.length === 1) {
    return {
      lat: path[0].lat,
      lng: path[0].lng,
      segmentIndex: 0,
      progressInSegment: 0,
      totalPathMeters: 0,
    };
  }

  // 1. Calculate each segment's length and total path length
  const segmentLengths: number[] = [];
  let totalLength = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const d = calculateHaversineDistance(
      path[i].lat,
      path[i].lng,
      path[i + 1].lat,
      path[i + 1].lng
    );
    segmentLengths.push(d);
    totalLength += d;
  }

  if (totalLength === 0) {
    return {
      lat: path[0].lat,
      lng: path[0].lng,
      segmentIndex: 0,
      progressInSegment: 0,
      totalPathMeters: 0,
    };
  }

  // 2. Clamp target distance within [0, totalLength]
  const clampedDistance = Math.min(Math.max(targetDistanceMeters, 0), totalLength);

  // 3. Walk cumulative distance to find target segment
  let accumulated = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const segLen = segmentLengths[i];
    if (accumulated + segLen >= clampedDistance || i === path.length - 2) {
      const remaining = Math.max(0, clampedDistance - accumulated);
      const t = segLen > 0 ? Math.min(1, Math.max(0, remaining / segLen)) : 0;
      const p1 = path[i];
      const p2 = path[i + 1];
      return {
        lat: p1.lat + (p2.lat - p1.lat) * t,
        lng: p1.lng + (p2.lng - p1.lng) * t,
        segmentIndex: i,
        progressInSegment: t,
        totalPathMeters: totalLength,
      };
    }
    accumulated += segLen;
  }

  const last = path[path.length - 1];
  return {
    lat: last.lat,
    lng: last.lng,
    segmentIndex: path.length - 2,
    progressInSegment: 1,
    totalPathMeters: totalLength,
  };
};

