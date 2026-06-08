import type { PersonRow } from '@/features/family-tree/lib/types';
import type { PosterTreeLayoutData } from '@/server/lib/pdf/poster-layout';
import type { StyleToken } from '@/server/lib/pdf/types';

import { CssDecorativeBorder } from './CssDecorativeBorder';
import { PosterTreeLayout } from './PosterTreeLayout';
import styles from './print.module.css';

export interface PosterDocumentProps {
  dir: 'rtl' | 'ltr';
  styleToken: StyleToken;
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
  variantIndex,
  treeName,
  introParagraphs,
  treeLayout,
  personById,
}: PosterDocumentProps) {
  return (
    <div
      id="pdf-root"
      dir={dir}
      className={styles.page}
      style={{ backgroundColor: styleToken.backgroundColor }}
    >
      <CssDecorativeBorder styleToken={styleToken} variantIndex={variantIndex} />

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
