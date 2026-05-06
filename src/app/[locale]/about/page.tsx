import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';

import type { LocalePageProps } from '@/types';
import { LOCALE_DIR } from '@/types';

export async function generateMetadata({
  params,
}: LocalePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'siteAbout' });
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  };
}

export default async function AboutPage({ params }: LocalePageProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'siteAbout' });
  const dir = LOCALE_DIR[locale];

  const sections = [
    {
      title: t('section1Title'),
      body: t('section1Body'),
    },
    {
      title: t('section2Title'),
      body: t('section2Body'),
    },
    {
      title: t('section3Title'),
      body: t('section3Body'),
    },
    {
      title: t('section4Title'),
      body: t('section4Body'),
    },
  ] as const;

  return (
    <article
      dir={dir}
      className="min-h-0 flex-1 bg-[#faf9f6] text-[#1a1a2e]"
    >
      <div className="mx-auto max-w-[780px] px-10 pb-20 pt-[60px]">
        <h1 className="text-[2.25rem] font-bold leading-[1.2] tracking-tight sm:text-[2.625rem]">
          {t('heroTitle')}
        </h1>

        <div className="mt-12 flex flex-col gap-12 sm:mt-14">
          {sections.map(({ title, body }, index) => (
            <section key={index}>
              <h2 className="text-[1.375rem] font-semibold leading-snug tracking-tight sm:text-2xl">
                {title}
              </h2>
              <p className="mt-4 text-[1.0625rem] font-normal leading-[1.8] sm:text-lg">
                {body}
              </p>
            </section>
          ))}
        </div>
      </div>
    </article>
  );
}
