interface HeroFamilyTreeProps {
  title: string;
  focalTag: string;
  footer: string;
  grandpaName: string;
  grandpaYears: string;
  grandmaName: string;
  grandmaYears: string;
  childOneName: string;
  childOneYears: string;
  focalName: string;
  focalYears: string;
  childThreeName: string;
  childThreeYears: string;
  grandchildOneName: string;
  grandchildOneYears: string;
  grandchildTwoName: string;
  grandchildTwoYears: string;
}

export function HeroFamilyTree({
  title,
  focalTag,
  footer,
  grandpaName,
  grandpaYears,
  grandmaName,
  grandmaYears,
  childOneName,
  childOneYears,
  focalName,
  focalYears,
  childThreeName,
  childThreeYears,
  grandchildOneName,
  grandchildOneYears,
  grandchildTwoName,
  grandchildTwoYears,
}: HeroFamilyTreeProps) {
  return (
    <div className="relative overflow-hidden rounded-[14px] border border-paper-line bg-paper p-6 shadow-lift sm:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(61,93,58,0.04),transparent_50%),radial-gradient(circle_at_80%_80%,rgba(176,132,54,0.04),transparent_50%)]" />

      <div className="relative z-[1] mb-4 flex items-center justify-between">
        <div className="font-serif text-base font-bold text-ink">{title}</div>
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-brand-green-bright" />
          <span className="size-2.5 rounded-full bg-cream-deep" />
          <span className="size-2.5 rounded-full bg-cream-deep" />
        </div>
      </div>

      <div className="relative z-[1] rounded-lg border border-paper-line bg-cream-warm p-4 sm:p-5">
        <svg viewBox="0 0 500 320" xmlns="http://www.w3.org/2000/svg" className="h-auto w-full" aria-hidden="true">
          <g>
            <rect x="60" y="20" width="130" height="58" rx="8" fill="#fff" stroke="#d4d1bd" strokeWidth="1" />
            <circle cx="82" cy="49" r="16" fill="#cdd9d0" />
            <text x="105" y="46" fontFamily="var(--font-frank-ruhl-libre)" fontSize="11" fontWeight="600" fill="#1a1a17">{grandpaName}</text>
            <text x="105" y="59" fontFamily="var(--font-heebo)" fontSize="9" fill="#6b6b5e">{grandpaYears}</text>
          </g>
          <g>
            <rect x="310" y="20" width="130" height="58" rx="8" fill="#fff" stroke="#d4d1bd" strokeWidth="1" />
            <circle cx="332" cy="49" r="16" fill="#e3d4c7" />
            <text x="355" y="46" fontFamily="var(--font-frank-ruhl-libre)" fontSize="11" fontWeight="600" fill="#1a1a17">{grandmaName}</text>
            <text x="355" y="59" fontFamily="var(--font-heebo)" fontSize="9" fill="#6b6b5e">{grandmaYears}</text>
          </g>
          <line x1="190" y1="49" x2="240" y2="49" stroke="#3d5d3a" strokeWidth="2" />
          <line x1="260" y1="49" x2="310" y2="49" stroke="#3d5d3a" strokeWidth="2" />
          <circle cx="250" cy="49" r="6" fill="#3d5d3a" />
          <path d="M 250 55 L 250 120 L 125 120 L 125 150" fill="none" stroke="#94a594" strokeWidth="1.5" />
          <path d="M 250 55 L 250 120 L 250 150" fill="none" stroke="#94a594" strokeWidth="1.5" />
          <path d="M 250 55 L 250 120 L 375 120 L 375 150" fill="none" stroke="#94a594" strokeWidth="1.5" />

          <g>
            <rect x="65" y="150" width="120" height="54" rx="8" fill="#fff" stroke="#d4d1bd" strokeWidth="1" />
            <circle cx="86" cy="177" r="14" fill="#e3d4c7" />
            <text x="106" y="174" fontFamily="var(--font-frank-ruhl-libre)" fontSize="11" fontWeight="600" fill="#1a1a17">{childOneName}</text>
            <text x="106" y="187" fontFamily="var(--font-heebo)" fontSize="9" fill="#6b6b5e">{childOneYears}</text>
          </g>
          <g>
            <rect x="190" y="150" width="120" height="54" rx="8" fill="rgba(61,93,58,.06)" stroke="#3d5d3a" strokeWidth="1.5" />
            <circle cx="211" cy="177" r="14" fill="#cdd9d0" />
            <text x="231" y="174" fontFamily="var(--font-frank-ruhl-libre)" fontSize="11" fontWeight="600" fill="#1a1a17">{focalName}</text>
            <text x="231" y="187" fontFamily="var(--font-heebo)" fontSize="9" fill="#6b6b5e">{focalYears}</text>
          </g>
          <g>
            <rect x="315" y="150" width="120" height="54" rx="8" fill="#fff" stroke="#d4d1bd" strokeWidth="1" />
            <circle cx="336" cy="177" r="14" fill="#e3d4c7" />
            <text x="356" y="174" fontFamily="var(--font-frank-ruhl-libre)" fontSize="11" fontWeight="600" fill="#1a1a17">{childThreeName}</text>
            <text x="356" y="187" fontFamily="var(--font-heebo)" fontSize="9" fill="#6b6b5e">{childThreeYears}</text>
          </g>

          <path d="M 250 204 L 250 230 L 195 230 L 195 250" fill="none" stroke="#94a594" strokeWidth="1.5" />
          <path d="M 250 204 L 250 230 L 305 230 L 305 250" fill="none" stroke="#94a594" strokeWidth="1.5" />
          <circle cx="250" cy="220" r="5" fill="#3d5d3a" />

          <g>
            <rect x="148" y="250" width="94" height="48" rx="7" fill="#fff" stroke="#d4d1bd" strokeWidth="1" />
            <circle cx="166" cy="274" r="12" fill="#cdd9d0" />
            <text x="183" y="272" fontFamily="var(--font-frank-ruhl-libre)" fontSize="10" fontWeight="600" fill="#1a1a17">{grandchildOneName}</text>
            <text x="183" y="284" fontFamily="var(--font-heebo)" fontSize="8" fill="#6b6b5e">{grandchildOneYears}</text>
          </g>
          <g>
            <rect x="258" y="250" width="94" height="48" rx="7" fill="#fff" stroke="#d4d1bd" strokeWidth="1" />
            <circle cx="276" cy="274" r="12" fill="#e3d4c7" />
            <text x="293" y="272" fontFamily="var(--font-frank-ruhl-libre)" fontSize="10" fontWeight="600" fill="#1a1a17">{grandchildTwoName}</text>
            <text x="293" y="284" fontFamily="var(--font-heebo)" fontSize="8" fill="#6b6b5e">{grandchildTwoYears}</text>
          </g>
        </svg>
      </div>

      <div className="relative z-[1] mt-4 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
        <span className="rounded-full bg-brand-green/10 px-2.5 py-1 font-semibold text-brand-green-deep">
          {focalTag}
        </span>
        <span>{footer}</span>
      </div>
    </div>
  );
}
