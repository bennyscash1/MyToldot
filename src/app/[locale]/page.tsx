import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import type { LocalePageProps } from '@/types';
import { assertBlogLocale, getRecentBlogPosts } from '@/features/blog/lib/posts';
import { LandingBlogBanner } from '@/components/features/landing/LandingBlogBanner';
import { LandingFeatures } from '@/components/features/landing/LandingFeatures';
import { LandingFinalCta } from '@/components/features/landing/LandingFinalCta';
import { LandingFooter } from '@/components/features/landing/LandingFooter';
import { ContactSection } from '@/features/contact/ContactSection';
import { LandingHero } from '@/components/features/landing/LandingHero';
import { LandingScenario } from '@/components/features/landing/LandingScenario';
import { LandingStats } from '@/components/features/landing/LandingStats';

export async function generateMetadata({ params }: LocalePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'landing.meta' });

  return {
    title: { absolute: t('title') },
    description: t('description'),
  };
}

export default async function HomePage({ params }: LocalePageProps) {
  const { locale } = await params;

  // The landing page renders for everyone — guests and authenticated users
  // alike (so signed-in users can read it, share the link, reach the blog…).
  // The navbar adapts to auth state inside the shared <Navbar /> component.
  const posts = await getRecentBlogPosts(assertBlogLocale(locale));
  const tStats = await getTranslations({ locale, namespace: 'landing.stats' });

  return (
    <div className="landing-page relative isolate overflow-x-hidden bg-cream text-ink">
      <LandingHero locale={locale} />
      <LandingBlogBanner locale={locale} posts={posts} />
      <LandingFeatures locale={locale} />
      <LandingScenario locale={locale} />
      <LandingStats
        rotatingDisplayLabel={tStats('rotatingDisplay')}
        registeredFamiliesLabel={tStats('registeredFamilies')}
        privacyLabel={tStats('privacy')}
        aiLabel={tStats('aiResearch')}
      />
      <LandingFinalCta locale={locale} />
      <section className="relative z-[2] bg-cream px-4 py-10 sm:px-6 lg:px-8">
        <ContactSection />
      </section>
      <LandingFooter locale={locale} />
    </div>
  );
}
