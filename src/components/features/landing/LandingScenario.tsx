import { getTranslations } from 'next-intl/server';

import type { Locale } from '@/i18n/routing';
import { LandingTvMockup } from './LandingTvMockup';

export async function LandingScenario({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'landing.scenario' });

  return (
    <section id="scenario" className="relative overflow-hidden bg-ink px-4 py-24 text-cream sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(77,117,73,.15),transparent_50%),radial-gradient(circle_at_80%_70%,rgba(176,132,54,.08),transparent_50%)]" />
      <div className="relative z-[1] mx-auto grid max-w-[1320px] items-center gap-14 lg:grid-cols-2 lg:gap-20">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-gold-soft">
            <span className="landing-pulse-dot size-1.5 rounded-full bg-gold-soft" aria-hidden="true" />
            {t('eyebrow')}
          </div>
          <h2 className="mt-6 font-serif text-[clamp(2.375rem,4vw,3.625rem)] font-extrabold leading-[1.05] tracking-[-0.03em] text-cream">
            {t.rich('title', {
              accent: (chunks) => <span className="font-display font-medium italic text-gold-soft">{chunks}</span>,
              br: () => <br />,
            })}
          </h2>
          <p className="mt-5 text-lg leading-[1.7] text-cream/80">
            {t('description')}
          </p>

          <ol className="mt-8">
            {(['stepOne', 'stepTwo', 'stepThree'] as const).map((stepKey, index) => (
              <li key={stepKey} className="flex items-start gap-4 border-t border-white/10 py-4 text-[0.95rem] leading-[1.65] text-cream/85 last:border-b">
                <span className="min-w-7 font-display text-2xl italic text-gold-soft">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span>
                  {t.rich(`${stepKey}.text`, {
                    strong: (chunks) => <strong className="font-semibold text-cream">{chunks}</strong>,
                  })}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <LandingTvMockup />
      </div>
    </section>
  );
}
