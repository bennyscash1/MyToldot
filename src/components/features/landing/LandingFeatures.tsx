import { getTranslations } from 'next-intl/server';

import type { Locale } from '@/i18n/routing';

export async function LandingFeatures({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'landing.features' });

  return (
    <section id="features" className="relative z-[2] mx-auto max-w-[1320px] px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto mb-16 max-w-[45rem] text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-brand-green/20 bg-brand-green/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-brand-green-deep">
          <span className="landing-pulse-dot size-1.5 rounded-full bg-brand-green-bright" aria-hidden="true" />
          {t('eyebrow')}
        </div>
        <h2 className="mt-5 font-serif text-[clamp(2.25rem,4vw,3.25rem)] font-extrabold leading-[1.05] tracking-[-0.03em] text-ink">
          {t.rich('title', {
            accent: (chunks) => <span className="font-display font-medium italic text-brand-green-deep">{chunks}</span>,
          })}
        </h2>
        <p className="mt-5 text-lg leading-[1.6] text-ink-soft">
          {t('subtitle')}
        </p>
      </div>

      <div className="grid gap-7 lg:grid-cols-3">
        {(['bilingual', 'ai', 'family'] as const).map((featureKey) => (
          <article
            key={featureKey}
            className="group relative overflow-hidden rounded-xl border border-paper-line bg-paper px-8 py-9 transition-all duration-300 hover:-translate-y-1 hover:border-brand-green/20 hover:shadow-card"
          >
            <div className="pointer-events-none absolute end-0 top-0 size-20 bg-[radial-gradient(circle_at_top_right,rgba(61,93,58,.05),transparent_70%)]" />
            <div className="mb-6 flex size-12 items-center justify-center rounded-[10px] bg-brand-green text-cream">
              {featureKey === 'bilingual' && (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M12 2v20M5 9l7-7 7 7M5 15l7 7 7-7" />
                </svg>
              )}
              {featureKey === 'ai' && (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 2L9.5 7.5 4 8l4 4-1 6 5-3 5 3-1-6 4-4-5.5-.5z" />
                </svg>
              )}
              {featureKey === 'family' && (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="9" cy="7" r="4" />
                  <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0-3-3.87" />
                </svg>
              )}
            </div>
            <h3 className="font-serif text-[1.375rem] font-bold tracking-[-0.02em] text-ink">
              {t(`${featureKey}.title`)}
            </h3>
            <p className="mt-3 text-[0.95rem] leading-[1.65] text-ink-soft">
              {t(`${featureKey}.description`)}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
