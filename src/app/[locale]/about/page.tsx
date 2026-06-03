import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';

import type { LocalePageProps } from '@/types';
import { LOCALE_DIR } from '@/types';
import { ContactSection } from '@/features/contact/ContactSection';

function proseParagraphs(text: string, baseClass: string, firstMt = 'mt-4') {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((paragraph, index) => (
      <p key={index} className={`${baseClass} ${index === 0 ? firstMt : 'mt-4'}`}>
        {paragraph}
      </p>
    ));
}

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

  const bodyClass =
    'text-[1.0625rem] font-normal leading-[1.8] sm:text-lg';
  const exampleClass =
    'mt-3 text-[1.0625rem] italic leading-[1.8] text-[#3d3d5c] sm:text-lg';
  const quoteClass =
    'mt-4 border-s border-slate-300 ps-4 text-[1.0625rem] leading-[1.8] text-[#3d3d5c] sm:text-lg';

  const sections = [
    { title: t('section1Title'), body: t('section1Body') },
    { title: t('section2Title'), body: t('section2Body') },
    { title: t('section3Title'), body: t('section3Body') },
  ] as const;

  const magicFeatures = [
    {
      title: t('magicFeature1Title'),
      lead: t('magicFeature1Lead'),
      sample: t('magicFeature1Sample'),
      body: t('magicFeature1Body'),
      example: t('magicFeature1Example'),
    },
    {
      title: t('magicFeature2Title'),
      lead: null,
      sample: null,
      body: t('magicFeature2Body'),
      example: t('magicFeature2Example'),
    },
    {
      title: t('magicFeature3Title'),
      lead: null,
      sample: null,
      body: t('magicFeature3Body'),
      example: null,
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
              {proseParagraphs(body, bodyClass)}
            </section>
          ))}

          <section>
            <h2 className="text-[1.375rem] font-semibold leading-snug tracking-tight sm:text-2xl">
              {t('magicTitle')}
            </h2>

            <div className="mt-10 flex flex-col gap-10">
              {magicFeatures.map(
                ({ title, lead, sample, body, example }) => (
                  <div key={title}>
                    <h3 className="text-lg font-semibold leading-snug tracking-tight sm:text-xl">
                      {title}
                    </h3>
                    {lead && (
                      <p className={`mt-3 ${bodyClass}`}>{lead}</p>
                    )}
                    {sample && (
                      <p className={quoteClass}>&ldquo;{sample}&rdquo;</p>
                    )}
                    {proseParagraphs(body, bodyClass, 'mt-3')}
                    {example && (
                      <p className={exampleClass}>{example}</p>
                    )}
                  </div>
                ),
              )}
            </div>
          </section>

          <section>
            <h2 className="text-[1.375rem] font-semibold leading-snug tracking-tight sm:text-2xl">
              {t('section4Title')}
            </h2>
            {proseParagraphs(t('section4Body'), bodyClass)}
          </section>
        </div>

        <ContactSection align="start" className="mt-14 border-t border-slate-200 pt-8" />

        <div className="mt-8 flex flex-col gap-2 text-[1.0625rem] font-normal leading-[1.8] sm:text-lg">
          <a
            className="underline hover:no-underline"
            href={t('contactLinkedInUrl')}
            target="_blank"
            rel="noreferrer"
          >
            {t('contactLinkedInLabel')}
          </a>
          <a
            className="underline hover:no-underline"
            href={t('contactDevUrl')}
            target="_blank"
            rel="noreferrer"
          >
            {t('contactDevLabel')}
          </a>
        </div>
      </div>
    </article>
  );
}
