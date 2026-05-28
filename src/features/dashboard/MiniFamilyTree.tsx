'use client';

import { useMemo, useState } from 'react';
import type { DashboardPerson } from './types';
import { BOX_RX, computeMiniTreeLayout } from './utils/computeMiniTreeLayout';

interface MiniFamilyTreeProps {
  person: DashboardPerson;
  onSelectPerson: (id: string) => void;
}

export function MiniFamilyTree({
  person,
  onSelectPerson,
}: MiniFamilyTreeProps) {
  const layout = useMemo(() => computeMiniTreeLayout(person), [person]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className="h-[120px] w-full overflow-hidden sm:h-[130px]">
      <svg
        width="100%"
        height="100%"
        viewBox={layout.viewBox}
        preserveAspectRatio="xMidYMid meet"
        className="block h-full max-h-full w-full"
        role="img"
        aria-label={person.displayName}
      >
        {layout.segments.map((seg, i) => (
          <line
            key={`seg-${i}`}
            x1={seg.x1}
            y1={seg.y1}
            x2={seg.x2}
            y2={seg.y2}
            stroke="#94a3b8"
            strokeWidth={1.5}
            strokeDasharray={seg.dashed ? '4 4' : undefined}
          />
        ))}
        {layout.circles.map((c, i) => (
          <circle
            key={`circle-${i}`}
            cx={c.cx}
            cy={c.cy}
            r={c.r}
            fill="#10b981"
          />
        ))}
        {layout.boxes.map((box) => {
          const isHovered = hoveredId === box.id;
          const label = box.label;

          return (
            <g
              key={box.id}
              onMouseEnter={() => box.clickable && setHoveredId(box.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => {
                if (box.clickable) onSelectPerson(box.id);
              }}
              style={{ cursor: box.clickable ? 'pointer' : 'default' }}
            >
              <rect
                x={box.x}
                y={box.y}
                width={box.width}
                height={box.height}
                rx={BOX_RX}
                fill={
                  box.isCurrent
                    ? '#ecfdf5'
                    : isHovered
                      ? '#f1f5f9'
                      : '#ffffff'
                }
                stroke={
                  box.isCurrent
                    ? '#10b981'
                    : box.isAdoptive
                      ? '#94a3b8'
                      : '#e2e8f0'
                }
                strokeWidth={box.isCurrent ? 2 : 1}
                strokeDasharray={box.isAdoptive ? '4 3' : undefined}
              />
              <text
                x={box.x + box.width / 2}
                y={box.y + box.height / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={11}
                fill={box.isCurrent ? '#065f46' : '#334155'}
                fontWeight={box.isCurrent ? 600 : 400}
                style={{ pointerEvents: 'none' }}
              >
                {truncateLabel(label, box.width)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function truncateLabel(label: string, maxWidth: number): string {
  const maxChars = Math.floor(maxWidth / 7);
  if (label.length <= maxChars) return label;
  return `${label.slice(0, Math.max(1, maxChars - 1))}…`;
}
