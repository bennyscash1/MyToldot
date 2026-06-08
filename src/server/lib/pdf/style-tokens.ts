import { parseVariantId } from './variants';
import type { StyleToken } from './types';

export const DEFAULT_STYLE_ID = 'heritage-sky';

export const STYLE_TOKENS: Record<string, StyleToken> = {
  'heritage-sky': {
    id: 'heritage-sky',
    labelHe: 'מורשת – קלף ושורשים',
    backgroundColor: '#f4f3e9',
    fontHeading: 'Frank Ruhl Libre',
    fontBody: 'Heebo',
    accentColor: '#059669',
    connectorColor: '#34d399',
    cardStyle: 'soft',
  },
  'parchment-classic': {
    id: 'parchment-classic',
    labelHe: 'קלאסי – קלף',
    backgroundColor: '#f4f3e9',
    fontHeading: 'Frank Ruhl Libre',
    fontBody: 'Heebo',
    accentColor: '#3e5045',
    cardStyle: 'framed',
  },
  'gold-royal': {
    id: 'gold-royal',
    labelHe: 'מלכותי – זהב',
    backgroundColor: '#f8f4e8',
    fontHeading: 'Frank Ruhl Libre',
    fontBody: 'Heebo',
    accentColor: '#8b6914',
    cardStyle: 'framed',
  },
  'olive-mediterranean': {
    id: 'olive-mediterranean',
    labelHe: 'ים-תיכוני – זית',
    backgroundColor: '#f2f0e4',
    fontHeading: 'Frank Ruhl Libre',
    fontBody: 'Heebo',
    accentColor: '#5c6b4a',
    cardStyle: 'soft',
  },
};

/** Resolve a base style token; accepts a full variant id or a base style id. */
export function getStyleToken(id: string | undefined | null): StyleToken {
  if (!id) return STYLE_TOKENS[DEFAULT_STYLE_ID];
  if (STYLE_TOKENS[id]) return STYLE_TOKENS[id];
  const parsed = parseVariantId(id);
  if (parsed && STYLE_TOKENS[parsed.baseStyleId]) return STYLE_TOKENS[parsed.baseStyleId];
  return STYLE_TOKENS[DEFAULT_STYLE_ID];
}

export function getBaseStyleId(id: string | undefined | null): string {
  if (!id) return DEFAULT_STYLE_ID;
  if (STYLE_TOKENS[id]) return id;
  const parsed = parseVariantId(id);
  return parsed?.baseStyleId ?? DEFAULT_STYLE_ID;
}
