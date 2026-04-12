/**
 * Deterministic avatar background color based on user ID.
 * Colors from the mockup wireframe — varied, not all crimson.
 */
const AVATAR_COLORS = [
  "var(--primary)", // crimson (brand)
  "#2563eb", // blue
  "#7c3aed", // purple
  "#0891b2", // cyan
  "#059669", // emerald
  "#d97706", // amber
  "#dc2626", // red
  "#4f46e5", // indigo
];

export function avatarColor(userId: number): string {
  return AVATAR_COLORS[userId % AVATAR_COLORS.length];
}
