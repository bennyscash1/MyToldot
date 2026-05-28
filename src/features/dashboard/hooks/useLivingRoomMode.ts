'use client';

import { useCallback, useEffect, useState } from 'react';

import { useWakeLock } from './useWakeLock';

const DISPLAY_MODE_KEY = 'dashboard:displayMode';
const DISPLAY_MODE_EVENT = 'dashboard:displayMode';

export type DashboardDisplayMode = 'tv' | 'tablet';

function readStoredMode(): DashboardDisplayMode | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(DISPLAY_MODE_KEY);
    if (raw === 'tv' || raw === 'tablet') return raw;
    return null;
  } catch {
    return null;
  }
}

function emitDisplayMode(mode: DashboardDisplayMode) {
  window.dispatchEvent(
    new CustomEvent(DISPLAY_MODE_EVENT, { detail: mode }),
  );
}

/** First visit in session (no stored preference) defaults to TV mode. */
function resolveInitialMode(): DashboardDisplayMode {
  return readStoredMode() ?? 'tv';
}

export function useLivingRoomMode() {
  const [displayMode, setDisplayMode] = useState<DashboardDisplayMode>(() => {
    if (typeof window === 'undefined') return 'tv';
    return readStoredMode() ?? 'tv';
  });
  const [hydrated, setHydrated] = useState(false);

  const isLivingRoomMode = displayMode === 'tv';

  useWakeLock(isLivingRoomMode && hydrated);

  useEffect(() => {
    setDisplayMode(resolveInitialMode());
    setHydrated(true);

    const onModeEvent = (event: Event) => {
      const next = (event as CustomEvent<DashboardDisplayMode>).detail;
      if (next === 'tv' || next === 'tablet') {
        setDisplayMode(next);
      }
    };

    window.addEventListener(DISPLAY_MODE_EVENT, onModeEvent);
    return () => window.removeEventListener(DISPLAY_MODE_EVENT, onModeEvent);
  }, []);

  const persistMode = useCallback((mode: DashboardDisplayMode) => {
    setDisplayMode(mode);
    try {
      window.sessionStorage.setItem(DISPLAY_MODE_KEY, mode);
    } catch {
      /* ignore */
    }
    emitDisplayMode(mode);
  }, []);

  const enterLivingRoom = useCallback(() => {
    persistMode('tv');
    const el = document.documentElement;
    void el.requestFullscreen?.().catch(() => {});
  }, [persistMode]);

  const exitLivingRoom = useCallback(() => {
    persistMode('tablet');
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => {});
    }
  }, [persistMode]);

  const toggleLivingRoom = useCallback(() => {
    if (isLivingRoomMode) {
      exitLivingRoom();
    } else {
      enterLivingRoom();
    }
  }, [enterLivingRoom, exitLivingRoom, isLivingRoomMode]);

  useEffect(() => {
    if (!hydrated || !isLivingRoomMode) return;
    const el = document.documentElement;
    if (!document.fullscreenElement) {
      void el.requestFullscreen?.().catch(() => {});
    }
  }, [hydrated, isLivingRoomMode]);

  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement && isLivingRoomMode) {
        persistMode('tablet');
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, [isLivingRoomMode, persistMode]);

  return {
    isLivingRoomMode,
    displayMode,
    hydrated,
    enterLivingRoom,
    exitLivingRoom,
    toggleLivingRoom,
  };
}
