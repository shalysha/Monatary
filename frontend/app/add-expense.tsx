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
import { api, Account, Card, Category } from "../api";
import { COLORS, FONTS, ACCOUNT_LABELS, CARD_LABELS, styles as g } from "../theme";

type Method = "cash" | "credit";

export default function AddExpense() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method>("credit");
  const [sourceAccount, setSourceAccount] = useState<string>("general");
  const [card, setCard] = useState<string>("amex");
  const [payoffAccount, setPayoffAccount] = useState<string>("general");
  const [categoryId, setCategoryId] = useState<string | null>(null);

  useEffect(() => {
    api.accounts().then(setAccounts);
    api.cards().then(setCards);
    api.categories().then(setCategories);
  }, []);

  const selectCategory = (cat: Category) => {
    setCategoryId(cat.id);
    if (!description.trim()) setDescription(cat.name);
    setSourceAccount(cat.parent_account);
    setPayoffAccount(cat.parent_account);
  };

  const submit = async () => {
    const amt = parseFloat(amount || "0");
    if (!description.trim() || amt <= 0) {
      Alert.alert("Missing info", "Add a description and amount.");
      return;
    }
    const cat = categories.find((c) => c.id === categoryId);
    const body: any = {
      description: description.trim(),
      amount: amt,
      payment_method: method,
      category_id: categoryId,
      category: cat?.name,
    };
    if (method === "cash") body.source_account = sourceAccount;
    else {
      body.card = card;
      body.payoff_account = payoffAccount;
    }
    try {
      await api.createExpense(body);
      router.back();
    } catch (e: any) {
      Alert.alert("Error", e.message || "Could not save");
    }
  };

  const Pill = ({
    active,
    label,
    color,
    onPress,
    testID,
  }: {
    active: boolean;
    label: string;
    color?: string;
    onPress: () => void;
    testID: string;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      testID={testID}
      style={{
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? color || COLORS.textPrimary : COLORS.border,
        backgroundColor: active ? color || COLORS.textPrimary : "transparent",
        marginRight: 8,
        marginBottom: 8,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
      }}
    >
      {active && color && <View style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: "#fff" }} />}
      <Text
        style={{
          fontFamily: FONTS.bodyMed,
          fontSize: 13,
          color: active ? "#fff" : COLORS.textPrimary,
        }}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  // Group categories by parent — only show LEAF categories (those without children) in picker
  const allCategories = categories;
  const parentIds = new Set(allCategories.filter((c) => c.parent_id).map((c) => c.parent_id!));
  const leafCategories = allCategories.filter((c) => !parentIds.has(c.id));
  const grouped: Record<string, Category[]> = {};
  leafCategories.forEach((c) => {
    if (!grouped[c.parent_account]) grouped[c.parent_account] = [];
    grouped[c.parent_account].push(c);
  });
  const PARENT_ORDER = ["fixed_expenses", "variable", "general", "savings"];

  return (
    <SafeAreaView style={g.screen} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", padding: 16 }}>
          <TouchableOpacity onPress={() => router.back()} testID="close-add-expense" hitSlop={10}>
            <Feather name="x" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={[g.h2, { marginLeft: 12 }]}>Add Expense</Text>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
          <Text style={g.label}>Description</Text>
          <TextInput
            testID="exp-description"
            value={description}
            onChangeText={setDescription}
            placeholder="Coffee, groceries, rent..."
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

          <Text style={g.label}>Amount (CAD)</Text>
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
              testID="exp-amount"
              value={amount}
              onChangeText={setAmount}
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

          {categories.length > 0 && (
            <>
              <Text style={g.label}>Category (optional)</Text>
              <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.textSecondary, marginTop: 4 }}>
                Selecting a category auto-fills the bucket for tracking.
              </Text>
              <View style={{ marginTop: 10, marginBottom: 14 }}>
                {PARENT_ORDER.map((parent) => {
                  const items = grouped[parent] || [];
                  if (items.length === 0) return null;
                  return (
                    <View key={parent} style={{ marginBottom: 6 }}>
                      <Text
                        style={{
                          fontFamily: FONTS.bodyBold,
                          fontSize: 10,
                          color: COLORS.textSecondary,
                          letterSpacing: 1.5,
                          textTransform: "uppercase",
                          marginBottom: 6,
                          marginTop: 6,
                        }}
                      >
                        {ACCOUNT_LABELS[parent]}
                      </Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                        {items.map((c) => (
                          <Pill
                            key={c.id}
                            active={categoryId === c.id}
                            label={c.name}
                            color={COLORS.accounts[c.parent_account]}
                            onPress={() => selectCategory(c)}
                            testID={`exp-cat-${c.id}`}
                          />
                        ))}
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          <Text style={g.label}>Paid With</Text>
          <View style={{ flexDirection: "row", marginTop: 8, gap: 8, marginBottom: 16 }}>
            {(["credit", "cash"] as Method[]).map((m) => (
              <TouchableOpacity
                key={m}
                testID={`method-${m}`}
                onPress={() => setMethod(m)}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: method === m ? COLORS.textPrimary : COLORS.border,
                  backgroundColor: method === m ? COLORS.textPrimary : "transparent",
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <Feather
                  name={m === "credit" ? "credit-card" : "dollar-sign"}
                  size={16}
                  color={method === m ? "#fff" : COLORS.textPrimary}
                />
                <Text
                  style={{
                    fontFamily: FONTS.bodyMed,
                    fontSize: 14,
                    color: method === m ? "#fff" : COLORS.textPrimary,
                  }}
                >
                  {m === "credit" ? "Credit Card" : "Bank Direct"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {method === "cash" ? (
            <>
              <Text style={g.label}>From Bank Account</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 10 }}>
                {accounts.map((a) => (
                  <Pill
                    key={a.key}
                    active={sourceAccount === a.key}
                    label={ACCOUNT_LABELS[a.key]}
                    color={a.color}
                    onPress={() => setSourceAccount(a.key)}
                    testID={`source-${a.key}`}
                  />
                ))}
              </View>
            </>
          ) : (
            <>
              <Text style={g.label}>Credit Card</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 10 }}>
                {cards.map((c) => (
                  <Pill
                    key={c.key}
                    active={card === c.key}
                    label={CARD_LABELS[c.key]}
                    color={c.color}
                    onPress={() => setCard(c.key)}
                    testID={`card-${c.key}`}
                  />
                ))}
              </View>

              <Text style={[g.label, { marginTop: 14 }]}>Payoff From Account</Text>
              <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.textSecondary, marginTop: 4 }}>
                Which bank bucket should pay this card off at month-end?
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 10 }}>
                {accounts.map((a) => (
                  <Pill
                    key={a.key}
                    active={payoffAccount === a.key}
                    label={ACCOUNT_LABELS[a.key]}
                    color={a.color}
                    onPress={() => setPayoffAccount(a.key)}
                    testID={`payoff-${a.key}`}
                  />
                ))}
              </View>
            </>
          )}

          <TouchableOpacity
            testID="save-expense"
            onPress={submit}
            style={{
              marginTop: 22,
              backgroundColor: COLORS.textPrimary,
              paddingVertical: 16,
              borderRadius: 999,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontFamily: FONTS.bodyBold, fontSize: 15 }}>Save Expense</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
