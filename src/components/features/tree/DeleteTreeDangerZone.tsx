'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import { useRouter } from '@/i18n/routing';
import { DeleteTreeConfirmDialog } from './DeleteTreeConfirmDialog';

interface DeleteTreeDangerZoneProps {
  treeId: string;
  treeShortCode: string;
  treeName: string;
}

export function DeleteTreeDangerZone({
  treeId,
  treeShortCode,
  treeName,
}: DeleteTreeDangerZoneProps) {
  const t = useTranslations('treeDelete');
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleDeleted = () => {
    setDialogOpen(false);
    router.push('/tree');
  };

  return (
    <section
      aria-labelledby="danger-zone-title"
      className="mx-auto mt-10 max-w-7xl px-4"
    >
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="danger-zone-title" className="text-base font-semibold text-red-800">
              {t('dangerZoneTitle')}
            </h2>
            <p className="mt-1 text-sm text-red-700">{t('dangerZoneBody')}</p>
          </div>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
          >
            <TrashIcon className="h-4 w-4" />
            {t('dangerZoneButton')}
          </button>
        </div>
      </div>

      <DeleteTreeConfirmDialog
        treeId={treeId}
        treeShortCode={treeShortCode}
        treeName={treeName}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={handleDeleted}
      />
    </section>
  );
}

function TrashIcon({ className }: { className?: string }) {
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
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}
