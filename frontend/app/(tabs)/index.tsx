import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api, Dashboard } from "../../api";
import { COLORS, FONTS, formatCAD, ACCOUNT_LABELS, CARD_LABELS, styles as g } from "../../theme";

export default function DashboardScreen() {
  const router = useRouter();
  const [data, setData] = useState<Dashboard | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const d = await api.dashboard();
      setData(d);
    } catch (e) {
      console.warn(e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  useEffect(() => {
    api.init().catch(() => {});
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (!data) {
    return (
      <SafeAreaView style={g.screen} edges={["top"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={COLORS.positive} />
        </View>
      </SafeAreaView>
    );
  }

  const { totals, accounts, cards } = data;
  const negativeAccount = accounts.find((a) => a.is_negative_projected);

  return (
    <SafeAreaView style={g.screen} edges={["top"]}>
      <ScrollView
        contentContainerStyle={g.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.positive} />}
        testID="dashboard-scroll"
      >
        {/* Header */}
        <View style={{ marginBottom: 24 }}>
          <Text style={[g.label, { marginBottom: 6 }]}>Zero-Based Budget · CAD</Text>
          <Text style={g.h1}>Hello there.</Text>
          <Text style={[g.body, { color: COLORS.textSecondary, marginTop: 4 }]}>
            {new Date().toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" })}
          </Text>
        </View>

        {/* Net Position card */}
        <View style={[g.card, { marginBottom: 16, padding: 22 }]} testID="net-position-card">
          <Text style={g.label}>Projected Net Position</Text>
          <Text
            style={{
              fontFamily: FONTS.heading,
              fontSize: 42,
              color: totals.total_projected < 0 ? COLORS.negative : COLORS.textPrimary,
              letterSpacing: -1.2,
              marginTop: 8,
            }}
            testID="net-projected"
          >
            {formatCAD(totals.total_projected)}
          </Text>
          <View style={{ flexDirection: "row", marginTop: 14, gap: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={g.label}>In Banks</Text>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 16, color: COLORS.positive, marginTop: 4 }}>
                {formatCAD(totals.total_balance)}
              </Text>
            </View>
            <View style={{ width: 1, backgroundColor: COLORS.border }} />
            <View style={{ flex: 1 }}>
              <Text style={g.label}>Owed on Cards</Text>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 16, color: COLORS.negative, marginTop: 4 }}>
                {formatCAD(totals.total_owed)}
              </Text>
            </View>
          </View>
        </View>

        {/* Negative balance alert */}
        {negativeAccount && (
          <View
            style={{
              backgroundColor: "rgba(194,109,92,0.1)",
              borderColor: "rgba(194,109,92,0.3)",
              borderWidth: 1,
              borderRadius: 18,
              padding: 14,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              marginBottom: 16,
            }}
            testID="negative-alert"
          >
            <Feather name="alert-triangle" color={COLORS.negative} size={20} />
            <Text style={{ flex: 1, color: COLORS.negative, fontFamily: FONTS.bodyMed, fontSize: 13 }}>
              {ACCOUNT_LABELS[negativeAccount.key]} will be negative after card transfers.
            </Text>
          </View>
        )}

        {/* Quick actions */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 22 }}>
          <TouchableOpacity
            testID="quick-add-income"
            style={{
              flex: 1,
              backgroundColor: COLORS.positive,
              paddingVertical: 14,
              borderRadius: 999,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
            onPress={() => router.push("/add-income")}
          >
            <Feather name="arrow-down-left" color="#fff" size={16} />
            <Text style={{ color: "#fff", fontFamily: FONTS.bodyBold, fontSize: 14 }}>Income</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="quick-add-expense"
            style={{
              flex: 1,
              backgroundColor: COLORS.textPrimary,
              paddingVertical: 14,
              borderRadius: 999,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
            onPress={() => router.push("/add-expense")}
          >
            <Feather name="arrow-up-right" color="#fff" size={16} />
            <Text style={{ color: "#fff", fontFamily: FONTS.bodyBold, fontSize: 14 }}>Expense</Text>
          </TouchableOpacity>
        </View>

        {/* Accounts */}
        <Text style={[g.h2, { marginBottom: 12 }]}>Bank Accounts</Text>
        {accounts.map((a) => {
          const allocated = a.target || 0;
          const spent = a.spent_this_month || 0;
          const pct = allocated > 0 ? Math.min(100, (spent / allocated) * 100) : 0;
          return (
            <View key={a.key} style={[g.card, { marginBottom: 12 }]} testID={`account-card-${a.key}`}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                <View
                  style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: a.color, marginRight: 10 }}
                />
                <Text style={[g.h3, { flex: 1 }]}>{ACCOUNT_LABELS[a.key]}</Text>
                <Text
                  style={{
                    fontFamily: FONTS.bodyBold,
                    fontSize: 18,
                    color: a.is_negative_projected ? COLORS.negative : COLORS.textPrimary,
                  }}
                  testID={`account-projected-${a.key}`}
                >
                  {formatCAD(a.projected_balance)}
                </Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.textSecondary }}>
                  Balance {formatCAD(a.balance)}
                </Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.textSecondary }}>
                  − {formatCAD(a.owed_to_cards)} owed
                </Text>
              </View>
              {allocated > 0 && (
                <>
                  <View
                    style={{
                      height: 10,
                      borderRadius: 999,
                      backgroundColor: COLORS.surfaceSecondary,
                      overflow: "hidden",
                    }}
                  >
                    <View
                      style={{
                        height: "100%",
                        width: `${pct}%`,
                        backgroundColor: pct >= 100 ? COLORS.negative : a.color,
                      }}
                    />
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                    <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: COLORS.textSecondary }}>
                      Spent {formatCAD(spent)}
                    </Text>
                    <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: COLORS.textSecondary }}>
                      Target {formatCAD(allocated)}
                    </Text>
                  </View>
                </>
              )}
            </View>
          );
        })}

        {/* Cards summary */}
        <Text style={[g.h2, { marginBottom: 12, marginTop: 14 }]}>Credit Cards</Text>
        {cards.map((c) => (
          <View
            key={c.key}
            style={[g.card, { marginBottom: 12, backgroundColor: c.color }]}
            testID={`card-summary-${c.key}`}
          >
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
              <Feather name="credit-card" color="rgba(255,255,255,0.85)" size={18} />
              <Text style={{ fontFamily: FONTS.headingMed, color: "#fff", fontSize: 18, marginLeft: 10, flex: 1 }}>
                {CARD_LABELS[c.key]}
              </Text>
              <Text style={{ fontFamily: FONTS.bodyBold, color: "#fff", fontSize: 20 }}>
                {formatCAD(c.balance)}
              </Text>
            </View>
            <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: "rgba(255,255,255,0.7)", letterSpacing: 1.5, textTransform: "uppercase" }}>
              Balance to clear
            </Text>
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
