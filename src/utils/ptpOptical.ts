import { PointToPointLink, PtpReadingStatus } from '../types';

export interface PtpOpticalAnalysis {
  status: PtpReadingStatus;
  statusLabel: string;
  badgeClass: string;
  borderClass: string;
  bgClass: string;
  textClass: string;
  observedLossDb: number;
  remainingMarginDb: number;
  theoreticalRxDbm: number;
  healthDescription: string;
}

/**
 * Evaluates 10G SFP+ optical reading health against standard DDM specifications.
 * - Standard Nominal Output (Tx): ~ -3.0 dBm
 * - Maximum Allowable Loss Budget: 14.0 dB (Receiver Sensitivity: down to -14.0 dBm)
 */
export const calculatePtpOpticalStatus = (
  measuredRxDbm: number,
  nominalTxDbm: number = -3.0,
  maxLossBudgetDb: number = 14.0,
  distanceMeters: number = 1000
): PtpOpticalAnalysis => {
  // Theoretical expected Rx based on standard G.652.D fiber (~0.35 dB/km + 0.4 dB connectors)
  const fiberAttenuationDb = Number(((distanceMeters / 1000) * 0.35).toFixed(2));
  const connectorLossDb = 0.4;
  const theoreticalLossDb = fiberAttenuationDb + connectorLossDb;
  const theoreticalRxDbm = Number((nominalTxDbm - theoreticalLossDb).toFixed(2));

  // Observed loss based on actual reading
  const observedLossDb = Number((nominalTxDbm - measuredRxDbm).toFixed(2));
  const remainingMarginDb = Number((maxLossBudgetDb - Math.max(0, observedLossDb)).toFixed(2));

  // Absolute sensitivity floor for 10G SFP+ receiver
  const sensitivityFloorDbm = -Math.abs(maxLossBudgetDb); // e.g. -14.0 dBm

  let status: PtpReadingStatus = 'optimal';
  let statusLabel = 'Optimal Signal';
  let badgeClass = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
  let borderClass = 'border-emerald-500/50';
  let bgClass = 'bg-emerald-950/40';
  let textClass = 'text-emerald-400';
  let healthDescription = `Clean 10G optical signal (${measuredRxDbm.toFixed(1)} dBm) well within receiver dynamic range.`;

  if (measuredRxDbm <= -40 || isNaN(measuredRxDbm)) {
    status = 'link_down';
    statusLabel = 'Optical Loss of Signal (LOS)';
    badgeClass = 'bg-slate-800 text-slate-400 border-slate-700';
    borderClass = 'border-slate-800';
    bgClass = 'bg-slate-950';
    textClass = 'text-slate-500';
    healthDescription = 'No optical light detected at 10G SFP+ receiver. Verify patch cable and laser state.';
  } else if (measuredRxDbm > 0.5) {
    status = 'critical';
    statusLabel = 'Receiver Overload';
    badgeClass = 'bg-rose-500/20 text-rose-300 border-rose-500/50';
    borderClass = 'border-rose-500/60';
    bgClass = 'bg-rose-950/40';
    textClass = 'text-rose-400';
    healthDescription = `Optical power (${measuredRxDbm.toFixed(1)} dBm) exceeds photodiode saturation limit. Attenuator required.`;
  } else if (measuredRxDbm < sensitivityFloorDbm) {
    status = 'critical';
    statusLabel = `Critical High Loss (> ${maxLossBudgetDb} dB)`;
    badgeClass = 'bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse';
    borderClass = 'border-rose-500/60';
    bgClass = 'bg-rose-950/40';
    textClass = 'text-rose-400';
    healthDescription = `Rx power (${measuredRxDbm.toFixed(1)} dBm) dropped below ${sensitivityFloorDbm} dBm receiver sensitivity. Risk of CRC errors and link flap.`;
  } else if (measuredRxDbm <= sensitivityFloorDbm + 2.0) {
    // Between -12.0 dBm and -14.0 dBm
    status = 'marginal';
    statusLabel = 'Marginal / High Attenuation';
    badgeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/50';
    borderClass = 'border-amber-500/50';
    bgClass = 'bg-amber-950/40';
    textClass = 'text-amber-400';
    healthDescription = `Signal approaching receiver budget limit (${remainingMarginDb.toFixed(1)} dB margin remaining). Check splices and fiber bends.`;
  } else if (measuredRxDbm <= -9.0) {
    // Between -9.0 dBm and -12.0 dBm
    status = 'good';
    statusLabel = 'Good Signal';
    badgeClass = 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
    borderClass = 'border-cyan-500/50';
    bgClass = 'bg-cyan-950/40';
    textClass = 'text-cyan-300';
    healthDescription = `Stable 10G optical reception with ${remainingMarginDb.toFixed(1)} dB margin to spare.`;
  } else {
    // Between -3.0 dBm and -9.0 dBm (Nominal / Optimal)
    status = 'optimal';
    statusLabel = 'Optimal / Nominal';
    badgeClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    borderClass = 'border-emerald-500/50';
    bgClass = 'bg-emerald-950/40';
    textClass = 'text-emerald-400';
    healthDescription = `Nominal 10G SFP+ performance (${measuredRxDbm.toFixed(1)} dBm). Optical budget headroom is excellent (+${remainingMarginDb.toFixed(1)} dB).`;
  }

  return {
    status,
    statusLabel,
    badgeClass,
    borderClass,
    bgClass,
    textClass,
    observedLossDb,
    remainingMarginDb,
    theoreticalRxDbm,
    healthDescription,
  };
};

/**
 * Formats link speed into a display badge string
 */
export const formatPtpSpeed = (speedOrType?: number | string): string => {
  if (typeof speedOrType === 'string') {
    if (speedOrType === '25g_sfp28') return '25G SFP28';
    if (speedOrType === '1g_sfp') return '1G SFP';
    return '10G SFP+';
  }
  const speed = speedOrType ?? 10;
  if (speed >= 100) return '100G QSFP28';
  if (speed >= 25) return '25G SFP28';
  if (speed >= 10) return '10G SFP+';
  return '1G SFP';
};

/**
 * Calculates theoretical expected Rx power over distance in meters
 */
export const calculatePtpTheoreticalRx = (
  distanceMeters: number,
  nominalTxDbm: number = -3.0,
  attenuationDbPerKm: number = 0.35,
  connectorLossDb: number = 0.4
): number => {
  const fiberAttenuationDb = (distanceMeters / 1000) * attenuationDbPerKm;
  const totalLoss = fiberAttenuationDb + connectorLossDb;
  return Number((nominalTxDbm - totalLoss).toFixed(2));
};
