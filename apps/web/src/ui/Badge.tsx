import type { HTMLAttributes } from 'react';
import styles from './Badge.module.css';

export type BadgeTone = 'neutral' | 'accent' | 'danger' | 'warning';

export function Badge({
  tone = 'neutral',
  className,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span className={[styles.badge, styles[tone], className].filter(Boolean).join(' ')} {...rest} />
  );
}
