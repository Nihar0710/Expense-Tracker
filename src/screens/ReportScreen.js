import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../context/ThemeContext';
import { getMonthlyReport } from '../db/database';
import { spacing, fontSize, radius, rs } from '../utils/layout';

export default function ReportScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const now = new Date();
  const [year, setYear]       = useState(now.getFullYear());
  const [month, setMonth]     = useState(now.getMonth() + 1);
  const [report, setReport]   = useState(null);
  const [prevReport, setPrev] = useState(null);

  const buildReport = useCallback(async (y, m) => {
    const rows = await getMonthlyReport(y, m);
    const expenses = rows.filter((r) => r.type === 'expense');
    const incomes  = rows.filter((r) => r.type === 'income');
    const totalExp = expenses.reduce((s, r) => s + r.amount, 0);
    const totalInc = incomes.reduce((s, r)  => s + r.amount, 0);

    // Category breakdown
    const catMap = {};
    expenses.forEach((r) => { catMap[r.category] = (catMap[r.category] || 0) + r.amount; });
    const top3 = Object.entries(catMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat, total]) => ({ cat, total }));

    // Biggest transaction
    const biggest = expenses.reduce((max, r) => (!max || r.amount > max.amount ? r : max), null);

    return { totalExp, totalInc, top3, biggest, rows };
  }, []);

  useEffect(() => {
    (async () => {
      const cur = await buildReport(year, month);
      setReport(cur);
      // Previous month
      const prevM = month === 1 ? 12 : month - 1;
      const prevY = month === 1 ? year - 1 : year;
      const prev = await buildReport(prevY, prevM);
      setPrev(prev);
    })();
  }, [year, month, buildReport]);

  const changeMonth = (delta) => {
    let m = month + delta;
    let y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1)  { m = 12; y--; }
    setMonth(m);
    setYear(y);
  };

  const handleShare = async () => {
    if (!report) return;
    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const pct = prevReport?.totalExp > 0
      ? (((report.totalExp - prevReport.totalExp) / prevReport.totalExp) * 100).toFixed(1)
      : null;
    const lines = [
      `Monthly Spending Report — ${MONTH_NAMES[month - 1]} ${year}`,
      ``,
      `Total Spending : ₹${report.totalExp.toFixed(2)}`,
      `Total Income   : ₹${report.totalInc.toFixed(2)}`,
      pct !== null ? `vs Last Month  : ${pct > 0 ? '+' : ''}${pct}%` : '',
      ``,
      `Top Categories:`,
      ...report.top3.map((t, i) => `  ${i + 1}. ${t.cat} — ₹${t.total.toFixed(2)}`),
      ``,
      report.biggest ? `Biggest Transaction: ₹${report.biggest.amount.toFixed(2)} — ${report.biggest.payee_name || report.biggest.note || report.biggest.category}` : '',
    ].filter(Boolean).join('\n');

    const path = `${FileSystem.documentDirectory}report_${year}_${month}.txt`;
    await FileSystem.writeAsStringAsync(path, lines);
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(path, { mimeType: 'text/plain', dialogTitle: 'Share report' });
    } else {
      Alert.alert('Report', lines);
    }
  };

  const MONTH_NAMES = ['January','February','March','April','May','June',
                       'July','August','September','October','November','December'];
  const pctChange = prevReport?.totalExp > 0
    ? ((report?.totalExp ?? 0) - prevReport.totalExp) / prevReport.totalExp * 100
    : null;

  const s = makeStyles(colors, insets);

  return (
    <View style={s.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        {/* Month navigator */}
        <View style={s.monthRow}>
          <TouchableOpacity onPress={() => changeMonth(-1)} style={s.monthBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={rs(22)} color={colors.text} />
          </TouchableOpacity>
          <Text style={s.monthTitle}>{MONTH_NAMES[month - 1]} {year}</Text>
          <TouchableOpacity onPress={() => changeMonth(1)} style={s.monthBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            disabled={year === now.getFullYear() && month === now.getMonth() + 1}>
            <Ionicons name="chevron-forward" size={rs(22)}
              color={year === now.getFullYear() && month === now.getMonth() + 1 ? colors.border : colors.text} />
          </TouchableOpacity>
        </View>

        {report && (
          <>
            {/* Summary cards */}
            <View style={s.cardRow}>
              <View style={[s.card, { flex: 1 }]}>
                <Text style={s.cardLabel}>Spending</Text>
                <Text style={[s.cardValue, { color: colors.danger }]}>₹{report.totalExp.toFixed(0)}</Text>
                {pctChange !== null && (
                  <Text style={[s.cardSub, { color: pctChange > 0 ? colors.danger : colors.success }]}>
                    {pctChange > 0 ? '▲' : '▼'} {Math.abs(pctChange).toFixed(1)}% vs last month
                  </Text>
                )}
              </View>
              <View style={[s.card, { flex: 1 }]}>
                <Text style={s.cardLabel}>Income</Text>
                <Text style={[s.cardValue, { color: colors.success }]}>₹{report.totalInc.toFixed(0)}</Text>
                <Text style={s.cardSub}>{report.rows.filter((r) => r.type === 'income').length} entries</Text>
              </View>
            </View>

            {/* Top categories */}
            {report.top3.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Top Categories</Text>
                {report.top3.map((t, i) => (
                  <View key={t.cat} style={s.topRow}>
                    <Text style={s.topRank}>#{i + 1}</Text>
                    <Text style={s.topCat}>{t.cat}</Text>
                    <Text style={s.topAmt}>₹{t.total.toFixed(0)}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Biggest transaction */}
            {report.biggest && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Biggest Expense</Text>
                <View style={s.bigTx}>
                  <Text style={s.bigTxName} numberOfLines={1}>
                    {report.biggest.payee_name || report.biggest.note || report.biggest.category}
                  </Text>
                  <Text style={[s.bigTxAmt, { color: colors.danger }]}>
                    ₹{report.biggest.amount.toFixed(2)}
                  </Text>
                </View>
                <Text style={s.bigTxDate}>{new Date(report.biggest.created_at).toLocaleDateString()}</Text>
              </View>
            )}

            {report.rows.length === 0 && (
              <Text style={s.empty}>No transactions recorded for this month.</Text>
            )}

            <TouchableOpacity style={s.shareBtn} onPress={handleShare}>
              <Ionicons name="share-outline" size={rs(18)} color={colors.accentText} />
              <Text style={s.shareBtnText}>Share Report</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(c, insets) {
  return StyleSheet.create({
    container:   { flex: 1, backgroundColor: c.bg, paddingTop: insets.top },
    content:     { paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xxl },
    monthRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.lg },
    monthBtn:    { padding: spacing.sm },
    monthTitle:  { fontSize: fontSize.lg, fontWeight: '700', color: c.text },
    cardRow:     { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
    card:        { backgroundColor: c.card, borderRadius: radius.lg, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    cardLabel:   { fontSize: fontSize.sm, color: c.textHint, marginBottom: spacing.xs },
    cardValue:   { fontSize: fontSize.xl, fontWeight: '700' },
    cardSub:     { fontSize: fontSize.xs, marginTop: spacing.xs },
    section:     { backgroundColor: c.card, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border },
    sectionTitle:{ fontSize: fontSize.base, fontWeight: '700', color: c.text, marginBottom: spacing.md },
    topRow:      { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
    topRank:     { fontSize: fontSize.sm, color: c.textHint, width: rs(28) },
    topCat:      { flex: 1, fontSize: fontSize.md, color: c.text },
    topAmt:      { fontSize: fontSize.md, fontWeight: '600', color: c.danger },
    bigTx:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    bigTxName:   { fontSize: fontSize.md, fontWeight: '600', color: c.text, flex: 1 },
    bigTxAmt:    { fontSize: fontSize.lg, fontWeight: '700' },
    bigTxDate:   { fontSize: fontSize.xs, color: c.textHint, marginTop: spacing.xs },
    empty:       { textAlign: 'center', color: c.textHint, marginTop: spacing.xxl * 2 },
    shareBtn:    { backgroundColor: c.accent, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.lg, marginTop: spacing.lg, minHeight: rs(54) },
    shareBtnText:{ color: c.accentText, fontWeight: '700', fontSize: fontSize.base },
  });
}
