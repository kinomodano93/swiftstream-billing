import assert from 'node:assert';
import test from 'node:test';
import {
  calculatePtpOpticalStatus,
  calculatePtpTheoreticalRx,
  formatPtpSpeed,
} from './ptpOptical.ts';

test('calculatePtpOpticalStatus evaluates nominal -3.0 dBm as optimal with full margin', () => {
  const result = calculatePtpOpticalStatus(-3.0, -3.0, 14.0, 1000);

  assert.strictEqual(result.status, 'optimal');
  assert.strictEqual(result.observedLossDb, 0);
  assert.strictEqual(result.remainingMarginDb, 14.0);
  assert.strictEqual(result.statusLabel, 'Optimal / Nominal');
});

test('calculatePtpOpticalStatus evaluates optimal range (-3.0 to -9.0 dBm)', () => {
  const result1 = calculatePtpOpticalStatus(-6.5, -3.0, 14.0, 2000);
  assert.strictEqual(result1.status, 'optimal');
  assert.strictEqual(result1.observedLossDb, 3.5);
  assert.strictEqual(result1.remainingMarginDb, 10.5);

  const result2 = calculatePtpOpticalStatus(-8.5, -3.0, 14.0, 2000);
  assert.strictEqual(result2.status, 'optimal');
  assert.strictEqual(result2.observedLossDb, 5.5);
  assert.strictEqual(result2.remainingMarginDb, 8.5);
});

test('calculatePtpOpticalStatus evaluates good signal range (-9.1 to -12.0 dBm)', () => {
  const result = calculatePtpOpticalStatus(-10.5, -3.0, 14.0, 3000);

  assert.strictEqual(result.status, 'good');
  assert.strictEqual(result.observedLossDb, 7.5);
  assert.strictEqual(result.remainingMarginDb, 6.5);
  assert.strictEqual(result.statusLabel, 'Good Signal');
});

test('calculatePtpOpticalStatus evaluates marginal range (-12.1 to -14.0 dBm)', () => {
  const result = calculatePtpOpticalStatus(-13.4, -3.0, 14.0, 5000);

  assert.strictEqual(result.status, 'marginal');
  assert.strictEqual(result.observedLossDb, 10.4);
  assert.strictEqual(result.remainingMarginDb, 3.6);
  assert.strictEqual(result.statusLabel, 'Marginal / High Attenuation');
});

test('calculatePtpOpticalStatus evaluates critical when exceeding max 14 dB loss budget', () => {
  // -14.5 dBm when nominal is -3.0 means loss is 11.5 dB, but receiver floor is -14.0 dBm
  const result = calculatePtpOpticalStatus(-14.5, -3.0, 14.0, 6000);

  assert.strictEqual(result.status, 'critical');
  assert.strictEqual(result.statusLabel, 'Critical High Loss (> 14 dB)');
});

test('calculatePtpOpticalStatus flags receiver overload when power is too high (> 0.5 dBm)', () => {
  const result = calculatePtpOpticalStatus(1.2, -3.0, 14.0, 100);

  assert.strictEqual(result.status, 'critical');
  assert.strictEqual(result.statusLabel, 'Receiver Overload');
});

test('calculatePtpOpticalStatus detects optical loss of signal (LOS / link down)', () => {
  const resultLos = calculatePtpOpticalStatus(-45.0, -3.0, 14.0, 1000);

  assert.strictEqual(resultLos.status, 'link_down');
  assert.strictEqual(resultLos.statusLabel, 'Optical Loss of Signal (LOS)');
});

test('calculatePtpTheoreticalRx computes expected loss over distance', () => {
  // 10 km @ 0.35 dB/km + 0.4 dB connector = 3.5 + 0.4 = 3.9 dB loss
  // Nominal Tx = -3.0 dBm -> Theoretical Rx = -3.0 - 3.9 = -6.9 dBm
  const theoreticalRx = calculatePtpTheoreticalRx(10000, -3.0, 0.35, 0.4);

  assert.strictEqual(theoreticalRx, -6.9);
});

test('formatPtpSpeed formats speeds and link type identifiers accurately', () => {
  assert.strictEqual(formatPtpSpeed(10), '10G SFP+');
  assert.strictEqual(formatPtpSpeed(1), '1G SFP');
  assert.strictEqual(formatPtpSpeed(25), '25G SFP28');
  assert.strictEqual(formatPtpSpeed(100), '100G QSFP28');
  assert.strictEqual(formatPtpSpeed('10g_sfp_plus'), '10G SFP+');
  assert.strictEqual(formatPtpSpeed('1g_sfp'), '1G SFP');
  assert.strictEqual(formatPtpSpeed('25g_sfp28'), '25G SFP28');
});

