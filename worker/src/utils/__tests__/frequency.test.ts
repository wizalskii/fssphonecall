import { describe, it, expect } from 'vitest';
import { isValidFrequency, normalizeFrequency } from '@fssphone/shared';

describe('isValidFrequency', () => {
  // Valid 25 kHz channels
  it.each([
    '118.000', '118.025', '118.050', '118.075',
    '122.200', '122.800', '121.500', '136.975',
    '119.100', '128.250', '133.300',
  ])('accepts valid 25 kHz channel %s', (freq) => {
    expect(isValidFrequency(freq)).toBe(true);
  });

  // Valid 8.33 kHz channels
  it.each([
    '118.005', '118.010', '118.015',
    '118.030', '118.035', '118.040',
    '118.055', '118.060', '118.065',
    '118.080', '118.085', '118.090',
    '129.305', '133.710',
  ])('accepts valid 8.33 kHz channel %s', (freq) => {
    expect(isValidFrequency(freq)).toBe(true);
  });

  // Short formats
  it.each([
    '122.2',   // interpreted as 122.200
    '122.20',  // interpreted as 122.200
    '118.0',   // interpreted as 118.000
  ])('accepts short format %s', (freq) => {
    expect(isValidFrequency(freq)).toBe(true);
  });

  // Invalid frequencies
  it.each([
    '117.000',  // below range
    '137.000',  // above range
    '136.980',  // above 136.975 (invalid ending)
    '122.201',  // invalid 8.33 kHz ending
    '122.003',  // invalid ending
    '122.046',  // invalid ending
    '122.099',  // invalid ending
    'abc',      // not a number
    '122',      // no decimal
    '',         // empty
    '122.2000', // too many decimals
  ])('rejects invalid frequency %s', (freq) => {
    expect(isValidFrequency(freq)).toBe(false);
  });
});

describe('normalizeFrequency', () => {
  it('pads to 3 decimal places', () => {
    expect(normalizeFrequency('122.2')).toBe('122.200');
    expect(normalizeFrequency('122.20')).toBe('122.200');
    expect(normalizeFrequency('122.200')).toBe('122.200');
  });

  it('returns input unchanged if invalid format', () => {
    expect(normalizeFrequency('abc')).toBe('abc');
  });
});
