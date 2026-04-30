import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api, Account, AnalyticsMonth, UpcomingExpense } from "../../api";
import {
  COLORS, FONTS, RADIUS, SPACING, TYPE,
  formatCAD, ACCOUNT_LABELS,
  styles as g,
} from "../../theme";
import {
  Card,
  Heading,
  Label,
  BodyText,
  Button,
  ColorDot,
  Divider,
} from "../../components/ui";

type Period = "3m" | "6m" | "12m" | "ytd";

// ─── Nav tile ─────────────────────────────────────────────────────────────────

function NavTile({
  icon,
  title,
  subtitle,
  iconBg,
  iconColor,
  onPress,
  testID,
}: {
  icon:       keyof typeof Feather.glyphMap;
  title:      string;
  subtitle:   string;
  iconBg:     string;
  iconColor:  string;
  onPress:    () => void;
  testID?:    string;
}) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      activeOpacity={0.78}
      style={{ flex: 1 }}
    >
      <Card style={s.navTile}>
        <View style={[s.navIcon, { backgroundColor: iconBg }]}>
          <Feather name={icon} color={iconColor} size={18} />
        </View>
        <Text style={s.navTitle}>{title}</Text>
        <BodyText secondary small style={{ marginTop: 2 }}>{subtitle}</BodyText>
      </Card>
    </TouchableOpacity>
  );
}

// ─── Period selector pill ─────────────────────────────────────────────────────

function PeriodPill({
  label,
  active,
  onPress,
  testID,
}: {
  label:   string;
  active:  boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        s.periodPill,
        active
          ? { backgroundColor: COLORS.textPrimary, borderColor: COLORS.textPrimary }
          : { backgroundColor: "transparent", borderColor: COLORS.border },
      ]}
    >
      <Text style={[s.periodPillText, { color: active ? "#fff" : COLORS.textSecondary }]}>
        {label === "ytd" ? "YTD" : label.toUpperCase()}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Bar chart ────────────────────────────────────────────────────────────────

function InsightsChart({
  analytics,
  maxVal,
}: {
  analytics: AnalyticsMonth[];
  maxVal:    number;
}) {
  return (
    <>
      <View style={s.chartBars}>
        {analytics.map((m) => {
          const incH = (m.income  / maxVal) * 110;
          const expH = (m.expense / maxVal) * 110;
          return (
            <View key={m.month} style={s.chartCol}>
              <View style={s.barPair}>
                <View style={[s.bar, { height: incH, backgroundColor: COLORS.positive }]} />
                <View style={[s.bar, { height: expH, backgroundColor: COLORS.negative }]} />
              </View>
              <Text style={s.barLabel}>{m.month.slice(5)}</Text>
            </View>
          );
        })}
      </View>

      {/* Legend */}
      <View style={s.legend}>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: COLORS.positive }]} />
          <BodyText secondary small>Income</BodyText>
        </View>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: COLORS.negative }]} />
          <BodyText secondary small>Expenses</BodyText>
        </View>
      </View>

      {/* Recent net rows */}
      <Divider style={{ marginTop: SPACING.md, marginBottom: SPACING.sm }} />
      {analytics.slice(-3).reverse().map((m) => (
        <View key={m.month} style={s.netRow}>
          <Text style={s.netMonth}>{m.month}</Text>
          <Text style={[s.netValue, { color: m.net >= 0 ? COLORS.positive : COLORS.negative }]}>
            Net {formatCAD(m.net)}
          </Text>
        </View>
      ))}
    </>
  );
}

// ─── Account balance editor row ───────────────────────────────────────────────

function AccountBalanceRow({
  account,
  value,
  onChange,
  onSave,
}: {
  account:  Account;
  value:    string;
  onChange: (v: string) => void;
  onSave:   () => void;
}) {
  return (
    <Card style={[s.balanceCard, { marginBottom: SPACING.sm }]} testID={`settings-card-${account.key}`}>
      <View style={[g.row, { marginBottom: SPACING.sm }]}>
        <ColorDot color={account.color} size={10} />
        <Text style={[s.balanceLabel, { flex: 1, marginLeft: SPACING.sm }]}>
          {ACCOUNT_LABELS[account.key]}
        </Text>
        <BodyText secondary small>Target {formatCAD(account.target)}</BodyText>
      </View>
      <View style={g.row}>
        <View style={s.balanceInputWrap}>
          <Text style={s.currencySymbol}>$</Text>
          <TextInput
            testID={`balance-input-${account.key}`}
            value={value}
            onChangeText={onChange}
            keyboardType="decimal-pad"
            style={s.balanceInput}
          />
        </View>
        <TouchableOpacity
          testID={`save-balance-${account.key}`}
          style={[s.setBtn, { backgroundColor: account.color }]}
          onPress={onSave}
          activeOpacity={0.8}
        >
          <Text style={s.setBtnText}>Set</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const router = useRouter();
  const [accounts,      setAccounts]      = useState<Account[]>([]);
  const [balanceEdits,  setBalanceEdits]  = useState<Record<string, string>>({});
  const [analytics,     setAnalytics]     = useState<AnalyticsMonth[]>([]);
  const [period,        setPeriod]        = useState<Period>("6m");
  const [upcomingItems, setUpcomingItems] = useState<UpcomingExpense[]>([]);

  const load = async (p: Period = period) => {
    const [a, an, up] = await Promise.all([
      api.accounts(),
      api.analyticsByPeriod(p),
      api.upcoming(),
    ]);
    setAccounts(a);
    setAnalytics(an.months);
    setUpcomingItems(up);
    const b: Record<string, string> = {};
    a.forEach((acc) => (b[acc.key] = String(acc.balance || 0)));
    setBalanceEdits(b);
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const changePeriod = async (p: Period) => {
    setPeriod(p);
    const an = await api.analyticsByPeriod(p);
    setAnalytics(an.months);
  };

  const saveBalance = async (key: string) => {
    const v = parseFloat(balanceEdits[key] || "0");
    await api.updateAccount(key, { balance: v });
    Alert.alert("Saved", `${ACCOUNT_LABELS[key]} balance set to ${formatCAD(v)}`);
    load();
  };

  const reset = () =>
    Alert.alert(
      "Reset Everything?",
      "This deletes all accounts, cards, income, expenses, and categories. Cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Reset", style: "destructive", onPress: async () => { await api.reset(); load(); } },
      ]
    );

  const rollover = () =>
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

  const pendingUpcoming = upcomingItems.filter((i) => !i.realized);
  const maxVal = Math.max(1, ...analytics.flatMap((m) => [m.income, m.expense]));
  const hasData = analytics.length > 0 && analytics.some((m) => m.income > 0 || m.expense > 0);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={g.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={g.scroll} testID="settings-scroll">
        <Label style={{ marginBottom: 4 }}>Settings</Label>
        <Heading level={1} style={{ marginBottom: SPACING.lg }}>Tools & History</Heading>

        {/* ── Nav tiles ───────────────────────────────────────────── */}
        <View style={s.navRow}>
          <NavTile
            testID="nav-recurring"
            icon="repeat"
            title="Recurring"
            subtitle="Edit & skip monthly bills"
            iconBg={`${COLORS.positive}18`}
            iconColor={COLORS.positive}
            onPress={() => router.push("/recurring")}
          />
          <NavTile
            testID="nav-upcoming"
            icon="calendar"
            title="Upcoming"
            subtitle={
              pendingUpcoming.length > 0
                ? `${pendingUpcoming.length} pending · ${formatCAD(pendingUpcoming.reduce((s, i) => s + i.amount, 0))}`
                : "Track large irregular costs"
            }
            iconBg={`${COLORS.warning}28`}
            iconColor={COLORS.warning}
            onPress={() => router.push("/upcoming")}
          />
        </View>

        {/* ── Insights ────────────────────────────────────────────── */}
        <Card style={{ marginBottom: SPACING.base }} testID="insights-card">
          <View style={[g.row, { marginBottom: SPACING.md }]}>
            <Feather name="bar-chart-2" color={COLORS.textPrimary} size={18} />
            <Heading level={3} style={{ marginLeft: SPACING.sm, flex: 1 }}>Insights</Heading>
          </View>

          {/* Period selector */}
          <View style={s.periodRow}>
            {(["3m", "6m", "12m", "ytd"] as Period[]).map((p) => (
              <PeriodPill
                key={p}
                testID={`period-${p}`}
                label={p}
                active={period === p}
                onPress={() => changePeriod(p)}
              />
            ))}
          </View>

          {!hasData ? (
            <BodyText secondary style={{ fontSize: 13 }}>
              No data yet — add income & expenses to see trends.
            </BodyText>
          ) : (
            <InsightsChart analytics={analytics} maxVal={maxVal} />
          )}
        </Card>

        {/* ── Close Month ─────────────────────────────────────────── */}
        <Card style={{ marginBottom: SPACING.base }}>
          <View style={[g.row, { marginBottom: SPACING.sm }]}>
            <Feather name="refresh-cw" color={COLORS.textPrimary} size={18} />
            <Heading level={3} style={{ marginLeft: SPACING.sm }}>Close Month</Heading>
          </View>
          <BodyText secondary style={{ fontSize: 13, marginBottom: SPACING.md }}>
            Sweep any leftover positive balance from your bucket accounts into Savings.
          </BodyText>
          <Button
            testID="rollover-btn"
            label="Sweep to Savings"
            icon="trending-up"
            variant="accent"
            onPress={rollover}
          />
        </Card>

        {/* ── Account Balances ────────────────────────────────────── */}
        <Heading level={3} style={{ marginBottom: SPACING.sm }}>Account Balances</Heading>
        <BodyText secondary style={{ marginBottom: SPACING.md }}>
          Manually correct each bank account balance if needed.
        </BodyText>

        {accounts.map((a) => (
          <AccountBalanceRow
            key={a.key}
            account={a}
            value={balanceEdits[a.key] ?? ""}
            onChange={(v) => setBalanceEdits({ ...balanceEdits, [a.key]: v })}
            onSave={() => saveBalance(a.key)}
          />
        ))}

        <BodyText secondary small style={{ marginTop: SPACING.md, marginBottom: SPACING.lg }}>
          Account targets are auto-calculated from your category targets in the Budget tab.
        </BodyText>

        {/* ── Danger zone ─────────────────────────────────────────── */}
        <TouchableOpacity
          testID="reset-all"
          onPress={reset}
          activeOpacity={0.78}
          style={s.resetBtn}
        >
          <Feather name="trash-2" color={COLORS.negative} size={16} />
          <Text style={s.resetBtnText}>Reset All Data</Text>
        </TouchableOpacity>

        <Text style={s.footer}>Zero-Based Budget · CAD</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Nav tiles
  navRow: {
    flexDirection:  "row",
    gap:            SPACING.sm,
    marginBottom:   SPACING.base,
  },
  navTile: {
    padding:     SPACING.md,
    alignItems:  "flex-start",
  },
  navIcon: {
    width:          36,
    height:         36,
    borderRadius:   RADIUS.sm,
    alignItems:     "center",
    justifyContent: "center",
    marginBottom:   SPACING.sm,
  },
  navTitle: {
    fontFamily: FONTS.bodyBold,
    fontSize:   14,
    color:      COLORS.textPrimary,
  },

  // Period pills
  periodRow: {
    flexDirection: "row",
    gap:           6,
    marginBottom:  SPACING.md,
  },
  periodPill: {
    flex:           1,
    paddingVertical: 8,
    borderRadius:   RADIUS.full,
    borderWidth:    1,
    alignItems:     "center",
    minHeight:      36,
    justifyContent: "center",
  },
  periodPillText: {
    fontFamily:    FONTS.bodyBold,
    fontSize:      11,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },

  // Chart
  chartBars: {
    flexDirection:  "row",
    alignItems:     "flex-end",
    height:         120,
    gap:            6,
  },
  chartCol: {
    flex:       1,
    alignItems: "center",
  },
  barPair: {
    flexDirection: "row",
    alignItems:    "flex-end",
    height:        110,
    gap:           2,
  },
  bar: {
    width:             12,
    borderTopLeftRadius:  4,
    borderTopRightRadius: 4,
  },
  barLabel: {
    fontFamily: FONTS.body,
    fontSize:   9,
    color:      COLORS.textTertiary,
    marginTop:  4,
  },
  legend: {
    flexDirection:  "row",
    marginTop:      SPACING.md,
    gap:            SPACING.lg,
    justifyContent: "center",
  },
  legendItem: {
    flexDirection: "row",
    alignItems:    "center",
    gap:           6,
  },
  legendDot: {
    width:        10,
    height:       10,
    borderRadius: 2,
  },
  netRow: {
    flexDirection:  "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  netMonth: {
    fontFamily: FONTS.bodyMed,
    fontSize:   13,
    color:      COLORS.textPrimary,
  },
  netValue: {
    fontFamily: FONTS.bodyBold,
    fontSize:   13,
  },

  // Account balance editor
  balanceCard: {
    padding: SPACING.md,
  },
  balanceLabel: {
    fontFamily: FONTS.bodyBold,
    fontSize:   15,
    color:      COLORS.textPrimary,
  },
  balanceInputWrap: {
    flex:            1,
    flexDirection:   "row",
    alignItems:      "center",
    borderWidth:     1,
    borderColor:     COLORS.border,
    borderRadius:    RADIUS.md,
    paddingHorizontal: SPACING.md,
    marginRight:     SPACING.sm,
    backgroundColor: COLORS.surface,
  },
  currencySymbol: {
    fontFamily:  FONTS.bodyMed,
    fontSize:    15,
    color:       COLORS.textSecondary,
    marginRight: 6,
  },
  balanceInput: {
    flex:        1,
    paddingVertical: 11,
    fontFamily:  FONTS.bodyMed,
    fontSize:    14,
    color:       COLORS.textPrimary,
  },
  setBtn: {
    paddingVertical:   11,
    paddingHorizontal: SPACING.base,
    borderRadius:      RADIUS.full,
    minWidth:          52,
    alignItems:        "center",
  },
  setBtnText: {
    color:      "#fff",
    fontFamily: FONTS.bodyBold,
    fontSize:   13,
  },

  // Danger zone
  resetBtn: {
    paddingVertical:  14,
    borderRadius:     RADIUS.full,
    borderWidth:      1,
    borderColor:      COLORS.negative,
    alignItems:       "center",
    flexDirection:    "row",
    justifyContent:   "center",
    gap:              SPACING.sm,
  },
  resetBtnText: {
    color:      COLORS.negative,
    fontFamily: FONTS.bodyBold,
    fontSize:   14,
  },

  // Footer
  footer: {
    textAlign:   "center",
    marginTop:   SPACING["2xl"],
    fontFamily:  FONTS.body,
    fontSize:    11,
    color:       COLORS.textTertiary,
    letterSpacing: 0.5,
  },
});
