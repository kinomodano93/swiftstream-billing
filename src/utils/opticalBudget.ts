import { NapBox, OltPopNode, FbtSplitterRatio, PlcSplitterType, BranchDirection, FeedLegType } from '../types';
import { calculateSpanMetrics, calculatePathMetrics, SpanMetrics } from './geoDistance';

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
export const SUB_SPLIT_50_50_LOSS_DB = 3.4; // 1x2 Symmetrical sub-split insertion loss (dB)

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
  throughOutputPowerDbm: number | null; // null if terminal (e.g. 60% leg continuing downstream)
  tapOutputPowerDbm: number; // Optical power on the tap leg (e.g. 40% leg)
  tapSubSplitEnabled: boolean; // True if tap is split 50/50 for dual NAPs
  subSplitLossDb: number; // 3.4 dB if enabled, 0 otherwise
  branchDirection: BranchDirection; // 'left' | 'right' | 'through' | 'direct'
  branchInputPowerDbm: number; // Optical power arriving at the box internal PLC splitter
  leftBranchRxDbm?: number; // Simulated Drop Rx for Left Branch 16-port NAP
  rightBranchRxDbm?: number; // Simulated Drop Rx for Right Branch 16-port NAP
  pairedBranchNapId?: string; // ID of paired twin box
  totalBranchCapacityPorts: number; // 32 ports for dual 16-port NAPs, or 16 ports for single
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

    // 1. Find root feeder NAP:
    // If multiple claim feeder / 'olt', pick the one physically closest to the Central OLT POP
    const feederCandidates = napsOnPon.filter((n) => n.feedSourceType === 'olt' || !n.upstreamNapId);
    let root = feederCandidates.length > 0
      ? [...feederCandidates].sort(
          (a, b) =>
            calculateSpanMetrics(olt.latitude, olt.longitude, a.latitude, a.longitude).directMeters -
            calculateSpanMetrics(olt.latitude, olt.longitude, b.latitude, b.longitude).directMeters
        )[0]
      : napsOnPon[0];

    chain.push(root);
    visited.add(root.id);

    // 2. Walk downstream children
    let current = root;
    while (chain.length < napsOnPon.length) {
      // First, if current has a co-located twin sub-split box that hasn't been added yet, add it
      const twinChild = napsOnPon.find(
        (n) => !visited.has(n.id) && n.upstreamNapId === current.id && (n.feedLegType === 'tap_subsplit' || n.id === current.pairedBranchNapId)
      );
      if (twinChild) {
        chain.push(twinChild);
        visited.add(twinChild.id);
      }

      // Next, find downstream trunk child from current (or from any visited trunk box)
      const nextTrunkChild = napsOnPon.find(
        (n) => !visited.has(n.id) && n.upstreamNapId === current.id && n.feedLegType !== 'tap_subsplit'
      );
      if (nextTrunkChild) {
        chain.push(nextTrunkChild);
        visited.add(nextTrunkChild.id);
        current = nextTrunkChild;
      } else {
        // Look for any unvisited box whose parent was already visited in the chain
        const childOfVisited = napsOnPon.find(
          (n) => !visited.has(n.id) && n.upstreamNapId && visited.has(n.upstreamNapId)
        );
        if (childOfVisited) {
          chain.push(childOfVisited);
          visited.add(childOfVisited.id);
          current = childOfVisited;
          continue;
        }

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
  const trunkBoxes = chain.filter((n) => n.feedLegType !== 'tap_subsplit');
  const totalHops = Math.max(1, trunkBoxes.length);
  let trunkHopCounter = 0;

  for (let i = 0; i < chain.length; i++) {
    const nap = chain[i];

    // Check if the NAP box has an explicit upstream NAP link
    const explicitUpstream = nap.upstreamNapId
      ? chain.find((b) => b.id === nap.upstreamNapId)
      : null;

    // Check if upstream parent has already been computed in this cascade
    const parentTelemetry = explicitUpstream ? result.find((t) => t.nap.id === explicitUpstream.id) : null;
    const isFeedFromSubSplit: boolean = Boolean(
      nap.feedLegType === 'tap_subsplit' ||
      (parentTelemetry?.tapSubSplitEnabled && parentTelemetry.nap.pairedBranchNapId === nap.id)
    );

    // Box 1 (i === 0) is the root feeder from the Central OLT.
    // All subsequent trunk boxes are daisy-chained hops fed from the preceding box (or explicit upstream).
    const isFeeder: boolean = i === 0 && !explicitUpstream && !isFeedFromSubSplit;

    const hopIndex: number = isFeedFromSubSplit && parentTelemetry
      ? parentTelemetry.hopIndex
      : ++trunkHopCounter;

    const isTerminal: boolean = Boolean(
      (!isFeedFromSubSplit && hopIndex === totalHops) ||
      nap.fbtRatio === 'terminal' ||
      isFeedFromSubSplit
    );

    const upstreamType: 'olt' | 'nap' = isFeeder ? 'olt' : 'nap';
    const upstreamId = isFeeder
      ? olt.id
      : explicitUpstream
      ? explicitUpstream.id
      : chain[i - 1]?.id || olt.id;

    const upstreamName = isFeeder
      ? (olt.code || olt.name || 'Central OLT')
      : explicitUpstream
      ? explicitUpstream.code
      : chain[i - 1]?.code || olt.code || 'Central OLT';

    const upstreamCoords = isFeeder
      ? { lat: olt.latitude, lng: olt.longitude }
      : explicitUpstream
      ? { lat: explicitUpstream.latitude, lng: explicitUpstream.longitude }
      : chain[i - 1]
      ? { lat: chain[i - 1].latitude, lng: chain[i - 1].longitude }
      : { lat: olt.latitude, lng: olt.longitude };

    // Hop Distance from immediate upstream node (uses exact pole waypoints if routed by engineer)
    const hopSpan = nap.customPathCoordinates && nap.customPathCoordinates.length > 0
      ? calculatePathMetrics([
          upstreamCoords,
          ...nap.customPathCoordinates,
          { lat: nap.latitude, lng: nap.longitude },
        ])
      : calculateSpanMetrics(
          upstreamCoords.lat,
          upstreamCoords.lng,
          nap.latitude,
          nap.longitude
        );

    const hopCumulativeDirect = (parentTelemetry ? parentTelemetry.cumulativeDirectMeters : cumulativeDirect) + hopSpan.directMeters;
    const hopCumulativeCable = (parentTelemetry ? parentTelemetry.cumulativeCableMeters : cumulativeCable) + hopSpan.routeCableMeters;

    // Source power entering the hop span fiber:
    const sourcePower = isFeeder
      ? oltTxPower
      : isFeedFromSubSplit && parentTelemetry
      ? parentTelemetry.branchInputPowerDbm
      : parentTelemetry
      ? (typeof parentTelemetry.throughOutputPowerDbm === 'number' ? parentTelemetry.throughOutputPowerDbm : parentTelemetry.arrivingInputPowerDbm)
      : currentTrunkPowerDbm;

    // Fiber loss along this hop (G.652D @ 0.35 dB/km) + splice loss (0.1 dB)
    // If it's a twin box co-located on the same pole (span < 10m), do not double-count fiber run
    const isCoLocated = isFeedFromSubSplit && hopSpan.directMeters < 10;
    const hopFiberLoss = isCoLocated ? 0 : Number(((hopSpan.routeCableMeters / 1000) * FIBER_LOSS_PER_KM).toFixed(2));
    const hopSpliceLoss = isCoLocated ? 0 : SPLICE_LOSS_DB;
    const hopCumulativeFiberLoss = Number(((parentTelemetry ? parentTelemetry.cumulativeFiberLossDb : cumulativeFiberLoss) + hopFiberLoss + hopSpliceLoss).toFixed(2));

    if (!isFeedFromSubSplit) {
      cumulativeDirect = hopCumulativeDirect;
      cumulativeCable = hopCumulativeCable;
      cumulativeFiberLoss = hopCumulativeFiberLoss;
    }

    // Arriving input power at this box
    const arrivingInputPowerDbm = Number((sourcePower - hopFiberLoss - hopSpliceLoss).toFixed(2));

    // Resolve FBT Coupler
    const fbtRatio = nap.fbtRatio || getDefaultFbtForHop(hopIndex, totalHops);
    const fbtSpec = FBT_LOSS_SPECS[fbtRatio] || FBT_LOSS_SPECS['85/15'];

    // Resolve PLC Splitter
    const plcType = resolvePlcType(nap);
    const plcSpec = PLC_LOSS_SPECS[plcType] || PLC_LOSS_SPECS['1:16'];

    // 1. Through Leg Power (continues along trunk to next hop)
    // If this is a lateral subsplit box, it does not output a through trunk leg
    const throughOutputPowerDbm = isFeedFromSubSplit || isTerminal
      ? null
      : Number((arrivingInputPowerDbm - fbtSpec.throughLoss - SPLICE_LOSS_DB).toFixed(2));

    // 2. Tap Leg Power (e.g. 40% leg)
    const tapOutputPowerDbm = isFeedFromSubSplit
      ? arrivingInputPowerDbm
      : isTerminal
      ? arrivingInputPowerDbm
      : Number((arrivingInputPowerDbm - fbtSpec.tapLoss - SPLICE_LOSS_DB).toFixed(2));

    // 3. 50/50 Sub-Split Configuration:
    // When enabled, the tap power is split 50/50 (~3.4 dB loss) to feed dual 16-port NAPs (Left & Right)
    const tapSubSplitEnabled = isFeedFromSubSplit
      ? true
      : Boolean(
          nap.tapSubSplitEnabled ||
          (fbtRatio === '60/40' && (nap.branchDirection === 'left' || nap.branchDirection === 'right'))
        );

    const subSplitLossDb = isFeedFromSubSplit
      ? 0
      : tapSubSplitEnabled && !isTerminal
      ? SUB_SPLIT_50_50_LOSS_DB
      : 0;

    const branchInputPowerDbm = isFeedFromSubSplit
      ? arrivingInputPowerDbm
      : tapSubSplitEnabled && !isTerminal
      ? Number((tapOutputPowerDbm - SUB_SPLIT_50_50_LOSS_DB - SPLICE_LOSS_DB).toFixed(2))
      : tapOutputPowerDbm;

    // 4. Drop Port Rx Power: inside the box after the PLC splitter
    const dropPortRxPowerDbm = Number((branchInputPowerDbm - plcSpec.loss).toFixed(2));
    const leftBranchRxDbm = tapSubSplitEnabled && !isTerminal ? dropPortRxPowerDbm : undefined;
    const rightBranchRxDbm = tapSubSplitEnabled && !isTerminal ? dropPortRxPowerDbm : undefined;
    const totalBranchCapacityPorts = tapSubSplitEnabled && !isTerminal ? plcSpec.ports * 2 : plcSpec.ports;

    const branchDirection: BranchDirection =
      nap.branchDirection || (tapSubSplitEnabled ? 'left' : isTerminal ? 'direct' : 'through');

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
      cumulativeDirectMeters: hopCumulativeDirect,
      cumulativeCableMeters: hopCumulativeCable,
      hopFiberLossDb: hopFiberLoss,
      cumulativeFiberLossDb: hopCumulativeFiberLoss,
      arrivingInputPowerDbm,
      fbtRatio,
      fbtThroughLossDb: fbtSpec.throughLoss,
      fbtTapLossDb: fbtSpec.tapLoss,
      throughOutputPowerDbm,
      tapOutputPowerDbm,
      tapSubSplitEnabled,
      subSplitLossDb,
      branchDirection,
      branchInputPowerDbm,
      leftBranchRxDbm,
      rightBranchRxDbm,
      pairedBranchNapId: nap.pairedBranchNapId,
      totalBranchCapacityPorts,
      plcType,
      plcLossDb: plcSpec.loss,
      dropPortRxPowerDbm,
      healthStatus: health.status,
      healthLabel: health.label,
    });

    // Update current trunk power for next daisy-chain hop along the main trunk line
    if (throughOutputPowerDbm !== null && !isFeedFromSubSplit) {
      currentTrunkPowerDbm = throughOutputPowerDbm;
    }
  }

  return result;
};

export interface SingleHopBudgetPreviewInput {
  baseTxPowerDbm: number;
  upstreamThroughPowerDbm?: number | null;
  upstreamTapSubSplitPowerDbm?: number | null;
  isFeedFromSubSplit?: boolean;
  routeCableMeters: number;
  fbtRatio: FbtSplitterRatio;
  plcSplitterType: PlcSplitterType;
  tapSubSplitEnabled: boolean;
  branchDirection?: BranchDirection;
}

export interface SingleHopBudgetPreviewResult {
  hopFiberLossDb: number;
  arrivingInputPowerDbm: number;
  throughOutputPowerDbm: number | null;
  tapOutputPowerDbm: number;
  subSplitLossDb: number;
  branchInputPowerDbm: number;
  dropPortRxPowerDbm: number;
  leftBranchRxDbm?: number;
  rightBranchRxDbm?: number;
  totalBranchCapacityPorts: number;
  health: { status: 'optimal' | 'acceptable' | 'warning' | 'critical'; label: string };
}

export const calculateSingleHopBudgetPreview = (
  input: SingleHopBudgetPreviewInput
): SingleHopBudgetPreviewResult => {
  const hopFiberLoss = Number(((input.routeCableMeters / 1000) * FIBER_LOSS_PER_KM).toFixed(2));
  const sourcePower = input.isFeedFromSubSplit && typeof input.upstreamTapSubSplitPowerDbm === 'number'
    ? input.upstreamTapSubSplitPowerDbm
    : typeof input.upstreamThroughPowerDbm === 'number'
    ? input.upstreamThroughPowerDbm
    : input.baseTxPowerDbm;

  const arrivingInputPowerDbm = Number((sourcePower - hopFiberLoss - SPLICE_LOSS_DB).toFixed(2));
  const isTerminal = input.fbtRatio === 'terminal';
  const fbtSpec = FBT_LOSS_SPECS[input.fbtRatio] || FBT_LOSS_SPECS['85/15'];
  const plcSpec = PLC_LOSS_SPECS[input.plcSplitterType] || PLC_LOSS_SPECS['1:16'];

  const throughOutputPowerDbm = isTerminal
    ? null
    : Number((arrivingInputPowerDbm - fbtSpec.throughLoss - SPLICE_LOSS_DB).toFixed(2));

  const tapOutputPowerDbm = isTerminal
    ? arrivingInputPowerDbm
    : Number((arrivingInputPowerDbm - fbtSpec.tapLoss - SPLICE_LOSS_DB).toFixed(2));

  const subSplitLossDb = input.tapSubSplitEnabled && !isTerminal ? SUB_SPLIT_50_50_LOSS_DB : 0;
  const branchInputPowerDbm = input.tapSubSplitEnabled && !isTerminal
    ? Number((tapOutputPowerDbm - SUB_SPLIT_50_50_LOSS_DB - SPLICE_LOSS_DB).toFixed(2))
    : tapOutputPowerDbm;

  const dropPortRxPowerDbm = Number((branchInputPowerDbm - plcSpec.loss).toFixed(2));
  const leftBranchRxDbm = input.tapSubSplitEnabled && !isTerminal ? dropPortRxPowerDbm : undefined;
  const rightBranchRxDbm = input.tapSubSplitEnabled && !isTerminal ? dropPortRxPowerDbm : undefined;
  const totalBranchCapacityPorts = input.tapSubSplitEnabled && !isTerminal ? plcSpec.ports * 2 : plcSpec.ports;
  const health = evaluateOpticalPowerHealth(dropPortRxPowerDbm);

  return {
    hopFiberLossDb: hopFiberLoss,
    arrivingInputPowerDbm,
    throughOutputPowerDbm,
    tapOutputPowerDbm,
    subSplitLossDb,
    branchInputPowerDbm,
    dropPortRxPowerDbm,
    leftBranchRxDbm,
    rightBranchRxDbm,
    totalBranchCapacityPorts,
    health,
  };
};

