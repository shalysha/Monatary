/**
 * theme.ts — Monatary Design System
 * Botanical / Organic Serif — adapted for React Native + Expo
 */

import { StyleSheet, Platform } from "react-native";

// ─── Color Tokens ────────────────────────────────────────────────────────────

export const COLORS = {
  // Surfaces
  background:        "#F9F8F4", // Warm Alabaster / Rice Paper
  surface:           "#FFFFFF",
  surfaceSecondary:  "#F2F0EB", // Soft Clay — card backgrounds, secondary fills
  surfaceTertiary:   "#EAE6DE", // Slightly deeper for nested surfaces

  // Typography
  textPrimary:   "#2D3A31", // Deep Forest Green — softer than black
  textSecondary: "#7A8478", // Muted sage — secondary labels
  textTertiary:  "#A8AFA5", // Subtle — captions, placeholders

  // Brand / Interactive
  primary:     "#8C9A84", // Sage Green — buttons, icons, highlights
  interactive: "#C27B66", // Terracotta — hover states, CTAs, alerts

  // Financial semantic tokens (domain-specific — preserved from original)
  positive: "#5C8065", // Income / gains
  negative: "#C26D5C", // Expenses / deficits
  warning:  "#D69F4C", // Caution

  // Structure
  border:       "#E6E2DA", // Stone — delicate, low-contrast
  borderStrong: "#D4CFC6", // For focused inputs

  // Account palette (unchanged — domain colour-coding)
  accounts: {
    savings:         "#5C8065",
    fixed_expenses:  "#8D9489",
    variable:        "#D69F4C",
    general:         "#9A8C73",
    his:             "#4A7485",
    hers:            "#A86B7E",
  } as Record<string, string>,

  // Card palette
  cards: {
    amex: "#4A7485",
    mc:   "#C86A4C",
    visa: "#2B3A4A",
  } as Record<string, string>,
};

// ─── Typography Tokens ────────────────────────────────────────────────────────
// Install in your project:
//   npx expo install @expo-google-fonts/playfair-display @expo-google-fonts/source-sans-3
//
// Then in _layout.tsx import:
//   PlayfairDisplay_700Bold, PlayfairDisplay_600SemiBold, PlayfairDisplay_700Bold_Italic
//   SourceSans3_400Regular, SourceSans3_500Medium, SourceSans3_700Bold

export const FONTS = {
  // Display / headings — Playfair Display (transitional serif, high contrast)
  heading:       "PlayfairDisplay_700Bold",
  headingMed:    "PlayfairDisplay_600SemiBold",
  headingItalic: "PlayfairDisplay_700Bold_Italic", // for italic emphasis in headlines

  // Body / UI — Source Sans 3 (humanist sans, pairs beautifully with Playfair)
  body:     "SourceSans3_400Regular",
  bodyMed:  "SourceSans3_500Medium",
  bodyBold: "SourceSans3_700Bold",
};

// ─── Spacing Scale ────────────────────────────────────────────────────────────

export const SPACING = {
  xs:   4,
  sm:   8,
  md:   12,
  base: 16,
  lg:   20,
  xl:   24,
  "2xl": 32,
  "3xl": 48,
  "4xl": 64,
};

// ─── Border Radius Scale ──────────────────────────────────────────────────────

export const RADIUS = {
  sm:   8,   // Small UI chips
  md:   16,  // Inputs, tags
  lg:   24,  // Cards — rounded-3xl equivalent
  xl:   32,  // Large cards
  full: 999, // Pill buttons, dots
};

// ─── Shadow Scale ─────────────────────────────────────────────────────────────
// Soft, diffused — no harsh dark drops

export const SHADOWS = {
  sm: {
    shadowColor:   "#2D3A31",
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius:  6,
    elevation:     1,
  },
  md: {
    shadowColor:   "#2D3A31",
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius:  12,
    elevation:     2,
  },
  lg: {
    shadowColor:   "#2D3A31",
    shadowOffset:  { width: 0, height: 8 },
    shadowOpacity: 0.07,
    shadowRadius:  24,
    elevation:     4,
  },
  xl: {
    shadowColor:   "#2D3A31",
    shadowOffset:  { width: 0, height: 16 },
    shadowOpacity: 0.10,
    shadowRadius:  40,
    elevation:     8,
  },
};

// ─── Typography Scale ─────────────────────────────────────────────────────────

export const TYPE = {
  display: { fontFamily: FONTS.heading,       fontSize: 42, letterSpacing: -1.2, lineHeight: 50 },
  h1:      { fontFamily: FONTS.heading,       fontSize: 32, letterSpacing: -0.8, lineHeight: 40 },
  h2:      { fontFamily: FONTS.headingMed,    fontSize: 24, letterSpacing: -0.4, lineHeight: 32 },
  h3:      { fontFamily: FONTS.headingMed,    fontSize: 18, letterSpacing: -0.2, lineHeight: 26 },
  body:    { fontFamily: FONTS.body,          fontSize: 15, letterSpacing: 0,    lineHeight: 22 },
  bodyMed: { fontFamily: FONTS.bodyMed,       fontSize: 15, letterSpacing: 0,    lineHeight: 22 },
  small:   { fontFamily: FONTS.body,          fontSize: 13, letterSpacing: 0,    lineHeight: 19 },
  label:   { fontFamily: FONTS.bodyBold,      fontSize: 11, letterSpacing: 1.8,  lineHeight: 16,
             textTransform: "uppercase" as const },
  caption: { fontFamily: FONTS.body,          fontSize: 11, letterSpacing: 0.3,  lineHeight: 15 },
};

// ─── Utility Formatters ───────────────────────────────────────────────────────

export const formatCAD = (n: number) => {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return `${sign}$${abs.toLocaleString("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

// ─── Domain Labels ────────────────────────────────────────────────────────────

export const ACCOUNT_LABELS: Record<string, string> = {
  fixed_expenses: "Fixed Expenses",
  variable:       "Variable",
  general:        "Spending",
  his:            "His Spending",
  hers:           "Hers Spending",
  savings:        "Savings",
};

export const CARD_LABELS: Record<string, string> = {
  amex: "Amex",
  mc:   "Mastercard",
  visa: "Visa",
};

// ─── Global StyleSheet ────────────────────────────────────────────────────────
// These are the "utility" styles used across screens.
// Prefer using COLORS / SHADOWS / RADIUS / TYPE tokens directly in components
// for one-off values rather than reaching for inline styles.

export const styles = StyleSheet.create({
  // Layout
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    padding: SPACING.lg,
    paddingBottom: 120,
  },

  // Typography
  display: {
    ...TYPE.display,
    color: COLORS.textPrimary,
  },
  h1: {
    ...TYPE.h1,
    color: COLORS.textPrimary,
  },
  h2: {
    ...TYPE.h2,
    color: COLORS.textPrimary,
  },
  h3: {
    ...TYPE.h3,
    color: COLORS.textPrimary,
  },
  body: {
    ...TYPE.body,
    color: COLORS.textPrimary,
  },
  bodyMed: {
    ...TYPE.bodyMed,
    color: COLORS.textPrimary,
  },
  small: {
    ...TYPE.small,
    color: COLORS.textSecondary,
  },
  label: {
    ...TYPE.label,
    color: COLORS.textSecondary,
  },
  caption: {
    ...TYPE.caption,
    color: COLORS.textTertiary,
  },

  // Card — the primary surface container
  card: {
    backgroundColor: COLORS.surface,
    borderColor:     COLORS.border,
    borderWidth:     1,
    borderRadius:    RADIUS.lg,
    padding:         SPACING.xl,
    ...SHADOWS.md,
  },

  // Card variant — muted clay surface (for secondary cards)
  cardMuted: {
    backgroundColor: COLORS.surfaceSecondary,
    borderColor:     COLORS.border,
    borderWidth:     1,
    borderRadius:    RADIUS.lg,
    padding:         SPACING.xl,
    ...SHADOWS.sm,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
  },

  // Row layout helper
  row: {
    flexDirection:  "row",
    alignItems:     "center",
  },

  // Section spacing
  section: {
    marginBottom: SPACING["2xl"],
  },
});

// ─── Button Presets ───────────────────────────────────────────────────────────
// Use these in TouchableOpacity / Pressable components.

export const BUTTON_STYLES = StyleSheet.create({
  // Primary — Deep Forest Green pill
  primary: {
    backgroundColor:  COLORS.textPrimary,
    borderRadius:     RADIUS.full,
    paddingVertical:  14,
    paddingHorizontal: SPACING["2xl"],
    flexDirection:    "row" as const,
    alignItems:       "center" as const,
    justifyContent:   "center" as const,
    gap:              8,
    minHeight:        48,
  },
  primaryText: {
    fontFamily:    FONTS.bodyBold,
    fontSize:      13,
    color:         "#FFFFFF",
    letterSpacing: 1.2,
    textTransform: "uppercase" as const,
  },

  // Accent — Sage Green pill
  accent: {
    backgroundColor:  COLORS.primary,
    borderRadius:     RADIUS.full,
    paddingVertical:  14,
    paddingHorizontal: SPACING["2xl"],
    flexDirection:    "row" as const,
    alignItems:       "center" as const,
    justifyContent:   "center" as const,
    gap:              8,
    minHeight:        48,
  },
  accentText: {
    fontFamily:    FONTS.bodyBold,
    fontSize:      13,
    color:         "#FFFFFF",
    letterSpacing: 1.2,
    textTransform: "uppercase" as const,
  },

  // Secondary — outlined, Sage border
  secondary: {
    backgroundColor:  "transparent",
    borderColor:      COLORS.primary,
    borderWidth:      1,
    borderRadius:     RADIUS.full,
    paddingVertical:  13,
    paddingHorizontal: SPACING["2xl"],
    flexDirection:    "row" as const,
    alignItems:       "center" as const,
    justifyContent:   "center" as const,
    gap:              8,
    minHeight:        48,
  },
  secondaryText: {
    fontFamily:    FONTS.bodyBold,
    fontSize:      13,
    color:         COLORS.primary,
    letterSpacing: 1.2,
    textTransform: "uppercase" as const,
  },

  // Ghost — for inline actions
  ghost: {
    backgroundColor:  "transparent",
    borderRadius:     RADIUS.full,
    paddingVertical:  10,
    paddingHorizontal: SPACING.base,
    flexDirection:    "row" as const,
    alignItems:       "center" as const,
    justifyContent:   "center" as const,
    gap:              6,
    minHeight:        44,
  },
  ghostText: {
    fontFamily:    FONTS.bodyMed,
    fontSize:      14,
    color:         COLORS.primary,
    letterSpacing: 0.3,
  },
});
