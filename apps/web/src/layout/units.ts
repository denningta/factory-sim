/** Display units are UI-only; stored geometry is always meters (ADR-0006). */
export type DisplayUnit = 'm' | 'ft';

/** Exact by definition (international foot). The only place this factor lives. */
export const METERS_PER_FOOT = 0.3048;

export function toDisplay(meters: number, unit: DisplayUnit): number {
  return unit === 'ft' ? meters / METERS_PER_FOOT : meters;
}

export function fromDisplay(value: number, unit: DisplayUnit): number {
  return unit === 'ft' ? value * METERS_PER_FOOT : value;
}

/** Rounded for display only; `Number()` drops trailing zeros. */
export function formatNumber(value: number, decimals = 2): string {
  return String(Number(value.toFixed(decimals)));
}

export function formatLength(meters: number, unit: DisplayUnit): string {
  return `${formatNumber(toDisplay(meters, unit))} ${unit}`;
}

/** Conveyor speed is stored in m/s; ft mode shows ft/min (display only). */
export function speedToDisplay(mps: number, unit: DisplayUnit): number {
  return unit === 'ft' ? toDisplay(mps, unit) * 60 : mps;
}

export function speedFromDisplay(value: number, unit: DisplayUnit): number {
  return unit === 'ft' ? fromDisplay(value, unit) / 60 : value;
}
