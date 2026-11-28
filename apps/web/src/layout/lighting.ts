export type ShadowFit = {
  position: [number, number, number];
  target: [number, number, number];
  half: number;
  near: number;
  far: number;
};

/** Stub: filled in by the implementation. */
export function shadowFit(_floor: { width: number; length: number }): ShadowFit {
  throw new Error('not implemented');
}
