import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { useTheme } from '../context/ThemeContext';
import { getMonthlyReport } from '../db/database';
import { spacing, fontSize, radius, rs } from '../utils/layout';

// Safe-load ViewShot — may not be available in all envs
let ViewShot = null;
try { ViewShot = require('react-native-view-shot').default; } catch (_) {}

const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];

export default function RecapScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const viewRef = useRef(null);
  const now = new Date();
  const [year, setYear]     = useState(now.getFullYear());
  const [month, setMonth]   = useState(now.getMonth() + 1);
  const [data, setData]     = useState(null);
  const [prev, setPrev]     = useState(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    (async () => {
      const rows = await getMonthlyReport(year, month);
      const prevM = month === 1 ? 12 : month - 1;
      const prevY = month === 1 ? year - 1 : year;
      const prevRows = await getMonthlyReport(prevY, prevM);
      setData(buildReport(rows));
      setPrev(buildReport(prevRows));
    })();
  }, [year, month]);

  const changeMonth = (delta) => {
    let m = month + delta, y = year;
    if (m > 12) { m = 1; y++; }
    if (m < 1) { m = 12; y--; }
    setMonth(m); setYear(y);
  };

  const handleShare = async () => {
    if (!ViewShot || !viewRef.current) {
      Alert.alert('Not available', 'react-native-view-shot is not available in Expo Go. Use a dev build.');
      return;
    }
    setSharing(true);
    try {
      const uri = await viewRef.current.capture();
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share recap' });
      }
    } catch (e) {
      Alert.alert('Share failed', e.message);
    } finally {
      setSharing(false);
    }
  };

  const pct = prev?.totalExp > 0 && data?.totalExp != null
    ? ((data.totalExp - prev.totalExp) / prev.totalExp * 100).toFixed(1)
    : null;

  const s = makeStyles(colors, insets);
  const CardContent = () => (
    <View style={s.card}>
      <Text style={s.cardMonth}>{MONTH_NAMES[month - 1]} {year}</Text>
      <Text style={s.cardLabel}>Total spent</Text>
      <Text style={[s.cardBig, { color: colors.danger }]}>₹{(data?.totalExp ?? 0).toFixed(0)}</Text>
      {pct !== null && (
        <Text style={[s.cardPct, { color: Number(pct) > 0 ? colors.danger : colors.success }]}>
          {Number(pct) > 0 ? '▲' : '▼'} {Math.abs(pct)}% vs last month
        </Text>
      )}
      {data?.top3?.[0] && (
        <View style={s.topRow}>
          <Text style={s.topLabel}>Top category</Text>
          <Text style={s.topValue}>{data.top3[0].cat} · ₹{data.top3[0].total.toFixed(0)}</Text>
        </View>
      )}
      {data?.biggest && (
        <View style={s.topRow}>
          <Text style={s.topLabel}>Biggest expense</Text>
          <Text style={s.topValue} numberOfLines={1}>
            {data.biggest.payee_name || data.biggest.note || data.biggest.category} · ₹{data.biggest.amount.toFixed(0)}
          </Text>
        </View>
      )}
      <Text style={s.cardFooter}>Expense Tracker</Text>
    </View>
  );

  return (
    <View style={s.container}>
      {/* Month nav */}
      <View style={s.monthRow}>
        <TouchableOpacity onPress={() => changeMonth(-1)} style={s.monthBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={rs(22)} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.monthTitle}>{MONTH_NAMES[month - 1]} {year}</Text>
        <TouchableOpacity onPress={() => changeMonth(1)} style={s.monthBtn}
          disabled={year === now.getFullYear() && month === now.getMonth() + 1}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-forward" size={rs(22)}
            color={year === now.getFullYear() && month === now.getMonth() + 1 ? colors.border : colors.text} />
        </TouchableOpacity>
      </View>

      {/* Preview card */}
      {ViewShot ? (
        <ViewShot ref={viewRef} options={{ format: 'png', quality: 0.95 }} style={{ alignSelf: 'center' }}>
          <CardContent />
        </ViewShot>
      ) : (
        <View style={{ alignSelf: 'center' }}>
          <CardContent />
        </View>
      )}

      <TouchableOpacity style={s.shareBtn} onPress={handleShare} disabled={sharing}>
        {sharing
          ? <ActivityIndicator color={colors.accentText} />
          : <>
              <Ionicons name="share-outline" size={rs(18)} color={colors.accentText} />
              <Text style={s.shareBtnText}>Share recap card</Text>
            </>
        }
      </TouchableOpacity>

      {!ViewShot && (
        <Text style={s.hint}>📌 Image capture requires a dev build — sharing text works in Expo Go.</Text>
      )}
    </View>
  );
}

function buildReport(rows) {
  const expenses = rows.filter((r) => r.type === 'expense');
  const totalExp = expenses.reduce((s, r) => s + r.amount, 0);
  const catMap = {};
  expenses.forEach((r) => { catMap[r.category] = (catMap[r.category] || 0) + r.amount; });
  const top3 = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([cat, total]) => ({ cat, total }));
  const biggest = expenses.reduce((max, r) => (!max || r.amount > max.amount ? r : max), null);
  return { totalExp, top3, biggest };
}

function makeStyles(c, insets) {
  return StyleSheet.create({
    container:    { flex: 1, backgroundColor: c.bg, paddingTop: insets.top, paddingHorizontal: spacing.lg },
    monthRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.lg },
    monthBtn:     { padding: spacing.sm },
    monthTitle:   { fontSize: fontSize.lg, fontWeight: '700', color: c.text },
    card:         {
      width: rs(300), backgroundColor: c.accent, borderRadius: radius.xl,
      padding: spacing.xxl, marginVertical: spacing.lg,
    },
    cardMonth:    { fontSize: fontSize.sm, color: c.accentText + 'AA', marginBottom: spacing.sm },
    cardLabel:    { fontSize: fontSize.xs, color: c.accentText + 'AA' },
    cardBig:      { fontSize: rs(42), fontWeight: '700', color: '#fff', marginVertical: spacing.sm },
    cardPct:      { fontSize: fontSize.sm, fontWeight: '600', marginBottom: spacing.lg },
    topRow:       { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.accentText + '33', paddingTop: spacing.sm, marginTop: spacing.sm },
    topLabel:     { fontSize: fontSize.xs, color: c.accentText + 'AA' },
    topValue:     { fontSize: fontSize.sm, color: c.accentText, fontWeight: '600', marginTop: 2 },
    cardFooter:   { fontSize: fontSize.xs, color: c.accentText + '66', textAlign: 'right', marginTop: spacing.lg },
    shareBtn:     { backgroundColor: c.accent, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.lg, minHeight: rs(54), marginTop: spacing.sm },
    shareBtnText: { color: c.accentText, fontWeight: '700', fontSize: fontSize.base },
    hint:         { fontSize: fontSize.xs, color: c.textHint, textAlign: 'center', marginTop: spacing.md },
  });
}
