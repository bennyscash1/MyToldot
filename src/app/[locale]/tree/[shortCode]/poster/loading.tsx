import { getTranslations } from 'next-intl/server';

import styles from './poster.module.css';

export default async function PosterLoading() {
  const t = await getTranslations('treePdf');

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t('loading')}</h1>
      </header>
      <div className={styles.skeletonSingle}>
        <div className={styles.skeletonCard} />
      </div>
    </div>
  );
}
