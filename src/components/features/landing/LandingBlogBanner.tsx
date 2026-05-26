import Image from 'next/image';
import { getTranslations } from 'next-intl/server';

import { Link, type Locale } from '@/i18n/routing';
import type { RecentBlogPost } from '@/features/blog/lib/posts';
import { LandingBlogIllustration } from './LandingBlogIllustrations';

interface LandingBlogBannerProps {
  locale: Locale;
  posts: RecentBlogPost[];
}

export async function LandingBlogBanner({ locale, posts }: LandingBlogBannerProps) {
  const t = await getTranslations({ locale, namespace: 'landing.blogBanner' });

  if (posts.length === 0) {
    return null;
  }

  return (
    <section id="blog" className="relative z-[2] border-y border-paper-line bg-[linear-gradient(180deg,#f4f3e9_0%,#f8f6ec_100%)] px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
      <div className="mx-auto max-w-[1320px]">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-8">
          <div className="max-w-[38rem]">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-green/20 bg-brand-green/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-brand-green-deep">
              <span className="landing-pulse-dot size-1.5 rounded-full bg-brand-green-bright" aria-hidden="true" />
              {t('eyebrow')}
            </div>
            <h2 className="mt-5 font-serif text-[clamp(2.25rem,4vw,3.25rem)] font-extrabold leading-[1.05] tracking-[-0.03em] text-ink">
              {t.rich('title', {
                accent: (chunks) => <span className="font-display font-medium italic text-brand-green-deep">{chunks}</span>,
              })}
            </h2>
            <p className="mt-4 text-lg leading-[1.6] text-ink-soft">
              {t('subtitle')}
            </p>
          </div>

          <Link
            href="/blog"
            className="inline-flex items-center gap-2 border-b-[1.5px] border-brand-green-deep py-2 text-sm font-semibold text-brand-green-deep transition-all duration-200 hover:gap-3 hover:text-brand-green"
          >
            <span>{t('allPosts')}</span>
            <svg className="rtl-flip size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        <div className="grid gap-7 lg:grid-cols-3">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group flex flex-col overflow-hidden rounded-xl border border-paper-line bg-paper shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lift"
            >
              {post.coverImage ? (
                <div className="relative aspect-[16/10] overflow-hidden bg-cream-deep">
                  <Image
                    src={post.coverImage}
                    alt={post.title}
                    fill
                    sizes="(max-width: 1024px) 100vw, 33vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
              ) : (
                <LandingBlogIllustration
                  illustration={post.coverIllustration}
                  overlayText={t(`illustrations.${post.coverIllustration}`)}
                />
              )}

              <div className="flex flex-1 flex-col p-6">
                <div className="mb-3 flex items-center gap-2.5 text-xs text-ink-muted">
                  <span className="rounded-full bg-brand-green/10 px-2.5 py-1 text-[11px] font-semibold tracking-[0.04em] text-brand-green-deep">
                    {t(`tags.${post.tag}`)}
                  </span>
                  <span>{post.publishedAt}</span>
                </div>

                <h3 className="font-serif text-[1.3125rem] font-bold leading-[1.3] tracking-[-0.02em] text-ink">
                  {post.title}
                </h3>
                <p className="mt-3 flex-1 text-[0.95rem] leading-[1.6] text-ink-soft">
                  {post.excerpt}
                </p>

                <div className="mt-5 flex items-center justify-between border-t border-paper-line pt-4">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-green-deep">
                    {t('readPost')}
                    <svg className="rtl-flip size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </span>
                  <span className="text-xs text-ink-muted">
                    {t('readTime', { minutes: post.readMinutes })}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
