import type { CSSProperties } from 'react';

import type { StyleToken } from '@/server/lib/pdf/types';

import styles from './print.module.css';

/**
 * CSS-only ornamental fallback when Flash Image generation fails.
 * Three distinct patterns keyed by variantIndex (1–3).
 */
export function CssDecorativeBorder({
  styleToken,
  variantIndex,
}: {
  styleToken: StyleToken;
  variantIndex: number;
}) {
  const accent = styleToken.accentColor;
  const pattern = variantIndex === 2 ? 'medallion' : variantIndex === 3 ? 'organic' : 'classic';

  return (
    <div
      className={`${styles.cssBorder} ${styles[`cssBorder_${pattern}`]}`}
      style={
        {
          '--poster-accent': accent,
          '--poster-bg': styleToken.backgroundColor,
        } as CSSProperties
      }
      aria-hidden
    />
  );
}
