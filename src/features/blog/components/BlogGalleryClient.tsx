'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

export interface BlogGalleryImage {
  src: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
}

interface BlogGalleryClientProps {
  images: BlogGalleryImage[];
}

export function BlogGalleryClient({ images }: BlogGalleryClientProps) {
  const t = useTranslations('blog.lightbox');
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const activeImage = useMemo(
    () => (activeIndex === null ? null : images[activeIndex] ?? null),
    [activeIndex, images],
  );

  useEffect(() => {
    if (activeIndex === null || images.length === 0) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveIndex(null);
      }

      if (event.key === 'ArrowRight') {
        setActiveIndex((current) =>
          current === null ? current : (current + 1) % images.length,
        );
      }

      if (event.key === 'ArrowLeft') {
        setActiveIndex((current) =>
          current === null ? current : (current - 1 + images.length) % images.length,
        );
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [activeIndex, images]);

  return (
    <>
      <div className="my-8 grid grid-cols-2 gap-3 sm:flex sm:overflow-x-auto sm:pb-2">
        {images.map((image, index) => (
          <button
            key={`${image.src}-${index}`}
            type="button"
            onClick={() => setActiveIndex(index)}
            className="group overflow-hidden rounded-2xl border border-slate-200 bg-white text-start shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md sm:w-60 sm:flex-none"
          >
            <Image
              src={image.src}
              alt={image.alt}
              width={image.width ?? 1200}
              height={image.height ?? 900}
              className="aspect-[4/3] h-auto w-full object-cover transition-transform group-hover:scale-[1.02]"
            />
            {image.caption && (
              <span className="block px-3 py-2 text-sm italic leading-6 text-slate-500">
                {image.caption}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeImage && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 p-4 sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label={activeImage.alt}
          onClick={() => setActiveIndex(null)}
        >
          <div className="mx-auto flex h-full max-w-5xl flex-col justify-center">
            <div
              className="relative rounded-3xl bg-white p-3 shadow-2xl sm:p-4"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-slate-500">
                  {activeIndex !== null ? `${activeIndex + 1} / ${images.length}` : null}
                </div>
                <button
                  type="button"
                  onClick={() => setActiveIndex(null)}
                  className="rounded-full px-3 py-1 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
                >
                  {t('close')}
                </button>
              </div>

              <Image
                src={activeImage.src}
                alt={activeImage.alt}
                width={activeImage.width ?? 1600}
                height={activeImage.height ?? 1100}
                className="max-h-[70vh] h-auto w-full rounded-2xl object-contain"
              />

              <div className="mt-3 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setActiveIndex((current) =>
                      current === null ? current : (current - 1 + images.length) % images.length,
                    )
                  }
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  {t('previous')}
                </button>

                <div className="flex-1 text-center text-sm italic leading-6 text-slate-500">
                  {activeImage.caption ?? activeImage.alt}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setActiveIndex((current) =>
                      current === null ? current : (current + 1) % images.length,
                    )
                  }
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  {t('next')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
