'use client';

import { useEffect, useState } from 'react';

interface LandingTvMockupProps {
  name: string;
  date: string;
}

export function LandingTvMockup({ name, date }: LandingTvMockupProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % 4);
    }, 2200);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div className="relative aspect-[16/10] rounded-[14px] bg-[#0a0a08] p-[18px] shadow-[0_30px_60px_rgba(0,0,0,.5),0_0_0_8px_#1f1f1d,0_0_0_9px_#2c2c29]">
      <div className="relative h-full overflow-hidden rounded-md bg-[linear-gradient(135deg,#2a4128_0%,#1a1a17_100%)]">
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[linear-gradient(135deg,#5d7556_0%,#3d5d3a_50%,#2a4128_100%)] px-10 text-center text-cream">
          <div className="mb-4 flex aspect-[4/5] w-1/2 items-center justify-center rounded bg-white/10 text-cream/50 ring-2 ring-white/20">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true">
              <circle cx="12" cy="8" r="4" />
              <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
            </svg>
          </div>
          <div className="font-serif text-2xl font-bold">
            {name}
          </div>
          <div className="mt-1 text-xs tracking-[0.08em] text-cream/60">
            {date}
          </div>
        </div>

        <div className="absolute bottom-3 end-3 flex gap-1">
          {Array.from({ length: 4 }).map((_, index) => (
            <span
              key={index}
              className={index === activeIndex ? 'size-1.5 rounded-full bg-gold-soft' : 'size-1.5 rounded-full bg-cream/30'}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
