import { getTranslations } from 'next-intl/server';

import { Link, type Locale } from '@/i18n/routing';
import { BrandMark } from '@/components/brand/BrandMark';

export async function LandingFooter({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'landing.footer' });

  return (
    <footer className="relative z-[2] bg-ink px-4 pb-8 pt-16 text-cream/70 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-[1320px] gap-12 border-b border-white/10 pb-12 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <Link href="/" className="inline-flex items-center gap-3">
            <BrandMark className="size-9 text-cream" monochrome />
            <div className="text-start">
              <div lang="en" className="font-serif text-xl font-extrabold tracking-[-0.03em] text-cream">TOLDOTAY</div>
              <div className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.3em] text-cream/50">
                {t('tagline')}
              </div>
            </div>
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-6 text-cream/60">
            {t('description')}
          </p>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-cream">
            {t('product.title')}
          </h4>
          <ul className="mt-5 space-y-2.5 text-sm">
            <li><Link href="/" className="transition-colors hover:text-gold-soft">{t('product.home')}</Link></li>
            <li><Link href="/blog" className="transition-colors hover:text-gold-soft">{t('product.blog')}</Link></li>
            <li><Link href="/about" className="transition-colors hover:text-gold-soft">{t('product.about')}</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-cream">
            {t('features.title')}
          </h4>
          <ul className="mt-5 space-y-2.5 text-sm">
            <li><Link href="/tree/29838" className="transition-colors hover:text-gold-soft">{t('features.demoTree')}</Link></li>
            <li><a href="#features" className="transition-colors hover:text-gold-soft">{t('features.aiBiographies')}</a></li>
            <li><a href="#scenario" className="transition-colors hover:text-gold-soft">{t('features.livingRoom')}</a></li>
          </ul>
        </div>

        <div>
          <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-cream">
            {t('account.title')}
          </h4>
          <ul className="mt-5 space-y-2.5 text-sm">
            <li><Link href="/login" className="transition-colors hover:text-gold-soft">{t('account.login')}</Link></li>
            <li><Link href="/signup" className="transition-colors hover:text-gold-soft">{t('account.signup')}</Link></li>
            <li><Link href="/tree" className="transition-colors hover:text-gold-soft">{t('account.myTrees')}</Link></li>
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-8 flex max-w-[1320px] flex-col gap-2 text-sm text-cream/40 sm:flex-row sm:items-center sm:justify-between">
        <div>{t('copyright', { year: new Date().getFullYear() })}</div>
        <div>{t('domain')}</div>
      </div>
    </footer>
  );
}
