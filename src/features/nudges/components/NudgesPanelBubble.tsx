'use client';

import { useTranslations } from 'next-intl';

interface NudgesPanelBubbleProps {
  count: number;
  onClick: () => void;
}

export function NudgesPanelBubble({ count, onClick }: NudgesPanelBubbleProps) {
  const t = useTranslations('nudges');
  const badge = count > 9 ? '9+' : String(count);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t('minimizedAriaLabel')}
      className="relative inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg transition hover:bg-emerald-700 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
    >
      <ChatIcon className="h-6 w-6" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white px-1 text-xs font-bold text-emerald-700 ring-2 ring-emerald-600">
          {badge}
        </span>
      )}
    </button>
  );
}

function ChatIcon({ className }: { className?: string }) {
  // Inline SVG — lucide-react isn't installed. TODO: swap for lucide MessageCircle if/when added.
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}
