import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

import { PostCard } from '@/features/blog/components/PostCard';
import { assertBlogLocale, getBlogPosts } from '@/features/blog/lib/posts';
import type { LocalePageProps } from '@/types';
import { LOCALE_DIR } from '@/types';

export async function generateMetadata({
  params,
}: LocalePageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'blog' });

  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function BlogIndexPage({ params }: LocalePageProps) {
  const { locale } = await params;
  const blogLocale = assertBlogLocale(locale);
  const t = await getTranslations({ locale, namespace: 'blog' });
  const posts = await getBlogPosts(blogLocale);

  return (
    <section
      dir={LOCALE_DIR[locale]}
      className="min-h-screen bg-[#f4f3e9] px-4 py-10 sm:px-6 sm:py-12 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <header className="max-w-2xl">
          <h1 className="font-serif text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            {t('title')}
          </h1>
          <p className="mt-4 text-base leading-8 text-slate-600 sm:text-lg">
            {t('description')}
          </p>
        </header>

        {posts.length === 0 ? (
          <div className="mt-12 rounded-3xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
            <p className="font-serif text-2xl font-semibold text-slate-900">
              {t('noPostsYet')}
            </p>
          </div>
        ) : (
          <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {posts.map((post) => (
              <PostCard
                key={post.slug}
                post={post}
                locale={blogLocale}
                categoryLabel={t(`categories.${post.category}`)}
                readMoreLabel={t('readMore')}
                readingTimeLabel={t('readingTime', { minutes: post.readingTime })}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
