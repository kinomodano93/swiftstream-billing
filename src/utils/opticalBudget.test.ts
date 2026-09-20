import assert from 'node:assert';
import test from 'node:test';
import {
  FBT_LOSS_SPECS,
  PLC_LOSS_SPECS,
  SUB_SPLIT_50_50_LOSS_DB,
  calculateCascadeTelemetry,
  calculateSingleHopBudgetPreview,
  evaluateOpticalPowerHealth,
  buildPonCascadeChain,
} from './opticalBudget.ts';
import { NapBox, OltPopNode } from '../types';

test('FBT loss specs contains accurate 60/40 values', () => {
  const spec = FBT_LOSS_SPECS['60/40'];
  assert.strictEqual(spec.percentThrough, 60);
  assert.strictEqual(spec.percentTap, 40);
  assert.strictEqual(spec.throughLoss, 2.5);
  assert.strictEqual(spec.tapLoss, 4.3);
});

test('calculateSingleHopBudgetPreview computes 60/40 with 50/50 sub-split accurately', () => {
  const result = calculateSingleHopBudgetPreview({
    baseTxPowerDbm: 4.0,
    upstreamThroughPowerDbm: null,
    routeCableMeters: 1000, // 0.35dB cable + 0.1dB splice = 0.45dB loss -> arriving = 3.55 dBm
    fbtRatio: '60/40',
    plcSplitterType: '1:16',
    tapSubSplitEnabled: true,
    branchDirection: 'left',
  });

  assert.strictEqual(result.hopFiberLossDb, 0.35);
  assert.strictEqual(result.arrivingInputPowerDbm, 3.55);
  // Through leg (60%): 3.55 - 2.5 - 0.1 = 0.95 dBm
  assert.strictEqual(result.throughOutputPowerDbm, 0.95);
  // Tap leg (40%): 3.55 - 4.3 - 0.1 = -0.85 dBm
  assert.strictEqual(result.tapOutputPowerDbm, -0.85);
  // Sub-split (50/50): -0.85 - 3.4 - 0.1 = -4.35 dBm
  assert.strictEqual(result.subSplitLossDb, 3.4);
  assert.strictEqual(result.branchInputPowerDbm, -4.35);
  // 1:16 PLC: -4.35 - 13.8 = -18.15 dBm
  assert.strictEqual(result.dropPortRxPowerDbm, -18.15);
  assert.strictEqual(result.leftBranchRxDbm, -18.15);
  assert.strictEqual(result.rightBranchRxDbm, -18.15);
  assert.strictEqual(result.totalBranchCapacityPorts, 32);
  assert.strictEqual(result.health.status, 'optimal');
});

test('calculateSingleHopBudgetPreview handles direct tap (without 50/50 sub-split)', () => {
  const result = calculateSingleHopBudgetPreview({
    baseTxPowerDbm: 4.0,
    upstreamThroughPowerDbm: null,
    routeCableMeters: 1000,
    fbtRatio: '60/40',
    plcSplitterType: '1:16',
    tapSubSplitEnabled: false,
    branchDirection: 'direct',
  });

  assert.strictEqual(result.subSplitLossDb, 0);
  assert.strictEqual(result.tapOutputPowerDbm, -0.85);
  assert.strictEqual(result.branchInputPowerDbm, -0.85);
  assert.strictEqual(result.dropPortRxPowerDbm, -14.65);
  assert.strictEqual(result.totalBranchCapacityPorts, 16);
  assert.strictEqual(result.health.status, 'optimal');
});

test('calculateCascadeTelemetry correctly propagates through power to next hop', () => {
  const mockOlt: OltPopNode = {
    id: 'olt-01',
    name: 'Main OLT',
    code: 'OLT-01',
    location: 'Central Office',
    barangay: 'Binauahan',
    latitude: 13.6838,
    longitude: 123.5175,
    totalPonPorts: 16,
    activePonPorts: 2,
    txPowerDbm: 4.0,
  };

  const mockNaps: NapBox[] = [
    {
      id: 'nap-1',
      code: 'NAP-01',
      name: 'Hop 1',
      location: 'Pole 1',
      barangay: 'Binauahan',
      totalPorts: 16,
      fiberCoreColor: 'Blue',
      splitterType: '1:16 PLC',
      plcSplitterType: '1:16',
      feedSourceType: 'olt',
      fbtRatio: '60/40',
      tapSubSplitEnabled: true,
      branchDirection: 'left',
      latitude: 13.6850,
      longitude: 123.5190,
      oltId: 'olt-01',
      ponPortNumber: 1,
      ports: [],
    },
    {
      id: 'nap-2',
      code: 'NAP-02',
      name: 'Hop 2 (Through Trunk)',
      location: 'Pole 2',
      barangay: 'Binauahan',
      totalPorts: 16,
      fiberCoreColor: 'Blue',
      splitterType: '1:16 PLC',
      plcSplitterType: '1:16',
      feedSourceType: 'nap',
      upstreamNapId: 'nap-1',
      feedLegType: 'trunk_through',
      fbtRatio: 'terminal',
      latitude: 13.6870,
      longitude: 123.5210,
      oltId: 'olt-01',
      ponPortNumber: 1,
      ports: [],
    }
  ];

  const telemetry = calculateCascadeTelemetry(mockNaps, mockOlt);
  assert.strictEqual(telemetry.length, 2);

  // Hop 1 checks
  assert.strictEqual(telemetry[0].isFeeder, true);
  assert.strictEqual(telemetry[0].tapSubSplitEnabled, true);
  assert.strictEqual(telemetry[0].totalBranchCapacityPorts, 32);
  assert.ok(telemetry[0].throughOutputPowerDbm !== null);
  assert.strictEqual(telemetry[0].leftBranchRxDbm, telemetry[0].dropPortRxPowerDbm);

  // Hop 2 checks (arriving input power should be less than Hop 1 through output power due to cable loss)
  assert.strictEqual(telemetry[1].isFeeder, false);
  assert.strictEqual(telemetry[1].isTerminal, true);
  assert.ok(telemetry[1].arrivingInputPowerDbm < telemetry[0].throughOutputPowerDbm!);
});

test('calculateCascadeTelemetry handles dual 16-port NAPs (Left & Right) and 60% through trunk', () => {
  const mockOlt: OltPopNode = {
    id: 'olt-01',
    name: 'Main OLT',
    code: 'OLT-01',
    location: 'Central Office',
    barangay: 'Binauahan',
    latitude: 13.6838,
    longitude: 123.5175,
    totalPonPorts: 16,
    activePonPorts: 2,
    txPowerDbm: 4.0,
  };

  const mockNaps: NapBox[] = [
    {
      id: 'nap-1a',
      code: 'NAP-01A',
      name: 'Pole 1 Left',
      location: 'Pole 1',
      barangay: 'Binauahan',
      totalPorts: 16,
      fiberCoreColor: 'Blue',
      splitterType: '1:16 PLC',
      plcSplitterType: '1:16',
      feedSourceType: 'olt',
      fbtRatio: '60/40',
      tapSubSplitEnabled: true,
      branchDirection: 'left',
      pairedBranchNapId: 'nap-1b',
      latitude: 13.6850,
      longitude: 123.5190,
      oltId: 'olt-01',
      ponPortNumber: 1,
      ports: [],
    },
    {
      id: 'nap-1b',
      code: 'NAP-01B',
      name: 'Pole 1 Right',
      location: 'Pole 1',
      barangay: 'Binauahan',
      totalPorts: 16,
      fiberCoreColor: 'Orange',
      splitterType: '1:16 PLC',
      plcSplitterType: '1:16',
      feedSourceType: 'nap',
      upstreamNapId: 'nap-1a',
      feedLegType: 'tap_subsplit',
      fbtRatio: '60/40',
      tapSubSplitEnabled: true,
      branchDirection: 'right',
      pairedBranchNapId: 'nap-1a',
      latitude: 13.6851,
      longitude: 123.5191,
      oltId: 'olt-01',
      ponPortNumber: 1,
      ports: [],
    },
    {
      id: 'nap-2',
      code: 'NAP-02',
      name: 'Pole 2 Trunk Downstream',
      location: 'Pole 2',
      barangay: 'Binauahan',
      totalPorts: 16,
      fiberCoreColor: 'Blue',
      splitterType: '1:16 PLC',
      plcSplitterType: '1:16',
      feedSourceType: 'nap',
      upstreamNapId: 'nap-1a',
      feedLegType: 'trunk_through',
      fbtRatio: 'terminal',
      latitude: 13.6880,
      longitude: 123.5220,
      oltId: 'olt-01',
      ponPortNumber: 1,
      ports: [],
    },
  ];

  const sortedChain = buildPonCascadeChain(mockNaps, mockOlt);
  const telemetry = calculateCascadeTelemetry(sortedChain, mockOlt);

  const t1a = telemetry.find((t) => t.nap.id === 'nap-1a')!;
  const t1b = telemetry.find((t) => t.nap.id === 'nap-1b')!;
  const t2 = telemetry.find((t) => t.nap.id === 'nap-2')!;

  assert.ok(t1a, 'NAP-1A must exist');
  assert.ok(t1b, 'NAP-1B must exist');
  assert.ok(t2, 'NAP-2 must exist');

  // Both 1A and 1B are fed by the 40% tap sub-divided 50/50, so both should have close drop port Rx
  assert.strictEqual(t1a.fbtThroughLossDb, 2.5);
  assert.strictEqual(t1a.fbtTapLossDb, 4.3);
  assert.strictEqual(t1a.subSplitLossDb, 3.4);
  assert.strictEqual(t1a.totalBranchCapacityPorts, 32);

  // t2 is fed by the 60% through leg (+0.95 dBm minus cable loss to pole 2)
  assert.ok(t2.arrivingInputPowerDbm < t1a.throughOutputPowerDbm!);
  assert.ok(t2.arrivingInputPowerDbm > -2.0); // should still be strong around 0 to -1 dBm
});

