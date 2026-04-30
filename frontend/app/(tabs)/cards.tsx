import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { api, Dashboard } from "../../api";
import {
  COLORS, FONTS, RADIUS, SPACING, TYPE,
  formatCAD, ACCOUNT_LABELS, CARD_LABELS,
  styles as g,
} from "../../theme";
import { Heading, Label, BodyText, Button, ColorDot } from "../../components/ui";

// ─── Card tile (coloured header + breakdown panel fused together) ─────────────
// The original split this into two sibling <View>s sharing a border with
// mismatched radii. Here they're one unified component with a clean seam.

function CardPayoffTile({
  cardKey,
  color,
  balance,
  breakdown,
  onPayoff,
}: {
  cardKey: string;
  color:   string;
  balance: number;
  breakdown: Record<string, number>;
  onPayoff: () => void;
}) {
  const entries   = Object.entries(breakdown);
  const hasCharges = entries.length > 0;

  return (
    <View style={s.tile} testID={`card-detail-${cardKey}`}>
      {/* ── Coloured header ─────────────────────────────────────── */}
      <View style={[s.tileHeader, { backgroundColor: color }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.cardNameLabel}>{CARD_LABELS[cardKey]}</Text>
          <Text style={s.cardBalance}>{formatCAD(balance)}</Text>
          <Text style={s.cardSubLabel}>Outstanding to clear</Text>
        </View>
        <Feather name="credit-card" color="rgba(255,255,255,0.75)" size={26} />
      </View>

      {/* ── Breakdown panel ─────────────────────────────────────── */}
      <View style={s.tileBody}>
        <Label style={{ marginBottom: SPACING.md }}>Transfer Breakdown</Label>

        {!hasCharges && (
          <BodyText secondary style={{ fontSize: 13 }}>
            No outstanding charges allocated
          </BodyText>
        )}

        {entries.map(([accountKey, amount]) => (
          <View key={accountKey} style={s.breakdownRow}>
            <View style={s.breakdownLeft}>
              <ColorDot
                color={COLORS.accounts[accountKey] || COLORS.textSecondary}
                size={8}
              />
              <Text style={s.breakdownAccount}>{ACCOUNT_LABELS[accountKey]}</Text>
            </View>
            <Text style={s.breakdownAmount}>{formatCAD(amount)}</Text>
          </View>
        ))}

        <Button
          testID={`payoff-${cardKey}`}
          label={hasCharges ? `Pay Off ${CARD_LABELS[cardKey]}` : "Nothing to pay"}
          variant={hasCharges ? "primary" : "secondary"}
          disabled={!hasCharges}
          onPress={onPayoff}
          style={{ marginTop: SPACING.md }}
        />
      </View>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function CardsScreen() {
  const [data,       setData]       = useState<Dashboard | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try { setData(await api.dashboard()); }
    catch (e) { console.warn(e); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const payoff = (cardKey: string) => {
    const name = CARD_LABELS[cardKey];
    Alert.alert(
      `Pay off ${name}?`,
      "This will deduct the projected transfer amounts from each bank account and clear the card balance.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Pay Off",
          onPress: async () => {
            try { await api.payoffCard(cardKey); load(); }
            catch (e: any) { Alert.alert("Error", e.message || "Failed"); }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={g.screen} edges={["top"]}>
      {/* Header */}
      <View style={s.pageHeader}>
        <Label style={{ marginBottom: 4 }}>Credit Cards</Label>
        <Heading level={1}>Payoff Plan</Heading>
        <BodyText secondary style={{ marginTop: 4 }}>
          End-of-month transfers from each bank account
        </BodyText>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        testID="cards-scroll"
      >
        {data?.cards.map((c) => (
          <CardPayoffTile
            key={c.key}
            cardKey={c.key}
            color={c.color}
            balance={c.balance}
            breakdown={c.breakdown || {}}
            onPayoff={() => payoff(c.key)}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  pageHeader: {
    paddingHorizontal: SPACING.lg,
    paddingTop:        SPACING.md,
    paddingBottom:     SPACING.base,
  },
  scroll: {
    padding:       SPACING.lg,
    paddingBottom: 120,
  },

  // Tile — fused card header + breakdown panel
  tile: {
    marginBottom:  SPACING.lg,
    borderRadius:  RADIUS.lg,
    overflow:      "hidden",
    // Soft shadow on the whole tile
    shadowColor:   "#2D3A31",
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius:  16,
    elevation:     3,
  },
  tileHeader: {
    flexDirection: "row",
    alignItems:    "flex-start",
    padding:       SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  tileBody: {
    backgroundColor: COLORS.surface,
    borderTopWidth:  0,
    padding:         SPACING.xl,
  },

  // Card header text
  cardNameLabel: {
    ...TYPE.label,
    color: "rgba(255,255,255,0.65)",
  },
  cardBalance: {
    fontFamily:    FONTS.heading,
    fontSize:      34,
    color:         "#fff",
    letterSpacing: -0.8,
    marginTop:     SPACING.sm,
  },
  cardSubLabel: {
    fontFamily: FONTS.body,
    fontSize:   12,
    color:      "rgba(255,255,255,0.65)",
    marginTop:  4,
  },

  // Breakdown rows
  breakdownRow: {
    flexDirection:     "row",
    justifyContent:    "space-between",
    alignItems:        "center",
    paddingVertical:   SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  breakdownLeft: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           SPACING.sm,
    flex:          1,
  },
  breakdownAccount: {
    fontFamily: FONTS.bodyMed,
    fontSize:   14,
    color:      COLORS.textPrimary,
  },
  breakdownAmount: {
    fontFamily: FONTS.bodyBold,
    fontSize:   14,
    color:      COLORS.textPrimary,
  },
});
