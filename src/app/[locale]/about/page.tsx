import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';

import type { LocalePageProps } from '@/types';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('aboutPage');
  return { title: t('title') };
}

export default async function AboutPage({ params }: LocalePageProps) {
  await params; // locale handled by layout
  const t = await getTranslations('aboutPage');

  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:py-24">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">
        {t('title')}
      </h1>
      <p className="mt-4 text-gray-500">{t('contentComingSoon')}</p>
    </section>
  );
}
