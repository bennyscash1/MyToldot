'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import clsx from 'clsx';

import type { PersonNodeData } from '../../lib/types';
import {
  PERSON_NODE_HEIGHT,
  PERSON_NODE_WIDTH,
} from '../../lib/constants';

// ────────────────────────────────────────────────────────────────
// PersonCardNode
//
// Renders one person as a card. Width/height MUST match the constants
// ELK was given — otherwise edges will connect to empty space next to the
// card. That's enforced here via an inline style rather than Tailwind
// fixed widths so a designer can tweak via constants only.
// ────────────────────────────────────────────────────────────────

function PersonCardNodeInner({ data, selected }: NodeProps) {
  const { person, is_focal } = data as unknown as PersonNodeData;

  const displayName = [person.first_name_he ?? person.first_name, person.last_name_he ?? person.last_name]
    .filter(Boolean)
    .join(' ');

  const birth = formatYear(person.birth_date);
  const death = formatYear(person.death_date);
  const years =
    birth && death ? `${birth} – ${death}` : birth ? `${birth}–` : death ? `–${death}` : '';

  return (
    <div
      style={{ width: PERSON_NODE_WIDTH, height: PERSON_NODE_HEIGHT }}
      className={clsx(
        'relative flex items-center gap-3 rounded-xl border bg-white px-3 shadow-sm transition',
        'hover:shadow-md',
        is_focal
          ? 'border-sky-500 ring-2 ring-sky-300'
          : selected
            ? 'border-sky-400'
            : 'border-slate-200',
        person.gender === 'MALE' && 'border-l-4 border-l-sky-400',
        person.gender === 'FEMALE' && 'border-l-4 border-l-rose-400',
      )}
    >
      {/* Incoming spouse edge — left side, same Y as the card centre. */}
      <Handle
        type="target"
        position={Position.Left}
        className="!h-0 !w-0 !border-0 !bg-transparent"
      />
      {/* Incoming child edge — top. */}
      <Handle
        id="top"
        type="target"
        position={Position.Top}
        className="!h-0 !w-0 !border-0 !bg-transparent"
      />

      <Avatar person={person} />

      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-900" title={displayName}>
          {displayName || '—'}
        </div>
        {years && <div className="text-xs text-slate-500">{years}</div>}
        {person.birth_place && (
          <div className="truncate text-[11px] text-slate-400" title={person.birth_place}>
            {person.birth_place}
          </div>
        )}
      </div>

      {/* Outgoing spouse edge — right side. */}
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        className="!h-0 !w-0 !border-0 !bg-transparent"
      />
      {/* Outgoing child edge — bottom (only meaningful when this node acts as a union parent, which persons don't, but kept for symmetry/placeholders). */}
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        className="!h-0 !w-0 !border-0 !bg-transparent"
      />
    </div>
  );
}

function Avatar({ person }: { person: PersonNodeData['person'] }) {
  const initials = (person.first_name_he?.[0] ?? person.first_name[0] ?? '?').toUpperCase();
  if (person.profile_image) {
    return (
      // Profile image path is a Supabase Storage key — callers should have
      // it resolved to a public URL before passing it in via data.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={person.profile_image}
        alt=""
        className="h-12 w-12 flex-shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-medium text-slate-500">
      {initials}
    </div>
  );
}

function formatYear(d: Date | string | null): string | null {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return String(date.getFullYear());
}

export const PersonCardNode = memo(PersonCardNodeInner);
