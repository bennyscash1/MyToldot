// Rendered node sizes — these MUST match the CSS box of the corresponding
// React component. ELK uses them to compute positions and route edges; any
// mismatch will make edges connect to empty space next to the node.
export const PERSON_NODE_WIDTH = 208;
export const PERSON_NODE_HEIGHT = 96;

// A small pill that sits between two spouses. Kept narrow so it visually
// reads as a connector, not a card.
export const UNION_NODE_WIDTH = 24;
export const UNION_NODE_HEIGHT = 12;

export const PLACEHOLDER_NODE_WIDTH = 168;
export const PLACEHOLDER_NODE_HEIGHT = 80;

// Vertical space between generations. Larger = airier tree, smaller = denser.
export const GEN_HEIGHT = 190;

// Horizontal gap ELK leaves between nodes in the same layer (minimum).
export const NODE_GAP = 48;
