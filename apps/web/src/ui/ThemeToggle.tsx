import { Button } from './Button';
import { useThemeStore } from './themeStore';

/** Switches dark/light; the label names the theme you'll get. */
export function ThemeToggle() {
  const mode = useThemeStore((s) => s.mode);
  const toggle = useThemeStore((s) => s.toggle);
  return <Button onClick={toggle}>{mode === 'dark' ? 'Light theme' : 'Dark theme'}</Button>;
}
