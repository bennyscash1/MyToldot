'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

type TreeShareButtonProps = {
  locale: string;
  shortCode: string;
  treeName: string;
  siteOrigin: string;
};

function buildViewUrl(siteOrigin: string, locale: string, shortCode: string) {
  return `${siteOrigin}/${locale}/tree/${shortCode}`;
}

function buildJoinUrl(siteOrigin: string, locale: string, shortCode: string) {
  return `${siteOrigin}/${locale}/join/${shortCode}`;
}

function ShareLinkSection({
  title,
  help,
  url,
  copyLabel,
  copiedLabel,
  whatsappLabel,
}: {
  title: string;
  help: string;
  url: string;
  copyLabel: string;
  copiedLabel: string;
  whatsappLabel: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }, [url]);

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(url)}`;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
      <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
      <p className="mt-1 break-all rounded-md border border-slate-200 bg-white px-2 py-1.5 font-mono text-xs text-slate-700">
        {url}
      </p>
      <p className="mt-2 text-xs text-slate-600">{help}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex h-9 items-center rounded-lg border border-emerald-300 bg-white px-3 text-sm font-medium text-emerald-800 hover:bg-emerald-50"
        >
          {copied ? copiedLabel : copyLabel}
        </button>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {whatsappLabel}
        </a>
      </div>
    </div>
  );
}

export function TreeShareButton({
  locale,
  shortCode,
  treeName,
  siteOrigin,
}: TreeShareButtonProps) {
  const t = useTranslations('share');
  const uiLocale = useLocale();
  const dir = uiLocale === 'he' ? 'rtl' : 'ltr';
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const viewUrl = buildViewUrl(siteOrigin, locale, shortCode);
  const joinUrl = buildJoinUrl(siteOrigin, locale, shortCode);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onPointer = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={t('buttonLabel')}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
      >
        <ShareIcon className="h-4 w-4 shrink-0" aria-hidden />
        <span className="hidden sm:inline">{t('buttonLabel')}</span>
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby="tree-share-title"
          dir={dir}
          className="absolute end-0 top-full z-50 mt-2 w-[min(100vw-2rem,22rem)] rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
        >
          <h3 id="tree-share-title" className="text-base font-semibold text-slate-900">
            {t('modalTitle', { treeName })}
          </h3>
          <div className="mt-4 flex flex-col gap-4">
            <ShareLinkSection
              title={t('viewLinkTitle')}
              help={t('viewLinkHelp')}
              url={viewUrl}
              copyLabel={t('copy')}
              copiedLabel={t('copied')}
              whatsappLabel={t('shareWhatsapp')}
            />
            <ShareLinkSection
              title={t('joinLinkTitle')}
              help={t('joinLinkHelp')}
              url={joinUrl}
              copyLabel={t('copy')}
              copiedLabel={t('copied')}
              whatsappLabel={t('shareWhatsapp')}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      className={className}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
      />
    </svg>
  );
}
