import { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { api, Account, AnalyticsMonth } from "../../api";
import { COLORS, FONTS, formatCAD, ACCOUNT_LABELS, styles as g } from "../../theme";

export default function SettingsScreen() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [balanceEdits, setBalanceEdits] = useState<Record<string, string>>({});
  const [analytics, setAnalytics] = useState<AnalyticsMonth[]>([]);

  const load = async () => {
    const [a, an] = await Promise.all([api.accounts(), api.analytics(6)]);
    setAccounts(a);
    setAnalytics(an.months);
    const e: Record<string, string> = {};
    const b: Record<string, string> = {};
    a.forEach((acc) => {
      e[acc.key] = String(acc.target || 0);
      b[acc.key] = String(acc.balance || 0);
    });
    setEdits(e);
    setBalanceEdits(b);
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  const saveBalance = async (key: string) => {
    const v = parseFloat(balanceEdits[key] || "0");
    await api.updateAccount(key, { balance: v });
    Alert.alert("Saved", `${ACCOUNT_LABELS[key]} balance set to ${formatCAD(v)}`);
    load();
  };

  const reset = () => {
    Alert.alert(
      "Reset Everything?",
      "This deletes all accounts, cards, income, expenses, and categories. Cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            await api.reset();
            load();
          },
        },
      ]
    );
  };

  const rollover = () => {
    Alert.alert(
      "Close Month?",
      "Sweep any leftover positive balance from Fixed Expenses, Variable, and Spending into Savings.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sweep to Savings",
          onPress: async () => {
            const res: any = await api.rollover(true);
            const total = Object.values(res.swept || {}).reduce((s: number, v: any) => s + v, 0);
            Alert.alert("Done", `Swept ${formatCAD(total)} to Savings.`);
            load();
          },
        },
      ]
    );
  };

  // Build chart from analytics (max bar height)
  const maxVal = Math.max(1, ...analytics.flatMap((m) => [m.income, m.expense]));

  return (
    <SafeAreaView style={g.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={g.scroll} testID="settings-scroll">
        <Text style={[g.label, { marginBottom: 4 }]}>Settings</Text>
        <Text style={[g.h1, { marginBottom: 18 }]}>Tools & History</Text>

        {/* Insights */}
        <View style={[g.card, { marginBottom: 16 }]} testID="insights-card">
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <Feather name="bar-chart-2" color={COLORS.textPrimary} size={18} />
            <Text style={[g.h3, { marginLeft: 8 }]}>Last 6 Months</Text>
          </View>
          {analytics.length === 0 || analytics.every((m) => m.income === 0 && m.expense === 0) ? (
            <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.textSecondary }}>
              No data yet — add income & expenses to see trends.
            </Text>
          ) : (
            <>
              <View style={{ flexDirection: "row", alignItems: "flex-end", height: 120, gap: 6 }}>
                {analytics.map((m) => {
                  const incH = (m.income / maxVal) * 110;
                  const expH = (m.expense / maxVal) * 110;
                  return (
                    <View key={m.month} style={{ flex: 1, alignItems: "center" }}>
                      <View style={{ flexDirection: "row", alignItems: "flex-end", height: 110, gap: 2 }}>
                        <View
                          style={{
                            width: 12,
                            height: incH,
                            backgroundColor: COLORS.positive,
                            borderTopLeftRadius: 4,
                            borderTopRightRadius: 4,
                          }}
                        />
                        <View
                          style={{
                            width: 12,
                            height: expH,
                            backgroundColor: COLORS.negative,
                            borderTopLeftRadius: 4,
                            borderTopRightRadius: 4,
                          }}
                        />
                      </View>
                      <Text
                        style={{
                          fontFamily: FONTS.body,
                          fontSize: 9,
                          color: COLORS.textSecondary,
                          marginTop: 4,
                        }}
                      >
                        {m.month.slice(5)}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <View style={{ flexDirection: "row", marginTop: 14, gap: 16, justifyContent: "center" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: COLORS.positive }} />
                  <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: COLORS.textSecondary }}>Income</Text>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: COLORS.negative }} />
                  <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: COLORS.textSecondary }}>Expenses</Text>
                </View>
              </View>
              {analytics.length > 0 && (
                <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border }}>
                  {analytics.slice(-3).reverse().map((m) => (
                    <View
                      key={m.month}
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        paddingVertical: 4,
                      }}
                    >
                      <Text style={{ fontFamily: FONTS.bodyMed, fontSize: 13 }}>{m.month}</Text>
                      <Text
                        style={{
                          fontFamily: FONTS.bodyBold,
                          fontSize: 13,
                          color: m.net >= 0 ? COLORS.positive : COLORS.negative,
                        }}
                      >
                        Net {formatCAD(m.net)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </View>

        {/* Monthly Rollover */}
        <View style={[g.card, { marginBottom: 16 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <Feather name="refresh-cw" color={COLORS.textPrimary} size={18} />
            <Text style={[g.h3, { marginLeft: 8 }]}>Close Month</Text>
          </View>
          <Text style={{ fontFamily: FONTS.body, fontSize: 13, color: COLORS.textSecondary, marginBottom: 12 }}>
            Sweep any leftover positive balance from your bucket accounts into Savings.
          </Text>
          <TouchableOpacity
            testID="rollover-btn"
            onPress={rollover}
            style={{
              backgroundColor: COLORS.positive,
              paddingVertical: 14,
              borderRadius: 999,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Feather name="trending-up" color="#fff" size={14} />
            <Text style={{ color: "#fff", fontFamily: FONTS.bodyBold, fontSize: 13 }}>
              Sweep to Savings
            </Text>
          </TouchableOpacity>
        </View>

        {/* Account balances */}
        <Text style={[g.h3, { marginBottom: 10 }]}>Account Balances</Text>
        <Text style={[g.body, { color: COLORS.textSecondary, marginBottom: 14 }]}>
          Manually correct each bank account balance if needed.
        </Text>

        {accounts.map((a) => (
          <View key={a.key} style={[g.card, { marginBottom: 10, padding: 14 }]} testID={`settings-card-${a.key}`}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
              <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: a.color, marginRight: 10 }} />
              <Text style={[g.h3, { fontSize: 15, flex: 1 }]}>{ACCOUNT_LABELS[a.key]}</Text>
              <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: COLORS.textSecondary }}>
                Target {formatCAD(a.target)}
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  borderRadius: 14,
                  paddingHorizontal: 14,
                  marginRight: 8,
                }}
              >
                <Text style={{ fontFamily: FONTS.bodyMed, color: COLORS.textSecondary, marginRight: 6 }}>$</Text>
                <TextInput
                  testID={`balance-input-${a.key}`}
                  value={balanceEdits[a.key]}
                  onChangeText={(t) => setBalanceEdits({ ...balanceEdits, [a.key]: t })}
                  keyboardType="decimal-pad"
                  style={{
                    flex: 1,
                    paddingVertical: 11,
                    fontFamily: FONTS.bodyMed,
                    fontSize: 14,
                    color: COLORS.textPrimary,
                  }}
                />
              </View>
              <TouchableOpacity
                testID={`save-balance-${a.key}`}
                style={{
                  paddingVertical: 11,
                  paddingHorizontal: 16,
                  backgroundColor: a.color,
                  borderRadius: 999,
                }}
                onPress={() => saveBalance(a.key)}
              >
                <Text style={{ color: "#fff", fontFamily: FONTS.bodyBold, fontSize: 13 }}>Set</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <Text
          style={{
            fontFamily: FONTS.body,
            fontSize: 11,
            color: COLORS.textSecondary,
            marginTop: 12,
            marginBottom: 16,
          }}
        >
          Account targets are auto-calculated from your category targets in the Budget tab.
        </Text>

        <TouchableOpacity
          testID="reset-all"
          onPress={reset}
          style={{
            marginTop: 4,
            paddingVertical: 14,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: COLORS.negative,
            alignItems: "center",
            flexDirection: "row",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <Feather name="trash-2" color={COLORS.negative} size={16} />
          <Text style={{ color: COLORS.negative, fontFamily: FONTS.bodyBold, fontSize: 14 }}>Reset All Data</Text>
        </TouchableOpacity>

        <Text
          style={{
            textAlign: "center",
            marginTop: 30,
            fontFamily: FONTS.body,
            fontSize: 11,
            color: COLORS.textSecondary,
          }}
        >
          Zero-Based Budget · CAD
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
