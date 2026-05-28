'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { usePathname } from '@/i18n/routing';

import type { DashboardPerson } from '../types';

const PERSON_DURATION_MS = 60_000;
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
  autoAdvance = true,
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
  const lastAdvanceAtRef = useRef(Date.now());
  const autoAdvanceTimerRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const manualNextLockRef = useRef(false);

  orderRef.current = order;

  const syncSecondsFromClock = useCallback(() => {
    const elapsed = Date.now() - lastAdvanceAtRef.current;
    const remaining = Math.max(
      0,
      Math.ceil((PERSON_DURATION_MS - elapsed) / 1000),
    );
    setSecondsRemaining(remaining);
  }, []);

  const advanceToNextPerson = useCallback(() => {
    const len = orderRef.current.length;
    if (len === 0) return;
    setIndex((i) => (i + 1) % len);
    lastAdvanceAtRef.current = Date.now();
    setSecondsRemaining(PERSON_DURATION_SECONDS);
  }, []);

  const advanceToPrevPerson = useCallback(() => {
    const len = orderRef.current.length;
    if (len === 0) return;
    setIndex((i) => (i - 1 + len) % len);
    lastAdvanceAtRef.current = Date.now();
    setSecondsRemaining(PERSON_DURATION_SECONDS);
  }, []);

  const bumpRotationClock = useCallback(() => {
    lastAdvanceAtRef.current = Date.now();
    setSecondsRemaining(PERSON_DURATION_SECONDS);
  }, []);

  const clearAutoAdvanceTimer = useCallback(() => {
    if (autoAdvanceTimerRef.current !== null) {
      clearInterval(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
  }, []);

  const clearCountdownTimer = useCallback(() => {
    if (countdownTimerRef.current !== null) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  const restartAutoAdvanceTimer = useCallback(() => {
    clearAutoAdvanceTimer();
    if (!autoAdvance || paused || orderRef.current.length <= 1) return;

    autoAdvanceTimerRef.current = setInterval(() => {
      advanceToNextPerson();
    }, PERSON_DURATION_MS);
  }, [advanceToNextPerson, autoAdvance, clearAutoAdvanceTimer, paused]);

  const restartCountdownTimer = useCallback(() => {
    clearCountdownTimer();
    if (!autoAdvance || paused) return;

    syncSecondsFromClock();
    countdownTimerRef.current = setInterval(() => {
      syncSecondsFromClock();
    }, TICK_MS);
  }, [autoAdvance, clearCountdownTimer, paused, syncSecondsFromClock]);

  useEffect(() => {
    restartAutoAdvanceTimer();
    restartCountdownTimer();
    return () => {
      clearAutoAdvanceTimer();
      clearCountdownTimer();
    };
  }, [
    autoAdvance,
    paused,
    order.length,
    restartAutoAdvanceTimer,
    restartCountdownTimer,
    clearAutoAdvanceTimer,
    clearCountdownTimer,
  ]);

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

    // Use replaceState only — router.replace was re-triggering RSC navigation
    // and stacking rotation timers on each person change.
    window.history.replaceState(window.history.state, '', nextUrl);
  }, [index, storageKey, order, pathname]);

  const next = useCallback(() => {
    if (manualNextLockRef.current || orderRef.current.length === 0) return;

    manualNextLockRef.current = true;
    setIsNextDebounced(true);

    advanceToNextPerson();
    restartAutoAdvanceTimer();
    if (autoAdvance && !paused) {
      restartCountdownTimer();
    }

    window.setTimeout(() => {
      manualNextLockRef.current = false;
      setIsNextDebounced(false);
    }, MANUAL_NEXT_DEBOUNCE_MS);
  }, [
    advanceToNextPerson,
    autoAdvance,
    paused,
    restartAutoAdvanceTimer,
    restartCountdownTimer,
  ]);

  const prev = useCallback(() => {
    if (orderRef.current.length === 0) return;
    advanceToPrevPerson();
    restartAutoAdvanceTimer();
    if (autoAdvance && !paused) {
      restartCountdownTimer();
    }
  }, [
    advanceToPrevPerson,
    autoAdvance,
    paused,
    restartAutoAdvanceTimer,
    restartCountdownTimer,
  ]);

  const setFocalPersonId = useCallback(
    (id: string) => {
      const idx = orderRef.current.findIndex((p) => p.id === id);
      if (idx < 0) return;
      setIndex(idx);
      bumpRotationClock();
      restartAutoAdvanceTimer();
      if (autoAdvance && !paused) {
        restartCountdownTimer();
      }
    },
    [
      autoAdvance,
      bumpRotationClock,
      paused,
      restartAutoAdvanceTimer,
      restartCountdownTimer,
    ],
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
