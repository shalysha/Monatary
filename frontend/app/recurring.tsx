import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, Category } from "../api";
import { COLORS, FONTS, formatCAD, ACCOUNT_LABELS, styles as g } from "../theme";

export default function RecurringScreen() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const currentMonth = new Date().toISOString().slice(0, 7);

  const load = async () => {
    const all = await api.categories();
    setCategories(all.filter((c) => c.auto_create));
  };

  useEffect(() => {
    load();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const runIt = (c: Category) => {
    Alert.alert(
      `Log ${c.name}?`,
      `Records ${formatCAD(c.monthly_target)} as cash spend from ${ACCOUNT_LABELS[c.parent_account]}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Now",
          onPress: async () => {
            try {
              await api.runCategory(c.id);
              load();
            } catch (e: any) {
              Alert.alert("Error", e.message || "Failed");
            }
          },
        },
      ]
    );
  };

  const skipIt = async (c: Category) => {
    await api.skipCategory(c.id, currentMonth);
    load();
  };

  const unskipIt = async (c: Category) => {
    await api.unskipCategory(c.id, currentMonth);
    load();
  };

  // Stats
  const total = categories.reduce((s, c) => s + (c.monthly_target || 0), 0);
  const logged = categories.filter((c) => c.last_run_month === currentMonth);
  const skipped = categories.filter((c) => (c.skipped_months || []).includes(currentMonth));
  const pending = categories.filter(
    (c) => c.last_run_month !== currentMonth && !(c.skipped_months || []).includes(currentMonth)
  );
  const pendingTotal = pending.reduce((s, c) => s + (c.monthly_target || 0), 0);

  const renderItem = (c: Category, status: "logged" | "skipped" | "pending") => (
    <View key={c.id} style={[g.card, { marginBottom: 10, padding: 14 }]} testID={`recurring-${c.id}`}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 15, color: COLORS.textPrimary }}>{c.name}</Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>
            {ACCOUNT_LABELS[c.parent_account]}
          </Text>
        </View>
        <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 17, color: COLORS.textPrimary }}>
          {formatCAD(c.monthly_target)}
        </Text>
      </View>

      {status === "logged" && (
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, gap: 6 }}>
          <Feather name="check-circle" color={COLORS.positive} size={14} />
          <Text style={{ fontFamily: FONTS.bodyMed, color: COLORS.positive, fontSize: 12 }}>
            Logged this month
          </Text>
        </View>
      )}
      {status === "skipped" && (
        <View style={{ flexDirection: "row", marginTop: 6, gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: 6 }}>
            <Feather name="slash" color={COLORS.textSecondary} size={14} />
            <Text style={{ fontFamily: FONTS.bodyMed, color: COLORS.textSecondary, fontSize: 12 }}>
              Skipped this month
            </Text>
          </View>
          <TouchableOpacity
            testID={`unskip-${c.id}`}
            onPress={() => unskipIt(c)}
            style={{
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: COLORS.border,
            }}
          >
            <Text style={{ fontFamily: FONTS.bodyMed, color: COLORS.textPrimary, fontSize: 11 }}>Un-skip</Text>
          </TouchableOpacity>
        </View>
      )}
      {status === "pending" && (
        <View style={{ flexDirection: "row", marginTop: 8, gap: 8 }}>
          <TouchableOpacity
            testID={`run-${c.id}`}
            onPress={() => runIt(c)}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 999,
              backgroundColor: COLORS.textPrimary,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <Feather name="zap" color="#fff" size={12} />
            <Text style={{ color: "#fff", fontFamily: FONTS.bodyBold, fontSize: 12 }}>Log Now</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID={`skip-${c.id}`}
            onPress={() => skipIt(c)}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: COLORS.border,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <Feather name="slash" color={COLORS.textSecondary} size={12} />
            <Text style={{ color: COLORS.textSecondary, fontFamily: FONTS.bodyMed, fontSize: 12 }}>
              Skip
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={g.screen} edges={["top", "bottom"]}>
      <View style={{ flexDirection: "row", alignItems: "center", padding: 16 }}>
        <TouchableOpacity onPress={() => router.back()} testID="recurring-close" hitSlop={10}>
          <Feather name="x" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={[g.h2, { marginLeft: 12 }]}>Recurring</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        testID="recurring-scroll"
      >
        <View style={[g.card, { marginBottom: 16, padding: 16 }]}>
          <Text style={g.label}>Month: {currentMonth}</Text>
          <Text style={{ fontFamily: FONTS.heading, fontSize: 28, color: COLORS.textPrimary, marginTop: 8 }}>
            {formatCAD(total)}
          </Text>
          <Text style={{ fontFamily: FONTS.body, fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>
            Total recurring across {categories.length} items
          </Text>
          <View style={{ flexDirection: "row", marginTop: 14, gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={g.label}>Logged</Text>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: COLORS.positive, marginTop: 4 }}>
                {logged.length}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={g.label}>Pending</Text>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: COLORS.warning, marginTop: 4 }}>
                {pending.length} · {formatCAD(pendingTotal)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={g.label}>Skipped</Text>
              <Text style={{ fontFamily: FONTS.bodyBold, fontSize: 14, color: COLORS.textSecondary, marginTop: 4 }}>
                {skipped.length}
              </Text>
            </View>
          </View>
        </View>

        {pending.length > 0 && (
          <>
            <Text style={[g.h3, { marginBottom: 10 }]}>Pending</Text>
            {pending.map((c) => renderItem(c, "pending"))}
          </>
        )}

        {logged.length > 0 && (
          <>
            <Text style={[g.h3, { marginTop: 8, marginBottom: 10 }]}>Logged this month</Text>
            {logged.map((c) => renderItem(c, "logged"))}
          </>
        )}

        {skipped.length > 0 && (
          <>
            <Text style={[g.h3, { marginTop: 8, marginBottom: 10 }]}>Skipped</Text>
            {skipped.map((c) => renderItem(c, "skipped"))}
          </>
        )}

        {categories.length === 0 && (
          <View style={[g.card, { alignItems: "center", padding: 40 }]}>
            <Feather name="inbox" size={32} color={COLORS.textSecondary} />
            <Text style={[g.body, { marginTop: 12, color: COLORS.textSecondary }]}>
              No recurring items. Toggle "Recurring" on a category in the Budget tab.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
