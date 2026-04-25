import { useState, useEffect } from "react";
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
import { useRouter } from "expo-router";
import { api, UpcomingExpense } from "../api";
import { COLORS, FONTS, formatCAD, ACCOUNT_LABELS, styles as g } from "../theme";

const ACCOUNTS = ["fixed_expenses", "variable", "general", "savings"];

export default function UpcomingScreen() {
  const router = useRouter();
  const [items, setItems] = useState<UpcomingExpense[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<UpcomingExpense | null>(null);
  const [adding, setAdding] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftAmount, setDraftAmount] = useState("");
  const [draftDate, setDraftDate] = useState("");
  const [draftAccount, setDraftAccount] = useState<string>("savings");
  const [draftNotes, setDraftNotes] = useState("");

  const load = async () => {
    const all = await api.upcoming();
    setItems(all);
  };

  useEffect(() => {
    load();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const startAdd = () => {
    setAdding(true);
    setEditing(null);
    setDraftName("");
    setDraftAmount("");
    setDraftDate(new Date().toISOString().slice(0, 10));
    setDraftAccount("savings");
    setDraftNotes("");
  };

  const startEdit = (it: UpcomingExpense) => {
    setEditing(it);
    setAdding(false);
    setDraftName(it.name);
    setDraftAmount(String(it.amount));
    setDraftDate(it.due_date);
    setDraftAccount(it.parent_account || "savings");
    setDraftNotes(it.notes || "");
  };

  const closeModal = () => {
    setAdding(false);
    setEditing(null);
  };

  const save = async () => {
    if (!draftName.trim()) {
      Alert.alert("Missing", "Name required");
      return;
    }
    const amt = parseFloat(draftAmount || "0");
    if (amt <= 0) {
      Alert.alert("Missing", "Amount must be positive");
      return;
    }
    const body = {
      name: draftName.trim(),
      amount: amt,
      due_date: draftDate || new Date().toISOString().slice(0, 10),
      parent_account: draftAccount,
      notes: draftNotes.trim() || undefined,
    };
    if (editing) await api.updateUpcoming(editing.id, body);
    else await api.createUpcoming(body);
    closeModal();
    load();
  };

  const remove = (it: UpcomingExpense) => {
    Alert.alert("Delete?", `Remove "${it.name}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await api.deleteUpcoming(it.id);
          load();
        },
      },
    ]);
  };

  const realize = (it: UpcomingExpense) => {
    Alert.alert(
      "Convert to Expense",
      `Record ${formatCAD(it.amount)} as a cash expense from ${ACCOUNT_LABELS[it.parent_account || "savings"]}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes",
          onPress: async () => {
            try {
              await api.realizeUpcoming(it.id);
              load();
            } catch (e: any) {
              Alert.alert("Error", e.message || "Failed");
            }
          },
        },
      ]
    );
  };

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = items.filter((i) => !i.realized);
  const realized = items.filter((i) => i.realized);
  const totalUpcoming = upcoming.reduce((s, i) => s + (i.amount || 0), 0);
  const next30 = upcoming.filter((i) => {
    const d = new Date(i.due_date);
    const t = new Date(today);
    const diff = (d.getTime() - t.getTime()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  });

  const formatDate = (s: string) => {
    try {
      return new Date(s).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return s;
    }
  };

  const daysUntil = (s: string) => {
    const d = new Date(s).getTime();
    const t = new Date(today).getTime();
    return Math.round((d - t) / (1000 * 60 * 60 * 24));
  };

  return (
    <SafeAreaView style={g.screen} edges={["top", "bottom"]}>
      <View style={{ flexDirection: "row", alignItems: "center", padding: 16 }}>
        <TouchableOpacity onPress={() => router.back()} testID="upcoming-close" hitSlop={10}>
          <Feather name="x" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={[g.h2, { marginLeft: 12, flex: 1 }]}>Upcoming</Text>
        <TouchableOpacity
          testID="upcoming-add"
          onPress={startAdd}
          style={{
            backgroundColor: COLORS.textPrimary,
            paddingVertical: 8,
            paddingHorizontal: 14,
            borderRadius: 999,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Feather name="plus" size={14} color="#fff" />
          <Text style={{ color: "#fff", fontFamily: FONTS.bodyBold, fontSize: 12 }}>Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        testID="upcoming-scroll"
      >
        <View style={[g.card, { marginBottom: 18, padding: 18 }]}>
          <Text style={g.label}>Total Upcoming</Text>
          <Text style={{ fontFamily: FONTS.heading, fontSize: 32, color: COLORS.textPrimary, marginTop: 6 }}>
            {formatCAD(totalUpcoming)}
          </Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>
            {upcoming.length} item{upcoming.length === 1 ? "" : "s"} ·{" "}
            <Text style={{ color: COLORS.warning, fontFamily: FONTS.bodyBold }}>
              {next30.length} in next 30 days
            </Text>
          </Text>
        </View>

        {upcoming.length === 0 && (
          <View style={[g.card, { alignItems: "center", padding: 36 }]}>
            <Feather name="calendar" size={32} color={COLORS.textSecondary} />
            <Text style={[g.body, { marginTop: 12, color: COLORS.textSecondary, textAlign: "center" }]}>
              Track irregular expenses (vacation, car repair, taxes…) so you can budget for them.
            </Text>
          </View>
        )}

        {upcoming.map((it) => {
          const days = daysUntil(it.due_date);
          const past = days < 0;
          const soon = days >= 0 && days <= 14;
          return (
            <TouchableOpacity
              key={it.id}
              testID={`upcoming-${it.id}`}
              onPress={() => startEdit(it)}
              style={[g.card, { marginBottom: 10, padding: 14 }]}
            >
              <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: COLORS.textPrimary }}>
                    {it.name}
                  </Text>
                  <Text
                    style={{
                      fontFamily: FONTS.body,
                      fontSize: 12,
                      color: past ? COLORS.negative : soon ? COLORS.warning : COLORS.textSecondary,
                      marginTop: 3,
                    }}
                  >
                    {formatDate(it.due_date)} ·{" "}
                    {past ? `${Math.abs(days)} days late` : days === 0 ? "today" : `in ${days} days`}
                  </Text>
                  {it.parent_account && (
                    <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: COLORS.textSecondary, marginTop: 2 }}>
                      from {ACCOUNT_LABELS[it.parent_account]}
                    </Text>
                  )}
                  {it.notes ? (
                    <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.textSecondary, marginTop: 4 }}>
                      {it.notes}
                    </Text>
                  ) : null}
                </View>
                <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 18, color: COLORS.textPrimary }}>
                  {formatCAD(it.amount)}
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity
                  testID={`realize-${it.id}`}
                  onPress={() => realize(it)}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    backgroundColor: COLORS.positive,
                    borderRadius: 999,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <Feather name="check" size={12} color="#fff" />
                  <Text style={{ color: "#fff", fontFamily: FONTS.bodyBold, fontSize: 11 }}>Mark as Spent</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID={`del-${it.id}`}
                  onPress={() => remove(it)}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: COLORS.border,
                  }}
                >
                  <Feather name="trash-2" size={12} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })}

        {realized.length > 0 && (
          <>
            <Text style={[g.h3, { marginTop: 16, marginBottom: 10 }]}>History</Text>
            {realized.map((it) => (
              <View
                key={it.id}
                testID={`upcoming-history-${it.id}`}
                style={[g.card, { marginBottom: 8, padding: 12, opacity: 0.6 }]}
              >
                <View style={{ flexDirection: "row" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: FONTS.bodyMed, fontSize: 13, color: COLORS.textPrimary }}>
                      {it.name}
                    </Text>
                    <Text style={{ fontFamily: FONTS.body, fontSize: 11, color: COLORS.textSecondary, marginTop: 2 }}>
                      Realized · {formatDate(it.due_date)}
                    </Text>
                  </View>
                  <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: COLORS.textPrimary }}>
                    {formatCAD(it.amount)}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <Modal visible={adding || !!editing} animationType="slide" transparent onRequestClose={closeModal}>
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
              <Text style={[g.h2, { flex: 1 }]}>{editing ? "Edit Upcoming" : "New Upcoming"}</Text>
              <TouchableOpacity onPress={closeModal} testID="up-modal-close">
                <Feather name="x" color={COLORS.textPrimary} size={22} />
              </TouchableOpacity>
            </View>

            <Text style={g.label}>Name</Text>
            <TextInput
              testID="up-name"
              value={draftName}
              onChangeText={setDraftName}
              placeholder="Vacation, car repair…"
              placeholderTextColor={COLORS.textSecondary}
              style={inputStyle}
            />
            <Text style={g.label}>Amount (CAD)</Text>
            <TextInput
              testID="up-amount"
              value={draftAmount}
              onChangeText={setDraftAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={COLORS.textSecondary}
              style={inputStyle}
            />
            <Text style={g.label}>Due Date (YYYY-MM-DD)</Text>
            <TextInput
              testID="up-date"
              value={draftDate}
              onChangeText={setDraftDate}
              placeholder="2026-03-15"
              placeholderTextColor={COLORS.textSecondary}
              style={inputStyle}
              autoCapitalize="none"
            />
            <Text style={g.label}>Funded From</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8, marginBottom: 14 }}>
              {ACCOUNTS.map((a) => (
                <TouchableOpacity
                  key={a}
                  testID={`up-acc-${a}`}
                  onPress={() => setDraftAccount(a)}
                  style={{
                    paddingVertical: 9,
                    paddingHorizontal: 13,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: draftAccount === a ? COLORS.textPrimary : COLORS.border,
                    backgroundColor: draftAccount === a ? COLORS.textPrimary : "transparent",
                    marginRight: 6,
                    marginBottom: 6,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: FONTS.bodyMed,
                      fontSize: 12,
                      color: draftAccount === a ? "#fff" : COLORS.textPrimary,
                    }}
                  >
                    {ACCOUNT_LABELS[a]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={g.label}>Notes (optional)</Text>
            <TextInput
              testID="up-notes"
              value={draftNotes}
              onChangeText={setDraftNotes}
              placeholder="Anything to remember…"
              placeholderTextColor={COLORS.textSecondary}
              multiline
              style={[inputStyle, { minHeight: 60 }]}
            />

            <TouchableOpacity
              testID="up-save"
              onPress={save}
              style={{
                marginTop: 16,
                paddingVertical: 16,
                borderRadius: 999,
                backgroundColor: COLORS.textPrimary,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#fff", fontFamily: FONTS.bodyBold, fontSize: 15 }}>
                {editing ? "Save Changes" : "Add Upcoming"}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const inputStyle = {
  borderWidth: 1,
  borderColor: COLORS.border,
  borderRadius: 14,
  padding: 14,
  marginTop: 8,
  marginBottom: 14,
  backgroundColor: COLORS.surface,
  fontFamily: FONTS.bodyMed,
  fontSize: 14,
  color: COLORS.textPrimary,
} as const;
