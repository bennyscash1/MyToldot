'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { normalizeExternalImageUrl, EXTERNAL_IMAGE_IMG_PROPS } from '@/lib/images/normalize-external-image-url';
import { cn } from '@/lib/utils';
import { AiImageSearchModal, type AiImageSelection } from './AiImageSearchModal';

const IMAGE_URL_PATTERN = /^https?:\/\/.+\.(jpe?g|png|webp|gif)(\?.*)?$/i;

function isValidImageUrlClient(url: string): boolean {
  try {
    const trimmed = url.trim();
    if (!trimmed) return false;
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    return IMAGE_URL_PATTERN.test(trimmed) || IMAGE_URL_PATTERN.test(parsed.href);
  } catch {
    return false;
  }
}

export interface PersonImagePickerProps {
  mode: 'profile' | 'gallery';
  personId: string;
  personName: string;
  birthDateLabel?: string;
  deathDateLabel?: string;
  defaultSearchContext: string;
  disabled?: boolean;
  onUploadFile: (file: File) => void | Promise<void>;
  onUrlSelected: (url: string) => void;
  onAiSelected: (selection: AiImageSelection) => void;
  className?: string;
}

type MenuView = 'closed' | 'menu' | 'url';

export function PersonImagePicker({
  mode,
  personId,
  personName,
  birthDateLabel,
  deathDateLabel,
  defaultSearchContext,
  disabled = false,
  onUploadFile,
  onUrlSelected,
  onAiSelected,
  className,
}: PersonImagePickerProps) {
  const t = useTranslations('personImage');
  const fileRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<MenuView>('closed');
  const [urlInput, setUrlInput] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [aiOpen, setAiOpen] = useState(false);

  const handleUrlSubmit = () => {
    const trimmed = urlInput.trim();
    if (!isValidImageUrlClient(trimmed)) {
      setUrlError(t('invalidUrl'));
      return;
    }
    setUrlError(null);
    onUrlSelected(trimmed);
    setUrlInput('');
    setView('closed');
  };

  return (
    <div className={cn('relative', className)}>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(ev) => {
          const f = ev.target.files?.[0];
          ev.target.value = '';
          if (f) void onUploadFile(f);
          setView('closed');
        }}
      />

      <button
        type="button"
        disabled={disabled}
        onClick={() => setView((v) => (v === 'menu' ? 'closed' : 'menu'))}
        className="text-sm font-medium text-[#3e5045] underline-offset-2 hover:underline disabled:opacity-50"
      >
        {mode === 'profile' ? t('changePhoto') : t('addPhoto')}
      </button>

      {view === 'menu' && (
        <div className="absolute start-0 top-full z-10 mt-1 min-w-[180px] overflow-hidden rounded-lg border border-slate-200/80 bg-white py-1 shadow-lg">
          <button
            type="button"
            className="block w-full px-3 py-2 text-start text-sm text-slate-800 hover:bg-slate-50"
            onClick={() => {
              fileRef.current?.click();
              setView('closed');
            }}
          >
            {t('uploadFile')}
          </button>
          <button
            type="button"
            className="block w-full px-3 py-2 text-start text-sm text-slate-800 hover:bg-slate-50"
            onClick={() => {
              setView('url');
              setUrlError(null);
            }}
          >
            {t('pasteUrl')}
          </button>
          <button
            type="button"
            className="block w-full px-3 py-2 text-start text-sm text-slate-800 hover:bg-slate-50"
            onClick={() => {
              setAiOpen(true);
              setView('closed');
            }}
          >
            {t('aiSearch')}
          </button>
        </div>
      )}

      {view === 'url' && (
        <div className="mt-2 w-full max-w-xs rounded-lg border border-slate-200/80 bg-white p-2 shadow-sm">
          <input
            type="url"
            dir="ltr"
            value={urlInput}
            onChange={(e) => {
              setUrlInput(e.target.value);
              setUrlError(null);
            }}
            placeholder="https://..."
            className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm"
          />
          {urlInput.trim() && isValidImageUrlClient(urlInput) && (
            <div className="mt-2 overflow-hidden rounded-md border border-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={normalizeExternalImageUrl(urlInput.trim())}
                alt=""
                className="max-h-24 w-full object-contain bg-slate-50"
                {...EXTERNAL_IMAGE_IMG_PROPS}
              />
            </div>
          )}
          {urlError && <p className="mt-1 text-xs text-rose-600">{urlError}</p>}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setView('closed')}
              className="flex-1 rounded-md border border-slate-200 px-2 py-1 text-xs"
            >
              {t('cancel')}
            </button>
            <button
              type="button"
              onClick={handleUrlSubmit}
              className="flex-1 rounded-md bg-emerald-600 px-2 py-1 text-xs text-white"
            >
              {t('applyUrl')}
            </button>
          </div>
        </div>
      )}

      <AiImageSearchModal
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        mode={mode}
        personId={personId}
        personName={personName}
        birthDateLabel={birthDateLabel}
        deathDateLabel={deathDateLabel}
        defaultSearchContext={defaultSearchContext}
        onApply={onAiSelected}
      />
    </div>
  );
}
