import { getPersonProfileImageUrl } from '@/lib/images/get-person-profile-image-url';
import {
  posterTierMetrics,
  type PosterTierKey,
} from '@/features/family-tree/lib/poster-tier-metrics';
import type { PersonRow } from '@/features/family-tree/lib/types';

import cardStyles from './poster-person-card.module.css';

function displayName(person: PersonRow): string {
  return [person.first_name_he ?? person.first_name, person.last_name_he ?? person.last_name]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(' ');
}

function formatYear(d: Date | string | null): string | null {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  return String(date.getFullYear());
}

function gregorianYears(person: PersonRow): string {
  const birth = formatYear(person.birth_date);
  const death = person.is_deceased ? formatYear(person.death_date) : null;
  if (person.is_deceased) {
    return birth && death ? `${birth} – ${death}` : (birth ?? '');
  }
  return birth ? `${birth} –` : '';
}

function hebrewYears(person: PersonRow): string {
  const birthHe = person.birth_year_hebrew ?? null;
  const deathHe = person.is_deceased ? (person.death_year_hebrew ?? null) : null;
  if (!birthHe) return '';
  if (person.is_deceased) {
    return deathHe ? `${birthHe} – ${deathHe}` : birthHe;
  }
  return `${birthHe} –`;
}

function BioBlock({
  relationshipLabel,
  bioParagraphs,
  tier,
  accentColor,
}: {
  relationshipLabel?: string;
  bioParagraphs: string[];
  tier: PosterTierKey;
  accentColor: string;
}) {
  const bioClass =
    tier === 'primary'
      ? cardStyles.bioPrimary
      : tier === 'secondary'
        ? cardStyles.bioSecondary
        : cardStyles.bioCompact;

  return (
    <div className={`${cardStyles.bioBlock} ${bioClass}`}>
      {relationshipLabel ? (
        <div className={cardStyles.bioRel} style={{ color: accentColor }}>
          {relationshipLabel}
        </div>
      ) : null}
      {bioParagraphs.map((para, i) => (
        <p key={i} className={cardStyles.bioPara}>
          {para}
        </p>
      ))}
    </div>
  );
}

export function PosterPersonCard({
  person,
  tier,
  accentColor,
  relationshipLabel,
  bioParagraphs = [],
}: {
  person: PersonRow;
  tier: PosterTierKey;
  accentColor: string;
  relationshipLabel?: string;
  bioParagraphs?: string[];
}) {
  const metrics = posterTierMetrics(tier);
  const name = displayName(person);
  const showDates = tier !== 'compact';
  const years = showDates ? gregorianYears(person) : '';
  const heYears = showDates ? hebrewYears(person) : '';
  const src = getPersonProfileImageUrl(person);
  const hasBio = bioParagraphs.length > 0;
  const isPrimary = tier === 'primary';

  const nameClass = isPrimary
    ? cardStyles.namePrimary
    : tier === 'secondary'
      ? cardStyles.nameSecondary
      : cardStyles.nameCompact;

  const avatar = (
    <div className={cardStyles.avatarWrap} style={{ width: metrics.avatarSize, height: metrics.avatarSize }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={name}
        className={cardStyles.avatarImg}
        style={{
          width: metrics.avatarSize,
          height: metrics.avatarSize,
          borderColor: isPrimary ? accentColor : 'rgba(148, 163, 184, 0.85)',
        }}
      />
      {person.is_deceased && (
        <span
          aria-label="deceased"
          className={cardStyles.deceasedDot}
          style={{ backgroundColor: '#f4a259' }}
        />
      )}
    </div>
  );

  if (metrics.layout === 'sideBio') {
    return (
      <div
        className={`${cardStyles.card} ${cardStyles.cardSideBio}`}
        style={{ width: metrics.width }}
      >
        <div className={cardStyles.sideBioRow}>
          {avatar}
          <div className={cardStyles.sideBioMain}>
            <div className={nameClass}>{name || '—'}</div>
            {years ? <div className={cardStyles.yearsGreg}>{years}</div> : null}
            {heYears ? (
              <div dir="rtl" className={cardStyles.yearsHe}>
                {heYears}
              </div>
            ) : null}
            {hasBio && (
              <BioBlock
                relationshipLabel={relationshipLabel}
                bioParagraphs={bioParagraphs}
                tier={tier}
                accentColor={accentColor}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`${cardStyles.card} ${cardStyles.cardColumn}`}
      style={{ width: metrics.width }}
    >
      {avatar}
      <div className={cardStyles.columnMeta}>
        <div className={nameClass}>{name || '—'}</div>
        {years ? <div className={cardStyles.yearsGreg}>{years}</div> : null}
        {heYears ? (
          <div dir="rtl" className={cardStyles.yearsHe}>
            {heYears}
          </div>
        ) : null}
      </div>
      {hasBio && (
        <BioBlock
          relationshipLabel={relationshipLabel}
          bioParagraphs={bioParagraphs}
          tier={tier}
          accentColor={accentColor}
        />
      )}
    </div>
  );
}
