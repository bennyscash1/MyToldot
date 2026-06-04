import { getTranslations } from 'next-intl/server';

import { Link, type Locale } from '@/i18n/routing';
import { getAuthUser } from '@/lib/api/auth';
import { HeroFamilyTree } from './HeroFamilyTree';

/** Public demo tree on production (משפחת בנאי). */
const DEMO_TREE_SHORT_CODE = '29838';

export async function LandingHero({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'landing.hero' });
  const user = await getAuthUser();
  const primaryCtaHref = user ? '/tree' : '/signup';
  const demoCtaHref = `/tree/${DEMO_TREE_SHORT_CODE}`;

  return (
    <section className="relative z-[2] mx-auto max-w-[1320px] px-4 pb-16 pt-16 sm:px-6 sm:pb-20 sm:pt-24 lg:px-8">
      <div className="pointer-events-none absolute start-0 top-0 -z-10 select-none font-display text-[clamp(8rem,18vw,16rem)] italic leading-none tracking-[-0.08em] text-cream-deep">
        {t('decorativeWord')}
      </div>

      <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_1fr] lg:gap-20">
        <div className="relative z-[1]">
          <div className="landing-fade-up inline-flex items-center gap-2 rounded-full border border-brand-green/20 bg-brand-green/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-brand-green-deep">
            <span className="landing-pulse-dot size-1.5 rounded-full bg-brand-green-bright" aria-hidden="true" />
            {t('eyebrow')}
          </div>

          <h1 className="landing-fade-up landing-delay-1 mt-7 font-serif text-[clamp(2.875rem,6vw,4.875rem)] font-extrabold leading-[1.02] tracking-[-0.04em] text-ink">
            {t.rich('title', {
              accent: (chunks) => <span className="landing-accent font-display font-medium italic text-brand-green-deep">{chunks}</span>,
              br: () => <br />,
            })}
          </h1>

          <p className="landing-fade-up landing-delay-2 mt-7 max-w-[35rem] text-lg leading-[1.65] text-ink-soft sm:text-xl">
            {t.rich('subtitle', {
              strong: (chunks) => <strong className="font-semibold text-ink">{chunks}</strong>,
            })}
          </p>

          <div className="landing-fade-up landing-delay-3 mt-9 flex flex-wrap items-center gap-3.5">
            <Link
              href={primaryCtaHref}
              className="inline-flex items-center gap-2 rounded-lg border border-brand-green bg-brand-green px-7 py-4 text-sm font-semibold text-cream shadow-[0_4px_14px_rgba(61,93,58,0.25)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-brand-green-deep hover:shadow-[0_8px_24px_rgba(61,93,58,0.32)]"
            >
              <span>{t('primaryCta')}</span>
              <svg className="rtl-flip size-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              href={demoCtaHref}
              className="inline-flex items-center rounded-lg border border-ink bg-transparent px-7 py-4 text-sm font-semibold text-ink transition-colors duration-200 hover:bg-ink hover:text-cream"
            >
              {t('secondaryCta')}
            </Link>
          </div>

          <div className="landing-fade-up landing-delay-4 mt-11 flex flex-wrap items-center gap-6 border-t border-paper-line pt-7">
            {(['metaOne', 'metaTwo', 'metaThree'] as const).map((key) => (
              <div key={key} className="flex items-center gap-2 text-sm text-ink-muted">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4 text-brand-green" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{t(key)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="landing-fade-up landing-delay-3 relative z-[1]">
          <HeroFamilyTree
            title={t('treeCard.title')}
            focalTag={t('treeCard.tag')}
            footer={t('treeCard.footer')}
            grandpaName={t('treeCard.people.grandpa.name')}
            grandpaYears={t('treeCard.people.grandpa.years')}
            grandmaName={t('treeCard.people.grandma.name')}
            grandmaYears={t('treeCard.people.grandma.years')}
            childOneName={t('treeCard.people.childOne.name')}
            childOneYears={t('treeCard.people.childOne.years')}
            focalName={t('treeCard.people.focal.name')}
            focalYears={t('treeCard.people.focal.years')}
            childThreeName={t('treeCard.people.childThree.name')}
            childThreeYears={t('treeCard.people.childThree.years')}
            grandchildOneName={t('treeCard.people.grandchildOne.name')}
            grandchildOneYears={t('treeCard.people.grandchildOne.years')}
            grandchildTwoName={t('treeCard.people.grandchildTwo.name')}
            grandchildTwoYears={t('treeCard.people.grandchildTwo.years')}
          />
        </div>
      </div>
    </section>
  );
}
