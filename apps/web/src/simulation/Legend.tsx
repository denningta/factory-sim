import { stateLabel } from './stationStatus';
import { useTheme } from '../ui/themeStore';
import type { StateName } from '../ui/tokens';

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
  const swatch = (color: string, round: boolean) => (
    <span
      aria-hidden
      style={{
        width: 10,
        height: 10,
        borderRadius: round ? '50%' : 2,
        background: color,
        flex: 'none',
      }}
    />
  );
  const item = { display: 'flex', alignItems: 'center', gap: theme.space[2] } as const;
  return (
    <ul
      aria-label="Legend"
      style={{
        position: 'absolute',
        left: theme.space[3],
        bottom: theme.space[3],
        margin: 0,
        padding: `${theme.space[2]}px ${theme.space[3]}px`,
        listStyle: 'none',
        display: 'grid',
        gap: theme.space[1],
        background: theme.color.surface,
        border: `1px solid ${theme.color.panelBorder}`,
        borderRadius: theme.radius.md,
        color: theme.color.text,
        font: `${theme.font.size.sm}px ${theme.font.family}`,
        pointerEvents: 'none',
      }}
    >
      {STATES.map((s) => (
        <li key={s.name} style={item}>
          {swatch(theme.state[s.name].strong, true)}
          {s.label}
        </li>
      ))}
      {products.map((p) => (
        <li key={p.id} style={item}>
          {swatch(p.color, false)}
          {p.name}
        </li>
      ))}
    </ul>
  );
}
