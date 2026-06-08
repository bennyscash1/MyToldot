import type { CSSProperties } from 'react';

import type { StyleToken } from '@/server/lib/pdf/types';

import styles from './print.module.css';

/** CSS-only minimalist frame — four variants keyed by variantIndex (1–4). */
export function CssDecorativeBorder({
  styleToken,
  variantIndex,
}: {
  styleToken: StyleToken;
  variantIndex: number;
}) {
  const frame = ((variantIndex - 1) % 4) + 1;
  const variantClass =
    frame === 2
      ? styles.frameHairline
      : frame === 3
        ? styles.frameBrackets
        : frame === 4
          ? styles.frameTint
          : styles.frameDouble;

  return (
    <div
      className={`${styles.cssBorder} ${variantClass}`}
      style={
        {
          '--poster-accent': styleToken.accentColor,
          '--poster-bg': styleToken.backgroundColor,
        } as CSSProperties
      }
      aria-hidden
    />
  );
}
