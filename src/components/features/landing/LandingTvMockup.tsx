'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';

export function LandingTvMockup() {
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
        <Image
          src="/images/langinImageTv.png"
          alt=""
          fill
          sizes="(max-width: 1024px) 100vw, 50vw"
          className="object-cover"
        />

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
