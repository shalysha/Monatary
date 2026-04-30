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
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { api, Category } from "../../api";
import {
  COLORS, FONTS, RADIUS, SPACING, TYPE,
  formatCAD, ACCOUNT_LABELS,
  styles as g,
} from "../../theme";
import {
  Card,
  Button,
  Heading,
  Label,
  BodyText,
  ProgressBar,
  ColorDot,
} from "../../components/ui";

const FALLBACK_PARENT_ORDER = ["fixed_expenses", "variable", "general", "his", "hers", "savings"];

// ─── Small Pill chip used inline on category rows ─────────────────────────────

function Pill({
  label,
  icon,
  filled,
  color,
  onPress,
  testID,
}: {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  filled?: boolean;
  color?: string;
  onPress: () => void;
  testID?: string;
}) {
  const borderColor = color || COLORS.border;
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      style={[
        s.pill,
        filled
          ? { backgroundColor: borderColor, borderColor: borderColor }
          : { borderColor, backgroundColor: "transparent" },
      ]}
    >
      <Feather name={icon} color={filled ? "#fff" : COLORS.textSecondary} size={10} />
      <Text style={[s.pillText, { color: filled ? "#fff" : COLORS.textSecondary }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─── Chip badge (GROUP / FIXED label) ────────────────────────────────────────

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <View style={[s.badge, { backgroundColor: `${color}18` }]}>
      <Text style={[s.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function BudgetScreen() {
  const [categories,  setCategories]  = useState<Category[]>([]);
  const [accounts,    setAccounts]    = useState<{ key: string; name: string; color: string }[]>([]);
  const [refreshing,  setRefreshing]  = useState(false);
  const [editing,     setEditing]     = useState<Category | null>(null);
  const [adding,      setAdding]      = useState<string | null>(null);
  const [addingSubTo, setAddingSubTo] = useState<Category | null>(null);
  const [collapsed,   setCollapsed]   = useState<Set<string>>(new Set());
  const [draftName,   setDraftName]   = useState("");
  const [draftAmount, setDraftAmount] = useState("");
  const [draftAuto,   setDraftAuto]   = useState(false);

  const load = async () => {
    try {
      const d = await api.dashboard();
      setCategories(d.categories || []);
      setAccounts(d.accounts.map((a) => ({ key: a.key, name: a.name, color: a.color })));
    } catch (e) { console.warn(e); }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const seedBudget = () =>
    Alert.alert(
      "Load preset budget?",
      "This will replace existing categories with the preset (14 fixed + 7 variable items).",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Load", onPress: async () => { await api.seedBudget(); load(); } },
      ]
    );

  const startEdit = (cat: Category) => {
    setEditing(cat); setDraftName(cat.name);
    setDraftAmount(String(cat.monthly_target)); setDraftAuto(cat.auto_create);
  };
  const startAdd = (parent: string) => {
    setAdding(parent); setAddingSubTo(null);
    setDraftName(""); setDraftAmount(""); setDraftAuto(parent === "fixed_expenses");
  };
  const startAddSub = (parentCat: Category) => {
    setAddingSubTo(parentCat); setAdding(null); setEditing(null);
    setDraftName(""); setDraftAmount(""); setDraftAuto(false);
  };
  const closeModal = () => { setEditing(null); setAdding(null); setAddingSubTo(null); };

  const saveDraft = async () => {
    const amt = parseFloat(draftAmount || "0");
    if (!draftName.trim()) { Alert.alert("Missing", "Name is required"); return; }
    if (editing) {
      await api.updateCategory(editing.id, {
        name: draftName.trim(), monthly_target: amt, auto_create: draftAuto,
      });
    } else if (addingSubTo) {
      await api.createCategory({
        name: draftName.trim(), parent_account: addingSubTo.parent_account,
        parent_id: addingSubTo.id, monthly_target: amt, auto_create: draftAuto, day_of_month: 1,
      });
    } else if (adding) {
      await api.createCategory({
        name: draftName.trim(), parent_account: adding,
        monthly_target: amt, auto_create: draftAuto, day_of_month: 1,
      });
    }
    closeModal(); load();
  };

  const deleteCat = (cat: Category) =>
    Alert.alert("Delete category?", `Remove "${cat.name}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await api.deleteCategory(cat.id); load(); } },
    ]);

  const runCat = (cat: Category) =>
    Alert.alert(
      `Log ${cat.name}?`,
      `Records ${formatCAD(cat.monthly_target)} as cash spend from ${ACCOUNT_LABELS[cat.parent_account]} for ${cat.name}.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Log Now", onPress: async () => { await api.runCategory(cat.id); load(); } },
      ]
    );

  // ── Derived data ────────────────────────────────────────────────────────────

  const PARENT_ORDER = accounts.length > 0 ? accounts.map((a) => a.key) : FALLBACK_PARENT_ORDER;
  const PARENT_COLORS: Record<string, string> = {};
  accounts.forEach((a) => (PARENT_COLORS[a.key] = a.color));
  PARENT_ORDER.forEach((k) => {
    if (!PARENT_COLORS[k]) PARENT_COLORS[k] = COLORS.accounts[k] || COLORS.textSecondary;
  });

  const accountLabel = (key: string) =>
    accounts.find((x) => x.key === key)?.name ?? ACCOUNT_LABELS[key] ?? key;

  const byParent: Record<string, Category[]> = {};
  PARENT_ORDER.forEach((p) => (byParent[p] = []));
  categories.forEach((c) => {
    if (!byParent[c.parent_account]) byParent[c.parent_account] = [];
    byParent[c.parent_account].push(c);
  });

  const allCatsByParent: Record<string, Category[]> = {};
  categories.forEach((c) => {
    if (c.parent_id) (allCatsByParent[c.parent_id] = allCatsByParent[c.parent_id] || []).push(c);
  });
  const hasChildren = (id: string) => !!allCatsByParent[id]?.length;

  const renderOrder: Record<string, Category[]> = {};
  PARENT_ORDER.forEach((pk) => {
    const all  = byParent[pk] || [];
    const roots = all.filter((c) => !c.parent_id);
    const childMap: Record<string, Category[]> = {};
    all.forEach((c) => { if (c.parent_id) (childMap[c.parent_id] = childMap[c.parent_id] || []).push(c); });
    const ordered: Category[] = [];
    roots.forEach((r) => { ordered.push(r); if (!collapsed.has(r.id)) (childMap[r.id] || []).forEach((ch) => ordered.push(ch)); });
    renderOrder[pk] = ordered;
  });

  const totalsByParent: Record<string, { target: number; spent: number }> = {};
  PARENT_ORDER.forEach((p) => {
    const items = byParent[p] || [];
    const childIds = new Set(items.filter((c) => c.parent_id).map((c) => c.parent_id!));
    let target = 0, spent = 0;
    items.forEach((c) => { if (childIds.has(c.id)) return; target += c.monthly_target || 0; spent += c.spent_this_month || 0; });
    totalsByParent[p] = { target, spent };
  });
  const grandTarget = Object.values(totalsByParent).reduce((s, v) => s + v.target, 0);
  const hasAny = categories.length > 0;

  const toggleCollapse = (id: string) => {
    const next = new Set(collapsed);
    next.has(id) ? next.delete(id) : next.add(id);
    setCollapsed(next);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={g.screen} edges={["top"]}>
      {/* Header */}
      <View style={s.pageHeader}>
        <Label style={{ marginBottom: 4 }}>Budget</Label>
        <Heading level={1}>Categories</Heading>
        <BodyText secondary style={{ marginTop: 4 }}>
          {hasAny ? `Total monthly target: ${formatCAD(grandTarget)}` : "Tap below to load your preset budget."}
        </BodyText>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        testID="budget-scroll"
      >
        {/* Seed budget CTA */}
        {!hasAny && (
          <Button
            testID="seed-budget"
            label="Load Preset Budget"
            icon="download"
            variant="accent"
            onPress={seedBudget}
            style={{ marginBottom: SPACING.lg }}
          />
        )}

        {/* Account buckets */}
        {PARENT_ORDER.map((parent) => {
          const items = renderOrder[parent] || [];
          const tot   = totalsByParent[parent];
          const pct   = tot.target > 0 ? Math.min(100, (tot.spent / tot.target) * 100) : 0;
          const color = PARENT_COLORS[parent];

          return (
            <View key={parent} style={{ marginBottom: SPACING.xl }} testID={`bucket-${parent}`}>
              {/* Bucket header */}
              <View style={[g.row, { marginBottom: SPACING.sm }]}>
                <ColorDot color={color} size={12} />
                <Heading level={2} style={{ flex: 1, marginLeft: SPACING.sm }}>{accountLabel(parent)}</Heading>
                <BodyText medium style={{ fontSize: 14, color: COLORS.textPrimary }}>
                  {formatCAD(tot.spent)} / {formatCAD(tot.target)}
                </BodyText>
              </View>

              {tot.target > 0 && (
                <ProgressBar percent={pct} color={color} style={{ marginBottom: SPACING.md }} />
              )}

              {/* Category rows */}
              {items.map((c) => {
                const isChild     = !!c.parent_id;
                const isGroup     = hasChildren(c.id);
                const isCollapsed = collapsed.has(c.id);
                const target      = isGroup ? (c.effective_target ?? c.monthly_target) : c.monthly_target;
                const cpct        = target > 0 ? Math.min(100, ((c.spent_this_month || 0) / target) * 100) : 0;

                return (
                  <TouchableOpacity
                    key={c.id}
                    testID={`category-${c.id}`}
                    onPress={() => isGroup ? toggleCollapse(c.id) : startEdit(c)}
                    onLongPress={() => startEdit(c)}
                    activeOpacity={0.75}
                    style={{ marginLeft: isChild ? 24 : 0, marginBottom: 6 }}
                  >
                    <Card
                      muted={isGroup}
                      style={{ padding: SPACING.md }}
                    >
                      {/* Row: name + value */}
                      <View style={[g.row, { marginBottom: SPACING.sm }]}>
                        {isChild && (
                          <Text style={{ color: COLORS.textTertiary, fontSize: 12, marginRight: 6 }}>└</Text>
                        )}
                        {isGroup && (
                          <TouchableOpacity
                            testID={`toggle-${c.id}`}
                            onPress={() => toggleCollapse(c.id)}
                            hitSlop={8}
                            style={{ marginRight: 6 }}
                          >
                            <Feather
                              name={isCollapsed ? "chevron-right" : "chevron-down"}
                              size={15}
                              color={COLORS.textSecondary}
                            />
                          </TouchableOpacity>
                        )}
                        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <Text style={[s.catName, isGroup && { fontSize: 15 }]}>{c.name}</Text>
                          {isGroup      && <Badge label="GROUP" color={COLORS.textSecondary} />}
                          {c.auto_create && !isGroup && <Badge label="FIXED" color={COLORS.positive} />}
                        </View>
                        <Text style={[s.catAmount, c.over_budget && { color: COLORS.negative }]}>
                          {formatCAD(c.spent_this_month || 0)} / {formatCAD(target)}
                        </Text>
                      </View>

                      {/* Progress */}
                      <ProgressBar
                        percent={cpct}
                        color={c.over_budget ? COLORS.negative : color}
                        style={{ height: isGroup ? 6 : 4 }}
                      />

                      {/* Action pills */}
                      <View style={{ flexDirection: "row", marginTop: SPACING.sm, gap: 6, flexWrap: "wrap" }}>
                        {!isGroup && c.auto_create && (
                          <Pill
                            testID={`run-${c.id}`}
                            label="Log Now"
                            icon="zap"
                            filled
                            color={COLORS.textPrimary}
                            onPress={() => runCat(c)}
                          />
                        )}
                        <Pill testID={`add-sub-${c.id}`} label="Add Sub" icon="plus"     onPress={() => startAddSub(c)} />
                        <Pill testID={`edit-${c.id}`}    label="Edit"    icon="edit-2"   onPress={() => startEdit(c)} />
                        <Pill
                          testID={`delete-${c.id}`}
                          label={isGroup ? "Delete Group" : "Delete"}
                          icon="trash-2"
                          onPress={() => deleteCat(c)}
                        />
                      </View>
                    </Card>
                  </TouchableOpacity>
                );
              })}

              {/* Add category row */}
              <TouchableOpacity
                testID={`add-cat-${parent}`}
                onPress={() => startAdd(parent)}
                style={s.addRow}
              >
                <Feather name="plus" color={COLORS.textTertiary} size={14} />
                <Text style={s.addRowText}>Add to {accountLabel(parent)}</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>

      {/* ── Edit / Add Modal ─────────────────────────────────────────────────── */}
      <Modal
        visible={!!editing || !!adding || !!addingSubTo}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={s.modalBackdrop}
        >
          <View style={s.modalSheet}>
            {/* Modal header */}
            <View style={[g.row, { marginBottom: SPACING.lg }]}>
              <Heading level={2} style={{ flex: 1 }}>
                {editing
                  ? "Edit Category"
                  : addingSubTo
                  ? `Sub-category of ${addingSubTo.name}`
                  : "New Category"}
              </Heading>
              <TouchableOpacity onPress={closeModal} testID="modal-close" hitSlop={8}>
                <Feather name="x" color={COLORS.textPrimary} size={22} />
              </TouchableOpacity>
            </View>

            {/* Name field */}
            <Label style={{ marginBottom: SPACING.sm }}>Name</Label>
            <TextInput
              testID="cat-name"
              value={draftName}
              onChangeText={setDraftName}
              placeholder="e.g. Phone, Groceries"
              placeholderTextColor={COLORS.textTertiary}
              style={s.input}
            />

            {/* Amount field */}
            <Label style={{ marginBottom: SPACING.sm, marginTop: SPACING.md }}>Monthly Target (CAD)</Label>
            <View style={s.amountRow}>
              <Text style={s.currencySymbol}>$</Text>
              <TextInput
                testID="cat-amount"
                value={draftAmount}
                onChangeText={setDraftAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={COLORS.textTertiary}
                style={s.amountInput}
              />
            </View>

            {/* Auto-fill toggle */}
            <TouchableOpacity
              testID="cat-auto-toggle"
              onPress={() => setDraftAuto(!draftAuto)}
              style={[s.toggle, draftAuto && { borderColor: COLORS.positive, backgroundColor: `${COLORS.positive}10` }]}
            >
              <View style={[s.checkbox, draftAuto && { borderColor: COLORS.positive, backgroundColor: COLORS.positive }]}>
                {draftAuto && <Feather name="check" color="#fff" size={13} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.toggleLabel}>Recurring (auto-fill)</Text>
                <BodyText secondary small style={{ marginTop: 2 }}>
                  Show "Log Now" button to record this fixed amount once a month
                </BodyText>
              </View>
            </TouchableOpacity>

            {/* Save */}
            <Button testID="cat-save" label="Save" onPress={saveDraft} style={{ marginTop: SPACING.sm }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Local styles ─────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  pageHeader: {
    paddingHorizontal: SPACING.lg,
    paddingTop:        SPACING.md,
    paddingBottom:     SPACING.base,
  },
  pill: {
    paddingVertical:   5,
    paddingHorizontal: 9,
    borderRadius:      RADIUS.full,
    borderWidth:       1,
    flexDirection:     "row",
    alignItems:        "center",
    gap:               4,
  },
  pillText: {
    fontFamily: FONTS.bodyMed,
    fontSize:   10,
    letterSpacing: 0.3,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical:   2,
    borderRadius:      RADIUS.full,
  },
  badgeText: {
    fontFamily:    FONTS.bodyBold,
    fontSize:      9,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  catName: {
    fontFamily: FONTS.bodyBold,
    fontSize:   14,
    color:      COLORS.textPrimary,
  },
  catAmount: {
    fontFamily: FONTS.bodyBold,
    fontSize:   13,
    color:      COLORS.textPrimary,
  },
  addRow: {
    marginTop:      6,
    paddingVertical: SPACING.sm,
    borderRadius:   RADIUS.md,
    borderWidth:    1,
    borderStyle:    "dashed",
    borderColor:    COLORS.border,
    alignItems:     "center",
    flexDirection:  "row",
    justifyContent: "center",
    gap:            6,
  },
  addRowText: {
    color:      COLORS.textTertiary,
    fontFamily: FONTS.bodyMed,
    fontSize:   12,
  },

  // Modal
  modalBackdrop: {
    flex:             1,
    justifyContent:   "flex-end",
    backgroundColor:  "rgba(45,58,49,0.45)",
  },
  modalSheet: {
    backgroundColor:     COLORS.background,
    borderTopLeftRadius:  RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding:             SPACING.xl,
    paddingBottom:       40,
  },
  input: {
    borderWidth:       1,
    borderColor:       COLORS.border,
    borderRadius:      RADIUS.md,
    padding:           SPACING.md,
    backgroundColor:   COLORS.surface,
    fontFamily:        FONTS.bodyMed,
    fontSize:          15,
    color:             COLORS.textPrimary,
    marginBottom:      4,
  },
  amountRow: {
    flexDirection:   "row",
    alignItems:      "center",
    borderWidth:     1,
    borderColor:     COLORS.border,
    borderRadius:    RADIUS.md,
    paddingHorizontal: SPACING.md,
    backgroundColor: COLORS.surface,
    marginBottom:    4,
  },
  currencySymbol: {
    fontFamily: FONTS.bodyMed,
    fontSize:   18,
    color:      COLORS.textSecondary,
    marginRight: 6,
  },
  amountInput: {
    flex:        1,
    paddingVertical: SPACING.md,
    fontFamily:  FONTS.bodyBold,
    fontSize:    18,
    color:       COLORS.textPrimary,
  },
  toggle: {
    flexDirection:  "row",
    alignItems:     "center",
    padding:        SPACING.md,
    borderRadius:   RADIUS.md,
    borderWidth:    1,
    borderColor:    COLORS.border,
    backgroundColor: COLORS.surface,
    marginTop:      SPACING.md,
    gap:            SPACING.md,
  },
  toggleLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize:   14,
    color:      COLORS.textPrimary,
  },
  checkbox: {
    width:          22,
    height:         22,
    borderRadius:   6,
    borderWidth:    1.5,
    borderColor:    COLORS.border,
    alignItems:     "center",
    justifyContent: "center",
  },
});
