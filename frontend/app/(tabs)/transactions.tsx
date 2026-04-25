import { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { api, Expense, Income } from "../../api";
import { COLORS, FONTS, formatCAD, ACCOUNT_LABELS, CARD_LABELS, styles as g } from "../../theme";

type Tx =
  | (Expense & { _kind: "expense" })
  | (Income & { _kind: "income" });

export default function TransactionsScreen() {
  const [items, setItems] = useState<Tx[]>([]);
  const [filter, setFilter] = useState<"all" | "income" | "expense">("all");
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const [exps, incs] = await Promise.all([api.expenses(), api.incomes()]);
      const merged: Tx[] = [
        ...exps.map((e) => ({ ...e, _kind: "expense" as const })),
        ...incs.map((i) => ({ ...i, _kind: "income" as const })),
      ].sort((a, b) => b.created_at.localeCompare(a.created_at));
      setItems(merged);
    } catch (e) {
      console.warn(e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filtered = items.filter((t) => filter === "all" || t._kind === filter);

  const remove = (t: Tx) => {
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
  };

  return (
    <SafeAreaView style={g.screen} edges={["top"]}>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
        <Text style={[g.label, { marginBottom: 4 }]}>Activity</Text>
        <Text style={g.h1}>Transactions</Text>
      </View>

      <View style={{ flexDirection: "row", paddingHorizontal: 20, gap: 8, marginVertical: 16 }}>
        {(["all", "income", "expense"] as const).map((f) => (
          <TouchableOpacity
            key={f}
            testID={`filter-${f}`}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: filter === f ? COLORS.textPrimary : COLORS.border,
              backgroundColor: filter === f ? COLORS.textPrimary : "transparent",
              alignItems: "center",
            }}
            onPress={() => setFilter(f)}
          >
            <Text
              style={{
                fontFamily: FONTS.bodyMed,
                fontSize: 13,
                color: filter === f ? "#fff" : COLORS.textPrimary,
                textTransform: "capitalize",
              }}
            >
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        testID="transactions-list"
      >
        {filtered.length === 0 && (
          <View style={[g.card, { alignItems: "center", paddingVertical: 40 }]}>
            <Feather name="inbox" size={32} color={COLORS.textSecondary} />
            <Text style={[g.body, { marginTop: 12, color: COLORS.textSecondary }]}>
              No transactions yet
            </Text>
          </View>
        )}
        {filtered.map((t) => (
          <TouchableOpacity
            key={`${t._kind}-${t.id}`}
            onLongPress={() => remove(t)}
            style={[g.card, { marginBottom: 10, padding: 14 }]}
            testID={`tx-${t._kind}-${t.id}`}
          >
            {t._kind === "expense" ? (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 999,
                    backgroundColor: "rgba(194,109,92,0.12)",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 12,
                  }}
                >
                  <Feather name="arrow-up-right" color={COLORS.negative} size={18} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: COLORS.textPrimary }}>
                    {t.description}
                  </Text>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>
                    {t.payment_method === "cash"
                      ? `Cash · ${ACCOUNT_LABELS[t.source_account || ""]}`
                      : `${CARD_LABELS[t.card || ""]} · pay from ${ACCOUNT_LABELS[t.payoff_account || ""]}`}
                    {" · "}
                    {t.date}
                  </Text>
                </View>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 16, color: COLORS.negative }}>
                  −{formatCAD(t.amount)}
                </Text>
              </View>
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 999,
                    backgroundColor: "rgba(92,128,101,0.12)",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 12,
                  }}
                >
                  <Feather name="arrow-down-left" color={COLORS.positive} size={18} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: COLORS.textPrimary }}>
                    {t.source}
                  </Text>
                  <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>
                    Income · {t.date}
                  </Text>
                </View>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 16, color: COLORS.positive }}>
                  +{formatCAD(t.total)}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
        <Text style={{ textAlign: "center", color: COLORS.textSecondary, fontFamily: FONTS.body, fontSize: 11, marginTop: 16 }}>
          Long-press an item to delete
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
