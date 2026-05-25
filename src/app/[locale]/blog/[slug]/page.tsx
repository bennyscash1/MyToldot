import Image from 'next/image';
import type { Metadata } from 'next';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { getMdxComponents } from '@/features/blog/components/MdxComponents';
import {
  assertBlogLocale,
  formatBlogDate,
  getAllBlogParams,
  getBlogPost,
} from '@/features/blog/lib/posts';
import { Link } from '@/i18n/routing';
import type { Locale } from '@/i18n/routing';
import { LOCALE_DIR } from '@/types';

interface BlogPostPageProps {
  params: Promise<{ locale: Locale; slug: string }>;
}

export async function generateStaticParams() {
  return getAllBlogParams();
}

export async function generateMetadata({
  params,
}: BlogPostPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const blogLocale = assertBlogLocale(locale);
  const post = await getBlogPost(blogLocale, slug);

  if (!post) {
    return {};
  }

  return {
    title: post.title,
    description: post.description,
    authors: [{ name: post.author }],
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { locale, slug } = await params;
  const blogLocale = assertBlogLocale(locale);
  const t = await getTranslations({ locale, namespace: 'blog' });
  const post = await getBlogPost(blogLocale, slug);

  if (!post) {
    notFound();
  }

  return (
    <article
      dir={LOCALE_DIR[locale]}
      className="min-h-screen bg-[#f4f3e9] px-4 py-8 sm:px-6 sm:py-10"
    >
      <div className="mx-auto max-w-4xl">
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 transition-colors hover:text-emerald-800"
        >
          <span aria-hidden="true">←</span>
          <span>{t('backToBlog')}</span>
        </Link>

        <header className="mt-6 rounded-[2rem] border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-10 sm:py-10">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
              {t(`categories.${post.category}`)}
            </span>
            <span className="text-slate-400">{formatBlogDate(post.date, blogLocale)}</span>
          </div>

          <h1 className="font-serif text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
            {post.title}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
            {post.description}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <span>{t('byAuthor', { author: post.author })}</span>
            <span aria-hidden="true">•</span>
            <span>{t('readingTime', { minutes: post.readingTime })}</span>
          </div>
        </header>

        {post.coverImage && (
          <div className="mt-6 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
            <Image
              src={post.coverImage}
              alt={post.title}
              width={1800}
              height={1012}
              className="h-auto w-full object-cover"
            />
          </div>
        )}

        <div className="mt-6 rounded-[2rem] border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-10 sm:py-10">
          <div className="mx-auto max-w-[720px]">
            <MDXRemote source={post.content} components={getMdxComponents()} />
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <Link
            href="/tree"
            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
          >
            {t('goToTree')}
          </Link>
        </div>
      </div>
    </article>
  );
}
