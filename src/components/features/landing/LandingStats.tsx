'use client';

import { useEffect, useRef, useState } from 'react';

const REGISTERED_FAMILIES_COUNT = 342;
// TODO: replace with prisma.tree.count() once we cross 500 families

interface LandingStatsProps {
  countTarget?: number;
  rotatingDisplayLabel: string;
  registeredFamiliesLabel: string;
  privacyLabel: string;
  aiLabel: string;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function LandingStats({
  countTarget = REGISTERED_FAMILIES_COUNT,
  rotatingDisplayLabel,
  registeredFamiliesLabel,
  privacyLabel,
  aiLabel,
}: LandingStatsProps) {
  const countRef = useRef<HTMLDivElement | null>(null);
  const [count, setCount] = useState(countTarget);

  useEffect(() => {
    const node = countRef.current;
    if (!node) return;

    let frameId = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          const startValue = Math.max(0, countTarget - 60);
          const duration = 1400;
          const start = performance.now();

          const tick = (now: number) => {
            const progress = Math.min(1, (now - start) / duration);
            const nextValue = Math.floor(startValue + (countTarget - startValue) * easeOutCubic(progress));
            setCount(nextValue);
            if (progress < 1) {
              frameId = window.requestAnimationFrame(tick);
            }
          };

          setCount(startValue);
          frameId = window.requestAnimationFrame(tick);
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.5 },
    );

    observer.observe(node);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frameId);
    };
  }, [countTarget]);

  return (
    <section className="border-y border-paper-line bg-cream-warm px-4 py-14 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-5xl gap-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center text-brand-green-deep">
            <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className="size-12" aria-hidden="true">
              <rect x="4" y="7" width="40" height="30" rx="3" stroke="currentColor" strokeWidth="2" />
              <line x1="18" y1="42" x2="30" y2="42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="24" y1="37" x2="24" y2="42" stroke="currentColor" strokeWidth="2" />
              <circle cx="16" cy="17" r="2" fill="currentColor" />
              <circle cx="24" cy="17" r="2" fill="currentColor" />
              <circle cx="32" cy="17" r="2" fill="currentColor" />
              <path d="M16 19 L 20 23 M 32 19 L 28 23 M 24 19 L 24 23" stroke="currentColor" strokeWidth="1.2" />
              <line x1="20" y1="23" x2="28" y2="23" stroke="currentColor" strokeWidth="1.2" />
              <circle cx="24" cy="27" r="2" fill="currentColor" />
              <circle cx="20" cy="32" r="1" fill="currentColor" opacity=".35" />
              <circle cx="24" cy="32" r="1" fill="currentColor" className="landing-rotating-dot" />
              <circle cx="28" cy="32" r="1" fill="currentColor" opacity=".35" />
            </svg>
          </div>
          <div className="text-sm font-medium uppercase tracking-[0.12em] text-ink-muted">
            {rotatingDisplayLabel}
          </div>
        </div>

        <div className="text-center">
          <div ref={countRef} className="font-serif text-5xl font-extrabold leading-none tracking-tight text-brand-green-deep">
            {count}
          </div>
          <div className="mt-2 text-sm font-medium uppercase tracking-[0.12em] text-ink-muted">
            {registeredFamiliesLabel}
          </div>
        </div>

        <div className="text-center">
          <div className="font-serif text-5xl font-extrabold leading-none tracking-tight text-brand-green-deep">
            100%
          </div>
          <div className="mt-2 text-sm font-medium uppercase tracking-[0.12em] text-ink-muted">
            {privacyLabel}
          </div>
        </div>

        <div className="text-center">
          <div className="font-serif text-5xl font-extrabold leading-none tracking-tight text-brand-green-deep">
            AI
          </div>
          <div className="mt-2 text-sm font-medium uppercase tracking-[0.12em] text-ink-muted">
            {aiLabel}
          </div>
        </div>
      </div>
    </section>
  );
}
