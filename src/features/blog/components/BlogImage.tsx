import Image from 'next/image';

import { cn } from '@/lib/utils';

interface BlogImageProps {
  src: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
  className?: string;
}

export function BlogImage({
  src,
  alt,
  caption,
  width = 1600,
  height = 900,
  className,
}: BlogImageProps) {
  return (
    <figure className={cn('my-8 overflow-hidden', className)}>
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          className="h-auto w-full object-cover"
        />
      </div>
      {caption && (
        <figcaption className="mt-3 text-center text-sm italic leading-7 text-slate-500">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
