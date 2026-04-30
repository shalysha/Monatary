import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api, Dashboard } from "../../api";
import {
  COLORS, FONTS, SPACING, RADIUS, TYPE,
  formatCAD, ACCOUNT_LABELS, CARD_LABELS,
  styles as g,
} from "../../theme";
import {
  Card,
  Button,
  Heading,
  Label,
  BodyText,
  AlertBanner,
  StatRow,
  ProgressBar,
  ColorDot,
} from "../../components/ui";

export default function DashboardScreen() {
  const router = useRouter();
  const [data, setData]           = useState<Dashboard | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const d = await api.dashboard();
      setData(d);
    } catch (e) {
      console.warn(e);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));
  useEffect(() => { api.init().catch(() => {}); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (!data) {
    return (
      <SafeAreaView style={g.screen} edges={["top"]}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={COLORS.primary} />
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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
          />
        }
        testID="dashboard-scroll"
      >
        {/* ── Header ──────────────────────────────────────────── */}
        <View style={{ marginBottom: SPACING.xl }}>
          <Label style={{ marginBottom: 6 }}>Zero-Based Budget · CAD</Label>
          <Heading level={1}>Hello there.</Heading>
          <BodyText secondary style={{ marginTop: 4 }}>
            {new Date().toLocaleDateString("en-CA", {
              weekday: "long",
              month:   "long",
              day:     "numeric",
            })}
          </BodyText>
        </View>

        {/* ── Net Position card ────────────────────────────────── */}
        <Card style={{ marginBottom: SPACING.base }} testID="net-position-card">
          <Label style={{ marginBottom: SPACING.sm }}>Projected Net Position</Label>
          <Text
            testID="net-projected"
            style={{
              fontFamily: FONTS.heading,
              fontSize:   42,
              letterSpacing: -1.2,
              color: totals.total_projected < 0 ? COLORS.negative : COLORS.textPrimary,
              marginTop: 4,
            }}
          >
            {formatCAD(totals.total_projected)}
          </Text>
          <StatRow
            left={{
              label:      "In Banks",
              value:      formatCAD(totals.total_balance),
              valueColor: COLORS.positive,
            }}
            right={{
              label:      "Owed on Cards",
              value:      formatCAD(totals.total_owed),
              valueColor: COLORS.negative,
            }}
          />
        </Card>

        {/* ── Negative balance alert ───────────────────────────── */}
        {negativeAccount && (
          <AlertBanner
            testID="negative-alert"
            message={`${ACCOUNT_LABELS[negativeAccount.key]} will be negative after card transfers.`}
            variant="error"
            style={{ marginBottom: SPACING.base }}
          />
        )}

        {/* ── Quick actions ────────────────────────────────────── */}
        <View style={{ flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.xl }}>
          <Button
            testID="quick-add-income"
            style={{ flex: 1 }}
            variant="accent"
            label="Income"
            icon="arrow-down-left"
            onPress={() => router.push("/add-income")}
          />
          <Button
            testID="quick-add-expense"
            style={{ flex: 1 }}
            variant="primary"
            label="Expense"
            icon="arrow-up-right"
            onPress={() => router.push("/add-expense")}
          />
        </View>

        {/* ── Bank Accounts ────────────────────────────────────── */}
        <Heading level={2} style={{ marginBottom: SPACING.md }}>
          Bank Accounts
        </Heading>
        {accounts.map((a) => {
          const allocated = a.target        || 0;
          const spent     = a.spent_this_month || 0;
          const pct = allocated > 0 ? Math.min(100, (spent / allocated) * 100) : 0;

          return (
            <Card
              key={a.key}
              style={{ marginBottom: SPACING.md }}
              testID={`account-card-${a.key}`}
            >
              {/* Account header row */}
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: SPACING.sm }}>
                <ColorDot color={a.color} size={10} />
                <Heading
                  level={3}
                  style={{ flex: 1, marginLeft: SPACING.sm }}
                >
                  {ACCOUNT_LABELS[a.key]}
                </Heading>
                <Text
                  testID={`account-projected-${a.key}`}
                  style={{
                    fontFamily: FONTS.bodyBold,
                    fontSize:   18,
                    color: a.is_negative_projected ? COLORS.negative : COLORS.textPrimary,
                  }}
                >
                  {formatCAD(a.projected_balance)}
                </Text>
              </View>

              {/* Balance meta row */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: SPACING.sm }}>
                <BodyText secondary small>Balance {formatCAD(a.balance)}</BodyText>
                <BodyText secondary small>− {formatCAD(a.owed_to_cards)} owed</BodyText>
              </View>

              {/* Spend progress bar */}
              {allocated > 0 && (
                <>
                  <ProgressBar percent={pct} color={a.color} />
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
                    <BodyText small secondary>Spent {formatCAD(spent)}</BodyText>
                    <BodyText small secondary>Target {formatCAD(allocated)}</BodyText>
                  </View>
                </>
              )}
            </Card>
          );
        })}

        {/* ── Credit Cards ─────────────────────────────────────── */}
        <Heading level={2} style={{ marginBottom: SPACING.md, marginTop: SPACING.base }}>
          Credit Cards
        </Heading>
        {cards.map((c) => (
          <Card
            key={c.key}
            colored={c.color}
            style={{ marginBottom: SPACING.md }}
            testID={`card-summary-${c.key}`}
          >
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: SPACING.sm }}>
              <Feather name="credit-card" color="rgba(255,255,255,0.85)" size={18} />
              <Text
                style={{
                  fontFamily: FONTS.headingMed,
                  color:      "#fff",
                  fontSize:   18,
                  marginLeft: SPACING.sm,
                  flex:       1,
                }}
              >
                {CARD_LABELS[c.key]}
              </Text>
              <Text
                style={{
                  fontFamily: FONTS.bodyBold,
                  color:      "#fff",
                  fontSize:   20,
                }}
              >
                {formatCAD(c.balance)}
              </Text>
            </View>
            <Text
              style={{
                ...TYPE.label,
                color:          "rgba(255,255,255,0.65)",
                textTransform:  "uppercase",
              }}
            >
              Balance to clear
            </Text>
          </Card>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
