import { posterTierMetrics } from '@/features/family-tree/lib/poster-tier-metrics';
import type { PersonRow } from '@/features/family-tree/lib/types';
import type { PosterTreeLayoutData } from '@/server/lib/pdf/poster-layout';
import type { StyleToken } from '@/server/lib/pdf/types';

import { PosterPersonCard } from './PosterPersonCard';
import { PosterUnionNode } from './PosterUnionNode';
import treeStyles from './poster-tree.module.css';

export function PosterTreeLayout({
  treeName,
  introParagraphs,
  styleToken,
  treeLayout,
  personById,
}: {
  treeName: string;
  introParagraphs: string[];
  styleToken: StyleToken;
  treeLayout: PosterTreeLayoutData;
  personById: Map<string, PersonRow>;
}) {
  const accent = styleToken.accentColor;
  const connector = styleToken.connectorColor ?? accent;
  const {
    contentWidth,
    canvasHeight,
    innerWidth,
    innerHeight,
    fitScale,
    offsetX,
    offsetY,
    subtitle,
    genLabels,
    persons,
    unions,
    edges,
  } = treeLayout;

  return (
    <div className={treeStyles.treeSection} style={{ fontFamily: `'${styleToken.fontBody}', sans-serif` }}>
      <header className={treeStyles.header}>
        <h1
          className={treeStyles.title}
          style={{ fontFamily: `'${styleToken.fontHeading}', serif`, color: accent }}
        >
          {treeName}
        </h1>
        {subtitle ? (
          <p className={treeStyles.subtitle} style={{ color: accent }}>
            {subtitle}
          </p>
        ) : null}
      </header>

      {introParagraphs.length > 0 && (
        <div className={treeStyles.intro} style={{ fontFamily: `'${styleToken.fontHeading}', serif` }}>
          {introParagraphs.map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      )}

      <div
        className={treeStyles.treeCanvasOuter}
        style={{ width: contentWidth, height: canvasHeight }}
      >
        <div
          className={treeStyles.treeCanvasInner}
          style={{
            width: innerWidth,
            height: innerHeight,
            transform: `translate(${offsetX}px, ${offsetY}px) scale(${fitScale})`,
          }}
        >
          <svg className={treeStyles.edgeLayer} width={innerWidth} height={innerHeight}>
            {edges.map((edge, i) => {
              const edgeClass =
                edge.kind === 'trunk'
                  ? treeStyles.edgeTrunk
                  : edge.kind === 'spouse'
                    ? treeStyles.edgeSpouse
                    : treeStyles.edgeChild;
              return (
                <path
                  key={`${edge.kind}-${i}`}
                  d={edge.d}
                  className={`${treeStyles.edgePath} ${edgeClass} ${
                    edge.isDivorced ? treeStyles.edgeDivorced : ''
                  }`}
                  stroke={edge.kind === 'trunk' ? undefined : connector}
                />
              );
            })}
          </svg>

          {genLabels.map((gl) => (
            <div
              key={gl.label}
              className={treeStyles.genBadge}
              style={{ left: gl.x, top: gl.y, borderColor: accent, color: accent }}
            >
              {gl.label}
            </div>
          ))}

          {unions.map((u) => (
            <PosterUnionNode
              key={u.id}
              x={u.x}
              y={u.y}
              width={u.width}
              height={u.height}
              visible={u.visible}
              isDivorced={u.isDivorced}
              connectorColor={connector}
            />
          ))}

          {persons.map((pn) => {
            const person = personById.get(pn.personId);
            if (!person) return null;
            const tierWidth = posterTierMetrics(pn.tier).width;
            return (
              <div
                key={pn.personId}
                className={treeStyles.personWrap}
                style={{ left: pn.x, top: pn.y, width: tierWidth }}
              >
                <PosterPersonCard
                  person={person}
                  tier={pn.tier}
                  accentColor={accent}
                  relationshipLabel={pn.relationshipLabel}
                  bioParagraphs={pn.bioParagraphs}
                />
              </div>
            );
          })}
        </div>
      </div>

      <footer className={treeStyles.footer} style={{ color: accent }}>
        MyToldot
      </footer>
    </div>
  );
}
