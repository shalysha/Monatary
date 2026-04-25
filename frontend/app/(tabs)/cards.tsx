import { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { api, Dashboard } from "../../api";
import { COLORS, FONTS, formatCAD, ACCOUNT_LABELS, CARD_LABELS, styles as g } from "../../theme";

export default function CardsScreen() {
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

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const payoff = (cardKey: string, name: string) => {
    Alert.alert(
      `Pay off ${name}?`,
      "This will deduct the projected transfer amounts from each bank account and clear the card balance.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Pay Off",
          onPress: async () => {
            try {
              await api.payoffCard(cardKey);
              load();
            } catch (e: any) {
              Alert.alert("Error", e.message || "Failed");
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={g.screen} edges={["top"]}>
      <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
        <Text style={[g.label, { marginBottom: 4 }]}>Credit Cards</Text>
        <Text style={g.h1}>Payoff Plan</Text>
        <Text style={[g.body, { color: COLORS.textSecondary, marginTop: 4 }]}>
          End-of-month transfers from each bank account
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        testID="cards-scroll"
      >
        {data?.cards.map((c) => {
          const breakdownEntries = Object.entries(c.breakdown || {});
          return (
            <View key={c.key} style={{ marginBottom: 18 }} testID={`card-detail-${c.key}`}>
              <View style={[g.card, { backgroundColor: c.color, marginBottom: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}>
                <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontFamily: FONTS.body,
                        fontSize: 11,
                        color: "rgba(255,255,255,0.7)",
                        letterSpacing: 1.8,
                        textTransform: "uppercase",
                      }}
                    >
                      {CARD_LABELS[c.key]}
                    </Text>
                    <Text style={{ fontFamily: FONTS.heading, fontSize: 32, color: "#fff", marginTop: 8, letterSpacing: -0.5 }}>
                      {formatCAD(c.balance)}
                    </Text>
                    <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 4 }}>
                      Outstanding to clear
                    </Text>
                  </View>
                  <Feather name="credit-card" color="rgba(255,255,255,0.85)" size={26} />
                </View>
              </View>
              <View
                style={{
                  backgroundColor: COLORS.surface,
                  borderColor: COLORS.border,
                  borderWidth: 1,
                  borderTopWidth: 0,
                  borderBottomLeftRadius: 24,
                  borderBottomRightRadius: 24,
                  padding: 18,
                }}
              >
                <Text style={[g.label, { marginBottom: 10 }]}>Transfer Breakdown</Text>
                {breakdownEntries.length === 0 && (
                  <Text style={{ fontFamily: FONTS.body, color: COLORS.textSecondary, fontSize: 13 }}>
                    No outstanding charges allocated
                  </Text>
                )}
                {breakdownEntries.map(([k, v]) => (
                  <View
                    key={k}
                    style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8 }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          backgroundColor: COLORS.accounts[k] || COLORS.textSecondary,
                          marginRight: 8,
                        }}
                      />
                      <Text style={{ fontFamily: FONTS.bodyMed, fontSize: 14, color: COLORS.textPrimary }}>
                        {ACCOUNT_LABELS[k]}
                      </Text>
                    </View>
                    <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: COLORS.textPrimary }}>
                      {formatCAD(v as number)}
                    </Text>
                  </View>
                ))}
                <TouchableOpacity
                  testID={`payoff-${c.key}`}
                  disabled={breakdownEntries.length === 0}
                  style={{
                    marginTop: 12,
                    backgroundColor: breakdownEntries.length === 0 ? COLORS.surfaceSecondary : COLORS.textPrimary,
                    paddingVertical: 13,
                    borderRadius: 999,
                    alignItems: "center",
                  }}
                  onPress={() => payoff(c.key, CARD_LABELS[c.key])}
                >
                  <Text
                    style={{
                      color: breakdownEntries.length === 0 ? COLORS.textSecondary : "#fff",
                      fontFamily: FONTS.bodyBold,
                      fontSize: 14,
                    }}
                  >
                    {breakdownEntries.length === 0 ? "Nothing to pay" : `Pay Off ${CARD_LABELS[c.key]}`}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
