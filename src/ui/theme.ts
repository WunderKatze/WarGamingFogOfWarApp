/**
 * Shared visual constants for the UI layer.
 *
 * Keep ad-hoc inline colors and spacings constrained to one of these values
 * unless there's a reason to deviate. Adding a new feature with new colors?
 * Prefer extending this file over scattering hex codes in components.
 */
export const theme = {
  colors: {
    headerBg: "#222",
    headerText: "#eee",
    sidebarBg: "#f3efe6",
    sidebarBorder: "#ccc",
    mapBg: "#fff",
    mapBorder: "#444",
    surface: "#fff",
    subtleBorder: "#eee",
    primary: "#2b6cb0",
    secondary: "#888",
    firedRing: "#ff8a00",
    revealedRing: "#222",
    /** Position-dot color for friendly-affiliation units (NATO blue). */
    friendly: "#1f77ff",
    /** Position-dot color for hostile-affiliation units (NATO red). */
    hostile: "#cc3333",
    text: "#111",
    textMuted: "#555",
    transitionBg: "#222",
    transitionText: "#eee",
    transitionAccent: "#ffa64d",
    transitionAccentAlt: "#a0d8ff",
  },
  spacing: { xs: 2, sm: 4, md: 8, lg: 12, xl: 16, xxl: 24 },
  fontSize: { xs: 10, sm: 11, md: 12, base: 13, lg: 14, xl: 18, hero: 48 },
  radius: { sm: 3, md: 6 },

  /** Canvas scale: how many screen pixels represent one map inch at zoom = 1. */
  pixelsPerInch: 8,
} as const;
