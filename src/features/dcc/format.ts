/** Display helpers shared by the DCC components. */

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

export const formatBytes = (bytes: number | undefined): string => {
  if (bytes === undefined || bytes < 0 || !Number.isFinite(bytes)) {
    return '—';
  }
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${unit === 0 ? value : value.toFixed(1)} ${UNITS[unit]}`;
};

export const formatRate = (bytesPerSecond: number | undefined): string =>
  bytesPerSecond === undefined || bytesPerSecond <= 0 ? '—' : `${formatBytes(bytesPerSecond)}/s`;

/** 0-100, clamped. Returns null when there is no known total to divide by. */
export const transferPercent = (
  transferred: number | undefined,
  size: number | undefined,
): number | null => {
  if (transferred === undefined || size === undefined || size <= 0) {
    return null;
  }
  return Math.min(100, Math.max(0, Math.round((transferred / size) * 100)));
};

/** Group a SHA-256 hex fingerprint into colon-separated byte pairs. */
export const formatFingerprint = (fingerprint: string | undefined): string => {
  if (fingerprint === undefined || fingerprint.length === 0) {
    return '';
  }
  if (fingerprint.includes(':')) {
    return fingerprint.toUpperCase();
  }
  return (fingerprint.match(/.{1,2}/g) ?? []).join(':').toUpperCase();
};
