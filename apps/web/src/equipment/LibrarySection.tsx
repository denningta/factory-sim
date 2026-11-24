import type { EquipmentType } from '@factory-sim/schema';
import type { DisplayUnit } from '../layout/units';

/** The calls the library needs; the real `api` client satisfies it. */
export interface LibraryApi {
  listEquipmentTypes: () => Promise<EquipmentType[]>;
  createEquipmentType: (type: EquipmentType) => Promise<EquipmentType>;
  updateEquipmentType: (type: EquipmentType) => Promise<EquipmentType>;
  deleteEquipmentType: (id: string) => Promise<void>;
}

export function LibrarySection(_props: { api: LibraryApi; unit: DisplayUnit }): never {
  throw new Error('EQ-3: not implemented');
}
