import { getTranslations } from 'next-intl/server';

import { Link, type Locale } from '@/i18n/routing';
import { BrandMark } from '@/components/brand/BrandMark';

export async function LandingFinalCta({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'landing.finalCta' });

  return (
    <section className="relative z-[2] bg-[linear-gradient(180deg,#f4f3e9_0%,#f8f6ec_100%)] px-4 py-24 text-center sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="relative mx-auto mb-6 size-16 opacity-50">
          <BrandMark className="size-16" />
        </div>
        <h2 className="font-serif text-[clamp(2.5rem,5vw,4rem)] font-extrabold leading-[1.05] tracking-[-0.04em] text-ink">
          {t.rich('title', {
            accent: (chunks) => <span className="font-display font-medium italic text-brand-green-deep">{chunks}</span>,
            br: () => <br />,
          })}
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-[1.6] text-ink-soft sm:text-[1.1875rem]">
          {t('subtitle')}
        </p>
        <div className="mt-10">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-lg border border-brand-green bg-brand-green px-7 py-4 text-sm font-semibold text-cream shadow-[0_4px_14px_rgba(61,93,58,0.25)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-green-deep hover:shadow-[0_8px_24px_rgba(61,93,58,0.32)]"
          >
            <span>{t('cta')}</span>
            <svg className="rtl-flip size-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
