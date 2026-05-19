'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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

export interface UseRotationResult {
  currentPerson: DashboardPerson | null;
  secondsRemaining: number;
  paused: boolean;
  next: () => void;
  prev: () => void;
  togglePause: () => void;
  totalCount: number;
  currentIndex: number;
}

export function useRotation(
  persons: DashboardPerson[],
  treeId: string,
): UseRotationResult {
  const order = useMemo(() => shuffle(persons), [persons]);
  const storageKey = `dashboard:position:${treeId}`;

  const [index, setIndex] = useState<number>(() =>
    readPersistedIndex(storageKey, Math.max(order.length, 1)),
  );
  const [secondsRemaining, setSecondsRemaining] = useState<number>(PERSON_DURATION_SECONDS);
  const [paused, setPaused] = useState<boolean>(false);

  const indexRef = useRef(index);
  indexRef.current = index;

  useEffect(() => {
    if (order.length === 0) return;
    try {
      window.sessionStorage.setItem(storageKey, String(index));
    } catch {
      /* ignore */
    }
  }, [index, storageKey, order.length]);

  useEffect(() => {
    if (paused || order.length <= 1) return;
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
  }, [paused, order.length]);

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

  const currentPerson = order.length > 0 ? order[Math.min(index, order.length - 1)] : null;

  return {
    currentPerson,
    secondsRemaining,
    paused,
    next,
    prev,
    togglePause,
    totalCount: order.length,
    currentIndex: index,
  };
}
