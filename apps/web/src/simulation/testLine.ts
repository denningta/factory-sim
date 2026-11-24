import { createProject, type Project } from '@factory-sim/schema';
import { createEditorStore } from '../layout/editorStore';
import { buildLineGeometry, type LineGeometry } from './partTracks';

/** A real source → station → sink line. */
export function realLine(): {
  project: Project;
  geometry: LineGeometry;
  colors: Map<string, string>;
} {
  const store = createEditorStore();
  const s = store.getState;
  const src = s().placeEquipment('base-source', { x: 0, y: 0 })!;
  const ws = s().placeEquipment('base-workstation', { x: 6, y: 0 })!;
  const sink = s().placeEquipment('base-sink', { x: 12, y: 0 })!;
  s().connect({ equipmentId: src.id, portId: 'out' }, { equipmentId: ws.id, portId: 'in' });
  s().connect({ equipmentId: ws.id, portId: 'out' }, { equipmentId: sink.id, portId: 'in' });
  const p = s().addProduct();
  s().addRoutingStep(p.id, ws.id);
  s().setCycleTime(p.id, ws.id, 5);
  s().setReleaseInterval(4);
  const tech = s().addTechnician();
  s().setTechnicianStation(tech.id, ws.id, true);
  const st = s();
  const project: Project = {
    ...createProject(),
    floor: st.floor,
    equipment: st.equipment,
    connections: st.connections,
    products: st.products,
    cycleTimes: st.cycleTimes,
    technicians: st.technicians,
    demand: st.demand,
    release: st.release,
  };
  return {
    project,
    geometry: buildLineGeometry(st.equipment, st.connections),
    colors: new Map(st.products.map((q) => [q.id, q.color])),
  };
}
