'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { usePathname } from '@/i18n/routing';

import type { DashboardPerson } from '../types';

const PERSON_DURATION_SECONDS = 60;
const TICK_MS = 1000;
const MANUAL_NEXT_DEBOUNCE_MS = 500;

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
  isNextDebounced: boolean;
}

export function usePersonRotation(
  persons: DashboardPerson[],
  treeId: string,
  initialPersonId?: string | null,
): UsePersonRotationResult {
  const pathname = usePathname();
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
  const [isNextDebounced, setIsNextDebounced] = useState(false);

  const orderRef = useRef(order);
  const manualNextLockRef = useRef(false);

  orderRef.current = order;

  const resetCountdown = useCallback(() => {
    setSecondsRemaining(PERSON_DURATION_SECONDS);
  }, []);

  const advanceToNextPerson = useCallback(() => {
    const len = orderRef.current.length;
    if (len === 0) return;
    setIndex((i) => (i + 1) % len);
    resetCountdown();
  }, [resetCountdown]);

  const advanceToPrevPerson = useCallback(() => {
    const len = orderRef.current.length;
    if (len === 0) return;
    setIndex((i) => (i - 1 + len) % len);
    resetCountdown();
  }, [resetCountdown]);

  // Single 1s tick: countdown display + auto-advance at 0. Depends only on paused
  // and order length — never on index/person id (avoids stacked intervals).
  useEffect(() => {
    if (paused || order.length <= 1) return;

    const tick = window.setInterval(() => {
      setSecondsRemaining((current) => {
        if (current <= 1) {
          setIndex((i) => (i + 1) % orderRef.current.length);
          return PERSON_DURATION_SECONDS;
        }
        return current - 1;
      });
    }, TICK_MS);

    return () => window.clearInterval(tick);
  }, [paused, order.length]);

  useEffect(() => {
    if (order.length === 0) return;
    try {
      window.sessionStorage.setItem(storageKey, String(index));
    } catch {
      /* ignore */
    }

    const person = order[index];
    if (!person) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get('personId') === person.id) return;

    params.set('personId', person.id);
    const nextUrl = `${pathname}?${params.toString()}`;
    window.history.replaceState(window.history.state, '', nextUrl);
  }, [index, storageKey, order, pathname]);

  const next = useCallback(() => {
    if (manualNextLockRef.current || orderRef.current.length === 0) return;

    manualNextLockRef.current = true;
    setIsNextDebounced(true);

    advanceToNextPerson();

    window.setTimeout(() => {
      manualNextLockRef.current = false;
      setIsNextDebounced(false);
    }, MANUAL_NEXT_DEBOUNCE_MS);
  }, [advanceToNextPerson]);

  const prev = useCallback(() => {
    if (orderRef.current.length === 0) return;
    advanceToPrevPerson();
  }, [advanceToPrevPerson]);

  const setFocalPersonId = useCallback(
    (id: string) => {
      const idx = orderRef.current.findIndex((p) => p.id === id);
      if (idx < 0) return;
      setIndex(idx);
      resetCountdown();
    },
    [resetCountdown],
  );

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
    isNextDebounced,
  };
}
