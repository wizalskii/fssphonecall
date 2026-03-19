/**
 * Validate a VHF airband frequency string.
 * Supports both 25 kHz and 8.33 kHz channel spacing.
 *
 * Valid range: 118.000 - 136.975 MHz
 *
 * 25 kHz: third decimal is 0, 2, 5, or 7 (e.g. 122.200, 118.025, 136.975)
 * 8.33 kHz: third decimal is 0, 1, 2, 3, 4, 5, 6, 7, 8
 *           with valid endings: x05, x10, x15, x30, x35, x40, x55, x60, x65, x80, x85, x90
 *           plus the 25 kHz ones: x00, x25, x50, x75
 *
 * Accepts formats: "122.200", "122.2", "122.20"
 */
export function isValidFrequency(freq: string): boolean {
  // Normalize: strip whitespace
  freq = freq.trim();

  // Must match pattern like 118.000 - 136.975
  const match = freq.match(/^(\d{3})\.(\d{1,3})$/);
  if (!match) return false;

  const mhz = parseInt(match[1], 10);
  const khzStr = match[2].padEnd(3, '0');
  const khz = parseInt(khzStr, 10);

  // Range check: 118.000 - 136.975
  if (mhz < 118 || mhz > 136) return false;
  if (mhz === 136 && khz > 975) return false;

  // Valid 8.33 kHz channel endings (last two digits of the kHz portion)
  // Every 25 kHz channel: x00, x25, x50, x75
  // 8.33 kHz channels between them: x05, x10, x15, x30, x35, x40, x55, x60, x65, x80, x85, x90
  const validEndings = [
    0, 5, 10, 15, 25, 30, 35, 40, 50, 55, 60, 65, 75, 80, 85, 90,
  ];

  const lastTwo = khz % 100;
  return validEndings.includes(lastTwo);
}

/**
 * Normalize a frequency to standard display format (e.g. "122.200")
 */
export function normalizeFrequency(freq: string): string {
  const match = freq.trim().match(/^(\d{3})\.(\d{1,3})$/);
  if (!match) return freq;
  return `${match[1]}.${match[2].padEnd(3, '0')}`;
}
