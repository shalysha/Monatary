import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { api, Category } from "../../api";
import { COLORS, FONTS, formatCAD, ACCOUNT_LABELS, styles as g } from "../../theme";

const PARENT_ORDER = ["fixed_expenses", "variable", "general", "savings"];

export default function BudgetScreen() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [adding, setAdding] = useState<string | null>(null); // parent_account
  const [draftName, setDraftName] = useState("");
  const [draftAmount, setDraftAmount] = useState("");
  const [draftAuto, setDraftAuto] = useState(false);

  const load = async () => {
    try {
      // Use dashboard to get categories with spent_this_month
      const d = await api.dashboard();
      setCategories(d.categories || []);
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

  const seedBudget = () => {
    Alert.alert(
      "Load preset budget?",
      "This will replace existing categories with the preset (14 fixed + 7 variable items).",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Load",
          onPress: async () => {
            await api.seedBudget();
            load();
          },
        },
      ]
    );
  };

  const startEdit = (cat: Category) => {
    setEditing(cat);
    setDraftName(cat.name);
    setDraftAmount(String(cat.monthly_target));
    setDraftAuto(cat.auto_create);
  };

  const startAdd = (parent: string) => {
    setAdding(parent);
    setDraftName("");
    setDraftAmount("");
    setDraftAuto(parent === "fixed_expenses");
  };

  const closeModal = () => {
    setEditing(null);
    setAdding(null);
  };

  const saveDraft = async () => {
    const amt = parseFloat(draftAmount || "0");
    if (!draftName.trim()) {
      Alert.alert("Missing", "Name is required");
      return;
    }
    if (editing) {
      await api.updateCategory(editing.id, {
        name: draftName.trim(),
        monthly_target: amt,
        auto_create: draftAuto,
      });
    } else if (adding) {
      await api.createCategory({
        name: draftName.trim(),
        parent_account: adding,
        monthly_target: amt,
        auto_create: draftAuto,
        day_of_month: 1,
      });
    }
    closeModal();
    load();
  };

  const deleteCat = (cat: Category) => {
    Alert.alert("Delete category?", `Remove "${cat.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await api.deleteCategory(cat.id);
          load();
        },
      },
    ]);
  };

  const runCat = (cat: Category) => {
    Alert.alert(
      `Log ${cat.name}?`,
      `Records ${formatCAD(cat.monthly_target)} as cash spend from ${ACCOUNT_LABELS[cat.parent_account]} for ${cat.name}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Now",
          onPress: async () => {
            await api.runCategory(cat.id);
            load();
          },
        },
      ]
    );
  };

  // Group by parent
  const grouped: Record<string, Category[]> = {};
  PARENT_ORDER.forEach((p) => (grouped[p] = []));
  categories.forEach((c) => {
    if (!grouped[c.parent_account]) grouped[c.parent_account] = [];
    grouped[c.parent_account].push(c);
  });

  const totalsByParent: Record<string, { target: number; spent: number }> = {};
  PARENT_ORDER.forEach((p) => {
    const items = grouped[p] || [];
    totalsByParent[p] = {
      target: items.reduce((s, c) => s + (c.monthly_target || 0), 0),
      spent: items.reduce((s, c) => s + (c.spent_this_month || 0), 0),
    };
  });
  const grandTarget = Object.values(totalsByParent).reduce((s, v) => s + v.target, 0);

  const PARENT_COLORS: Record<string, string> = {
    fixed_expenses: COLORS.accounts.fixed_expenses,
    variable: COLORS.accounts.variable,
    general: COLORS.accounts.general,
    savings: COLORS.accounts.savings,
  };

  const hasAny = categories.length > 0;

  return (
    <SafeAreaView style={g.screen} edges={["top"]}>
      <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
        <Text style={[g.label, { marginBottom: 4 }]}>Budget</Text>
        <Text style={g.h1}>Categories</Text>
        <Text style={[g.body, { color: COLORS.textSecondary, marginTop: 4 }]}>
          {hasAny
            ? `Total monthly target: ${formatCAD(grandTarget)}`
            : "Tap below to load your preset budget."}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        testID="budget-scroll"
      >
        {!hasAny && (
          <TouchableOpacity
            testID="seed-budget"
            onPress={seedBudget}
            style={{
              backgroundColor: COLORS.positive,
              paddingVertical: 16,
              borderRadius: 999,
              alignItems: "center",
              marginBottom: 20,
              flexDirection: "row",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <Feather name="download" color="#fff" size={16} />
            <Text style={{ color: "#fff", fontFamily: FONTS.bodyBold, fontSize: 14 }}>
              Load Preset Budget
            </Text>
          </TouchableOpacity>
        )}

        {PARENT_ORDER.map((parent) => {
          const items = grouped[parent] || [];
          const tot = totalsByParent[parent];
          const pct = tot.target > 0 ? Math.min(100, (tot.spent / tot.target) * 100) : 0;
          return (
            <View key={parent} style={{ marginBottom: 22 }} testID={`bucket-${parent}`}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                <View
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 999,
                    backgroundColor: PARENT_COLORS[parent],
                    marginRight: 10,
                  }}
                />
                <Text style={[g.h2, { flex: 1 }]}>{ACCOUNT_LABELS[parent]}</Text>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 16, color: COLORS.textPrimary }}>
                  {formatCAD(tot.spent)} / {formatCAD(tot.target)}
                </Text>
              </View>

              {tot.target > 0 && (
                <View
                  style={{
                    height: 8,
                    borderRadius: 999,
                    backgroundColor: COLORS.surfaceSecondary,
                    overflow: "hidden",
                    marginBottom: 12,
                  }}
                >
                  <View
                    style={{
                      height: "100%",
                      width: `${pct}%`,
                      backgroundColor: pct >= 100 ? COLORS.negative : PARENT_COLORS[parent],
                    }}
                  />
                </View>
              )}

              {items.map((c) => {
                const cpct =
                  c.monthly_target > 0
                    ? Math.min(100, ((c.spent_this_month || 0) / c.monthly_target) * 100)
                    : 0;
                const over = c.over_budget;
                return (
                  <TouchableOpacity
                    key={c.id}
                    testID={`category-${c.id}`}
                    onPress={() => startEdit(c)}
                    style={[g.card, { marginBottom: 8, padding: 14 }]}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: COLORS.textPrimary }}>
                          {c.name}
                        </Text>
                        {c.auto_create && (
                          <View
                            style={{
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              borderRadius: 999,
                              backgroundColor: "rgba(92,128,101,0.12)",
                            }}
                          >
                            <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 9, color: COLORS.positive, letterSpacing: 0.8 }}>
                              FIXED
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text
                        style={{
                          fontFamily: FONTS.bodyBold,
                          fontSize: 14,
                          color: over ? COLORS.negative : COLORS.textPrimary,
                        }}
                      >
                        {formatCAD(c.spent_this_month || 0)} / {formatCAD(c.monthly_target)}
                      </Text>
                    </View>

                    <View
                      style={{
                        height: 5,
                        borderRadius: 999,
                        backgroundColor: COLORS.surfaceSecondary,
                        overflow: "hidden",
                      }}
                    >
                      <View
                        style={{
                          height: "100%",
                          width: `${cpct}%`,
                          backgroundColor: over ? COLORS.negative : PARENT_COLORS[parent],
                        }}
                      />
                    </View>

                    <View style={{ flexDirection: "row", marginTop: 10, gap: 8 }}>
                      {c.auto_create && (
                        <TouchableOpacity
                          testID={`run-${c.id}`}
                          onPress={() => runCat(c)}
                          style={{
                            paddingVertical: 7,
                            paddingHorizontal: 12,
                            borderRadius: 999,
                            backgroundColor: COLORS.textPrimary,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <Feather name="zap" color="#fff" size={11} />
                          <Text style={{ color: "#fff", fontFamily: FONTS.bodyMed, fontSize: 11 }}>Log Now</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        testID={`delete-${c.id}`}
                        onPress={() => deleteCat(c)}
                        style={{
                          paddingVertical: 7,
                          paddingHorizontal: 12,
                          borderRadius: 999,
                          borderWidth: 1,
                          borderColor: COLORS.border,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Feather name="trash-2" color={COLORS.textSecondary} size={11} />
                        <Text style={{ color: COLORS.textSecondary, fontFamily: FONTS.bodyMed, fontSize: 11 }}>
                          Delete
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                testID={`add-cat-${parent}`}
                onPress={() => startAdd(parent)}
                style={{
                  marginTop: 4,
                  paddingVertical: 10,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderStyle: "dashed",
                  borderColor: COLORS.border,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <Feather name="plus" color={COLORS.textSecondary} size={14} />
                <Text style={{ color: COLORS.textSecondary, fontFamily: FONTS.bodyMed, fontSize: 12 }}>
                  Add to {ACCOUNT_LABELS[parent]}
                </Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={!!editing || !!adding} animationType="slide" transparent onRequestClose={closeModal}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(35,43,37,0.4)" }}
        >
          <View
            style={{
              backgroundColor: COLORS.background,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              padding: 24,
              paddingBottom: 36,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
              <Text style={[g.h2, { flex: 1 }]}>{editing ? "Edit Category" : "New Category"}</Text>
              <TouchableOpacity onPress={closeModal} testID="modal-close">
                <Feather name="x" color={COLORS.textPrimary} size={22} />
              </TouchableOpacity>
            </View>

            <Text style={g.label}>Name</Text>
            <TextInput
              testID="cat-name"
              value={draftName}
              onChangeText={setDraftName}
              placeholder="e.g. Phone, Groceries"
              placeholderTextColor={COLORS.textSecondary}
              style={{
                borderWidth: 1,
                borderColor: COLORS.border,
                borderRadius: 14,
                padding: 14,
                marginTop: 8,
                marginBottom: 14,
                backgroundColor: COLORS.surface,
                fontFamily: FONTS.bodyMed,
                fontSize: 15,
                color: COLORS.textPrimary,
              }}
            />

            <Text style={g.label}>Monthly Target (CAD)</Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                borderWidth: 1,
                borderColor: COLORS.border,
                borderRadius: 14,
                paddingHorizontal: 14,
                marginTop: 8,
                marginBottom: 14,
                backgroundColor: COLORS.surface,
              }}
            >
              <Text style={{ fontFamily: FONTS.bodyMed, color: COLORS.textSecondary, marginRight: 6, fontSize: 18 }}>$</Text>
              <TextInput
                testID="cat-amount"
                value={draftAmount}
                onChangeText={setDraftAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={COLORS.textSecondary}
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  fontFamily: FONTS.bodyBold,
                  fontSize: 18,
                  color: COLORS.textPrimary,
                }}
              />
            </View>

            <TouchableOpacity
              testID="cat-auto-toggle"
              onPress={() => setDraftAuto(!draftAuto)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                padding: 14,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: draftAuto ? COLORS.positive : COLORS.border,
                backgroundColor: draftAuto ? "rgba(92,128,101,0.08)" : COLORS.surface,
                marginBottom: 16,
              }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  borderWidth: 1.5,
                  borderColor: draftAuto ? COLORS.positive : COLORS.border,
                  backgroundColor: draftAuto ? COLORS.positive : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                }}
              >
                {draftAuto && <Feather name="check" color="#fff" size={14} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: COLORS.textPrimary }}>
                  Recurring (auto-fill)
                </Text>
                <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>
                  Show "Log Now" button to record this fixed amount once a month
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              testID="cat-save"
              onPress={saveDraft}
              style={{
                backgroundColor: COLORS.textPrimary,
                paddingVertical: 16,
                borderRadius: 999,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontFamily: FONTS.bodyBold, fontSize: 15 }}>Save</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
