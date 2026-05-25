import { BlogGalleryClient, type BlogGalleryImage } from './BlogGalleryClient';

interface BlogGalleryProps {
  images?: BlogGalleryImage[] | string | Record<string, unknown>;
}

function isBlogGalleryImage(value: unknown): value is BlogGalleryImage {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { src?: unknown }).src === 'string' &&
    typeof (value as { alt?: unknown }).alt === 'string'
  );
}

function normalizeBlogGalleryImages(value: BlogGalleryProps['images']): BlogGalleryImage[] {
  if (Array.isArray(value)) {
    return value.filter(isBlogGalleryImage);
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return normalizeBlogGalleryImages(parsed as BlogGalleryProps['images']);
    } catch {
      return [];
    }
  }

  if (value && typeof value === 'object') {
    const values = Object.values(value);
    if (values.every(isBlogGalleryImage)) {
      return values;
    }
  }

  return [];
}

export function BlogGallery({ images }: BlogGalleryProps) {
  const safeImages = normalizeBlogGalleryImages(images);

  if (safeImages.length === 0) {
    return null;
  }

  return <BlogGalleryClient images={safeImages} />;
}
