import type { BlogCoverIllustration } from '@/features/blog/lib/posts';

interface IllustrationProps {
  overlayText: string;
}

export function BlogCoverSources({ overlayText }: IllustrationProps) {
  return (
    <div className="relative aspect-[16/10] overflow-hidden bg-[linear-gradient(135deg,#2a4128_0%,#5d3d2a_100%)]">
      <svg viewBox="0 0 400 250" xmlns="http://www.w3.org/2000/svg" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id="landing-sources-gold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e8c878" />
            <stop offset="1" stopColor="#b08436" />
          </linearGradient>
        </defs>
        <rect width="400" height="250" fill="transparent" />
        <rect x="40" y="60" width="140" height="100" fill="#2a3a2a" stroke="#4d7549" strokeWidth="2" rx="4" />
        <rect x="40" y="60" width="140" height="14" fill="#1a1a17" />
        <line x1="60" y1="90" x2="160" y2="90" stroke="#b08436" strokeWidth="1.5" opacity="0.6" />
        <line x1="60" y1="100" x2="150" y2="100" stroke="#b08436" strokeWidth="1" opacity="0.5" />
        <line x1="60" y1="110" x2="155" y2="110" stroke="#b08436" strokeWidth="1" opacity="0.5" />
        <line x1="60" y1="120" x2="140" y2="120" stroke="#b08436" strokeWidth="1" opacity="0.5" />
        <rect x="50" y="160" width="120" height="6" fill="#2a3a2a" />
        <path d="M 180 120 Q 250 60 320 100" stroke="url(#landing-sources-gold)" strokeWidth="3" fill="none" opacity="0.8" />
        <path d="M 180 120 Q 250 60 320 100" stroke="#fff7e0" strokeWidth="1" fill="none" opacity="0.5" />
        <rect x="260" y="100" width="110" height="80" fill="#8b6332" rx="2" />
        <rect x="265" y="105" width="100" height="70" fill="#e8d8b8" />
        <line x1="315" y1="105" x2="315" y2="175" stroke="#b08436" strokeWidth="1.5" />
        <text x="285" y="130" fontFamily="var(--font-frank-ruhl-libre)" fontSize="9" fill="#3d5d3a">תולדות</text>
        <line x1="270" y1="138" x2="310" y2="138" stroke="#b08436" strokeWidth=".5" opacity=".5" />
        <line x1="270" y1="145" x2="308" y2="145" stroke="#b08436" strokeWidth=".5" opacity=".5" />
        <line x1="270" y1="152" x2="312" y2="152" stroke="#b08436" strokeWidth=".5" opacity=".5" />
        <line x1="320" y1="138" x2="358" y2="138" stroke="#b08436" strokeWidth=".5" opacity=".5" />
        <line x1="320" y1="145" x2="360" y2="145" stroke="#b08436" strokeWidth=".5" opacity=".5" />
        <line x1="320" y1="152" x2="356" y2="152" stroke="#b08436" strokeWidth=".5" opacity=".5" />
        <circle cx="240" cy="75" r="2" fill="#fff7e0" />
        <circle cx="195" cy="95" r="1.5" fill="#fff7e0" />
        <circle cx="285" cy="85" r="1.5" fill="#fff7e0" />
      </svg>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_50%,rgba(0,0,0,.25)_100%)]" />
      <div className="absolute inset-x-4 bottom-3 z-[2] font-serif text-base font-bold text-cream drop-shadow-[0_2px_8px_rgba(0,0,0,.4)]">
        {overlayText}
      </div>
    </div>
  );
}

export function BlogCoverDigitalFamily({ overlayText }: IllustrationProps) {
  return (
    <div className="relative aspect-[16/10] overflow-hidden bg-[linear-gradient(135deg,#6b5640_0%,#2a2520_100%)]">
      <svg viewBox="0 0 400 250" xmlns="http://www.w3.org/2000/svg" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <rect width="400" height="250" fill="transparent" />
        <rect x="50" y="170" width="300" height="60" fill="#5d4534" rx="4" />
        <rect x="60" y="160" width="280" height="20" fill="#705540" rx="2" />
        <circle cx="140" cy="100" r="22" fill="#e8d4b8" />
        <rect x="115" y="115" width="50" height="60" fill="#d8c8a8" rx="6" />
        <ellipse cx="140" cy="115" rx="14" ry="8" fill="#fff" opacity="0.5" />
        <ellipse cx="140" cy="80" rx="14" ry="6" fill="#1a1a17" />
        <circle cx="240" cy="110" r="18" fill="#e8d4b8" />
        <rect x="222" y="125" width="36" height="55" fill="#3d5d3a" rx="6" />
        <rect x="170" y="135" width="60" height="42" fill="#1a1a17" rx="3" stroke="#b08436" strokeWidth="1" />
        <rect x="174" y="139" width="52" height="34" fill="#3d5d3a" />
        <circle cx="186" cy="150" r="2" fill="#fff7e0" />
        <circle cx="200" cy="150" r="2" fill="#fff7e0" />
        <circle cx="214" cy="150" r="2" fill="#fff7e0" />
        <line x1="186" y1="152" x2="200" y2="160" stroke="#fff7e0" strokeWidth=".5" />
        <line x1="214" y1="152" x2="200" y2="160" stroke="#fff7e0" strokeWidth=".5" />
        <circle cx="200" cy="162" r="2" fill="#b08436" />
        <circle cx="195" cy="80" r="2" fill="#b08436" opacity="0.8" />
        <circle cx="180" cy="60" r="1.5" fill="#b08436" opacity="0.6" />
        <circle cx="210" cy="65" r="1.5" fill="#b08436" opacity="0.6" />
        <circle cx="225" cy="75" r="2" fill="#b08436" opacity="0.7" />
      </svg>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_50%,rgba(0,0,0,.25)_100%)]" />
      <div className="absolute inset-x-4 bottom-3 z-[2] font-serif text-base font-bold text-cream drop-shadow-[0_2px_8px_rgba(0,0,0,.4)]">
        {overlayText}
      </div>
    </div>
  );
}

export function BlogCoverGift({ overlayText }: IllustrationProps) {
  return (
    <div className="relative aspect-[16/10] overflow-hidden bg-[linear-gradient(135deg,#5d4a36_0%,#1a1410_100%)]">
      <svg viewBox="0 0 400 250" xmlns="http://www.w3.org/2000/svg" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <rect width="400" height="250" fill="transparent" />
        <rect x="0" y="180" width="400" height="70" fill="#3d2f1f" />
        <ellipse cx="200" cy="180" rx="180" ry="10" fill="#5d4a36" />
        <circle cx="200" cy="80" r="28" fill="#f0e0c8" />
        <path d="M 175 70 Q 200 50 225 70 Q 225 80 200 78 Q 175 80 175 70 Z" fill="#d8d4cc" />
        <rect x="165" y="105" width="70" height="80" fill="#e8d8b8" rx="8" />
        <rect x="130" y="155" width="140" height="40" fill="#5d3d24" rx="3" />
        <rect x="135" y="160" width="65" height="30" fill="#e8d4b8" />
        <rect x="205" y="160" width="60" height="30" fill="#e8d4b8" />
        <rect x="140" y="165" width="22" height="20" fill="#a08866" />
        <circle cx="151" cy="173" r="3" fill="#3d5d3a" />
        <rect x="170" y="165" width="22" height="20" fill="#a08866" />
        <circle cx="181" cy="173" r="3" fill="#5d3d2a" />
        <rect x="210" y="165" width="22" height="20" fill="#a08866" />
        <circle cx="221" cy="173" r="3" fill="#3d5d3a" />
        <rect x="240" y="165" width="22" height="20" fill="#a08866" />
        <circle cx="251" cy="173" r="3" fill="#5d3d2a" />
        <rect x="320" y="155" width="50" height="40" fill="#b08436" rx="2" />
        <rect x="324" y="159" width="42" height="32" fill="#e8d4b8" />
        <rect x="20" y="60" width="100" height="100" fill="#3d2f1f" opacity="0.5" />
        <line x1="40" y1="60" x2="40" y2="160" stroke="#5d3d2a" strokeWidth="1.5" />
        <line x1="60" y1="60" x2="60" y2="160" stroke="#5d3d2a" strokeWidth="1.5" />
        <line x1="80" y1="60" x2="80" y2="160" stroke="#5d3d2a" strokeWidth="1.5" />
        <line x1="100" y1="60" x2="100" y2="160" stroke="#5d3d2a" strokeWidth="1.5" />
        <circle cx="200" cy="100" r="80" fill="#fff7e0" opacity="0.08" />
      </svg>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_50%,rgba(0,0,0,.25)_100%)]" />
      <div className="absolute inset-x-4 bottom-3 z-[2] font-serif text-base font-bold text-cream drop-shadow-[0_2px_8px_rgba(0,0,0,.4)]">
        {overlayText}
      </div>
    </div>
  );
}

export function LandingBlogIllustration({
  illustration,
  overlayText,
}: {
  illustration: BlogCoverIllustration;
  overlayText: string;
}) {
  if (illustration === 'digital-family') {
    return <BlogCoverDigitalFamily overlayText={overlayText} />;
  }

  if (illustration === 'gift') {
    return <BlogCoverGift overlayText={overlayText} />;
  }

  return <BlogCoverSources overlayText={overlayText} />;
}
