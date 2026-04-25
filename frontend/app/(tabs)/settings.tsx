import { useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { api, Account } from "../../api";
import { COLORS, FONTS, formatCAD, ACCOUNT_LABELS, styles as g } from "../../theme";

export default function SettingsScreen() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [balanceEdits, setBalanceEdits] = useState<Record<string, string>>({});

  const load = async () => {
    const a = await api.accounts();
    setAccounts(a);
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

  const saveTarget = async (key: string) => {
    const v = parseFloat(edits[key] || "0");
    await api.updateAccount(key, { target: v });
    Alert.alert("Saved", `${ACCOUNT_LABELS[key]} target set to ${formatCAD(v)}`);
    load();
  };

  const saveBalance = async (key: string) => {
    const v = parseFloat(balanceEdits[key] || "0");
    await api.updateAccount(key, { balance: v });
    Alert.alert("Saved", `${ACCOUNT_LABELS[key]} balance set to ${formatCAD(v)}`);
    load();
  };

  const reset = () => {
    Alert.alert(
      "Reset Everything?",
      "This deletes all accounts, cards, income, and expenses. Cannot be undone.",
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

  return (
    <SafeAreaView style={g.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={g.scroll} testID="settings-scroll">
        <Text style={[g.label, { marginBottom: 4 }]}>Settings</Text>
        <Text style={[g.h1, { marginBottom: 18 }]}>Budget Targets</Text>
        <Text style={[g.body, { color: COLORS.textSecondary, marginBottom: 18 }]}>
          Set monthly spending targets and seed starting balances for each bank account.
        </Text>

        {accounts.map((a) => (
          <View key={a.key} style={[g.card, { marginBottom: 14 }]} testID={`settings-card-${a.key}`}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
              <View style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: a.color, marginRight: 10 }} />
              <Text style={g.h3}>{ACCOUNT_LABELS[a.key]}</Text>
            </View>

            <Text style={g.label}>Monthly Target</Text>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, marginBottom: 14 }}>
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
                  testID={`target-input-${a.key}`}
                  value={edits[a.key]}
                  onChangeText={(t) => setEdits({ ...edits, [a.key]: t })}
                  keyboardType="decimal-pad"
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    fontFamily: FONTS.bodyMed,
                    fontSize: 15,
                    color: COLORS.textPrimary,
                  }}
                />
              </View>
              <TouchableOpacity
                testID={`save-target-${a.key}`}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 18,
                  backgroundColor: COLORS.textPrimary,
                  borderRadius: 999,
                }}
                onPress={() => saveTarget(a.key)}
              >
                <Text style={{ color: "#fff", fontFamily: FONTS.bodyBold, fontSize: 13 }}>Save</Text>
              </TouchableOpacity>
            </View>

            <Text style={g.label}>Current Balance</Text>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
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
                    paddingVertical: 12,
                    fontFamily: FONTS.bodyMed,
                    fontSize: 15,
                    color: COLORS.textPrimary,
                  }}
                />
              </View>
              <TouchableOpacity
                testID={`save-balance-${a.key}`}
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 18,
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

        <TouchableOpacity
          testID="reset-all"
          onPress={reset}
          style={{
            marginTop: 20,
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
