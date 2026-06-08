import type { CSSProperties } from 'react';

import type { StyleToken } from '@/server/lib/pdf/types';

import styles from './print.module.css';

/** CSS parchment gradient + stylised roots when scenic Flash Image is unavailable. */
export function HeritageScenicFallback({ styleToken }: { styleToken: StyleToken }) {
  const accent = styleToken.connectorColor ?? styleToken.accentColor;

  return (
    <div
      className={styles.scenicFallback}
      style={
        {
          '--poster-sky-top': '#f8f6ef',
          '--poster-sky-mid': styleToken.backgroundColor,
          '--poster-sky-bottom': '#e8e4d4',
          '--poster-accent': accent,
          '--poster-trunk': '#6b4c35',
        } as CSSProperties
      }
      aria-hidden
    >
      <div className={styles.scenicCornerLeft} />
      <div className={styles.scenicCornerRight} />
      <div className={styles.scenicRoots} />
    </div>
  );
}
