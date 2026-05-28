'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { usePathname, useRouter } from '@/i18n/routing';

import type { DashboardPerson } from '../types';

const PERSON_DURATION_SECONDS = 60;

function shuffle<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function readPersistedIndex(key: string, max: number): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (raw === null) return 0;
    const n = Number.parseInt(raw, 10);
    if (Number.isNaN(n) || n < 0 || n >= max) return 0;
    return n;
  } catch {
    return 0;
  }
}

export interface UsePersonRotationResult {
  currentPerson: DashboardPerson | null;
  secondsRemaining: number;
  progress: number;
  paused: boolean;
  next: () => void;
  prev: () => void;
  togglePause: () => void;
  setFocalPersonId: (id: string) => void;
  totalCount: number;
  currentIndex: number;
}

export function usePersonRotation(
  persons: DashboardPerson[],
  treeId: string,
  initialPersonId?: string | null,
  autoAdvance = true,
): UsePersonRotationResult {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const order = useMemo(() => shuffle(persons), [persons]);
  const storageKey = `dashboard:position:${treeId}`;

  const initialIndex = useMemo(() => {
    if (initialPersonId) {
      const idx = order.findIndex((p) => p.id === initialPersonId);
      if (idx >= 0) return idx;
    }
    return readPersistedIndex(storageKey, Math.max(order.length, 1));
  }, [initialPersonId, order, storageKey]);

  const [index, setIndex] = useState<number>(initialIndex);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(
    PERSON_DURATION_SECONDS,
  );
  const [paused, setPaused] = useState<boolean>(false);

  useEffect(() => {
    if (order.length === 0) return;
    try {
      window.sessionStorage.setItem(storageKey, String(index));
    } catch {
      /* ignore */
    }
    const person = order[index];
    if (!person) return;
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (params.get('personId') !== person.id) {
      params.set('personId', person.id);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [index, storageKey, order, router, pathname, searchParams]);

  useEffect(() => {
    if (!autoAdvance || paused || order.length <= 1) return;
    const id = window.setInterval(() => {
      setSecondsRemaining((s) => {
        if (s <= 1) {
          setIndex((i) => (i + 1) % order.length);
          return PERSON_DURATION_SECONDS;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [autoAdvance, paused, order.length]);

  const setFocalPersonId = useCallback(
    (id: string) => {
      const idx = order.findIndex((p) => p.id === id);
      if (idx < 0) return;
      setIndex(idx);
      setSecondsRemaining(PERSON_DURATION_SECONDS);
    },
    [order],
  );

  const next = useCallback(() => {
    if (order.length === 0) return;
    setIndex((i) => (i + 1) % order.length);
    setSecondsRemaining(PERSON_DURATION_SECONDS);
  }, [order.length]);

  const prev = useCallback(() => {
    if (order.length === 0) return;
    setIndex((i) => (i - 1 + order.length) % order.length);
    setSecondsRemaining(PERSON_DURATION_SECONDS);
  }, [order.length]);

  const togglePause = useCallback(() => {
    setPaused((p) => !p);
  }, []);

  const currentPerson =
    order.length > 0 ? order[Math.min(index, order.length - 1)] : null;

  const progress =
    (PERSON_DURATION_SECONDS - secondsRemaining) / PERSON_DURATION_SECONDS;

  return {
    currentPerson,
    secondsRemaining,
    progress,
    paused,
    next,
    prev,
    togglePause,
    setFocalPersonId,
    totalCount: order.length,
    currentIndex: index,
  };
}
