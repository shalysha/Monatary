import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, Account } from "../api";
import { COLORS, FONTS, formatCAD, ACCOUNT_LABELS, styles as g } from "../theme";

type Mode = "amount" | "percent";

export default function AddIncome() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [source, setSource] = useState("Paycheck");
  const [total, setTotal] = useState("");
  const [mode, setMode] = useState<Mode>("amount");
  const [values, setValues] = useState<Record<string, string>>({
    fixed_expenses: "",
    variable: "",
    general: "",
    savings: "",
  });

  useEffect(() => {
    api.accounts().then(setAccounts);
  }, []);

  const totalNum = parseFloat(total || "0");
  const allocations = (() => {
    if (mode === "amount") {
      return {
        fixed_expenses: parseFloat(values.fixed_expenses || "0"),
        variable: parseFloat(values.variable || "0"),
        general: parseFloat(values.general || "0"),
        savings: parseFloat(values.savings || "0"),
      };
    } else {
      return {
        fixed_expenses: (totalNum * (parseFloat(values.fixed_expenses || "0") / 100)) || 0,
        variable: (totalNum * (parseFloat(values.variable || "0") / 100)) || 0,
        general: (totalNum * (parseFloat(values.general || "0") / 100)) || 0,
        savings: (totalNum * (parseFloat(values.savings || "0") / 100)) || 0,
      };
    }
  })();

  const allocSum = allocations.fixed_expenses + allocations.variable + allocations.general + allocations.savings;
  const remaining = (mode === "amount" ? totalNum : totalNum) - allocSum;

  const submit = async () => {
    if (allocSum <= 0) {
      Alert.alert("Allocate income", "Distribute the paycheck into at least one bucket.");
      return;
    }
    try {
      await api.createIncome({ source, allocation: allocations });
      router.back();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Could not save");
    }
  };

  return (
    <SafeAreaView style={g.screen} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", padding: 16 }}>
          <TouchableOpacity onPress={() => router.back()} testID="close-add-income" hitSlop={10}>
            <Feather name="x" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={[g.h2, { marginLeft: 12 }]}>Add Income</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
          <Text style={g.label}>Source</Text>
          <TextInput
            testID="income-source"
            value={source}
            onChangeText={setSource}
            placeholder="Paycheck"
            placeholderTextColor={COLORS.textSecondary}
            style={{
              borderWidth: 1,
              borderColor: COLORS.border,
              borderRadius: 14,
              padding: 14,
              marginTop: 8,
              marginBottom: 16,
              fontFamily: FONTS.bodyMed,
              fontSize: 15,
              color: COLORS.textPrimary,
            }}
          />

          <Text style={g.label}>Total Amount (CAD)</Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              borderWidth: 1,
              borderColor: COLORS.border,
              borderRadius: 14,
              paddingHorizontal: 14,
              marginTop: 8,
              marginBottom: 18,
            }}
          >
            <Text style={{ fontFamily: FONTS.bodyMed, color: COLORS.textSecondary, marginRight: 6, fontSize: 18 }}>$</Text>
            <TextInput
              testID="income-total"
              value={total}
              onChangeText={setTotal}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={COLORS.textSecondary}
              style={{
                flex: 1,
                paddingVertical: 14,
                fontFamily: FONTS.bodyBold,
                fontSize: 22,
                color: COLORS.textPrimary,
              }}
            />
          </View>

          <View style={{ flexDirection: "row", marginBottom: 16, gap: 8 }}>
            {(["amount", "percent"] as Mode[]).map((m) => (
              <TouchableOpacity
                key={m}
                testID={`mode-${m}`}
                onPress={() => setMode(m)}
                style={{
                  flex: 1,
                  paddingVertical: 11,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: mode === m ? COLORS.textPrimary : COLORS.border,
                  backgroundColor: mode === m ? COLORS.textPrimary : "transparent",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    fontFamily: FONTS.bodyMed,
                    color: mode === m ? "#fff" : COLORS.textPrimary,
                    fontSize: 13,
                  }}
                >
                  {m === "amount" ? "By Amount" : "By Percentage"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {accounts.map((a) => (
            <View key={a.key} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                <View
                  style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: a.color, marginRight: 8 }}
                />
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: COLORS.textPrimary, flex: 1 }}>
                  {ACCOUNT_LABELS[a.key]}
                </Text>
                {mode === "percent" && (
                  <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.textSecondary }}>
                    = {formatCAD((allocations as any)[a.key])}
                  </Text>
                )}
              </View>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  borderRadius: 14,
                  paddingHorizontal: 14,
                }}
              >
                <Text style={{ fontFamily: FONTS.bodyMed, color: COLORS.textSecondary, marginRight: 6 }}>
                  {mode === "amount" ? "$" : "%"}
                </Text>
                <TextInput
                  testID={`alloc-${a.key}`}
                  value={values[a.key]}
                  onChangeText={(t) => setValues({ ...values, [a.key]: t })}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={COLORS.textSecondary}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    fontFamily: FONTS.bodyMed,
                    fontSize: 15,
                    color: COLORS.textPrimary,
                  }}
                />
              </View>
            </View>
          ))}

          <View
            style={[
              g.card,
              {
                marginTop: 12,
                backgroundColor: Math.abs(remaining) < 0.01 ? "rgba(92,128,101,0.1)" : COLORS.surfaceSecondary,
                borderColor: Math.abs(remaining) < 0.01 ? COLORS.positive : COLORS.border,
              },
            ]}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={g.body}>Allocated</Text>
              <Text style={{ fontFamily: FONTS.bodyBold }}>{formatCAD(allocSum)}</Text>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
              <Text style={g.body}>Remaining</Text>
              <Text
                style={{
                  fontFamily: FONTS.bodyBold,
                  color: Math.abs(remaining) < 0.01 ? COLORS.positive : COLORS.warning,
                }}
                testID="income-remaining"
              >
                {formatCAD(remaining)}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            testID="save-income"
            onPress={submit}
            style={{
              marginTop: 22,
              backgroundColor: COLORS.positive,
              paddingVertical: 16,
              borderRadius: 999,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontFamily: FONTS.bodyBold, fontSize: 15 }}>Save Income</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
