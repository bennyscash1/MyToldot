// Shared types for the family-tree PDF poster export.
//
// AI does decoration + planning only; our own code renders all content. These
// types describe (a) the style variant registry, (b) the AI layout plan
// contract, and (c) the compact tree summary fed to the planner.

/**
 * Everything that defines a visual design variant for the poster. v1 ships a
 * single token (`parchment-classic`); adding variants later = adding registry
 * entries, with no change to the renderer.
 */
export interface StyleToken {
  id: string;
  /** Shown to the user in the (future) style picker. */
  labelHe: string;
  /** Page background colour, e.g. "#f4f3e9". */
  backgroundColor: string;
  fontHeading: string;
  fontBody: string;
  /** Connector lines, dividers, focal accents. */
  accentColor: string;
  /** Curved tree connectors; defaults to accentColor. */
  connectorColor?: string;
  cardStyle: 'framed' | 'minimal' | 'soft';
}

/** Visual hierarchy tier — maps to card size in the renderer. */
export type TreeTier = 'primary' | 'secondary' | 'compact';

/**
 * Strict JSON contract returned by the Gemini Pro planner (or synthesised by
 * the deterministic fallback). `notes` is rationale only and is ignored by the
 * renderer.
 */
export interface TreeLayoutPlan {
  styleId: string;
  tiers: {
    primary: string[];
    secondary: string[];
    compact: string[];
  };
  notes?: string;
}

/** Relationship of a person to the family head, used by the planner. */
export type RelationToHead = 'head' | 'spouse' | 'ancestor' | 'descendant' | 'other';

/** One compact per-person row sent to the planner. */
export interface TreeSummaryPerson {
  id: string;
  /** Hebrew-preferred full name. */
  name: string;
  /** Generation relative to head (0 = head row, negative = ancestors). */
  gen: number;
  relToHead: RelationToHead;
  hasBio: boolean;
  hasPhoto: boolean;
}

/** Compact tree summary — the only family data the AI planner ever sees. */
export interface TreeSummary {
  headId: string | null;
  familySize: number;
  persons: TreeSummaryPerson[];
}

/**
 * Input to the delivery-agnostic core renderer. `generateTreePdf` returns a
 * Buffer and knows nothing about HTTP delivery, Storage, or webhooks.
 * `baseUrl`/`locale`/`shortCode` describe *where/how* to render the print
 * route — they are rendering inputs, not delivery concerns.
 */
export interface GenerateTreePdfArgs {
  treeId: string;
  shortCode: string;
  locale: string;
  /** Full variant id passed to /print and Puppeteer. */
  styleId: string;
  plan: TreeLayoutPlan;
  /** Origin used to navigate the headless browser to the print route. */
  baseUrl: string;
}

/** Poster-edition narrative cached per epoch. */
export interface PosterBioCopy {
  introParagraphs: string[];
  /** @deprecated Use personBios — kept for backward-compatible cache reads. */
  headBioParagraphs: string[];
  personBios: Record<string, string[]>;
  usedAiCopy: boolean;
}
