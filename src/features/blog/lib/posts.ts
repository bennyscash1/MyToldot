import { promises as fs } from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { z } from 'zod';

import type { Locale } from '@/i18n/routing';

const BLOG_ROOT = path.join(process.cwd(), 'content', 'blog');
const BLOG_LOCALES = ['en', 'he'] as const;

export type BlogLocale = (typeof BLOG_LOCALES)[number];
export type BlogCategory = 'guide' | 'story' | 'tech';
export type BlogCoverIllustration = 'sources' | 'digital-family' | 'gift';

const blogFrontmatterSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  author: z.string().min(1),
  category: z.enum(['guide', 'story', 'tech']),
  readingTime: z.string().min(1),
  coverImage: z.string().min(1).optional(),
});

type BlogFrontmatter = z.infer<typeof blogFrontmatterSchema>;

export interface BlogPostMeta extends BlogFrontmatter {
  slug: string;
  locale: BlogLocale;
}

export interface BlogPost extends BlogPostMeta {
  content: string;
}

export interface RecentBlogPost {
  slug: string;
  title: string;
  excerpt: string;
  tag: BlogCategory;
  publishedAt: string;
  readMinutes: string;
  coverImage?: string;
  coverIllustration: BlogCoverIllustration;
}

function isBlogLocale(locale: Locale | string): locale is BlogLocale {
  return BLOG_LOCALES.includes(locale as BlogLocale);
}

function getLocaleDir(locale: BlogLocale) {
  return path.join(BLOG_ROOT, locale);
}

function comparePostsDesc(a: BlogPostMeta, b: BlogPostMeta) {
  return a.date < b.date ? 1 : -1;
}

function getCoverIllustration(
  slug: string,
  category: BlogCategory,
  index: number,
): BlogCoverIllustration {
  if (slug.includes('gift') || slug.includes('gifts')) return 'gift';
  if (slug.includes('digital-family-tree')) return 'digital-family';
  if (slug.includes('ai') || slug.includes('deep-search')) return 'sources';

  const categoryDefault: Record<BlogCategory, BlogCoverIllustration> = {
    guide: 'digital-family',
    story: 'gift',
    tech: 'sources',
  };

  return categoryDefault[category] ?? (['sources', 'digital-family', 'gift'][index % 3] as BlogCoverIllustration);
}

async function readLocaleEntries(locale: BlogLocale) {
  try {
    return await fs.readdir(getLocaleDir(locale), { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

async function readPostFromFile(locale: BlogLocale, slug: string): Promise<BlogPost | null> {
  const filePath = path.join(getLocaleDir(locale), `${slug}.mdx`);

  try {
    const source = await fs.readFile(filePath, 'utf8');
    const { data, content } = matter(source);
    const frontmatter = blogFrontmatterSchema.parse(data);

    return {
      ...frontmatter,
      slug,
      locale,
      content,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

export async function getBlogPosts(locale: BlogLocale): Promise<BlogPostMeta[]> {
  const entries = await readLocaleEntries(locale);
  const mdxFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.mdx'));

  const posts: Array<BlogPostMeta | null> = await Promise.all(
    mdxFiles.map(async (entry) => {
      const slug = entry.name.replace(/\.mdx$/, '');
      const post = await readPostFromFile(locale, slug);

      if (!post) return null;

      return {
        title: post.title,
        description: post.description,
        date: post.date,
        author: post.author,
        category: post.category,
        readingTime: post.readingTime,
        coverImage: post.coverImage,
        slug: post.slug,
        locale: post.locale,
      };
    }),
  );

  return posts.filter((post): post is BlogPostMeta => post !== null).sort(comparePostsDesc);
}

export async function getBlogPost(locale: BlogLocale, slug: string): Promise<BlogPost | null> {
  return readPostFromFile(locale, slug);
}

export async function getAllBlogParams() {
  const allPosts = await Promise.all(BLOG_LOCALES.map((locale) => getBlogPosts(locale)));

  return allPosts.flatMap((posts) =>
    posts.map((post) => ({
      locale: post.locale,
      slug: post.slug,
    })),
  );
}

export function assertBlogLocale(locale: Locale): BlogLocale {
  if (!isBlogLocale(locale)) {
    throw new Error(`Unsupported blog locale: ${locale}`);
  }

  return locale;
}

export function formatBlogDate(date: string, locale: BlogLocale) {
  return new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : 'en-US', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00.000Z`));
}

export async function getRecentBlogPosts(
  locale: BlogLocale,
  limit = 3,
): Promise<RecentBlogPost[]> {
  const posts = await getBlogPosts(locale);

  return posts.slice(0, limit).map((post, index) => ({
    slug: post.slug,
    title: post.title,
    excerpt: post.description,
    tag: post.category,
    publishedAt: formatBlogDate(post.date, locale),
    readMinutes: post.readingTime,
    coverImage: post.coverImage,
    coverIllustration: getCoverIllustration(post.slug, post.category, index),
  }));
}
