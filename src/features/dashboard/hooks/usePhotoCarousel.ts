'use client';

import { useEffect, useMemo, useState } from 'react';

const PHOTO_INTERVAL_MS = 5000;

export interface PhotoSlide {
  url: string;
  caption: string | null;
  isProfile: boolean;
}

export interface UsePhotoCarouselResult {
  current: PhotoSlide | null;
  index: number;
  total: number;
  slides: PhotoSlide[];
}

export function usePhotoCarousel(
  personId: string,
  profileImageUrl: string | null,
  galleryUrls: { url: string; caption: string | null }[],
  paused = false,
): UsePhotoCarouselResult {
  const slides = useMemo<PhotoSlide[]>(() => {
    const list: PhotoSlide[] = [];
    if (profileImageUrl) list.push({ url: profileImageUrl, caption: null, isProfile: true });
    for (const g of galleryUrls) {
      if (g.url === profileImageUrl) continue;
      list.push({ url: g.url, caption: g.caption, isProfile: false });
    }
    return list;
  }, [profileImageUrl, galleryUrls]);

  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [personId]);

  useEffect(() => {
    if (paused || slides.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, PHOTO_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [paused, slides.length, personId]);

  const safeIndex = slides.length > 0 ? Math.min(index, slides.length - 1) : 0;
  return {
    current: slides[safeIndex] ?? null,
    index: safeIndex,
    total: slides.length,
    slides,
  };
}
