'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

import { DeleteTreeConfirmDialog } from './DeleteTreeConfirmDialog';

interface TreeCardMenuProps {
  treeId: string;
  treeShortCode: string;
  treeName: string;
  /** Called after a successful delete. Parent typically calls router.refresh() + flashes an alert. */
  onDeleted: (name: string) => void;
}

export function TreeCardMenu({
  treeId,
  treeShortCode,
  treeName,
  onDeleted,
}: TreeCardMenuProps) {
  const t = useTranslations('treeDelete');
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const handleTriggerClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen((v) => !v);
  };

  const handleMenuItemClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpen(false);
    setDialogOpen(true);
  };

  const handleDeleted = () => {
    setDialogOpen(false);
    onDeleted(treeName);
  };

  return (
    <div
      ref={containerRef}
      className="absolute end-2 top-2"
      // Stop card-link navigation when interacting with the menu region.
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <button
        type="button"
        onClick={handleTriggerClick}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('menuTrigger')}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
      >
        <DotsIcon className="h-4 w-4" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute end-0 top-9 z-20 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleMenuItemClick}
            className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            <TrashIcon className="h-4 w-4" />
            {t('menuItem')}
          </button>
        </div>
      )}

      <DeleteTreeConfirmDialog
        treeId={treeId}
        treeShortCode={treeShortCode}
        treeName={treeName}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={handleDeleted}
      />
    </div>
  );
}

function DotsIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="5" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="12" cy="19" r="1.75" />
    </svg>
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
