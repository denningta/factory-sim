import { Legend as KeyList } from '../ui';
import { useTheme } from '../ui/themeStore';
import type { StateName } from '../ui/tokens';
import { stateLabel } from './stationStatus';
import styles from './Legend.module.css';

const STATES: { name: StateName; label: string }[] = [
  { name: 'working', label: stateLabel('working') },
  { name: 'starved', label: stateLabel('starved') },
  { name: 'blocked', label: stateLabel('blocked') },
  { name: 'waiting', label: stateLabel('idle') },
  { name: 'walking', label: 'Tech walking' },
];

/** Corner key for the 3D view: state colours (strong, as on the lights) and product colours. */
export function Legend({
  products,
}: {
  products: readonly { id: string; name: string; color: string }[];
}) {
  const theme = useTheme();
  const items = [
    ...STATES.map((s) => ({ key: s.name, label: s.label, color: theme.state[s.name].strong })),
    ...products.map((p) => ({ key: p.id, label: p.name, color: p.color })),
  ];
  return (
    <div className={styles.corner}>
      <KeyList label="Legend" items={items} />
    </div>
  );
}
