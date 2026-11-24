import { createProject, type Project } from '@factory-sim/schema';
import { useEditorStore } from '../layout/editorStore';

/** The project the editor currently holds, as the engine sees it. */
export function currentProject(): Project {
  const s = useEditorStore.getState();
  return {
    ...createProject(),
    floor: s.floor,
    equipment: s.equipment,
    connections: s.connections,
    products: s.products,
    cycleTimes: s.cycleTimes,
    technicians: s.technicians,
    demand: s.demand,
    release: s.release,
  };
}
