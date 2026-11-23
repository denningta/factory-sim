import { createRoot } from 'react-dom/client';
import { createEditorStore } from './src/layout/editorStore';
import { ProductsPanel } from './src/products/ProductsPanel';
const store = createEditorStore();
const s = store.getState();
const mk = (x: number, name: string) => {
  const e = s.placeEquipment('base-workstation', { x, y: 2 })!;
  s.updateEquipment(e.id, { name });
  return e.id;
};
const [saw, cnc, , ] = [mk(2, 'Saw'), mk(5, 'CNC'), mk(8, 'Spare (unrouted)'), mk(11, 'Spare 2 (unrouted)')];
const p1 = s.addProduct();
s.addRoutingStep(p1.id, saw);
s.addRoutingStep(p1.id, cnc);
const t = s.addTechnician();
s.setTechnicianStation(t.id, saw, true);
createRoot(document.getElementById('root')!).render(<ProductsPanel useStore={store} />);
