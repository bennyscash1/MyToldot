import Image from 'next/image';

import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import { formatBlogDate, type BlogLocale, type BlogPostMeta } from '@/features/blog/lib/posts';

interface PostCardProps {
  post: BlogPostMeta;
  locale: BlogLocale;
  categoryLabel: string;
  readMoreLabel: string;
  readingTimeLabel: string;
}

export function PostCard({
  post,
  locale,
  categoryLabel,
  readMoreLabel,
  readingTimeLabel,
}: PostCardProps) {
  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-transform hover:-translate-y-1 hover:shadow-md">
      {post.coverImage && (
        <div className="overflow-hidden border-b border-slate-200">
          <Image
            src={post.coverImage}
            alt={post.title}
            width={1600}
            height={900}
            className="aspect-[16/9] h-auto w-full object-cover"
          />
        </div>
      )}

      <div className="flex h-full flex-col p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
            {categoryLabel}
          </span>
          <span className="text-slate-400">{formatBlogDate(post.date, locale)}</span>
        </div>

        <h2 className="font-serif text-2xl font-semibold leading-snug text-slate-900">
          {post.title}
        </h2>
        <p className="mt-3 text-sm leading-7 text-slate-600">{post.description}</p>

        <div className="mt-5 flex items-center justify-between gap-4 text-sm text-slate-500">
          <span>{readingTimeLabel}</span>
          <Link
            href={`/blog/${post.slug}`}
            className={cn(
              'font-semibold text-emerald-700 transition-colors hover:text-emerald-800',
              locale === 'he' ? 'text-right' : 'text-left',
            )}
          >
            {readMoreLabel}
          </Link>
        </div>
      </div>
    </article>
  );
}
