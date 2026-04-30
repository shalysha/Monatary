/**
 * components/ui/index.tsx
 *
 * Botanical design system primitives for Monatary.
 * Import these instead of raw RN components to stay on-system.
 *
 * Usage:
 *   import { Card, Button, Heading, Label, SectionHeading, StatRow, AlertBanner } from "../components/ui";
 */

import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { COLORS, FONTS, RADIUS, SHADOWS, SPACING, TYPE, BUTTON_STYLES } from "../../theme";

// ─── Card ────────────────────────────────────────────────────────────────────

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  muted?: boolean;   // use surfaceSecondary background
  colored?: string;  // override background (e.g. for credit card tiles)
  testID?: string;
}

export function Card({ children, style, muted, colored, testID }: CardProps) {
  return (
    <View
      testID={testID}
      style={[
        styles.card,
        muted   && styles.cardMuted,
        colored && { backgroundColor: colored, borderWidth: 0 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ─── Button ──────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "accent" | "secondary" | "ghost";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: keyof typeof Feather.glyphMap;
  iconPosition?: "left" | "right";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  iconPosition = "left",
  loading,
  disabled,
  style,
  testID,
}: ButtonProps) {
  const containerStyle = BUTTON_STYLES[variant];
  const textStyle      = BUTTON_STYLES[`${variant}Text` as keyof typeof BUTTON_STYLES] as TextStyle;
  const iconColor      = variant === "secondary" ? COLORS.primary
                       : variant === "ghost"     ? COLORS.primary
                       : "#FFFFFF";

  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.78}
      style={[containerStyle, disabled && { opacity: 0.5 }, style]}
    >
      {loading ? (
        <ActivityIndicator color={iconColor} size="small" />
      ) : (
        <>
          {icon && iconPosition === "left" && (
            <Feather name={icon} color={iconColor} size={16} strokeWidth={1.5} />
          )}
          <Text style={textStyle}>{label}</Text>
          {icon && iconPosition === "right" && (
            <Feather name={icon} color={iconColor} size={16} strokeWidth={1.5} />
          )}
        </>
      )}
    </TouchableOpacity>
  );
}

// ─── Heading ─────────────────────────────────────────────────────────────────

interface HeadingProps {
  children: React.ReactNode;
  level?: 1 | 2 | 3 | "display";
  italic?: boolean;  // use PlayfairDisplay italic for emphasis
  color?: string;
  style?: TextStyle;
}

export function Heading({ children, level = 1, italic, color, style }: HeadingProps) {
  const base = level === "display" ? TYPE.display
             : level === 1        ? TYPE.h1
             : level === 2        ? TYPE.h2
             :                      TYPE.h3;

  const fontFamily = italic
    ? FONTS.headingItalic
    : level === "display" || level === 1
    ? FONTS.heading
    : FONTS.headingMed;

  return (
    <Text
      style={[
        base,
        { fontFamily, color: color ?? COLORS.textPrimary },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

// ─── Label ───────────────────────────────────────────────────────────────────
// Uppercase tracking label — for section headers, field labels, metadata.

interface LabelProps {
  children: React.ReactNode;
  color?: string;
  style?: TextStyle;
}

export function Label({ children, color, style }: LabelProps) {
  return (
    <Text
      style={[
        TYPE.label,
        { color: color ?? COLORS.textSecondary },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

// ─── BodyText ─────────────────────────────────────────────────────────────────

interface BodyTextProps {
  children: React.ReactNode;
  secondary?: boolean;
  small?: boolean;
  medium?: boolean;
  color?: string;
  style?: TextStyle;
}

export function BodyText({ children, secondary, small, medium, color, style }: BodyTextProps) {
  const base = small ? TYPE.small : TYPE.body;
  const fontFamily = medium ? FONTS.bodyMed : FONTS.body;
  const defaultColor = secondary ? COLORS.textSecondary : COLORS.textPrimary;

  return (
    <Text style={[base, { fontFamily, color: color ?? defaultColor }, style]}>
      {children}
    </Text>
  );
}

// ─── SectionHeading ───────────────────────────────────────────────────────────
// Combines a label + h2 for consistent section introductions.

interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  style?: ViewStyle;
}

export function SectionHeading({ title, subtitle, style }: SectionHeadingProps) {
  return (
    <View style={[{ marginBottom: SPACING.md }, style]}>
      {subtitle && <Label style={{ marginBottom: 6 }}>{subtitle}</Label>}
      <Heading level={2}>{title}</Heading>
    </View>
  );
}

// ─── StatRow ─────────────────────────────────────────────────────────────────
// Two-column stat layout inside a card.

interface StatRowProps {
  left:  { label: string; value: string; valueColor?: string };
  right: { label: string; value: string; valueColor?: string };
}

export function StatRow({ left, right }: StatRowProps) {
  return (
    <View style={styles.statRow}>
      <View style={{ flex: 1 }}>
        <Label>{left.label}</Label>
        <Text style={[styles.statValue, { color: left.valueColor ?? COLORS.textPrimary }]}>
          {left.value}
        </Text>
      </View>
      <View style={styles.statDivider} />
      <View style={{ flex: 1, paddingLeft: SPACING.base }}>
        <Label>{right.label}</Label>
        <Text style={[styles.statValue, { color: right.valueColor ?? COLORS.textPrimary }]}>
          {right.value}
        </Text>
      </View>
    </View>
  );
}

// ─── AlertBanner ─────────────────────────────────────────────────────────────

interface AlertBannerProps {
  message: string;
  variant?: "warning" | "error" | "info";
  style?: ViewStyle;
  testID?: string;
}

export function AlertBanner({ message, variant = "error", style, testID }: AlertBannerProps) {
  const color = variant === "error"   ? COLORS.negative
              : variant === "warning" ? COLORS.warning
              :                         COLORS.primary;

  const icon = variant === "error"   ? "alert-triangle"
             : variant === "warning" ? "alert-circle"
             :                         "info";

  return (
    <View
      testID={testID}
      style={[
        styles.alertBanner,
        {
          backgroundColor: `${color}18`,
          borderColor:     `${color}4D`,
        },
        style,
      ]}
    >
      <Feather name={icon} color={color} size={18} />
      <Text style={[styles.alertText, { color }]}>{message}</Text>
    </View>
  );
}

// ─── ProgressBar ─────────────────────────────────────────────────────────────

interface ProgressBarProps {
  percent: number;   // 0–100
  color:   string;
  style?:  ViewStyle;
}

export function ProgressBar({ percent, color, style }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, percent));
  const barColor = pct >= 100 ? COLORS.negative : color;
  return (
    <View style={[styles.progressTrack, style]}>
      <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
    </View>
  );
}

// ─── Divider ─────────────────────────────────────────────────────────────────

export function Divider({ style }: { style?: ViewStyle }) {
  return <View style={[styles.divider, style]} />;
}

// ─── ColorDot ────────────────────────────────────────────────────────────────

export function ColorDot({ color, size = 10 }: { color: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
      }}
    />
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderColor:     COLORS.border,
    borderWidth:     1,
    borderRadius:    RADIUS.lg,
    padding:         SPACING.xl,
    ...SHADOWS.md,
  },
  cardMuted: {
    backgroundColor: COLORS.surfaceSecondary,
    ...SHADOWS.sm,
  },
  statRow: {
    flexDirection:  "row",
    alignItems:     "flex-start",
    marginTop:      SPACING.md,
    gap:            SPACING.base,
  },
  statDivider: {
    width:           1,
    alignSelf:       "stretch",
    backgroundColor: COLORS.border,
  },
  statValue: {
    fontFamily: FONTS.bodyBold,
    fontSize:   16,
    marginTop:  4,
  },
  alertBanner: {
    borderWidth:    1,
    borderRadius:   RADIUS.md,
    padding:        SPACING.md,
    flexDirection:  "row",
    alignItems:     "center",
    gap:            SPACING.sm,
  },
  alertText: {
    flex:       1,
    fontFamily: FONTS.bodyMed,
    fontSize:   13,
    lineHeight: 18,
  },
  progressTrack: {
    height:       8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceSecondary,
    overflow:     "hidden",
  },
  progressFill: {
    height:       "100%",
    borderRadius: RADIUS.full,
  },
  divider: {
    height:          1,
    backgroundColor: COLORS.border,
  },
});