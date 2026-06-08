import type { PersonRow } from '@/features/family-tree/lib/types';
import type { PosterTreeLayoutData } from '@/server/lib/pdf/poster-layout';
import type { StyleToken } from '@/server/lib/pdf/types';

import { CssDecorativeBorder } from './CssDecorativeBorder';
import { HeritageScenicFallback } from './HeritageScenicFallback';
import { PosterTreeLayout } from './PosterTreeLayout';
import styles from './print.module.css';

export interface PosterDocumentProps {
  dir: 'rtl' | 'ltr';
  styleToken: StyleToken;
  borderUrl: string | null;
  usedCssFallback: boolean;
  variantIndex: number;
  treeName: string;
  introParagraphs: string[];
  treeLayout: PosterTreeLayoutData | null;
  personById: Map<string, PersonRow>;
}

/** Single source of truth for poster layout — shared by /print and Puppeteer capture. */
export function PosterDocument({
  dir,
  styleToken,
  borderUrl,
  usedCssFallback,
  variantIndex,
  treeName,
  introParagraphs,
  treeLayout,
  personById,
}: PosterDocumentProps) {
  const isScenic = styleToken.backgroundMode === 'scenic';

  return (
    <div
      id="pdf-root"
      dir={dir}
      className={isScenic ? `${styles.page} ${styles.pageScenic}` : styles.page}
      style={{ backgroundColor: styleToken.backgroundColor }}
    >
      {isScenic ? (
        borderUrl && !usedCssFallback ? (
          <div className={styles.scenicBg} style={{ backgroundImage: `url("${borderUrl}")` }} />
        ) : (
          <HeritageScenicFallback styleToken={styleToken} />
        )
      ) : borderUrl && !usedCssFallback ? (
        <div className={styles.frame} style={{ backgroundImage: `url("${borderUrl}")` }} />
      ) : (
        <CssDecorativeBorder styleToken={styleToken} variantIndex={variantIndex} />
      )}

      <div className={styles.content}>
        {treeLayout ? (
          <PosterTreeLayout
            treeName={treeName}
            introParagraphs={introParagraphs}
            styleToken={styleToken}
            treeLayout={treeLayout}
            personById={personById}
          />
        ) : null}
      </div>
    </div>
  );
}
