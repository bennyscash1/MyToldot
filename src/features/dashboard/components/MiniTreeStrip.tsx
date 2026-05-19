'use client';

import { useTranslations } from 'next-intl';

import type { DashboardPerson, PersonRef } from '../types';

interface MiniTreeStripProps {
  person: DashboardPerson;
}

const NODE_WIDTH = 96;
const NODE_HEIGHT = 28;
const NODE_GAP = 12;
const ROW_GAP = 16;

export function MiniTreeStrip({ person }: MiniTreeStripProps) {
  const t = useTranslations('dashboard');
  const parents = person.relatives.parents.slice(0, 2);
  const siblings = person.relatives.siblings.slice(0, 3);
  const spouse = person.relatives.spouses[0] ?? null;

  const focalRow: PersonRef[] = [
    ...siblings,
    { id: person.id, displayName: person.displayName, profileImageUrl: person.profileImageUrl },
    ...(spouse ? [spouse] : []),
  ];

  const totalWidth = Math.max(
    parents.length * (NODE_WIDTH + NODE_GAP),
    focalRow.length * (NODE_WIDTH + NODE_GAP),
  );

  return (
    <div className="mt-4 rounded-lg border border-slate-200/70 bg-slate-50/50 p-3">
      <div className="mb-1 text-xs font-medium text-slate-500">
        {t('miniTreeLabel')}
      </div>
      <div className="flex flex-col items-center gap-2 overflow-x-auto py-1">
        {parents.length > 0 && (
          <Row nodes={parents} highlightId={null} totalWidth={totalWidth} />
        )}
        <Row nodes={focalRow} highlightId={person.id} totalWidth={totalWidth} />
      </div>
    </div>
  );
}

function Row({
  nodes,
  highlightId,
  totalWidth,
}: {
  nodes: PersonRef[];
  highlightId: string | null;
  totalWidth: number;
}) {
  return (
    <div
      className="flex shrink-0 items-center justify-center"
      style={{ gap: NODE_GAP, minHeight: NODE_HEIGHT, minWidth: totalWidth }}
    >
      {nodes.map((node) => (
        <div
          key={node.id}
          className={
            'flex items-center justify-center rounded-md border px-2 text-center text-[11px] font-medium leading-tight ' +
            (node.id === highlightId
              ? 'border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm'
              : 'border-slate-200 bg-white text-slate-600')
          }
          style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}
          title={node.displayName}
        >
          <span className="truncate">{node.displayName || '—'}</span>
        </div>
      ))}
    </div>
  );
}

export const _miniTreeMetrics = { NODE_WIDTH, NODE_HEIGHT, NODE_GAP, ROW_GAP };
