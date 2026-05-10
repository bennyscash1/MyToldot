'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import clsx from 'clsx';

import { DEFAULT_PERSON_IMAGE_SRC } from '@/lib/images/default-person';
import { profileImagePublicUrl } from '@/lib/supabase/public-url';
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
    birth && death ? `${birth} – ${death}` : birth ? `${birth} –` : death ? `– ${death}` : '';

  const active = Boolean(is_focal || selected);

  return (
    <div
      style={{ width: PERSON_NODE_WIDTH, height: PERSON_NODE_HEIGHT }}
      className={clsx(
        'relative flex flex-col overflow-hidden rounded-xl border bg-white shadow-md transition',
        'hover:shadow-lg',
        active
          ? 'border-[2px] border-[#3e5045] bg-[#f4f3e9]'
          : 'border border-slate-200/90',
      )}
    >
      {/* Outgoing spouse edge — left side, for when this card is to the RIGHT of the union node. */}
      <Handle
        id="left"
        type="source"
        position={Position.Left}
        className="!h-0 !w-0 !border-0 !bg-transparent"
      />
      {/* Incoming child edge — top centre. */}
      <Handle
        id="top"
        type="target"
        position={Position.Top}
        className="!h-0 !w-0 !border-0 !bg-transparent"
      />

      <Avatar person={person} />

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-2 pb-2 pt-1 text-center">
        <div className="line-clamp-2 w-full text-sm font-bold leading-tight text-slate-900" title={displayName}>
          {displayName || '—'}
        </div>
        {years ? <div className="mt-0.5 text-xs text-slate-500">{years}</div> : null}
      </div>

      {/* Outgoing spouse edge — right side. */}
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        className="!h-0 !w-0 !border-0 !bg-transparent"
      />
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
  const uploaded =
    profileImagePublicUrl(person.profile_image) ?? person.profile_image?.trim() ?? null;
  const src = uploaded || DEFAULT_PERSON_IMAGE_SRC;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="h-[132px] w-full flex-shrink-0 rounded-t-[10px] object-cover object-top bg-slate-100"
    />
  );
}

function formatYear(d: Date | string | null): string | null {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return String(date.getFullYear());
}

export const PersonCardNode = memo(PersonCardNodeInner);
