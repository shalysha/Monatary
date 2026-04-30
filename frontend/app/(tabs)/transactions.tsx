import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { api, Expense, Income } from "../../api";
import {
  COLORS, FONTS, RADIUS, SPACING, TYPE,
  formatCAD, ACCOUNT_LABELS, CARD_LABELS,
  styles as g,
} from "../../theme";
import { Card, Heading, Label, BodyText, ColorDot } from "../../components/ui";

type Tx =
  | (Expense & { _kind: "expense" })
  | (Income  & { _kind: "income"  });

type FilterType = "all" | "income" | "expense";

// ─── Transaction icon bubble ──────────────────────────────────────────────────

function TxIcon({ kind }: { kind: "expense" | "income" }) {
  const isExpense = kind === "expense";
  return (
    <View
      style={[
        s.txIcon,
        { backgroundColor: isExpense ? `${COLORS.negative}18` : `${COLORS.positive}18` },
      ]}
    >
      <Feather
        name={isExpense ? "arrow-up-right" : "arrow-down-left"}
        color={isExpense ? COLORS.negative : COLORS.positive}
        size={18}
      />
    </View>
  );
}

// ─── Filter pill ──────────────────────────────────────────────────────────────

function FilterPill({
  label,
  active,
  onPress,
  testID,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        s.filterPill,
        active
          ? { backgroundColor: COLORS.textPrimary, borderColor: COLORS.textPrimary }
          : { backgroundColor: "transparent", borderColor: COLORS.border },
      ]}
    >
      <Text style={[s.filterPillText, { color: active ? "#fff" : COLORS.textSecondary }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Paid badge ───────────────────────────────────────────────────────────────

function PaidBadge() {
  return (
    <View style={s.paidBadge}>
      <Text style={s.paidBadgeText}>PAID</Text>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function TransactionsScreen() {
  const [items,      setItems]      = useState<Tx[]>([]);
  const [filter,     setFilter]     = useState<FilterType>("all");
  const [showPaid,   setShowPaid]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [exps, incs] = await Promise.all([api.expenses(), api.incomes()]);
      const merged: Tx[] = [
        ...exps.map((e) => ({ ...e, _kind: "expense" as const })),
        ...incs.map((i) => ({ ...i, _kind: "income"  as const })),
      ].sort((a, b) => b.created_at.localeCompare(a.created_at));
      setItems(merged);
    } catch (e) { console.warn(e); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const filtered = items.filter((t) => {
    if (filter !== "all" && t._kind !== filter) return false;
    if (!showPaid && t._kind === "expense" && (t as any).paid) return false;
    return true;
  });

  const remove = (t: Tx) =>
    Alert.alert("Delete", "Remove this transaction?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          if (t._kind === "expense") await api.deleteExpense(t.id);
          else await api.deleteIncome(t.id);
          load();
        },
      },
    ]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={g.screen} edges={["top"]}>
      {/* Header */}
      <View style={s.pageHeader}>
        <Label style={{ marginBottom: 4 }}>Activity</Label>
        <Heading level={1}>Transactions</Heading>
      </View>

      {/* Filter pills */}
      <View style={s.filterRow}>
        {(["all", "income", "expense"] as const).map((f) => (
          <FilterPill
            key={f}
            testID={`filter-${f}`}
            label={f.charAt(0).toUpperCase() + f.slice(1)}
            active={filter === f}
            onPress={() => setFilter(f)}
          />
        ))}
      </View>

      {/* Paid history toggle */}
      <View style={s.toggleRow}>
        <TouchableOpacity
          testID="toggle-paid"
          onPress={() => setShowPaid(!showPaid)}
          activeOpacity={0.75}
          style={[s.paidToggle, showPaid && { backgroundColor: `${COLORS.positive}10` }]}
        >
          <Feather
            name={showPaid ? "eye" : "eye-off"}
            size={12}
            color={showPaid ? COLORS.positive : COLORS.textTertiary}
          />
          <Text style={[s.paidToggleText, showPaid && { color: COLORS.positive }]}>
            {showPaid ? "Showing paid history" : "Hiding paid history"}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={s.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        testID="transactions-list"
      >
        {/* Empty state */}
        {filtered.length === 0 && (
          <Card style={s.emptyState}>
            <Feather name="inbox" size={30} color={COLORS.textTertiary} />
            <BodyText secondary style={{ marginTop: SPACING.md }}>
              No transactions yet
            </BodyText>
          </Card>
        )}

        {/* Transaction rows */}
        {filtered.map((t) => (
          <TouchableOpacity
            key={`${t._kind}-${t.id}`}
            onLongPress={() => remove(t)}
            activeOpacity={0.78}
            testID={`tx-${t._kind}-${t.id}`}
          >
            <Card style={[s.txCard, { marginBottom: SPACING.sm }]}>
              {t._kind === "expense" ? (
                <ExpenseRow tx={t as Expense & { _kind: "expense" }} />
              ) : (
                <IncomeRow tx={t as Income & { _kind: "income" }} />
              )}
            </Card>
          </TouchableOpacity>
        ))}

        {filtered.length > 0 && (
          <Text style={s.hint}>Long-press to delete</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Expense row ──────────────────────────────────────────────────────────────

function ExpenseRow({ tx }: { tx: Expense & { _kind: "expense" } }) {
  const meta =
    tx.payment_method === "cash"
      ? `Cash · ${ACCOUNT_LABELS[tx.source_account || ""]}`
      : `${CARD_LABELS[tx.card || ""]} · pay from ${ACCOUNT_LABELS[tx.payoff_account || ""]}`;

  return (
    <View style={s.txRow}>
      <TxIcon kind="expense" />
      <View style={s.txBody}>
        <View style={s.txNameRow}>
          <Text style={s.txTitle}>{tx.description}</Text>
          {(tx as any).paid && <PaidBadge />}
        </View>
        <BodyText secondary small style={{ marginTop: 2 }}>
          {meta} · {tx.date}
        </BodyText>
      </View>
      <Text style={[s.txAmount, { color: COLORS.negative }]}>
        −{formatCAD(tx.amount)}
      </Text>
    </View>
  );
}

// ─── Income row ───────────────────────────────────────────────────────────────

function IncomeRow({ tx }: { tx: Income & { _kind: "income" } }) {
  return (
    <View style={s.txRow}>
      <TxIcon kind="income" />
      <View style={s.txBody}>
        <Text style={s.txTitle}>{tx.source}</Text>
        <BodyText secondary small style={{ marginTop: 2 }}>
          Income · {tx.date}
        </BodyText>
      </View>
      <Text style={[s.txAmount, { color: COLORS.positive }]}>
        +{formatCAD(tx.total)}
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  pageHeader: {
    paddingHorizontal: SPACING.lg,
    paddingTop:        SPACING.md,
    paddingBottom:     SPACING.sm,
  },
  filterRow: {
    flexDirection:   "row",
    paddingHorizontal: SPACING.lg,
    gap:             SPACING.sm,
    marginVertical:  SPACING.base,
  },
  filterPill: {
    flex:           1,
    paddingVertical: 10,
    borderRadius:   RADIUS.full,
    borderWidth:    1,
    alignItems:     "center",
    minHeight:      44,
    justifyContent: "center",
  },
  filterPillText: {
    fontFamily:    FONTS.bodyMed,
    fontSize:      13,
    letterSpacing: 0.3,
  },
  toggleRow: {
    paddingHorizontal: SPACING.lg,
    marginBottom:      SPACING.sm,
  },
  paidToggle: {
    flexDirection:   "row",
    alignItems:      "center",
    gap:             SPACING.sm,
    paddingVertical:  6,
    paddingHorizontal: SPACING.md,
    borderRadius:    RADIUS.full,
    borderWidth:     1,
    borderColor:     COLORS.border,
    alignSelf:       "flex-start",
  },
  paidToggleText: {
    fontFamily: FONTS.bodyMed,
    fontSize:   11,
    color:      COLORS.textTertiary,
    letterSpacing: 0.2,
  },
  list: {
    paddingHorizontal: SPACING.lg,
    paddingBottom:     120,
    paddingTop:        SPACING.xs,
  },
  emptyState: {
    alignItems:     "center",
    paddingVertical: 40,
    marginTop:       SPACING.base,
  },
  txCard: {
    padding: SPACING.md,
  },
  txRow: {
    flexDirection: "row",
    alignItems:    "center",
  },
  txIcon: {
    width:          40,
    height:         40,
    borderRadius:   RADIUS.full,
    alignItems:     "center",
    justifyContent: "center",
    marginRight:    SPACING.md,
    flexShrink:     0,
  },
  txBody: {
    flex: 1,
  },
  txNameRow: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           6,
    flexWrap:      "wrap",
  },
  txTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize:   15,
    color:      COLORS.textPrimary,
  },
  txAmount: {
    fontFamily:  FONTS.bodyBold,
    fontSize:    16,
    marginLeft:  SPACING.sm,
    flexShrink:  0,
  },
  paidBadge: {
    paddingHorizontal: 6,
    paddingVertical:   2,
    borderRadius:      RADIUS.full,
    backgroundColor:   `${COLORS.positive}18`,
  },
  paidBadgeText: {
    fontFamily:    FONTS.bodyBold,
    fontSize:      9,
    color:         COLORS.positive,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  hint: {
    textAlign:   "center",
    color:       COLORS.textTertiary,
    fontFamily:  FONTS.body,
    fontSize:    11,
    marginTop:   SPACING.base,
    letterSpacing: 0.3,
  },
});
