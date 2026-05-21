// Rendered node sizes — these MUST match the CSS box of the corresponding
// React component. ELK uses them to compute positions and route edges; any
// mismatch will make edges connect to empty space next to the node.
// Vertical card: photo on top, name + years below (RTL tree UI).
export const PERSON_NODE_WIDTH = 168;
export const PERSON_NODE_HEIGHT = 212;

// A small pill that sits between two spouses. Kept narrow so it visually
// reads as a connector, not a card.
export const UNION_NODE_WIDTH = 24;
export const UNION_NODE_HEIGHT = 12;

// Y offset (from the top of a person card) at which spouse handles attach.
// Targets the vertical center of the 132px avatar so spouse lines visually
// connect at face level. The union pill in the same row must vertically
// center on this same Y, otherwise spouse edges render diagonally.
export const PERSON_SPOUSE_HANDLE_Y = 66;

// Vertical gap ELK uses between layers (hint; final Y uses GEN_HEIGHT below).
export const ELK_LAYER_SPACING = 192;

// Vertical space between generations (top-of-row to top-of-next-row).
// Must be > PERSON_NODE_HEIGHT (212) to prevent generation rows from overlapping.
export const GEN_HEIGHT = PERSON_NODE_HEIGHT + ELK_LAYER_SPACING;

// Horizontal gap ELK leaves between nodes in the same layer (siblings).
// Spouses stay tight via adjacency ordering + narrow union pill.
export const NODE_GAP = 128;

// Minimum spacing between edges and nearby nodes in ELK routing.
export const EDGE_NODE_GAP = 40;

/** Gap below the bottom of parent cards before the child sibling-bar (px). */
export const SIBLING_BAR_CLEAR_MARGIN = 16;
