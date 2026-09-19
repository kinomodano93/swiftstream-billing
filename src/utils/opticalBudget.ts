import { NapBox, OltPopNode, FbtSplitterRatio, PlcSplitterType } from '../types';
import { calculateSpanMetrics, SpanMetrics } from './geoDistance';

export const FBT_LOSS_SPECS: Record<
  FbtSplitterRatio,
  { throughLoss: number; tapLoss: number; label: string; percentThrough: number; percentTap: number }
> = {
  '90/10': { throughLoss: 0.6, tapLoss: 10.6, label: '90/10 FBT Coupler', percentThrough: 90, percentTap: 10 },
  '85/15': { throughLoss: 0.9, tapLoss: 8.8, label: '85/15 FBT Coupler', percentThrough: 85, percentTap: 15 },
  '80/20': { throughLoss: 1.2, tapLoss: 7.4, label: '80/20 FBT Coupler', percentThrough: 80, percentTap: 20 },
  '75/25': { throughLoss: 1.5, tapLoss: 6.5, label: '75/25 FBT Coupler', percentThrough: 75, percentTap: 25 },
  '70/30': { throughLoss: 1.8, tapLoss: 5.6, label: '70/30 FBT Coupler', percentThrough: 70, percentTap: 30 },
  '60/40': { throughLoss: 2.5, tapLoss: 4.3, label: '60/40 FBT Coupler', percentThrough: 60, percentTap: 40 },
  '50/50': { throughLoss: 3.4, tapLoss: 3.4, label: '50/50 Symmetrical 1x2', percentThrough: 50, percentTap: 50 },
  terminal: { throughLoss: 0.0, tapLoss: 0.0, label: 'Terminal Box (100% Direct to PLC)', percentThrough: 0, percentTap: 100 },
};

export const PLC_LOSS_SPECS: Record<PlcSplitterType, { loss: number; ports: number; label: string }> = {
  '1:4': { loss: 7.2, ports: 4, label: '1:4 PLC Splitter (~7.2 dB)' },
  '1:8': { loss: 10.5, ports: 8, label: '1:8 PLC Splitter (~10.5 dB)' },
  '1:16': { loss: 13.8, ports: 16, label: '1:16 PLC Splitter (~13.8 dB)' },
  '1:32': { loss: 17.1, ports: 32, label: '1:32 PLC Splitter (~17.1 dB)' },
};

export const FIBER_LOSS_PER_KM = 0.35; // ITU-T G.652.D at 1310/1490nm (dB/km)
export const SPLICE_LOSS_DB = 0.1; // Fusion splice insertion loss (dB)

export interface CascadeHopTelemetry {
  nap: NapBox;
  hopIndex: number; // 1-based index: 1 = Feeder NAP from OLT, 2 = 2nd hop, etc.
  totalHops: number;
  isFeeder: boolean;
  isTerminal: boolean;
  upstreamType: 'olt' | 'nap';
  upstreamId: string;
  upstreamName: string;
  upstreamCoords: { lat: number; lng: number };
  hopSpan: SpanMetrics;
  cumulativeDirectMeters: number;
  cumulativeCableMeters: number;
  hopFiberLossDb: number;
  cumulativeFiberLossDb: number;
  arrivingInputPowerDbm: number;
  fbtRatio: FbtSplitterRatio;
  fbtThroughLossDb: number;
  fbtTapLossDb: number;
  throughOutputPowerDbm: number | null; // null if terminal
  plcType: PlcSplitterType;
  plcLossDb: number;
  dropPortRxPowerDbm: number;
  healthStatus: 'optimal' | 'acceptable' | 'warning' | 'critical';
  healthLabel: string;
}

/**
 * Parses the PLC splitter type from either explicit plcSplitterType or the legacy splitterType string.
 */
export const resolvePlcType = (nap: NapBox): PlcSplitterType => {
  if (nap.plcSplitterType) return nap.plcSplitterType;
  if (nap.totalPorts === 8 || (nap.splitterType && nap.splitterType.includes('1:8'))) return '1:8';
  if (nap.totalPorts === 4 || (nap.splitterType && nap.splitterType.includes('1:4'))) return '1:4';
  if (nap.totalPorts === 32 || (nap.splitterType && nap.splitterType.includes('1:32'))) return '1:32';
  return '1:16';
};

/**
 * Returns sensible default FBT ratio based on hop position and total boxes.
 */
export const getDefaultFbtForHop = (hopIndex: number, totalHops: number): FbtSplitterRatio => {
  if (hopIndex >= totalHops) return 'terminal';
  if (hopIndex === 1) return totalHops >= 5 ? '90/10' : '85/15';
  if (hopIndex === 2) return '80/20';
  if (hopIndex === 3) return '70/30';
  if (hopIndex === 4) return '60/40';
  return '50/50';
};

/**
 * Resolves the sequential daisy-chain ordering of NAPs for a given OLT and PON Port.
 * Prioritizes explicit `upstreamNapId` / `feedSourceType` links; falls back to spatial geodetic chain.
 */
export const buildPonCascadeChain = (
  napsOnPon: NapBox[],
  olt: OltPopNode
): NapBox[] => {
  if (napsOnPon.length === 0) return [];
  if (napsOnPon.length === 1) return napsOnPon;

  // Check if explicit chaining is configured
  const hasExplicitLinks = napsOnPon.some((n) => n.upstreamNapId || n.feedSourceType);

  if (hasExplicitLinks) {
    const chain: NapBox[] = [];
    const visited = new Set<string>();

    // 1. Find root feeder NAP (explicit feedSourceType === 'olt' or no upstreamNapId)
    let root = napsOnPon.find((n) => n.feedSourceType === 'olt' || !n.upstreamNapId);
    if (!root) {
      // Fallback to closest to OLT
      root = [...napsOnPon].sort(
        (a, b) =>
          calculateSpanMetrics(olt.latitude, olt.longitude, a.latitude, a.longitude).directMeters -
          calculateSpanMetrics(olt.latitude, olt.longitude, b.latitude, b.longitude).directMeters
      )[0];
    }

    chain.push(root);
    visited.add(root.id);

    // 2. Walk downstream children
    let current = root;
    while (chain.length < napsOnPon.length) {
      const nextChild = napsOnPon.find((n) => !visited.has(n.id) && n.upstreamNapId === current.id);
      if (nextChild) {
        chain.push(nextChild);
        visited.add(nextChild.id);
        current = nextChild;
      } else {
        // Look for any unvisited box closest to current
        const unvisited = napsOnPon.filter((n) => !visited.has(n.id));
        if (unvisited.length === 0) break;
        const nearest = [...unvisited].sort(
          (a, b) =>
            calculateSpanMetrics(current.latitude, current.longitude, a.latitude, a.longitude).directMeters -
            calculateSpanMetrics(current.latitude, current.longitude, b.latitude, b.longitude).directMeters
        )[0];
        chain.push(nearest);
        visited.add(nearest.id);
        current = nearest;
      }
    }

    return chain;
  }

  // Pure spatial routing:
  // Step 1: Feeder NAP is nearest to OLT
  const unvisited = [...napsOnPon];
  const chain: NapBox[] = [];

  unvisited.sort(
    (a, b) =>
      calculateSpanMetrics(olt.latitude, olt.longitude, a.latitude, a.longitude).directMeters -
      calculateSpanMetrics(olt.latitude, olt.longitude, b.latitude, b.longitude).directMeters
  );

  const feeder = unvisited.shift()!;
  chain.push(feeder);

  // Step 2: Next NAP is nearest to the previous box
  while (unvisited.length > 0) {
    const lastBox = chain[chain.length - 1];
    unvisited.sort(
      (a, b) =>
        calculateSpanMetrics(lastBox.latitude, lastBox.longitude, a.latitude, a.longitude).directMeters -
        calculateSpanMetrics(lastBox.latitude, lastBox.longitude, b.latitude, b.longitude).directMeters
    );
    chain.push(unvisited.shift()!);
  }

  return chain;
};

/**
 * Evaluates the health status of subscriber drop port optical power.
 */
export const evaluateOpticalPowerHealth = (
  rxDbm: number
): { status: 'optimal' | 'acceptable' | 'warning' | 'critical'; label: string } => {
  if (rxDbm > -8.0) {
    return { status: 'warning', label: 'Overload (Tx Saturation Risk)' };
  }
  if (rxDbm >= -24.0 && rxDbm <= -14.0) {
    return { status: 'optimal', label: 'Optimal / Green Zone' };
  }
  if (rxDbm >= -27.0 && rxDbm < -24.0) {
    return { status: 'acceptable', label: 'Acceptable Margin' };
  }
  if (rxDbm >= -29.0 && rxDbm < -27.0) {
    return { status: 'warning', label: 'High Attenuation Warning' };
  }
  return { status: 'critical', label: 'Critical / Out of Spec' };
};

/**
 * Calculates complete hop-by-hop optical telemetry for a cascaded daisy chain.
 */
export const calculateCascadeTelemetry = (
  chain: NapBox[],
  olt: OltPopNode
): CascadeHopTelemetry[] => {
  if (chain.length === 0) return [];

  const oltTxPower = typeof olt.txPowerDbm === 'number' ? olt.txPowerDbm : 4.0;
  let currentTrunkPowerDbm = oltTxPower;
  let cumulativeDirect = 0;
  let cumulativeCable = 0;
  let cumulativeFiberLoss = 0;

  const result: CascadeHopTelemetry[] = [];
  const totalHops = chain.length;

  for (let i = 0; i < chain.length; i++) {
    const nap = chain[i];
    const hopIndex = i + 1;
    const isFeeder = hopIndex === 1;
    const isTerminal = hopIndex === totalHops || nap.fbtRatio === 'terminal';

    const upstreamType: 'olt' | 'nap' = isFeeder ? 'olt' : 'nap';
    const upstreamId = isFeeder ? olt.id : chain[i - 1].id;
    const upstreamName = isFeeder ? (olt.code || olt.name || 'Central OLT') : chain[i - 1].code;
    const upstreamCoords = isFeeder
      ? { lat: olt.latitude, lng: olt.longitude }
      : { lat: chain[i - 1].latitude, lng: chain[i - 1].longitude };

    // Hop Distance from immediate upstream node
    const hopSpan = calculateSpanMetrics(
      upstreamCoords.lat,
      upstreamCoords.lng,
      nap.latitude,
      nap.longitude
    );

    cumulativeDirect += hopSpan.directMeters;
    cumulativeCable += hopSpan.routeCableMeters;

    // Fiber loss along this hop (G.652D @ 0.35 dB/km) + splice loss (0.1 dB)
    const hopFiberLoss = Number(((hopSpan.routeCableMeters / 1000) * FIBER_LOSS_PER_KM).toFixed(2));
    cumulativeFiberLoss += hopFiberLoss + SPLICE_LOSS_DB;

    // Arriving input power at this box
    const arrivingInputPowerDbm = Number((currentTrunkPowerDbm - hopFiberLoss - SPLICE_LOSS_DB).toFixed(2));

    // Resolve FBT Coupler
    const fbtRatio = nap.fbtRatio || getDefaultFbtForHop(hopIndex, totalHops);
    const fbtSpec = FBT_LOSS_SPECS[fbtRatio] || FBT_LOSS_SPECS['85/15'];

    // Resolve PLC Splitter
    const plcType = resolvePlcType(nap);
    const plcSpec = PLC_LOSS_SPECS[plcType] || PLC_LOSS_SPECS['1:16'];

    // Drop Port Rx Power:
    // Arriving power minus FBT tap loss minus PLC splitter insertion loss
    const dropPortRxPowerDbm = isTerminal
      ? Number((arrivingInputPowerDbm - plcSpec.loss).toFixed(2))
      : Number((arrivingInputPowerDbm - fbtSpec.tapLoss - plcSpec.loss).toFixed(2));

    // Power continuing down the through leg (if not terminal)
    const throughOutputPowerDbm = isTerminal
      ? null
      : Number((arrivingInputPowerDbm - fbtSpec.throughLoss).toFixed(2));

    const health = evaluateOpticalPowerHealth(dropPortRxPowerDbm);

    result.push({
      nap,
      hopIndex,
      totalHops,
      isFeeder,
      isTerminal,
      upstreamType,
      upstreamId,
      upstreamName,
      upstreamCoords,
      hopSpan,
      cumulativeDirectMeters: cumulativeDirect,
      cumulativeCableMeters: cumulativeCable,
      hopFiberLossDb: hopFiberLoss,
      cumulativeFiberLossDb: Number(cumulativeFiberLoss.toFixed(2)),
      arrivingInputPowerDbm,
      fbtRatio,
      fbtThroughLossDb: fbtSpec.throughLoss,
      fbtTapLossDb: fbtSpec.tapLoss,
      throughOutputPowerDbm,
      plcType,
      plcLossDb: plcSpec.loss,
      dropPortRxPowerDbm,
      healthStatus: health.status,
      healthLabel: health.label,
    });

    // Update current trunk power for next hop
    if (throughOutputPowerDbm !== null) {
      currentTrunkPowerDbm = throughOutputPowerDbm;
    }
  }

  return result;
};

