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

// Vertical space between generations (top-of-row to top-of-next-row).
// Must be > PERSON_NODE_HEIGHT (212) to prevent generation rows from overlapping.
// 332 = 212 (card height) + 120 (extra vertical breathing room).
export const GEN_HEIGHT = 332;

// Horizontal gap ELK leaves between nodes in the same layer (minimum).
export const NODE_GAP = 80;

// Minimum spacing between edges and nearby nodes in ELK routing.
export const EDGE_NODE_GAP = 40;
