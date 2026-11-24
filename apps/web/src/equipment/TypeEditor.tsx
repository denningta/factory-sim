import type { EquipmentType } from '@factory-sim/schema';
import type { DisplayUnit } from '../layout/units';

interface Props {
  unit: DisplayUnit;
  initial?: EquipmentType;
  onSave: (type: EquipmentType) => void;
  onCancel: () => void;
}

export function TypeEditor(_props: Props): never {
  throw new Error('EQ-3: not implemented');
}
