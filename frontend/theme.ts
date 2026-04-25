import { StyleSheet } from "react-native";

export const COLORS = {
  background: "#F7F5F0",
  surface: "#FFFFFF",
  surfaceSecondary: "#F0EBE1",
  textPrimary: "#232B25",
  textSecondary: "#757971",
  border: "#E5E0D8",
  positive: "#5C8065",
  negative: "#C26D5C",
  warning: "#D69F4C",
  accounts: {
    savings: "#5C8065",
    fixed_expenses: "#8D9489",
    variable: "#D69F4C",
    general: "#9A8C73",
  } as Record<string, string>,
  cards: {
    amex: "#4A7485",
    mc: "#C86A4C",
    visa: "#2B3A4A",
  } as Record<string, string>,
};

export const FONTS = {
  heading: "Outfit_700Bold",
  headingMed: "Outfit_600SemiBold",
  body: "Manrope_400Regular",
  bodyMed: "Manrope_500Medium",
  bodyBold: "Manrope_700Bold",
};

export const formatCAD = (n: number) => {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return `${sign}$${abs.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const ACCOUNT_LABELS: Record<string, string> = {
  fixed_expenses: "Fixed Expenses",
  variable: "Variable",
  general: "General",
  savings: "Savings",
};

export const CARD_LABELS: Record<string, string> = {
  amex: "Amex",
  mc: "Mastercard",
  visa: "Visa",
};

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 20, paddingBottom: 120 },
  h1: { fontFamily: FONTS.heading, fontSize: 30, color: COLORS.textPrimary, letterSpacing: -0.5 },
  h2: { fontFamily: FONTS.headingMed, fontSize: 22, color: COLORS.textPrimary, letterSpacing: -0.3 },
  h3: { fontFamily: FONTS.headingMed, fontSize: 18, color: COLORS.textPrimary },
  body: { fontFamily: FONTS.body, fontSize: 14, color: COLORS.textPrimary, lineHeight: 20 },
  label: {
    fontFamily: FONTS.bodyBold,
    fontSize: 11,
    color: COLORS.textSecondary,
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  card: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    shadowColor: "#232B25",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 1,
  },
});
