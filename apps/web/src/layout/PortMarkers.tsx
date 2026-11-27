import type { ThreeEvent } from '@react-three/fiber';
import type { PortRef } from '@factory-sim/schema';
import type { PortKind } from './portMarkers';

/** A port to draw: where it sits and the state that decides how it looks. */
export interface PortSpot {
  ref: PortRef;
  key: string;
  kind: PortKind;
  position: [number, number, number];
  active: boolean;
  valid: boolean;
  connected: boolean;
}

/** Every port marker of the floor as a few instanced meshes (pills and IN/OUT labels). */
export function PortMarkers(_props: {
  spots: readonly PortSpot[];
  pending: PortRef | null;
  onPort: (ref: PortRef, e: ThreeEvent<PointerEvent>) => void;
}) {
  return null;
}
